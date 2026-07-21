import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { verifyToken, bearerToken } from "../_session"
import { getBusinessConfig } from "@/lib/ordersBusinessConfig"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET (Authorization: Bearer <token>) -> toda la info del residente:
// perfil, sus unidades, y para esas unidades: cargos, pagos y recibos.
export async function GET(request: NextRequest) {
  try {
    const residentId = verifyToken(bearerToken(request))
    if (!residentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    const supabase = getSupabaseAdmin()

    const { data: resident, error } = await supabase
      .from("residents")
      .select("id, branch_id, full_name, document_type, document_number, phone, email")
      .eq("id", residentId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!resident) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { data: links } = await supabase
      .from("unit_residents")
      .select("id, role, is_primary, receives_billing, unit_id, units(id, code, tower, floor, area_m2, alicuota, balance, status)")
      .eq("resident_id", residentId)

    const unitIds = (links ?? []).map((l) => l.unit_id).filter(Boolean) as string[]

    let charges: unknown[] = []
    let payments: unknown[] = []
    let receipts: unknown[] = []
    if (unitIds.length) {
      const [c, p, r] = await Promise.all([
        supabase.from("charges").select("id, unit_id, concept, description, amount, amount_paid, status, due_date, created_at").in("unit_id", unitIds).order("created_at", { ascending: false }).limit(100),
        supabase.from("payments").select("id, unit_id, amount, amount_local, method, reference, status, paid_on, created_at").in("unit_id", unitIds).order("created_at", { ascending: false }).limit(100),
        supabase.from("receipts").select("id, unit_id, number, previous_balance, charges_total, payments_total, new_balance, status, issued_at").in("unit_id", unitIds).order("issued_at", { ascending: false }).limit(60),
      ])
      charges = c.data ?? []
      payments = p.data ?? []
      receipts = r.data ?? []
    }

    // Mientras el negocio no esté fiscalizado, sus recibos son no fiscales.
    let nonFiscal = true
    try {
      const bc = await getBusinessConfig()
      nonFiscal = bc.fiscalEnabled !== true
    } catch { /* por defecto, no fiscal */ }

    return NextResponse.json({ ok: true, resident, units: links ?? [], charges, payments, receipts, nonFiscal })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la cuenta" },
      { status: 500 },
    )
  }
}
