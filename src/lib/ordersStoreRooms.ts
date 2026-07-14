import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// ============================================================
// HABITACIONES Y TIPOS DE HABITACIÓN SOBRE SUPABASE (Hotel · Fase 1)
//
// Toda query se filtra/asigna por branch_id (= propiedad/hotel) para no mezclar
// datos entre propiedades — igual que reservas (branchIsolation.fitness.test).
// La ocupación NO vive aquí: se deriva de hotel_reservations. Esta capa maneja
// el catálogo (tipos + habitaciones) y el estado de limpieza.
// ============================================================

export const ROOM_HOUSEKEEPING_STATUSES = [
  "limpia",
  "sucia",
  "inspeccion",
  "mantenimiento",
] as const

export type RoomHousekeepingStatus = (typeof ROOM_HOUSEKEEPING_STATUSES)[number]

export function normalizeHousekeepingStatus(value: unknown): RoomHousekeepingStatus {
  const clean = cleanText(value).toLowerCase()
  return (ROOM_HOUSEKEEPING_STATUSES as readonly string[]).includes(clean)
    ? (clean as RoomHousekeepingStatus)
    : "limpia"
}

// Galería pública del tipo (migración 0039): el orden del arreglo es el orden
// de la galería. Se limita a 12 fotos y solo URLs http(s) para evitar basura.
export type RoomTypePhoto = { url: string; caption: string }

export const MAX_ROOM_TYPE_PHOTOS = 12

export function normalizeRoomTypePhotos(value: unknown): RoomTypePhoto[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>
      const url = cleanText(item.url)
      return { url, caption: cleanText(item.caption).slice(0, 160) }
    })
    .filter((photo) => /^https?:\/\//i.test(photo.url))
    .slice(0, MAX_ROOM_TYPE_PHOTOS)
}

export type RoomType = {
  id: string
  name: string
  description: string
  baseCapacity: number
  maxCapacity: number
  baseRate: number
  photos: RoomTypePhoto[]
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Room = {
  id: string
  roomTypeId: string
  name: string
  floor: string
  capacity: number
  baseRate: number | null
  housekeepingStatus: RoomHousekeepingStatus
  outOfService: boolean
  amenities: string
  notes: string
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type SaveRoomTypeInput = {
  id?: string
  name: string
  description?: string
  baseCapacity?: number
  maxCapacity?: number
  baseRate?: number
  photos?: RoomTypePhoto[]
  sortOrder?: number
  active?: boolean
}

export type SaveRoomInput = {
  id?: string
  roomTypeId?: string
  name: string
  floor?: string
  capacity?: number
  baseRate?: number | null
  housekeepingStatus?: string
  outOfService?: boolean
  amenities?: string
  notes?: string
  sortOrder?: number
  active?: boolean
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapRoomType(raw: Row): RoomType {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    description: cleanText(raw.description),
    baseCapacity: Math.max(1, num(raw.base_capacity, 2)),
    maxCapacity: Math.max(1, num(raw.max_capacity, 2)),
    baseRate: Math.max(0, num(raw.base_rate, 0)),
    photos: normalizeRoomTypePhotos(raw.photos),
    sortOrder: num(raw.sort_order, 0),
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

function mapRoom(raw: Row): Room {
  const rawRate = raw.base_rate
  return {
    id: String(raw.id || ""),
    roomTypeId: cleanText(raw.room_type_id),
    name: cleanText(raw.name),
    floor: cleanText(raw.floor),
    capacity: Math.max(1, num(raw.capacity, 2)),
    baseRate: rawRate === null || rawRate === undefined ? null : Math.max(0, num(rawRate, 0)),
    housekeepingStatus: normalizeHousekeepingStatus(raw.housekeeping_status),
    outOfService: raw.out_of_service === true,
    amenities: cleanText(raw.amenities),
    notes: cleanText(raw.notes),
    sortOrder: num(raw.sort_order, 0),
    active: raw.active !== false,
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

// ---------------- Tipos de habitación ----------------

export async function getRoomTypes(branchId?: string | null): Promise<RoomType[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("room_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapRoomType(raw as Row))
}

export async function saveRoomType(
  input: SaveRoomTypeInput,
  branchId?: string | null,
): Promise<RoomType> {
  const supabase = getSupabaseAdmin()
  const fields: Record<string, unknown> = {
    name: cleanText(input.name),
    description: cleanText(input.description),
    base_capacity: Math.max(1, num(input.baseCapacity, 2)),
    max_capacity: Math.max(1, num(input.maxCapacity, 2)),
    base_rate: Math.max(0, num(input.baseRate, 0)),
    sort_order: num(input.sortOrder, 0),
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  }
  // Solo toca la galería si el cliente la manda: así los formularios viejos no
  // borran fotos y el guardado sigue funcionando si 0039 no está aplicada aún.
  if (input.photos !== undefined) {
    fields.photos = normalizeRoomTypePhotos(input.photos)
  }

  if (input.id) {
    let updateQuery = supabase.from("room_types").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapRoomType(data as Row)
  }

  const { data, error } = await supabase
    .from("room_types")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRoomType(data as Row)
}

export async function deleteRoomType(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("room_types").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}

// ---------------- Habitaciones ----------------

export async function getRooms(branchId?: string | null): Promise<Room[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("rooms")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapRoom(raw as Row))
}

export async function saveRoom(
  input: SaveRoomInput,
  branchId?: string | null,
): Promise<Room> {
  const supabase = getSupabaseAdmin()
  const roomTypeId = cleanText(input.roomTypeId)
  const rate =
    input.baseRate === null || input.baseRate === undefined || input.baseRate === ("" as unknown)
      ? null
      : Math.max(0, num(input.baseRate, 0))

  const fields = {
    room_type_id: roomTypeId || null,
    name: cleanText(input.name),
    floor: cleanText(input.floor),
    capacity: Math.max(1, num(input.capacity, 2)),
    base_rate: rate,
    housekeeping_status: normalizeHousekeepingStatus(input.housekeepingStatus),
    out_of_service: input.outOfService === true,
    amenities: cleanText(input.amenities),
    notes: cleanText(input.notes),
    sort_order: num(input.sortOrder, 0),
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("rooms").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapRoom(data as Row)
  }

  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRoom(data as Row)
}

export async function updateRoomHousekeeping(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<Room> {
  const supabase = getSupabaseAdmin()
  let updateQuery = supabase
    .from("rooms")
    .update({
      housekeeping_status: normalizeHousekeepingStatus(status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapRoom(data as Row)
}

export async function deleteRoom(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("rooms").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
