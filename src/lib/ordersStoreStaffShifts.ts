import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"

// Turnos / asistencia del personal sobre Supabase (Hotel · P3-H).
// Todo por branch_id. Ver 0044_staff_shifts.sql. NADA de sueldos.

export type StaffShift = {
  id: string
  staffUsername: string
  staffName: string
  shiftDate: string
  shiftLabel: string
  plannedStart: string
  plannedEnd: string
  checkInAt: string
  checkOutAt: string
  note: string
  createdAt: string
}

export type SaveStaffShiftInput = {
  id?: string
  staffUsername: string
  staffName: string
  shiftDate: string
  shiftLabel?: string
  plannedStart?: string
  plannedEnd?: string
  note?: string
}

function mapShift(raw: Row): StaffShift {
  return {
    id: String(raw.id || ""),
    staffUsername: cleanText(raw.staff_username),
    staffName: cleanText(raw.staff_name),
    shiftDate: normalizeStayDate(raw.shift_date),
    shiftLabel: cleanText(raw.shift_label),
    plannedStart: cleanText(raw.planned_start),
    plannedEnd: cleanText(raw.planned_end),
    checkInAt: raw.check_in_at ? String(raw.check_in_at) : "",
    checkOutAt: raw.check_out_at ? String(raw.check_out_at) : "",
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
  }
}

export async function getStaffShifts(
  filters: { from?: string; to?: string } = {},
  branchId?: string | null,
): Promise<StaffShift[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("staff_shifts").select("*").order("shift_date", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const from = normalizeStayDate(filters.from)
  const to = normalizeStayDate(filters.to)
  if (from) query = query.gte("shift_date", from)
  if (to) query = query.lt("shift_date", to)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as Row[]) || []).map(mapShift)
}

export async function saveStaffShift(
  input: SaveStaffShiftInput,
  branchId?: string | null,
): Promise<StaffShift> {
  const supabase = getSupabaseAdmin()
  const fields = {
    staff_username: cleanText(input.staffUsername),
    staff_name: cleanText(input.staffName),
    shift_date: normalizeStayDate(input.shiftDate),
    shift_label: cleanText(input.shiftLabel),
    planned_start: cleanText(input.plannedStart),
    planned_end: cleanText(input.plannedEnd),
    note: cleanText(input.note),
  }

  if (input.id) {
    let query = supabase.from("staff_shifts").update(fields).eq("id", input.id)
    if (branchId) query = query.eq("branch_id", branchId)
    const { data, error } = await query.select("*").single()
    if (error) throw new Error(error.message)
    return mapShift(data as Row)
  }

  const { data, error } = await supabase
    .from("staff_shifts")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapShift(data as Row)
}

export async function deleteStaffShift(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("staff_shifts").delete().eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function getStaffShiftById(id: string, branchId?: string | null): Promise<StaffShift | null> {
  if (!id) return null
  const supabase = getSupabaseAdmin()
  let query = supabase.from("staff_shifts").select("*").eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapShift(data as Row) : null
}

/** Sella la marca real de entrada o salida (una sola vez cada una). */
export async function markStaffShift(
  id: string,
  kind: "in" | "out",
  branchId?: string | null,
): Promise<StaffShift> {
  const supabase = getSupabaseAdmin()
  const field = kind === "in" ? "check_in_at" : "check_out_at"
  let query = supabase
    .from("staff_shifts")
    .update({ [field]: new Date().toISOString() })
    .eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.select("*").single()
  if (error) throw new Error(error.message)
  return mapShift(data as Row)
}
