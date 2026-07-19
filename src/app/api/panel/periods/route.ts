import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }
function round2(n: number) { return Math.round(n * 100) / 100 }

// GET: períodos del condominio.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, periods: [] })
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("fee_periods")
      .select("*")
      .eq("branch_id", branchId)
      .order("period_month", { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, periods: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST { action:"emit", label, periodMonth, commonExpenseTotal, dueDate }
// Emite las cuotas del período: prorratea el gasto común por alícuota, crea un
// cargo (cuota_ordinaria) y un recibo por unidad, y actualiza el saldo.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (text(body.action) !== "emit") return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    const periodMonth = text(body.periodMonth) || new Date().toISOString().slice(0, 10)
    const label = text(body.label) || periodMonth.slice(0, 7)
    const commonExpenseTotal = num(body.commonExpenseTotal)
    const dueDate = text(body.dueDate) || null

    // Evita doble emisión del mismo mes.
    const { data: existing } = await supabase.from("fee_periods").select("id, status").eq("branch_id", branchId).eq("period_month", periodMonth).maybeSingle()
    if (existing && existing.status === "emitido") {
      return NextResponse.json({ error: "Ese período ya fue emitido" }, { status: 409 })
    }

    // Período
    let periodId = existing?.id as string | undefined
    if (periodId) {
      await supabase.from("fee_periods").update({ label, status: "emitido", issued_at: new Date().toISOString(), due_date: dueDate, common_expense_total: commonExpenseTotal }).eq("id", periodId)
    } else {
      const { data: p, error: pe } = await supabase.from("fee_periods").insert({ branch_id: branchId, label, period_month: periodMonth, status: "emitido", issued_at: new Date().toISOString(), due_date: dueDate, common_expense_total: commonExpenseTotal }).select("id").maybeSingle()
      if (pe) throw new Error(pe.message)
      periodId = p?.id
    }

    // Contratos activos: canon mensual por local (para cobrarlo junto al condominio).
    const { data: leaseRows } = await supabase
      .from("leases")
      .select("unit_id, canon_amount, condo_included")
      .eq("branch_id", branchId)
      .eq("status", "activo")
    const leaseByUnit = new Map<string, { canon: number; condoIncluded: boolean }>()
    for (const l of (leaseRows ?? []) as { unit_id: string; canon_amount: number | null; condo_included: boolean | null }[]) {
      if (l.unit_id) leaseByUnit.set(l.unit_id, { canon: num(l.canon_amount), condoIncluded: !!l.condo_included })
    }

    // Locales a cobrar: ocupados o con contrato activo. Se excluyen los
    // disponibles, en mantenimiento e inactivos (y el legado desocupada/inactiva).
    const { data: units, error: ue } = await supabase.from("units").select("id, alicuota, balance, status").eq("branch_id", branchId)
    if (ue) throw new Error(ue.message)
    const OCCUPIED = new Set(["ocupado", "reservado", "activa"])
    const list = ((units ?? []) as { id: string; alicuota: number | null; balance: number | null; status: string }[])
      .filter((u) => leaseByUnit.has(u.id) || OCCUPIED.has(u.status))
    if (!list.length) return NextResponse.json({ error: "No hay locales ocupados ni contratos activos para emitir" }, { status: 400 })

    // Correlativo de recibo
    const { data: lastReceipt } = await supabase.from("receipts").select("number").eq("branch_id", branchId).order("number", { ascending: false }).limit(1).maybeSingle()
    let nextNumber = (num(lastReceipt?.number) || 0) + 1

    const charges: Record<string, unknown>[] = []
    const receipts: Record<string, unknown>[] = []
    const balanceUpdates: { id: string; balance: number }[] = []
    let totalEmitted = 0

    for (const u of list) {
      const lease = leaseByUnit.get(u.id)
      // Condominio por alícuota (salvo que el canon ya lo incluya).
      const condoAmount = lease?.condoIncluded ? 0 : round2(commonExpenseTotal * Number(u.alicuota || 0))
      // Canon de arrendamiento (si tiene contrato activo).
      const canonAmount = lease ? round2(lease.canon) : 0
      const total = round2(condoAmount + canonAmount)
      if (total <= 0) continue
      const prev = round2(Number(u.balance || 0))
      const newBal = round2(prev + total)
      if (condoAmount > 0) {
        charges.push({ branch_id: branchId, unit_id: u.id, period_id: periodId, concept: "cuota_ordinaria", description: `Condominio ${label}`, amount: condoAmount, amount_paid: 0, alicuota_used: u.alicuota, due_date: dueDate, status: "pendiente" })
      }
      if (canonAmount > 0) {
        charges.push({ branch_id: branchId, unit_id: u.id, period_id: periodId, concept: "canon_arrendamiento", description: `Canon ${label}`, amount: canonAmount, amount_paid: 0, alicuota_used: null, due_date: dueDate, status: "pendiente" })
      }
      receipts.push({ branch_id: branchId, unit_id: u.id, period_id: periodId, number: nextNumber++, previous_balance: prev, charges_total: total, payments_total: 0, new_balance: newBal, status: "emitido" })
      balanceUpdates.push({ id: u.id, balance: newBal })
      totalEmitted = round2(totalEmitted + total)
    }

    if (charges.length) {
      const { error: ce } = await supabase.from("charges").insert(charges)
      if (ce) throw new Error(ce.message)
      const { error: re } = await supabase.from("receipts").insert(receipts)
      if (re) throw new Error(re.message)
      for (const b of balanceUpdates) {
        await supabase.from("units").update({ balance: b.balance }).eq("id", b.id)
      }
    }

    return NextResponse.json({ ok: true, periodId, unitsEmitted: receipts.length, totalEmitted })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo emitir" }, { status: 500 })
  }
}
