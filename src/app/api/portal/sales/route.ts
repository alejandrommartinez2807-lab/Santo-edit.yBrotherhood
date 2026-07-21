import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { verifyToken, bearerToken } from "../_session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }

// "2026-07" o "2026-07-15" -> "2026-07-01" (las ventas son por mes calendario).
function normalizeMonth(v: unknown): string {
  const m = text(v).match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-01` : ""
}

// Locales del comerciante autenticado (vía unit_residents, igual que microsite).
async function ownedUnitIds(supabase: ReturnType<typeof getSupabaseAdmin>, residentId: string) {
  const { data } = await supabase.from("unit_residents").select("unit_id").eq("resident_id", residentId)
  return (data ?? []).map((l) => l.unit_id).filter(Boolean) as string[]
}

// GET: contratos con renta porcentual del comerciante + sus ventas reportadas
// (últimos 12 meses) para que reporte él mismo desde /mi-cuenta.
export async function GET(request: NextRequest) {
  try {
    const residentId = verifyToken(bearerToken(request))
    if (!residentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    const supabase = getSupabaseAdmin()
    const unitIds = await ownedUnitIds(supabase, residentId)
    if (!unitIds.length) return NextResponse.json({ ok: true, leases: [], sales: [] })

    const { data: leases, error } = await supabase
      .from("leases")
      .select("id, unit_id, percentage_rent_rate, percentage_rent_min, units(code, commercial_name)")
      .in("unit_id", unitIds)
      .eq("status", "activo")
      .eq("percentage_rent", true)
    if (error) throw new Error(error.message)
    const leaseIds = (leases ?? []).map((l) => l.id)
    let sales: unknown[] = []
    if (leaseIds.length) {
      const { data } = await supabase
        .from("lease_sales")
        .select("id, lease_id, unit_id, period_month, gross_sales, currency, source")
        .in("lease_id", leaseIds)
        .order("period_month", { ascending: false })
        .limit(12 * leaseIds.length)
      sales = data ?? []
    }
    return NextResponse.json({ ok: true, leases: leases ?? [], sales })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar" }, { status: 500 })
  }
}

// POST { leaseId, periodMonth, grossSales } : el comerciante reporta las ventas
// brutas de SU local para el mes. La renta porcentual del cobro mensual las lee
// de lease_sales. Un registro que ya vino del POS no se pisa a mano.
export async function POST(request: NextRequest) {
  try {
    const residentId = verifyToken(bearerToken(request))
    if (!residentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const leaseId = text(body.leaseId)
    const periodMonth = normalizeMonth(body.periodMonth)
    const grossSales = num(body.grossSales, -1)
    if (!leaseId || !periodMonth) return NextResponse.json({ error: "Faltan datos (contrato o mes)" }, { status: 400 })
    if (grossSales < 0) return NextResponse.json({ error: "Escribe el monto de ventas del mes" }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const unitIds = await ownedUnitIds(supabase, residentId)
    const { data: lease } = await supabase
      .from("leases")
      .select("id, unit_id, branch_id, status, percentage_rent")
      .eq("id", leaseId)
      .maybeSingle()
    if (!lease || !unitIds.includes(lease.unit_id)) {
      return NextResponse.json({ error: "Ese contrato no es tuyo" }, { status: 403 })
    }
    if (lease.status !== "activo" || !lease.percentage_rent) {
      return NextResponse.json({ error: "El contrato no tiene renta porcentual activa" }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from("lease_sales")
      .select("id, source")
      .eq("lease_id", leaseId)
      .eq("period_month", periodMonth)
      .maybeSingle()
    if (existing?.source === "pos") {
      return NextResponse.json({ error: "Ese mes ya lo registró el sistema de ventas (POS); no se puede editar a mano." }, { status: 409 })
    }
    const row = {
      branch_id: lease.branch_id,
      lease_id: leaseId,
      unit_id: lease.unit_id,
      period_month: periodMonth,
      gross_sales: grossSales,
      currency: "USD",
      source: "reportado",
      reported_by: "comerciante",
    }
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
