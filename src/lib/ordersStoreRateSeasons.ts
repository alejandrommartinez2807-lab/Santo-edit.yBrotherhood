import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"
import { normalizeSeasonMode, type RateSeasonMode } from "./rateSeasons"

// ============================================================
// TARIFAS POR TEMPORADA SOBRE SUPABASE (Hotel · Fase 6)
//
// Catálogo de temporadas (`rate_seasons`). El cálculo de la tarifa vive en la
// lógica pura rateSeasons.ts; aquí solo el CRUD. Todo por branch_id.
// ============================================================

export type RateSeason = {
  id: string
  roomTypeId: string
  name: string
  startDate: string
  endDate: string
  mode: RateSeasonMode
  rate: number
  multiplier: number
  priority: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type SaveRateSeasonInput = {
  id?: string
  roomTypeId?: string
  name: string
  startDate: string
  endDate: string
  mode?: string
  rate?: number
  multiplier?: number
  priority?: number
  active?: boolean
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapRateSeason(raw: Row): RateSeason {
  return {
    id: String(raw.id || ""),
    roomTypeId: cleanText(raw.room_type_id),
    name: cleanText(raw.name),
    startDate: normalizeStayDate(raw.start_date),
    endDate: normalizeStayDate(raw.end_date),
    mode: normalizeSeasonMode(raw.mode),
    rate: Math.max(0, num(raw.rate, 0)),
    multiplier: Math.max(0, num(raw.multiplier, 1)),
    priority: num(raw.priority, 0),
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

export async function getRateSeasons(branchId?: string | null): Promise<RateSeason[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("rate_seasons")
    .select("*")
    .order("priority", { ascending: false })
    .order("start_date", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapRateSeason(raw as Row))
}

export async function saveRateSeason(
  input: SaveRateSeasonInput,
  branchId?: string | null,
): Promise<RateSeason> {
  const supabase = getSupabaseAdmin()
  const mode = normalizeSeasonMode(input.mode)

  const fields = {
    room_type_id: cleanText(input.roomTypeId) || null,
    name: cleanText(input.name),
    start_date: normalizeStayDate(input.startDate),
    end_date: normalizeStayDate(input.endDate),
    mode,
    rate: Math.max(0, num(input.rate, 0)),
    multiplier: Math.max(0, num(input.multiplier, 1)),
    priority: num(input.priority, 0),
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("rate_seasons").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapRateSeason(data as Row)
  }

  const { data, error } = await supabase
    .from("rate_seasons")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRateSeason(data as Row)
}

export async function deleteRateSeason(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("rate_seasons").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
