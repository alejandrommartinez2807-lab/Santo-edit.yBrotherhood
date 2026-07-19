import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }
function int(v: unknown, f = 0) { return Math.trunc(num(v, f)) }

export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, customers: [], transactions: [] })
    const supabase = getSupabaseAdmin()
    const [custRes, txRes] = await Promise.all([
      supabase.from("loyalty_customers").select("*").eq("branch_id", branchId).order("points", { ascending: false }).limit(500),
      supabase.from("loyalty_transactions").select("*, loyalty_customers(full_name)").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(100),
    ])
    if (custRes.error) throw new Error(custRes.error.message)
    return NextResponse.json({ ok: true, customers: custRes.data ?? [], transactions: txRes.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin centro comercial" }, { status: 400 })
    const supabase = getSupabaseAdmin()
    const action = text(body.action)

    if (action === "customer") {
      const name = text(body.fullName)
      const phone = text(body.phone)
      if (!name || !phone) return NextResponse.json({ error: "Nombre y teléfono son obligatorios" }, { status: 400 })
      const row = { branch_id: branchId, full_name: name, phone, email: text(body.email), document: text(body.document), tier: text(body.tier) || "general", active: body.active === undefined ? true : !!body.active }
      if (body.id) {
        const { error } = await supabase.from("loyalty_customers").update(row).eq("id", body.id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      const { error } = await supabase.from("loyalty_customers").insert(row)
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate")) return NextResponse.json({ error: "Ya existe un cliente con ese teléfono" }, { status: 409 })
        throw new Error(error.message)
      }
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    if (action === "points") {
      // Acumula (kind compra/bono/ajuste, points>0) o canjea (points<0).
      const customerId = text(body.customerId)
      const points = int(body.points)
      if (!customerId || !points) return NextResponse.json({ error: "Faltan cliente o puntos" }, { status: 400 })
      const { data: cust } = await supabase.from("loyalty_customers").select("points").eq("id", customerId).eq("branch_id", branchId).maybeSingle()
      if (!cust) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
      const newBal = Math.max(0, num(cust.points) + points)
      const { error: te } = await supabase.from("loyalty_transactions").insert({
        branch_id: branchId, customer_id: customerId, points, kind: text(body.kind) || (points > 0 ? "compra" : "canje"),
        amount: num(body.amount), note: text(body.note), created_by: access.role,
      })
      if (te) throw new Error(te.message)
      const { error: ue } = await supabase.from("loyalty_customers").update({ points: newBal }).eq("id", customerId).eq("branch_id", branchId)
      if (ue) throw new Error(ue.message)
      return NextResponse.json({ ok: true, points: newBal })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
