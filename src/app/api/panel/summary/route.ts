import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { getBusinessConfig } from "@/lib/ordersBusinessConfig"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function round2(n: number) { return Math.round(n * 100) / 100 }
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso + "T00:00:00").getTime()
  if (!Number.isFinite(d)) return null
  return Math.ceil((d - Date.now()) / 86400000)
}

// Tablero gerencial: ocupación de locales, morosidad, contratos por vencer e
// ingresos del mes por fuente (canon, condominio, renta %, estacionamiento,
// publicidad). Todo del centro comercial actual.
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) {
      return NextResponse.json({ ok: true, unitsCount: 0, residentsCount: 0, alicuotaSum: 0, balanceDue: 0 })
    }
    const supabase = getSupabaseAdmin()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [units, residentsCount, leasesRes, chargesRes, parkingRes, adsRes] = await Promise.all([
      supabase.from("units").select("status, alicuota, balance").eq("branch_id", branchId),
      supabase.from("residents").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
      supabase.from("leases").select("status, ends_on").eq("branch_id", branchId),
      supabase.from("charges").select("concept, amount, created_at").eq("branch_id", branchId).gte("created_at", monthStart),
      supabase.from("parking_tickets").select("amount, status, paid_at").eq("branch_id", branchId).eq("status", "pagado").gte("paid_at", monthStart),
      supabase.from("ad_bookings").select("price, status").eq("branch_id", branchId).eq("status", "activo"),
    ])
    if (units.error) throw new Error(units.error.message)

    const rows = (units.data ?? []) as { status: string; alicuota: number | null; balance: number | null }[]
    const alicuotaSum = rows.reduce((s, r) => s + Number(r.alicuota || 0), 0)
    const balanceDue = round2(rows.reduce((s, r) => s + Math.max(0, Number(r.balance || 0)), 0))
    const occupied = rows.filter((r) => r.status === "ocupado").length
    const available = rows.filter((r) => r.status === "disponible").length
    const delinquent = rows.filter((r) => Number(r.balance || 0) > 0).length

    const leases = (leasesRes.data ?? []) as { status: string; ends_on: string | null }[]
    const leasesActive = leases.filter((l) => l.status === "activo").length
    const leasesExpiring = leases.filter((l) => {
      const du = daysUntil(l.ends_on)
      return l.status === "activo" && du !== null && du >= 0 && du <= 60
    }).length

    // Ingresos del mes por fuente
    const charges = (chargesRes.data ?? []) as { concept: string; amount: number | null }[]
    let canonMonth = 0, condoMonth = 0, pctMonth = 0
    for (const c of charges) {
      const a = Number(c.amount || 0)
      if (c.concept === "canon_arrendamiento") canonMonth += a
      else if (c.concept === "renta_porcentual") pctMonth += a
      else if (c.concept === "cuota_ordinaria" || c.concept === "cuota_extraordinaria") condoMonth += a
    }
    const parkingMonth = ((parkingRes.data ?? []) as { amount: number | null }[]).reduce((s, p) => s + Number(p.amount || 0), 0)
    const adsMonth = ((adsRes.data ?? []) as { price: number | null }[]).reduce((s, a) => s + Number(a.price || 0), 0)

    const incomeMonth = round2(canonMonth + condoMonth + pctMonth + parkingMonth + adsMonth)

    // Alícuotas opcionales: el resumen oculta la validación del 100% si están apagadas.
    let alicuotaEnabled = true
    try { alicuotaEnabled = (await getBusinessConfig()).alicuotaEnabled !== false } catch {}

    return NextResponse.json({
      ok: true,
      unitsCount: rows.length,
      occupied,
      available,
      delinquent,
      residentsCount: residentsCount.count ?? 0,
      alicuotaSum,
      alicuotaEnabled,
      balanceDue,
      leasesActive,
      leasesExpiring,
      income: {
        canon: round2(canonMonth),
        condominio: round2(condoMonth),
        renta_pct: round2(pctMonth),
        estacionamiento: round2(parkingMonth),
        publicidad: round2(adsMonth),
        total: incomeMonth,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el resumen" },
      { status: 500 },
    )
  }
}
