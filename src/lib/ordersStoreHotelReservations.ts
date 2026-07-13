import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import {
  nightsBetween,
  normalizeHotelReservationStatus,
  normalizeStayDate,
  type HotelReservationStatus,
} from "./hotelReservationConflicts"

// ============================================================
// RESERVAS HOTELERAS SOBRE SUPABASE (Hotel · Fase 2)
//
// Reservas por rango de noches. Todo filtrado/asignado por branch_id (=
// propiedad). El solape se valida en la ruta API con hotelReservationConflicts.
// El huésped se guarda como snapshot (guest_name/guest_phone); la ficha legal
// completa (tabla guests) llega en la Fase 3 (check-in).
// ============================================================

export type HotelReservation = {
  id: string
  code: string
  roomId: string
  roomTypeId: string
  guestId: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  nights: number
  adults: number
  children: number
  ratePerNight: number
  totalAmount: number
  status: HotelReservationStatus
  source: string
  note: string
  checkedInAt: string
  checkedOutAt: string
  createdAt: string
  updatedAt: string
}

export type SaveHotelReservationInput = {
  id?: string
  code?: string
  roomId?: string
  roomTypeId?: string
  guestName: string
  guestPhone?: string
  checkInDate: string
  checkOutDate: string
  adults?: number
  children?: number
  ratePerNight?: number
  status?: string
  source?: string
  note?: string
}

export type GetHotelReservationsFilters = {
  from?: string
  to?: string
  status?: string
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapHotelReservation(raw: Row): HotelReservation {
  const checkInDate = normalizeStayDate(raw.check_in_date)
  const checkOutDate = normalizeStayDate(raw.check_out_date)
  return {
    id: String(raw.id || ""),
    code: cleanText(raw.code),
    roomId: cleanText(raw.room_id),
    roomTypeId: cleanText(raw.room_type_id),
    guestId: cleanText(raw.guest_id),
    guestName: cleanText(raw.guest_name),
    guestPhone: cleanText(raw.guest_phone),
    checkInDate,
    checkOutDate,
    nights: nightsBetween(checkInDate, checkOutDate),
    adults: Math.max(1, num(raw.adults, 1)),
    children: Math.max(0, num(raw.children, 0)),
    ratePerNight: Math.max(0, num(raw.rate_per_night, 0)),
    totalAmount: Math.max(0, num(raw.total_amount, 0)),
    status: normalizeHotelReservationStatus(raw.status),
    source: cleanText(raw.source) || "recepcion",
    note: cleanText(raw.note),
    checkedInAt: String(raw.checked_in_at || ""),
    checkedOutAt: String(raw.checked_out_at || ""),
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

function shortCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}

export async function getHotelReservations(
  filters: GetHotelReservationsFilters = {},
  branchId?: string | null,
): Promise<HotelReservation[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("hotel_reservations")
    .select("*")
    .order("check_in_date", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  // Reservas que tocan la ventana [from, to): check_out > from y check_in < to.
  const from = normalizeStayDate(filters.from)
  const to = normalizeStayDate(filters.to)
  if (from) query = query.gt("check_out_date", from)
  if (to) query = query.lt("check_in_date", to)
  if (filters.status) query = query.eq("status", normalizeHotelReservationStatus(filters.status))

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapHotelReservation(raw as Row))
}

export async function saveHotelReservation(
  input: SaveHotelReservationInput,
  branchId?: string | null,
): Promise<HotelReservation> {
  const supabase = getSupabaseAdmin()

  const checkInDate = normalizeStayDate(input.checkInDate)
  const checkOutDate = normalizeStayDate(input.checkOutDate)
  const nights = nightsBetween(checkInDate, checkOutDate)
  const ratePerNight = Math.max(0, num(input.ratePerNight, 0))

  const fields = {
    code: cleanText(input.code) || shortCode(),
    room_id: cleanText(input.roomId) || null,
    room_type_id: cleanText(input.roomTypeId) || null,
    guest_name: cleanText(input.guestName),
    guest_phone: cleanText(input.guestPhone),
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    adults: Math.max(1, num(input.adults, 1)),
    children: Math.max(0, num(input.children, 0)),
    rate_per_night: ratePerNight,
    total_amount: ratePerNight * nights,
    status: normalizeHotelReservationStatus(input.status),
    source: cleanText(input.source) || "recepcion",
    note: cleanText(input.note),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("hotel_reservations").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapHotelReservation(data as Row)
  }

  const { data, error } = await supabase
    .from("hotel_reservations")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapHotelReservation(data as Row)
}

export async function updateHotelReservationStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<HotelReservation> {
  const supabase = getSupabaseAdmin()
  const normalized = normalizeHotelReservationStatus(status)
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = { status: normalized, updated_at: now }
  // Sella la marca de tiempo al hacer check-in / check-out.
  if (normalized === "checkin") patch.checked_in_at = now
  if (normalized === "checkout") patch.checked_out_at = now

  let updateQuery = supabase.from("hotel_reservations").update(patch).eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapHotelReservation(data as Row)
}

export async function getHotelReservationById(
  id: string,
  branchId?: string | null,
): Promise<HotelReservation | null> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("hotel_reservations").select("*").eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapHotelReservation(data as Row) : null
}

export async function updateHotelReservationGuest(
  id: string,
  guestId: string,
  branchId?: string | null,
): Promise<HotelReservation> {
  const supabase = getSupabaseAdmin()
  let updateQuery = supabase
    .from("hotel_reservations")
    .update({ guest_id: guestId || null, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapHotelReservation(data as Row)
}

export async function deleteHotelReservation(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("hotel_reservations").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
