import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { slotsForDate, type ScheduleBlock } from "@/lib/medicalSlots"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) { return String(v ?? "").trim() }

// GET: sin params -> lista de doctores; con doctorId+date -> cupos disponibles.
export async function GET(request: NextRequest) {
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, doctors: [] })
    const supabase = getSupabaseAdmin()
    const url = new URL(request.url)
    const doctorId = text(url.searchParams.get("doctorId"))
    const date = text(url.searchParams.get("date"))

    if (doctorId && date) {
      const [schedRes, apptRes] = await Promise.all([
        supabase.from("doctor_schedule").select("weekday, start_time, end_time, slot_minutes, active").eq("branch_id", branchId).eq("doctor_id", doctorId),
        supabase.from("medical_appointments").select("starts_at, status").eq("branch_id", branchId).eq("doctor_id", doctorId).gte("starts_at", `${date}T00:00:00-04:00`).lte("starts_at", `${date}T23:59:59-04:00`),
      ])
      const blocks = (schedRes.data ?? []) as ScheduleBlock[]
      const bookedIso = new Set(
        ((apptRes.data ?? []) as { starts_at: string; status: string }[])
          .filter((a) => a.status !== "cancelada")
          .map((a) => new Date(a.starts_at).getTime()),
      )
      const nowMs = Date.now()
      const slots = slotsForDate(date, blocks).filter((s) => {
        const ms = new Date(s.iso).getTime()
        return ms > nowMs && !bookedIso.has(ms)
      })
      return NextResponse.json({ ok: true, slots })
    }

    const { data } = await supabase
      .from("doctors")
      .select("id, full_name, specialty, photo_url, bio, consult_fee, currency, unit_id, units(floor)")
      .eq("branch_id", branchId).eq("active", true).order("sort_order").order("full_name")
    return NextResponse.json({ ok: true, doctors: data ?? [] })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}

// POST: reservar una cita en línea.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: false, error: "No disponible" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    const doctorId = text(body.doctorId)
    const date = text(body.date)
    const time = text(body.time)
    const name = text(body.patientName)
    const phone = text(body.patientPhone)
    if (!doctorId || !date || !time || !name || !phone) {
      return NextResponse.json({ ok: false, error: "Faltan datos (doctor, fecha, hora, nombre o teléfono)" }, { status: 400 })
    }

    // Valida que el cupo pertenezca al horario y esté libre.
    const [schedRes, apptRes, docRes] = await Promise.all([
      supabase.from("doctor_schedule").select("weekday, start_time, end_time, slot_minutes, active").eq("branch_id", branchId).eq("doctor_id", doctorId),
      supabase.from("medical_appointments").select("starts_at, status").eq("branch_id", branchId).eq("doctor_id", doctorId).gte("starts_at", `${date}T00:00:00-04:00`).lte("starts_at", `${date}T23:59:59-04:00`),
      supabase.from("doctors").select("id").eq("branch_id", branchId).eq("id", doctorId).eq("active", true).maybeSingle(),
    ])
    if (!docRes.data) return NextResponse.json({ ok: false, error: "Doctor no disponible" }, { status: 404 })
    const blocks = (schedRes.data ?? []) as ScheduleBlock[]
    const slot = slotsForDate(date, blocks).find((s) => s.time === time)
    if (!slot) return NextResponse.json({ ok: false, error: "Ese horario no está disponible" }, { status: 409 })
    const slotMs = new Date(slot.iso).getTime()
    if (slotMs <= Date.now()) return NextResponse.json({ ok: false, error: "Ese horario ya pasó" }, { status: 409 })
    const taken = ((apptRes.data ?? []) as { starts_at: string; status: string }[]).some((a) => a.status !== "cancelada" && new Date(a.starts_at).getTime() === slotMs)
    if (taken) return NextResponse.json({ ok: false, error: "Ese cupo acaba de ocuparse" }, { status: 409 })

    const { error } = await supabase.from("medical_appointments").insert({
      branch_id: branchId, doctor_id: doctorId, patient_name: name, patient_phone: phone, patient_email: text(body.patientEmail),
      starts_at: slot.iso, reason: text(body.reason), status: "solicitada", source: "online",
    })
    if (error) {
      // violación del índice único = cupo tomado
      if (String(error.message).toLowerCase().includes("duplicate")) return NextResponse.json({ ok: false, error: "Ese cupo acaba de ocuparse" }, { status: 409 })
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error" }, { status: 500 })
  }
}
