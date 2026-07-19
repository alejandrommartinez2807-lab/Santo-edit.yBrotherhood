import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }

// GET ?month=YYYY-MM-01 : contratos con renta porcentual + ventas ya reportadas
// del mes (para que la administración las cargue/edite).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, leases: [], sales: [] })
    const url = new URL(request.url)
    const month = text(url.searchParams.get("month")) || new Date().toISOString().slice(0, 8) + "01"
    const supabase = getSupabaseAdmin()
    const [leasesRes, salesRes] = await Promise.all([
      supabase
        .from("leases")
        .select("id, unit_id, percentage_rent_rate, percentage_rent_min, units(code, commercial_name)")
        .eq("branch_id", branchId)
        .eq("status", "activo")
        .eq("percentage_rent", true),
      supabase
        .from("lease_sales")
        .select("*")
        .eq("branch_id", branchId)
        .eq("period_month", month),
    ])
    if (leasesRes.error) throw new Error(leasesRes.error.message)
    return NextResponse.json({ ok: true, month, leases: leasesRes.data ?? [], sales: salesRes.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST { leaseId, unitId, periodMonth, grossSales, currency? } : upsert de ventas.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin centro comercial" }, { status: 400 })
    const leaseId = text(body.leaseId)
    const unitId = text(body.unitId)
    const periodMonth = text(body.periodMonth)
    if (!leaseId || !unitId || !periodMonth) return NextResponse.json({ error: "Faltan datos (contrato, local o mes)" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    const row = {
      branch_id: branchId,
      lease_id: leaseId,
      unit_id: unitId,
      period_month: periodMonth,
      gross_sales: num(body.grossSales),
      currency: text(body.currency) || "USD",
      source: "reportado",
      reported_by: access.role,
    }
    const { data: existing } = await supabase
      .from("lease_sales")
      .select("id")
      .eq("branch_id", branchId)
      .eq("lease_id", leaseId)
      .eq("period_month", periodMonth)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await supabase.from("lease_sales").update(row).eq("id", existing.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, updated: true })
    }
    const { error } = await supabase.from("lease_sales").insert(row)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, created: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 500 })
  }
}
