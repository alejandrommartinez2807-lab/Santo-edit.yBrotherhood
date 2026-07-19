import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function round2(n: number) { return Math.round(n * 100) / 100 }

// GET (Bearer): mis reservas.
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data } = await ctx.supabase
    .from("amenity_reservations")
    .select("id, reservation_date, start_time, end_time, status, fee_amount, amenities(name)")
    .eq("resident_id", ctx.residentId)
    .order("reservation_date", { ascending: false })
    .limit(50)
  return NextResponse.json({ ok: true, reservations: data ?? [] })
}

// POST (Bearer): crear reserva. Valida solape y, si la amenidad tiene costo,
// genera el cargo a la unidad.
export async function POST(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const amenityId = text(body.amenityId)
    const unitId = text(body.unitId) || ctx.unitIds[0]
    const date = text(body.date)
    const start = text(body.startTime)
    const end = text(body.endTime) || start
    if (!amenityId || !date || !start) return NextResponse.json({ error: "Faltan datos de la reserva" }, { status: 400 })
    if (unitId && !ctx.unitIds.includes(unitId)) return NextResponse.json({ error: "Unidad no válida" }, { status: 400 })

    const { data: amenity } = await ctx.supabase.from("amenities").select("id, name, fee, requires_approval").eq("id", amenityId).eq("branch_id", ctx.branchId).maybeSingle()
    if (!amenity) return NextResponse.json({ error: "Área no encontrada" }, { status: 404 })

    // Solape: misma amenidad, misma fecha, franja que se cruza, no cancelada/rechazada.
    const { data: sameDay } = await ctx.supabase.from("amenity_reservations").select("start_time, end_time, status").eq("amenity_id", amenityId).eq("reservation_date", date).in("status", ["pendiente", "confirmada"])
    const overlaps = (sameDay ?? []).some((r) => start < (r.end_time || "23:59") && end > (r.start_time || "00:00"))
    if (overlaps) return NextResponse.json({ error: "Ya hay una reserva en ese horario" }, { status: 409 })

    const fee = round2(Number(amenity.fee || 0))
    const status = amenity.requires_approval ? "pendiente" : "confirmada"

    // Cargo por uso (si tiene costo y queda confirmada).
    let chargeId: string | null = null
    if (fee > 0 && unitId && status === "confirmada") {
      const { data: charge } = await ctx.supabase.from("charges").insert({ branch_id: ctx.branchId, unit_id: unitId, concept: "reserva_amenidad", description: `Reserva ${amenity.name} ${date}`, amount: fee, status: "pendiente" }).select("id").maybeSingle()
      chargeId = (charge?.id as string) || null
      const { data: u } = await ctx.supabase.from("units").select("balance").eq("id", unitId).maybeSingle()
      await ctx.supabase.from("units").update({ balance: round2(Number(u?.balance || 0) + fee) }).eq("id", unitId)
    }

    const { error } = await ctx.supabase.from("amenity_reservations").insert({
      branch_id: ctx.branchId, amenity_id: amenityId, unit_id: unitId || null, resident_id: ctx.residentId,
      resident_name: ctx.resident.full_name, reservation_date: date, start_time: start, end_time: end,
      guests: Number(body.guests) || 0, status, fee_amount: fee, charge_id: chargeId,
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, status }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reservar" }, { status: 500 })
  }
}
