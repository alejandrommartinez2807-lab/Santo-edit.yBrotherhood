import { randomInt } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { captureError } from "@/lib/monitoring"

// Anulación con código del dueño (pedido del dueño 2026-07-21): el
// trabajador solicita anular con motivo; el código de un solo uso viaja SOLO
// al dueño (push a sus equipos + su panel + WhatsApp cuando esté conectado)
// y sin él no se puede completar la anulación.
//
// Si la migración 0029 no está aplicada, todo degrada al flujo anterior
// (motivo obligatorio y anulación directa): isCancellationApprovalAvailable
// devuelve false y el API no exige código.

const REQUEST_TTL_MINUTES = 120
const MAX_ATTEMPTS = 6

export type CancellationRequest = {
  id: string
  orderId: string
  branchId: string | null
  displayNumber: string
  reason: string
  requestedBy: string
  code: string
  status: string
  createdAt: string
}

function isMissingTableError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || "")
  const code = String((error as { code?: string })?.code || "")
  return (
    code === "PGRST205" ||
    /could not find the table|does not exist/i.test(message)
  )
}

function isExpired(createdAt: string): boolean {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return true
  return Date.now() - created.getTime() > REQUEST_TTL_MINUTES * 60_000
}

/** ¿Está aplicada la migración 0029? (con caché por proceso). */
let availabilityCache: boolean | null = null

export async function isCancellationApprovalAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from("order_cancellation_requests")
      .select("id", { head: true, count: "exact" })
      .limit(1)

    if (error) {
      if (isMissingTableError(error)) {
        availabilityCache = false
        return false
      }
      // Error transitorio: no cachear, asumir disponible para no saltarse
      // el control por un parpadeo de red.
      return true
    }

    availabilityCache = true
    return true
  } catch (error) {
    captureError(error, { route: "lib/cancellationRequests", action: "availability" })
    return false
  }
}

export async function createCancellationRequest(input: {
  orderId: string
  branchId?: string | null
  displayNumber: string
  reason: string
  requestedBy: string
}): Promise<CancellationRequest | null> {
  try {
    const supabase = getSupabaseAdmin()

    // Una solicitud pendiente vigente por pedido: si ya existe, se reusa (el
    // dueño ya tiene ese código; generar otro solo confunde).
    const { data: existingRows } = await supabase
      .from("order_cancellation_requests")
      .select("*")
      .eq("order_id", input.orderId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)

    const existing = existingRows?.[0] as Record<string, unknown> | undefined
    if (existing && !isExpired(String(existing.created_at || ""))) {
      return rowToRequest(existing)
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const row = {
      id: `can-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order_id: input.orderId,
      branch_id: input.branchId ?? null,
      display_number: input.displayNumber,
      reason: input.reason,
      requested_by: input.requestedBy,
      code,
      status: "pending",
    }

    const { data, error } = await supabase
      .from("order_cancellation_requests")
      .insert(row)
      .select("*")
      .single()

    if (error) {
      if (isMissingTableError(error)) return null
      throw new Error(error.message)
    }

    return rowToRequest(data as Record<string, unknown>)
  } catch (error) {
    captureError(error, { route: "lib/cancellationRequests", action: "create" })
    return null
  }
}

export type CodeVerification =
  | { ok: true; request: CancellationRequest }
  | { ok: false; error: string }

export async function verifyCancellationCode(
  orderId: string,
  code: string,
): Promise<CodeVerification> {
  const cleanCode = String(code || "").replace(/[^0-9]/g, "")

  if (cleanCode.length !== 6) {
    return { ok: false, error: "El código de anulación tiene 6 dígitos." }
  }

  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from("order_cancellation_requests")
    .select("*")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    return { ok: false, error: "No se pudo verificar el código. Intenta de nuevo." }
  }

  const row = rows?.[0] as Record<string, unknown> | undefined
  if (!row) {
    return {
      ok: false,
      error: "No hay una solicitud de anulación pendiente para este pedido. Pide la anulación primero.",
    }
  }

  if (isExpired(String(row.created_at || ""))) {
    await supabase
      .from("order_cancellation_requests")
      .update({ status: "expired" })
      .eq("id", String(row.id))
    return {
      ok: false,
      error: "La solicitud venció (2 horas). Pide la anulación de nuevo.",
    }
  }

  const attempts = Number(row.attempts || 0)
  if (attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Demasiados intentos con código equivocado. Pide la anulación de nuevo.",
    }
  }

  if (String(row.code || "") !== cleanCode) {
    await supabase
      .from("order_cancellation_requests")
      .update({ attempts: attempts + 1 })
      .eq("id", String(row.id))
    return {
      ok: false,
      error: `Código incorrecto. Verifícalo con el dueño (intento ${attempts + 1} de ${MAX_ATTEMPTS}).`,
    }
  }

  return { ok: true, request: rowToRequest(row) }
}

export async function markCancellationRequestUsed(
  requestId: string,
  input: { inventoryWasUsed?: boolean | null; inventoryRevertedCount?: number } = {},
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase
      .from("order_cancellation_requests")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        inventory_was_used: input.inventoryWasUsed ?? null,
        inventory_reverted_count: input.inventoryRevertedCount ?? 0,
      })
      .eq("id", requestId)
  } catch (error) {
    captureError(error, { route: "lib/cancellationRequests", action: "markUsed" })
  }
}

/** Solicitudes recientes para el panel del DUEÑO (código visible). */
export async function listCancellationRequestsForOwner(
  branchId?: string | null,
): Promise<CancellationRequest[]> {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from("order_cancellation_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
    if (branchId) query = query.eq("branch_id", branchId)

    const { data, error } = await query
    if (error) return []

    return (data ?? []).map((row) => rowToRequest(row as Record<string, unknown>))
  } catch {
    return []
  }
}

function rowToRequest(row: Record<string, unknown>): CancellationRequest {
  return {
    id: String(row.id || ""),
    orderId: String(row.order_id || ""),
    branchId: row.branch_id ? String(row.branch_id) : null,
    displayNumber: String(row.display_number || ""),
    reason: String(row.reason || ""),
    requestedBy: String(row.requested_by || ""),
    code: String(row.code || ""),
    status: String(row.status || "pending"),
    createdAt: String(row.created_at || ""),
  }
}
