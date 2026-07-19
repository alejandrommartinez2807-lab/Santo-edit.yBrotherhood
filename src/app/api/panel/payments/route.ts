import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }
function round2(n: number) { return Math.round(n * 100) / 100 }

// GET: unidades con saldo + pagos recientes (incluye reportados por residentes).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, units: [], payments: [] })
    const supabase = getSupabaseAdmin()
    const [u, p] = await Promise.all([
      supabase.from("units").select("id, code, tower, balance, status").eq("branch_id", branchId).order("code"),
      supabase.from("payments").select("id, unit_id, amount, method, reference, status, paid_on, created_at").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(80),
    ])
    if (u.error) throw new Error(u.error.message)
    return NextResponse.json({ ok: true, units: u.data ?? [], payments: p.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// Aplica un monto a los cargos pendientes de una unidad (FIFO) y devuelve las
// asignaciones creadas. Actualiza amount_paid/status de cada cargo.
async function allocatePayment(branchId: string, unitId: string, paymentId: string, amount: number) {
  const supabase = getSupabaseAdmin()
  const { data: charges } = await supabase
    .from("charges")
    .select("id, amount, amount_paid")
    .eq("branch_id", branchId)
    .eq("unit_id", unitId)
    .neq("status", "anulado")
    .order("created_at", { ascending: true })
  let left = amount
  for (const c of (charges ?? []) as { id: string; amount: number; amount_paid: number }[]) {
    if (left <= 0) break
    const pending = round2(Number(c.amount) - Number(c.amount_paid || 0))
    if (pending <= 0) continue
    const apply = round2(Math.min(pending, left))
    const newPaid = round2(Number(c.amount_paid || 0) + apply)
    await supabase.from("payment_allocations").insert({ branch_id: branchId, payment_id: paymentId, charge_id: c.id, amount: apply })
    await supabase.from("charges").update({ amount_paid: newPaid, status: newPaid >= Number(c.amount) ? "pagado" : "parcial" }).eq("id", c.id)
    left = round2(left - apply)
  }
}

async function applyToBalance(branchId: string, unitId: string, delta: number) {
  const supabase = getSupabaseAdmin()
  const { data: unit } = await supabase.from("units").select("balance").eq("id", unitId).maybeSingle()
  const newBal = round2(Number(unit?.balance || 0) + delta)
  await supabase.from("units").update({ balance: newBal }).eq("id", unitId)
}

// POST { action:"register"|"confirm"|"reject", ... }
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = text(body.action)
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (action === "register") {
      const unitId = text(body.unitId)
      const amount = round2(num(body.amount))
      if (!unitId || amount <= 0) return NextResponse.json({ error: "Falta unidad o monto" }, { status: 400 })
      const { data: pay, error } = await supabase.from("payments").insert({
        branch_id: branchId, unit_id: unitId, amount, amount_local: round2(num(body.amountLocal)),
        method: text(body.method) || "transferencia", reference: text(body.reference), paid_on: text(body.paidOn) || new Date().toISOString().slice(0, 10),
        status: "confirmado", reviewed_at: new Date().toISOString(),
      }).select("id").maybeSingle()
      if (error) throw new Error(error.message)
      await allocatePayment(branchId, unitId, pay!.id as string, amount)
      await applyToBalance(branchId, unitId, -amount)
      return NextResponse.json({ ok: true, paymentId: pay!.id })
    }

    if (action === "confirm" || action === "reject") {
      const paymentId = text(body.paymentId)
      if (!paymentId) return NextResponse.json({ error: "Falta el pago" }, { status: 400 })
      const { data: pay } = await supabase.from("payments").select("id, unit_id, amount, status").eq("id", paymentId).eq("branch_id", branchId).maybeSingle()
      if (!pay) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
      if (pay.status !== "reportado") return NextResponse.json({ error: "Ese pago ya fue procesado" }, { status: 409 })
      if (action === "reject") {
        await supabase.from("payments").update({ status: "rechazado", reviewed_at: new Date().toISOString(), reject_reason: text(body.reason) }).eq("id", paymentId)
        return NextResponse.json({ ok: true })
      }
      await supabase.from("payments").update({ status: "confirmado", reviewed_at: new Date().toISOString() }).eq("id", paymentId)
      await allocatePayment(branchId, pay.unit_id as string, paymentId, round2(Number(pay.amount)))
      await applyToBalance(branchId, pay.unit_id as string, -round2(Number(pay.amount)))
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el pago" }, { status: 500 })
  }
}
