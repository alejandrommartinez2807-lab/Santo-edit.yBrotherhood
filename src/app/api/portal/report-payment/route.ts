import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST (Bearer): el residente reporta un pago -> queda 'reportado' para que la
// administración lo confirme en Estado de cuenta.
export async function POST(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const unitId = String(body.unitId ?? "").trim()
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100
    if (!ctx.unitIds.includes(unitId)) return NextResponse.json({ error: "Unidad no válida" }, { status: 400 })
    if (amount <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
    const { error } = await ctx.supabase.from("payments").insert({
      branch_id: ctx.branchId, unit_id: unitId, resident_id: ctx.residentId,
      amount, amount_local: Math.round((Number(body.amountLocal) || 0) * 100) / 100,
      method: String(body.method ?? "transferencia").trim(), reference: String(body.reference ?? "").trim(),
      proof_url: String(body.proofUrl ?? "").trim(), paid_on: new Date().toISOString().slice(0, 10),
      status: "reportado",
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reportar" }, { status: 500 })
  }
}
