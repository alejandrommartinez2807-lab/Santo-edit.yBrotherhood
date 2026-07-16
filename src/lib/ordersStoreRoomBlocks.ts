import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { normalizeStayDate } from "./hotelReservationConflicts"

// ============================================================
// BLOQUEOS DE HABITACIÓN SOBRE SUPABASE (Hotel · Fase 20)
//
// Rango [from_date, to_date) que impide reservar/asignar una habitación
// (mantenimiento, evento). Todo por branch_id. Ver 0028_room_blocks.sql.
// ============================================================

export type RoomBlock = {
  id: string
  roomId: string
  fromDate: string
  toDate: string
  reason: string
  /** "manual" (staff) | "ical" (creado por la sincronización con OTAs). */
  source: string
  createdAt: string
}

export type SaveRoomBlockInput = {
  id?: string
  roomId: string
  fromDate: string
  toDate: string
  reason?: string
  /** Solo la sincronización iCal lo manda; el flujo manual no lo toca
   *  (así sigue funcionando aunque la migración 0043 no esté aplicada). */
  source?: string
}

export type GetRoomBlocksFilters = {
  from?: string
  to?: string
}

function mapRoomBlock(raw: Row): RoomBlock {
  return {
    id: String(raw.id || ""),
    roomId: cleanText(raw.room_id),
    fromDate: normalizeStayDate(raw.from_date),
    toDate: normalizeStayDate(raw.to_date),
    reason: cleanText(raw.reason),
    source: cleanText(raw.source) || "manual",
    createdAt: String(raw.created_at || ""),
  }
}

export async function getRoomBlocks(
  filters: GetRoomBlocksFilters = {},
  branchId?: string | null,
): Promise<RoomBlock[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("room_blocks")
    .select("*")
    .order("from_date", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  // Bloqueos que tocan la ventana [from, to): to_date > from && from_date < to.
  const from = normalizeStayDate(filters.from)
  const to = normalizeStayDate(filters.to)
  if (from) query = query.gt("to_date", from)
  if (to) query = query.lt("from_date", to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapRoomBlock(raw as Row))
}

export async function saveRoomBlock(
  input: SaveRoomBlockInput,
  branchId?: string | null,
): Promise<RoomBlock> {
  const supabase = getSupabaseAdmin()
  const fields: Record<string, unknown> = {
    room_id: cleanText(input.roomId) || null,
    from_date: normalizeStayDate(input.fromDate),
    to_date: normalizeStayDate(input.toDate),
    reason: cleanText(input.reason),
  }
  // La columna source solo viaja cuando el llamador la manda (sync iCal):
  // el flujo manual no depende de que la migración 0043 esté aplicada.
  if (input.source) fields.source = cleanText(input.source)

  if (input.id) {
    let updateQuery = supabase.from("room_blocks").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapRoomBlock(data as Row)
  }

  const { data, error } = await supabase
    .from("room_blocks")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRoomBlock(data as Row)
}

export async function deleteRoomBlock(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("room_blocks").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
