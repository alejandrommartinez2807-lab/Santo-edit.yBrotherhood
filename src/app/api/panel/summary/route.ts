import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Resumen del tablero: conteos y chequeo de alícuota (debe sumar ~1 = 100 %).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) {
      return NextResponse.json({ ok: true, unitsCount: 0, residentsCount: 0, alicuotaSum: 0, balanceDue: 0 })
    }
    const supabase = getSupabaseAdmin()
    const [units, residentsCount] = await Promise.all([
      supabase.from("units").select("alicuota, balance").eq("branch_id", branchId),
      supabase.from("residents").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    ])
    if (units.error) throw new Error(units.error.message)
    const rows = (units.data ?? []) as { alicuota: number | null; balance: number | null }[]
    const alicuotaSum = rows.reduce((s, r) => s + Number(r.alicuota || 0), 0)
    const balanceDue = rows.reduce((s, r) => s + Math.max(0, Number(r.balance || 0)), 0)
    return NextResponse.json({
      ok: true,
      unitsCount: rows.length,
      residentsCount: residentsCount.count ?? 0,
      alicuotaSum,
      balanceDue,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el resumen" },
      { status: 500 },
    )
  }
}
