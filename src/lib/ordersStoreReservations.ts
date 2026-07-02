import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import type { Reservation } from "@/types/localOrders"

import {
  normalizeReservationDate,
  normalizeReservationStatus,
  normalizeReservationTime,
} from "./reservationConflicts"
import { type Row } from "./ordersStoreMappers"

// ============================================================
// RESERVAS SOBRE SUPABASE (Fase 5)
//
// Toda query se filtra/asigna por branch_id para no mezclar reservas
// entre sucursales (el test branchIsolation.fitness.test.ts lo vigila).
// La validación de solapes vive en la ruta API (reservationConflicts.ts).
// ============================================================

export type SaveReservationInput = {
  id?: string
  tableId: string
  tableName?: string
  customerName: string
  customerPhone?: string
  partySize?: number
  reservationDate: string
  startTime: string
  endTime: string
  status?: string
  note?: string
}

export type GetReservationsFilters = {
  date?: string
  status?: string
}

function mapReservation(raw: Row): Reservation {
  return {
    id: String(raw.id || ""),
    tableId: cleanText(raw.table_id),
    tableName: cleanText(raw.table_name),
    customerName: cleanText(raw.customer_name),
    customerPhone: cleanText(raw.customer_phone),
    partySize: Math.max(1, Number(raw.party_size) || 1),
    reservationDate: normalizeReservationDate(raw.reservation_date),
    startTime: normalizeReservationTime(raw.start_time),
    endTime: normalizeReservationTime(raw.end_time),
    status: normalizeReservationStatus(raw.status),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

export async function getReservations(
  filters: GetReservationsFilters = {},
  branchId?: string | null,
): Promise<Reservation[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  const date = normalizeReservationDate(filters.date)
  if (date) query = query.eq("reservation_date", date)
  if (filters.status) query = query.eq("status", normalizeReservationStatus(filters.status))

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapReservation(raw as Row))
}

export async function saveReservation(
  input: SaveReservationInput,
  branchId?: string | null,
): Promise<Reservation> {
  const supabase = getSupabaseAdmin()

  const fields = {
    table_id: cleanText(input.tableId),
    table_name: cleanText(input.tableName),
    customer_name: cleanText(input.customerName),
    customer_phone: cleanText(input.customerPhone),
    party_size: Math.max(1, Number(input.partySize) || 2),
    reservation_date: normalizeReservationDate(input.reservationDate),
    start_time: normalizeReservationTime(input.startTime),
    end_time: normalizeReservationTime(input.endTime),
    status: normalizeReservationStatus(input.status),
    note: cleanText(input.note),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    // Actualiza una fila concreta de esta sucursal (no toca otras sucursales).
    let updateQuery = supabase.from("reservations").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapReservation(data as Row)
  }

  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data, error } = await supabase
    .from("reservations")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapReservation(data as Row)
}

export async function updateReservationStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<Reservation> {
  const supabase = getSupabaseAdmin()
  // Cambia el estado de una fila concreta, acotada además a la sucursal.
  let updateQuery = supabase
    .from("reservations")
    .update({ status: normalizeReservationStatus(status), updated_at: new Date().toISOString() })
    .eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapReservation(data as Row)
}

export async function deleteReservation(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  // Borra una fila concreta, acotada además a la sucursal.
  let deleteQuery = supabase.from("reservations").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
