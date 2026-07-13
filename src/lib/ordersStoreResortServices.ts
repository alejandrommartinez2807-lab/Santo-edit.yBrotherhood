import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"
import {
  normalizeServiceBookingStatus,
  normalizeServiceKind,
  type ServiceBookingStatus,
  type ServiceKind,
} from "./resortServices"

// ============================================================
// SERVICIOS DEL RESORT SOBRE SUPABASE (Hotel · Fase 21)
//
// Catálogo (resort_services) + reservas de servicio (service_bookings). El
// control de cupo vive en la lógica pura resortServices.ts. Todo por branch_id.
// ============================================================

export type ResortService = {
  id: string
  name: string
  kind: ServiceKind
  description: string
  price: number
  capacity: number
  durationMin: number
  active: boolean
  sortOrder: number
}

export type ServiceBooking = {
  id: string
  serviceId: string
  reservationId: string
  guestName: string
  guestPhone: string
  date: string
  time: string
  people: number
  status: ServiceBookingStatus
  note: string
  createdAt: string
}

export type SaveResortServiceInput = {
  id?: string
  name: string
  kind?: string
  description?: string
  price?: number
  capacity?: number
  durationMin?: number
  active?: boolean
  sortOrder?: number
}

export type CreateServiceBookingInput = {
  serviceId: string
  reservationId?: string
  guestName?: string
  guestPhone?: string
  date: string
  time?: string
  people?: number
  note?: string
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapService(raw: Row): ResortService {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    kind: normalizeServiceKind(raw.kind),
    description: cleanText(raw.description),
    price: Math.max(0, num(raw.price, 0)),
    capacity: Math.max(1, num(raw.capacity, 1)),
    durationMin: Math.max(0, num(raw.duration_min, 60)),
    active: raw.active !== false,
    sortOrder: num(raw.sort_order, 0),
  }
}

function mapBooking(raw: Row): ServiceBooking {
  return {
    id: String(raw.id || ""),
    serviceId: cleanText(raw.service_id),
    reservationId: cleanText(raw.reservation_id),
    guestName: cleanText(raw.guest_name),
    guestPhone: cleanText(raw.guest_phone),
    date: normalizeStayDate(raw.date),
    time: cleanText(raw.time),
    people: Math.max(1, num(raw.people, 1)),
    status: normalizeServiceBookingStatus(raw.status),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
  }
}

// ---------------- Catálogo ----------------

export async function getResortServices(branchId?: string | null): Promise<ResortService[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("resort_services")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapService(raw as Row))
}

export async function saveResortService(
  input: SaveResortServiceInput,
  branchId?: string | null,
): Promise<ResortService> {
  const supabase = getSupabaseAdmin()
  const fields = {
    name: cleanText(input.name),
    kind: normalizeServiceKind(input.kind),
    description: cleanText(input.description),
    price: Math.max(0, num(input.price, 0)),
    capacity: Math.max(1, num(input.capacity, 1)),
    duration_min: Math.max(0, num(input.durationMin, 60)),
    active: input.active !== false,
    sort_order: num(input.sortOrder, 0),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("resort_services").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapService(data as Row)
  }

  const { data, error } = await supabase
    .from("resort_services")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapService(data as Row)
}

export async function deleteResortService(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("resort_services").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}

// ---------------- Reservas de servicio ----------------

export async function getServiceBookings(
  filters: { from?: string; to?: string; serviceId?: string; reservationId?: string } = {},
  branchId?: string | null,
): Promise<ServiceBooking[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("service_bookings")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const from = normalizeStayDate(filters.from)
  const to = normalizeStayDate(filters.to)
  if (from) query = query.gte("date", from)
  if (to) query = query.lte("date", to)
  if (filters.serviceId) query = query.eq("service_id", filters.serviceId)
  if (filters.reservationId) query = query.eq("reservation_id", filters.reservationId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapBooking(raw as Row))
}

export async function createServiceBooking(
  input: CreateServiceBookingInput,
  branchId?: string | null,
): Promise<ServiceBooking> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("service_bookings")
    .insert({
      branch_id: branchId ?? null,
      service_id: cleanText(input.serviceId) || null,
      reservation_id: cleanText(input.reservationId) || null,
      guest_name: cleanText(input.guestName),
      guest_phone: cleanText(input.guestPhone),
      date: normalizeStayDate(input.date),
      time: cleanText(input.time),
      people: Math.max(1, num(input.people, 1)),
      note: cleanText(input.note),
      status: "reservada",
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapBooking(data as Row)
}

export async function updateServiceBookingStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<ServiceBooking> {
  const supabase = getSupabaseAdmin()
  let updateQuery = supabase
    .from("service_bookings")
    .update({ status: normalizeServiceBookingStatus(status) })
    .eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapBooking(data as Row)
}

export async function deleteServiceBooking(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("service_bookings").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
