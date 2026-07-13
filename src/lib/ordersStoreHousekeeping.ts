import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { updateRoomHousekeeping } from "./ordersStoreRooms"

// ============================================================
// HOUSEKEEPING / LIMPIEZA SOBRE SUPABASE (Hotel · Fase 5)
//
// Tablero de tareas de limpieza por habitación. El estado de limpieza vive en
// `rooms.housekeeping_status` (lo maneja ordersStoreRooms); aquí viven las
// TAREAS asignables (`housekeeping_tasks`): quién limpia, qué tipo y su estado.
// Todo se filtra/asigna por branch_id para no mezclar propiedades — igual que
// habitaciones y reservas (branchIsolation.fitness.test).
// ============================================================

export const HOUSEKEEPING_TASK_TYPES = [
  "salida", // limpieza a fondo tras un check-out
  "estancia", // repaso diario del huésped alojado
  "inspeccion", // revisión de supervisión
  "mantenimiento", // arreglo/incidencia
] as const

export type HousekeepingTaskType = (typeof HOUSEKEEPING_TASK_TYPES)[number]

export const HOUSEKEEPING_TASK_STATUSES = [
  "pendiente",
  "en_proceso",
  "hecha",
] as const

export type HousekeepingTaskStatus = (typeof HOUSEKEEPING_TASK_STATUSES)[number]

// Estados que aún ocupan a alguien (no cerrados).
const OPEN_STATUSES: readonly HousekeepingTaskStatus[] = ["pendiente", "en_proceso"]

export function normalizeTaskType(value: unknown): HousekeepingTaskType {
  const clean = cleanText(value).toLowerCase()
  return (HOUSEKEEPING_TASK_TYPES as readonly string[]).includes(clean)
    ? (clean as HousekeepingTaskType)
    : "salida"
}

export function normalizeTaskStatus(value: unknown): HousekeepingTaskStatus {
  const clean = cleanText(value).toLowerCase()
  return (HOUSEKEEPING_TASK_STATUSES as readonly string[]).includes(clean)
    ? (clean as HousekeepingTaskStatus)
    : "pendiente"
}

export type HousekeepingTask = {
  id: string
  roomId: string
  type: HousekeepingTaskType
  status: HousekeepingTaskStatus
  assignedTo: string
  note: string
  createdAt: string
  doneAt: string | null
}

export type CreateHousekeepingTaskInput = {
  roomId: string
  type?: string
  status?: string
  assignedTo?: string
  note?: string
}

export type UpdateHousekeepingTaskInput = {
  type?: string
  status?: string
  assignedTo?: string
  note?: string
}

function mapTask(raw: Row): HousekeepingTask {
  const doneAt = raw.done_at
  return {
    id: String(raw.id || ""),
    roomId: cleanText(raw.room_id),
    type: normalizeTaskType(raw.type),
    status: normalizeTaskStatus(raw.status),
    assignedTo: cleanText(raw.assigned_to),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
    doneAt: doneAt ? String(doneAt) : null,
  }
}

export async function getHousekeepingTasks(branchId?: string | null): Promise<HousekeepingTask[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("housekeeping_tasks")
    .select("*")
    .order("created_at", { ascending: false })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapTask(raw as Row))
}

export async function createHousekeepingTask(
  input: CreateHousekeepingTaskInput,
  branchId?: string | null,
): Promise<HousekeepingTask> {
  const roomId = cleanText(input.roomId)
  if (!roomId) throw new Error("Indica la habitación de la tarea")

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .insert({
      branch_id: branchId ?? null,
      room_id: roomId,
      type: normalizeTaskType(input.type),
      status: normalizeTaskStatus(input.status),
      assigned_to: cleanText(input.assignedTo),
      note: cleanText(input.note),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapTask(data as Row)
}

export async function updateHousekeepingTask(
  id: string,
  input: UpdateHousekeepingTaskInput,
  branchId?: string | null,
): Promise<HousekeepingTask> {
  const supabase = getSupabaseAdmin()

  const fields: Record<string, unknown> = {}
  if (input.type !== undefined) fields.type = normalizeTaskType(input.type)
  if (input.assignedTo !== undefined) fields.assigned_to = cleanText(input.assignedTo)
  if (input.note !== undefined) fields.note = cleanText(input.note)
  if (input.status !== undefined) {
    const status = normalizeTaskStatus(input.status)
    fields.status = status
    // Sella done_at al completar; lo limpia si se reabre la tarea.
    fields.done_at = status === "hecha" ? new Date().toISOString() : null
  }

  let updateQuery = supabase.from("housekeeping_tasks").update(fields).eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapTask(data as Row)
}

export async function deleteHousekeepingTask(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("housekeeping_tasks").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}

// Al salir un huésped (check-out) la habitación queda "sucia" y se encola una
// tarea de limpieza de salida. Idempotente: no duplica la tarea si ya hay una
// abierta de tipo salida para esa habitación (por si el cierre se repite).
export async function queueCheckoutCleaning(
  roomId: string,
  branchId?: string | null,
  note = "",
): Promise<HousekeepingTask | null> {
  const room = cleanText(roomId)
  if (!room) return null

  await updateRoomHousekeeping(room, "sucia", branchId)

  const supabase = getSupabaseAdmin()
  let openQuery = supabase
    .from("housekeeping_tasks")
    .select("id")
    .eq("room_id", room)
    .eq("type", "salida")
    .in("status", OPEN_STATUSES as unknown as string[])
    .limit(1)
  if (branchId) openQuery = openQuery.eq("branch_id", branchId)
  const { data: existing, error: existingError } = await openQuery
  if (existingError) throw new Error(existingError.message)
  if (existing && existing.length > 0) return null

  return createHousekeepingTask(
    { roomId: room, type: "salida", status: "pendiente", note: cleanText(note) },
    branchId,
  )
}
