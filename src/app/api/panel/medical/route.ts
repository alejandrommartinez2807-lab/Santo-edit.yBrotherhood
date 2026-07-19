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
    if (!branchId) return NextResponse.json({ ok: true, doctors: [], schedule: [], appointments: [] })
    const supabase = getSupabaseAdmin()
    const [doctorsRes, schedRes, apptRes] = await Promise.all([
      supabase.from("doctors").select("*").eq("branch_id", branchId).order("sort_order").order("full_name"),
      supabase.from("doctor_schedule").select("*").eq("branch_id", branchId),
      supabase.from("medical_appointments").select("*, doctors(full_name, specialty)").eq("branch_id", branchId).order("starts_at", { ascending: false }).limit(200),
    ])
    if (doctorsRes.error) throw new Error(doctorsRes.error.message)
    return NextResponse.json({ ok: true, doctors: doctorsRes.data ?? [], schedule: schedRes.data ?? [], appointments: apptRes.data ?? [] })
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

    if (action === "doctor") {
      const name = text(body.fullName)
      if (!name) return NextResponse.json({ error: "Escribe el nombre del doctor" }, { status: 400 })
      const row = {
        branch_id: branchId, unit_id: text(body.unitId) || null, full_name: name, specialty: text(body.specialty),
        phone: text(body.phone), email: text(body.email), photo_url: text(body.photoUrl), bio: text(body.bio),
        consult_fee: num(body.consultFee), currency: text(body.currency) || "USD",
        active: body.active === undefined ? true : !!body.active,
      }
      if (body.id) {
        const { error } = await supabase.from("doctors").update(row).eq("id", body.id).eq("branch_id", branchId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      const { data, error } = await supabase.from("doctors").insert(row).select("id").maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, id: data?.id }, { status: 201 })
    }

    if (action === "deleteDoctor") {
      const { error } = await supabase.from("doctors").delete().eq("id", text(body.id)).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === "schedule") {
      // Reemplaza el horario del doctor por los bloques enviados.
      const doctorId = text(body.doctorId)
      if (!doctorId) return NextResponse.json({ error: "Falta el doctor" }, { status: 400 })
      const blocks = (Array.isArray(body.blocks) ? body.blocks : []) as Record<string, unknown>[]
      await supabase.from("doctor_schedule").delete().eq("doctor_id", doctorId).eq("branch_id", branchId)
      if (blocks.length) {
        const rows = blocks.map((b) => ({
          branch_id: branchId, doctor_id: doctorId, weekday: int(b.weekday, 1),
          start_time: text(b.startTime) || "09:00", end_time: text(b.endTime) || "13:00",
          slot_minutes: int(b.slotMinutes, 30), active: true,
        }))
        const { error } = await supabase.from("doctor_schedule").insert(rows)
        if (error) throw new Error(error.message)
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "apptStatus") {
      const id = text(body.id)
      const status = text(body.status)
      if (!id || !status) return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
      const { error } = await supabase.from("medical_appointments").update({ status }).eq("id", id).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
