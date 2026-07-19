import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }
function num(v: unknown, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f }

// GET: amenidades + reservas (con nombre de unidad).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, amenities: [], reservations: [] })
    const supabase = getSupabaseAdmin()
    const [a, r] = await Promise.all([
      supabase.from("amenities").select("*").eq("branch_id", branchId).order("sort_order"),
      supabase.from("amenity_reservations").select("id, amenity_id, unit_id, resident_name, reservation_date, start_time, end_time, guests, status, fee_amount, units(code)").eq("branch_id", branchId).order("reservation_date", { ascending: false }).limit(100),
    ])
    if (a.error) throw new Error(a.error.message)
    return NextResponse.json({ ok: true, amenities: a.data ?? [], reservations: r.data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: kind "amenity" (alta/edición) o "decision" (aprobar/rechazar reserva).
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "Sin condominio" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "decision") {
      const id = text(body.reservationId)
      const status = text(body.decision) === "confirmar" ? "confirmada" : "rechazada"
      const { error } = await supabase.from("amenity_reservations").update({ status, approved_by: "admin" }).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    const name = text(body.name)
    if (!name) return NextResponse.json({ error: "Escribe el nombre del área" }, { status: 400 })
    const row = {
      branch_id: branchId, name, description: text(body.description),
      booking_mode: text(body.bookingMode) || "por_franja",
      open_time: text(body.openTime) || "08:00", close_time: text(body.closeTime) || "22:00",
      requires_approval: body.requiresApproval === true, fee: num(body.fee), deposit: num(body.deposit),
      active: body.active !== false, sort_order: num(body.sortOrder),
    }
    if (body.id) {
      const { data, error } = await supabase.from("amenities").update(row).eq("id", body.id).eq("branch_id", branchId).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, amenity: data })
    }
    const { data, error } = await supabase.from("amenities").insert(row).select().maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, amenity: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 500 })
  }
}
