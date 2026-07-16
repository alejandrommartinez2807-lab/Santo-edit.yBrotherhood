import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// ============================================================
// HUÉSPEDES + FOLIO DEL HUÉSPED SOBRE SUPABASE (Hotel · Fase 3)
//
// El folio es la cuenta de la estadía: cargos (habitación, restaurante, extras)
// y pagos. El saldo = suma(cargos) - suma(pagos). Un folio por reserva.
// Todo filtrado/asignado por branch_id (= propiedad).
// ============================================================

export type Guest = {
  id: string
  fullName: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  nationality: string
  birthDate: string
  address: string
  notes: string
}

export type Folio = {
  id: string
  reservationId: string
  guestId: string
  status: string // abierto | cerrado
  openedAt: string
  closedAt: string
}

export type FolioItemKind = "cargo" | "pago"

export type FolioItem = {
  id: string
  folioId: string
  kind: FolioItemKind
  category: string
  description: string
  quantity: number
  unitAmount: number
  amount: number
  method: string
  sourceOrderId: string
  createdBy: string
  createdAt: string
}

export type SaveGuestInput = {
  id?: string
  fullName: string
  documentType?: string
  documentNumber?: string
  phone?: string
  email?: string
  nationality?: string
  birthDate?: string
  address?: string
  notes?: string
}

export type AddFolioItemInput = {
  folioId: string
  kind?: string
  category?: string
  description?: string
  quantity?: number
  unitAmount?: number
  amount?: number
  method?: string
  sourceOrderId?: string
  createdBy?: string
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeItemKind(value: unknown): FolioItemKind {
  return cleanText(value).toLowerCase() === "pago" ? "pago" : "cargo"
}

function mapGuest(raw: Row): Guest {
  return {
    id: String(raw.id || ""),
    fullName: cleanText(raw.full_name),
    documentType: cleanText(raw.document_type) || "cedula",
    documentNumber: cleanText(raw.document_number),
    phone: cleanText(raw.phone),
    email: cleanText(raw.email),
    nationality: cleanText(raw.nationality),
    birthDate: raw.birth_date ? String(raw.birth_date).slice(0, 10) : "",
    address: cleanText(raw.address),
    notes: cleanText(raw.notes),
  }
}

function mapFolio(raw: Row): Folio {
  return {
    id: String(raw.id || ""),
    reservationId: cleanText(raw.reservation_id),
    guestId: cleanText(raw.guest_id),
    status: cleanText(raw.status) || "abierto",
    openedAt: String(raw.opened_at || ""),
    closedAt: String(raw.closed_at || ""),
  }
}

function mapFolioItem(raw: Row): FolioItem {
  return {
    id: String(raw.id || ""),
    folioId: cleanText(raw.folio_id),
    kind: normalizeItemKind(raw.kind),
    category: cleanText(raw.category) || "extra",
    description: cleanText(raw.description),
    quantity: num(raw.quantity, 1),
    unitAmount: num(raw.unit_amount, 0),
    amount: num(raw.amount, 0),
    method: cleanText(raw.method),
    sourceOrderId: cleanText(raw.source_order_id),
    createdBy: cleanText(raw.created_by),
    createdAt: String(raw.created_at || ""),
  }
}

/** Saldo del folio: cargos - pagos. */
export function folioBalance(items: FolioItem[]): number {
  return items.reduce((acc, item) => acc + (item.kind === "pago" ? -item.amount : item.amount), 0)
}

// ---------------- Huéspedes ----------------

export async function saveGuest(input: SaveGuestInput, branchId?: string | null): Promise<Guest> {
  const supabase = getSupabaseAdmin()
  const fields = {
    full_name: cleanText(input.fullName),
    document_type: cleanText(input.documentType) || "cedula",
    document_number: cleanText(input.documentNumber),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    nationality: cleanText(input.nationality),
    birth_date: cleanText(input.birthDate) || null,
    address: cleanText(input.address),
    notes: cleanText(input.notes),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("guests").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapGuest(data as Row)
  }

  const { data, error } = await supabase
    .from("guests")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapGuest(data as Row)
}

export async function getGuests(branchId?: string | null): Promise<Guest[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("guests").select("*").order("full_name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as Row[]) || []).map(mapGuest)
}

export async function getGuest(id: string, branchId?: string | null): Promise<Guest | null> {
  if (!id) return null
  const supabase = getSupabaseAdmin()
  let query = supabase.from("guests").select("*").eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGuest(data as Row) : null
}

// ---------------- Folio ----------------

export async function getFolioByReservation(
  reservationId: string,
  branchId?: string | null,
): Promise<Folio | null> {
  if (!reservationId) return null
  const supabase = getSupabaseAdmin()
  let query = supabase.from("folios").select("*").eq("reservation_id", reservationId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapFolio(data as Row) : null
}

/** Abre el folio de una reserva si no existe (idempotente). */
export async function openFolio(
  input: { reservationId: string; guestId?: string },
  branchId?: string | null,
): Promise<Folio> {
  const existing = await getFolioByReservation(input.reservationId, branchId)
  if (existing) return existing

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("folios")
    .insert({
      reservation_id: input.reservationId,
      guest_id: input.guestId || null,
      status: "abierto",
      branch_id: branchId ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapFolio(data as Row)
}

export async function closeFolio(folioId: string, branchId?: string | null): Promise<Folio> {
  const supabase = getSupabaseAdmin()
  let updateQuery = supabase
    .from("folios")
    .update({ status: "cerrado", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", folioId)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapFolio(data as Row)
}

// ---------------- Líneas del folio ----------------

export async function getFolioItems(folioId: string, branchId?: string | null): Promise<FolioItem[]> {
  if (!folioId) return []
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("folio_items")
    .select("*")
    .eq("folio_id", folioId)
    .order("created_at", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapFolioItem(raw as Row))
}

export async function addFolioItem(input: AddFolioItemInput, branchId?: string | null): Promise<FolioItem> {
  const supabase = getSupabaseAdmin()
  const kind = normalizeItemKind(input.kind)
  const quantity = Math.max(1, num(input.quantity, 1))
  const unitAmount = Math.max(0, num(input.unitAmount, 0))
  // amount explícito (p.ej. cargo de habitación ya calculado) o cantidad × unitario.
  const amount = input.amount !== undefined ? Math.max(0, num(input.amount, 0)) : unitAmount * quantity

  const { data, error } = await supabase
    .from("folio_items")
    .insert({
      folio_id: cleanText(input.folioId),
      kind,
      category: cleanText(input.category) || (kind === "pago" ? "pago" : "extra"),
      description: cleanText(input.description),
      quantity,
      unit_amount: unitAmount,
      amount,
      method: cleanText(input.method),
      source_order_id: cleanText(input.sourceOrderId) || null,
      created_by: cleanText(input.createdBy),
      branch_id: branchId ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapFolioItem(data as Row)
}

export async function deleteFolioItem(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("folio_items").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}

/** Folios por id (para mapear pagos → reserva → huésped sin N+1). */
export async function getFoliosByIds(
  folioIds: string[],
  branchId?: string | null,
): Promise<Folio[]> {
  const ids = [...new Set(folioIds.filter(Boolean))]
  if (ids.length === 0) return []
  const supabase = getSupabaseAdmin()
  let query = supabase.from("folios").select("*").in("id", ids.slice(0, 200))
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapFolio(raw as Row))
}

/**
 * Líneas de folio del periodo [from, to) por fecha de creación (hora Caracas).
 * Para reportes: ingresos por categoría (habitación, restaurante, servicio,
 * paquete…) y pagos por método.
 */
export async function getFolioItemsInRange(
  filters: { from: string; to: string },
  branchId?: string | null,
): Promise<FolioItem[]> {
  if (!filters.from || !filters.to) return []
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("folio_items")
    .select("*")
    .gte("created_at", `${filters.from}T00:00:00-04:00`)
    .lt("created_at", `${filters.to}T00:00:00-04:00`)
    .order("created_at", { ascending: true })
    .limit(2000)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapFolioItem(raw as Row))
}

/** IDs de pedidos del POS ya cargados a algún folio (para no duplicar). */
export async function getChargedOrderIds(branchId?: string | null): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("folio_items")
    .select("source_order_id")
    .not("source_order_id", "is", null)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => cleanText((row as Row).source_order_id))
    .filter(Boolean)
}

/** ¿El folio ya tiene el cargo de habitación? (para no duplicarlo al abrir). */
export async function hasRoomCharge(folioId: string, branchId?: string | null): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("folio_items")
    .select("id")
    .eq("folio_id", folioId)
    .eq("category", "habitacion")
    .limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}
