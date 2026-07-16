// ============================================================
// Hotel · V8-A · Conector Odoo — lógica PURA (sin DB ni red).
//
// Complementamos Odoo, no competimos: le empujamos los datos hoteleros por su
// API externa JSON-RPC (POST a {url}/jsonrpc). Aquí vive todo lo testeable:
// armado de las llamadas, lectura de la respuesta, mapeo de entidades y el
// PLAN de sincronización idempotente (crear / actualizar / saltar por hash).
// El transporte (fetch real) vive en odooClient.ts (solo servidor).
// ============================================================

/** Normaliza la URL de Odoo: sin barra final, con https:// si falta el esquema. */
export function normalizeOdooBaseUrl(raw: unknown): string {
  const s = String(raw || "").trim().replace(/\/+$/, "")
  if (!s) return ""
  if (!/^https?:\/\//i.test(s)) return `https://${s}`
  return s
}

export type JsonRpcBody = {
  jsonrpc: "2.0"
  method: "call"
  params: Record<string, unknown>
  id: number
}

let jsonRpcId = 0
function nextId(): number {
  jsonRpcId = (jsonRpcId % 1_000_000) + 1
  return jsonRpcId
}

/** common.authenticate(db, login, apiKey, {}) → uid. */
export function buildAuthCall(db: string, login: string, apiKey: string): JsonRpcBody {
  return {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [db, login, apiKey, {}],
    },
    id: nextId(),
  }
}

/** object.execute_kw(db, uid, apiKey, model, method, args, kwargs). */
export function buildExecuteCall(
  db: string,
  uid: number,
  apiKey: string,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): JsonRpcBody {
  return {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [db, uid, apiKey, model, method, args, kwargs],
    },
    id: nextId(),
  }
}

export type JsonRpcParsed =
  | { ok: true; result: unknown }
  | { ok: false; error: string }

/**
 * Lee una respuesta JSON-RPC de Odoo. Éxito → { result }. Falla → { error:{...} }
 * (Odoo mete el mensaje humano en error.data.message; si no, error.message).
 */
export function parseJsonRpcResult(raw: unknown): JsonRpcParsed {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Respuesta vacía o inválida de Odoo" }
  }
  const obj = raw as Record<string, unknown>
  if ("error" in obj && obj.error) {
    const err = obj.error as Record<string, unknown>
    const data = (err.data as Record<string, unknown>) || {}
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof err.message === "string" && err.message) ||
      "Error desconocido de Odoo"
    return { ok: false, error: String(message) }
  }
  return { ok: true, result: obj.result }
}

/**
 * authenticate devuelve el uid (number) si las credenciales sirven, o false.
 * Devolvemos el uid válido o null.
 */
export function readAuthUid(parsed: JsonRpcParsed): number | null {
  if (!parsed.ok) return null
  const uid = parsed.result
  return typeof uid === "number" && uid > 0 ? uid : null
}

// ---------- Hash estable para idempotencia ----------

/** Serializa con claves ordenadas para que el hash no dependa del orden. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`
}

/** Hash FNV-1a de 32 bits en hex — determinista, suficiente para detectar cambios. */
export function recordHash(value: unknown): string {
  const str = stableStringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

// ---------- Mapeo de entidades locales → modelos de Odoo ----------

export type LocalGuest = {
  fullName?: string
  phone?: string
  email?: string
  documentNumber?: string
  address?: string
}

/** Huésped/cliente → res.partner. vat lleva el documento (RIF/cédula). */
export function mapGuestToPartner(guest: LocalGuest): Record<string, unknown> {
  const values: Record<string, unknown> = {
    name: String(guest.fullName || "").trim() || "Huésped sin nombre",
    customer_rank: 1,
  }
  const phone = String(guest.phone || "").trim()
  const email = String(guest.email || "").trim()
  const vat = String(guest.documentNumber || "").trim()
  const address = String(guest.address || "").trim()
  if (phone) values.phone = phone
  if (email) values.email = email
  if (vat) values.vat = vat
  if (address) values.street = address
  return values
}

export type LocalProduct = {
  name?: string
  price?: number
  sku?: string
  isService?: boolean
}

/** Producto del menú → product.product. */
export function mapProductToOdoo(product: LocalProduct): Record<string, unknown> {
  const values: Record<string, unknown> = {
    name: String(product.name || "").trim() || "Producto sin nombre",
    list_price: Math.max(0, Number(product.price) || 0),
    type: product.isService ? "service" : "consu",
  }
  const sku = String(product.sku || "").trim()
  if (sku) values.default_code = sku
  return values
}

// ---------- Plan de sincronización idempotente ----------

export type SyncMapEntry = { localId: string; odooId: number; recordHash: string }
export type PlannedRecord = { localId: string; hash: string }

/** Un registro local listo para Odoo: su id local y los valores del modelo. */
export type SyncableRecord = { localId: string; values: Record<string, unknown> }

/** Deriva los PlannedRecord (localId + hash de los valores) para planificar. */
export function toPlannedRecords(records: SyncableRecord[]): PlannedRecord[] {
  return records.map((r) => ({ localId: r.localId, hash: recordHash(r.values) }))
}

export type SyncPlan = {
  toCreate: PlannedRecord[]
  toUpdate: Array<PlannedRecord & { odooId: number }>
  unchanged: Array<PlannedRecord & { odooId: number }>
}

/**
 * Compara los registros locales contra el mapa ya sincronizado:
 * - sin entrada previa        → crear
 * - entrada previa, hash ≠    → actualizar (con su odooId)
 * - entrada previa, hash =    → sin cambios (saltar)
 * Idempotente: correr dos veces seguidas la segunda vez no crea nada.
 */
export function planSync(records: PlannedRecord[], existing: SyncMapEntry[]): SyncPlan {
  const byLocal = new Map(existing.map((e) => [e.localId, e]))
  const plan: SyncPlan = { toCreate: [], toUpdate: [], unchanged: [] }
  for (const record of records) {
    const prev = byLocal.get(record.localId)
    if (!prev) {
      plan.toCreate.push(record)
    } else if (prev.recordHash !== record.hash) {
      plan.toUpdate.push({ ...record, odooId: prev.odooId })
    } else {
      plan.unchanged.push({ ...record, odooId: prev.odooId })
    }
  }
  return plan
}

/** Resumen legible del resultado de una sincronización. */
export function summarizeSyncPlan(plan: SyncPlan): string {
  return `${plan.toCreate.length} nuevos · ${plan.toUpdate.length} actualizados · ${plan.unchanged.length} sin cambios`
}
