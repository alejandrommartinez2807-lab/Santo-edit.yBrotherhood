import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"

// ============================================================
// RESTRICCIONES DE TARIFA SOBRE SUPABASE (Hotel · Fase 18)
//
// CRUD de rate_restrictions. La evaluación vive en la lógica pura
// rateRestrictions.ts. Todo por branch_id. Ver 0029_rate_restrictions.sql.
// ============================================================

export type RateRestriction = {
  id: string
  roomTypeId: string
  fromDate: string
  toDate: string
  minStay: number
  closedToArrival: boolean
  closedToDeparture: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export type SaveRateRestrictionInput = {
  id?: string
  roomTypeId?: string
  fromDate: string
  toDate: string
  minStay?: number
  closedToArrival?: boolean
  closedToDeparture?: boolean
  active?: boolean
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapRestriction(raw: Row): RateRestriction {
  return {
    id: String(raw.id || ""),
    roomTypeId: cleanText(raw.room_type_id),
    fromDate: normalizeStayDate(raw.from_date),
    toDate: normalizeStayDate(raw.to_date),
    minStay: Math.max(1, num(raw.min_stay, 1)),
    closedToArrival: raw.closed_to_arrival === true,
    closedToDeparture: raw.closed_to_departure === true,
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

export async function getRateRestrictions(branchId?: string | null): Promise<RateRestriction[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("rate_restrictions")
    .select("*")
    .order("from_date", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapRestriction(raw as Row))
}

export async function saveRateRestriction(
  input: SaveRateRestrictionInput,
  branchId?: string | null,
): Promise<RateRestriction> {
  const supabase = getSupabaseAdmin()
  const fields = {
    room_type_id: cleanText(input.roomTypeId) || null,
    from_date: normalizeStayDate(input.fromDate),
    to_date: normalizeStayDate(input.toDate),
    min_stay: Math.max(1, num(input.minStay, 1)),
    closed_to_arrival: input.closedToArrival === true,
    closed_to_departure: input.closedToDeparture === true,
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("rate_restrictions").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapRestriction(data as Row)
  }

  const { data, error } = await supabase
    .from("rate_restrictions")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRestriction(data as Row)
}

export async function deleteRateRestriction(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("rate_restrictions").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
