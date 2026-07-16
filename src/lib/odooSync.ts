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

// ---------- V8-C · El dinero a Odoo (facturas, pagos, reservas) ----------

/** Fecha ISO/timestamp → "YYYY-MM-DD" (formato date de Odoo). Vacío si no parsea. */
export function odooDate(iso: unknown): string {
  const s = String(iso || "").trim()
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ""
}

/**
 * El módulo local de facturación guarda la tasa como FRACCIÓN (0.16); Odoo y
 * los humanos hablan en porcentaje (16). Normaliza cualquiera de las dos.
 */
export function taxRateToPercent(rate: unknown): number {
  const n = Math.max(0, Number(rate) || 0)
  return n > 0 && n <= 1 ? n * 100 : n
}

export type LocalInvoiceForOdoo = {
  number: number
  serie: string
  customerName?: string
  subtotal: number
  taxRate: number
  tax: number
  createdAt?: string
}

/**
 * Factura del hotel → account.move (factura de cliente, queda en BORRADOR).
 * Si Odoo tiene un impuesto de venta con la misma tasa (taxId), la línea base lo
 * lleva y Odoo calcula el IVA solo (asiento cuadrado). Si no, el IVA va como
 * línea aparte para que el total coincida igual — el contador lo ajusta.
 */
export function mapInvoiceToAccountMove(
  invoice: LocalInvoiceForOdoo,
  opts: { partnerId: number; taxId?: number | null },
): Record<string, unknown> {
  const serie = String(invoice.serie || "A").trim() || "A"
  const lines: unknown[] = [
    [
      0,
      0,
      {
        name: "Estadía y servicios del hotel",
        quantity: 1,
        price_unit: Math.max(0, Number(invoice.subtotal) || 0),
        tax_ids: opts.taxId ? [[6, 0, [opts.taxId]]] : [],
      },
    ],
  ]
  const tax = Math.max(0, Number(invoice.tax) || 0)
  if (!opts.taxId && tax > 0) {
    lines.push([
      0,
      0,
      { name: `IVA ${taxRateToPercent(invoice.taxRate)}%`, quantity: 1, price_unit: tax, tax_ids: [] },
    ])
  }
  const values: Record<string, unknown> = {
    move_type: "out_invoice",
    partner_id: opts.partnerId,
    ref: `Hotel ${serie}-${Number(invoice.number) || 0}`,
    invoice_line_ids: lines,
  }
  const date = odooDate(invoice.createdAt)
  if (date) values.invoice_date = date
  return values
}

export type LocalPaymentForOdoo = {
  amount: number
  method?: string
  reference?: string
  reservationCode?: string
  createdAt?: string
}

/** Pago confirmado de reserva → account.payment (entrada de cliente, borrador). */
export function mapPaymentToOdoo(
  payment: LocalPaymentForOdoo,
  opts: { partnerId: number },
): Record<string, unknown> {
  const refParts = [
    String(payment.reservationCode || "").trim() && `Reserva ${String(payment.reservationCode).trim()}`,
    String(payment.method || "").trim(),
    String(payment.reference || "").trim(),
  ].filter(Boolean)
  const values: Record<string, unknown> = {
    payment_type: "inbound",
    partner_type: "customer",
    partner_id: opts.partnerId,
    amount: Math.max(0, Number(payment.amount) || 0),
  }
  // memo = referencia del pago desde Odoo 18 (antes "ref"; Online está al día).
  if (refParts.length > 0) values.memo = refParts.join(" · ")
  const date = odooDate(payment.createdAt)
  if (date) values.date = date
  return values
}

export type LocalReservationForOdoo = {
  code: string
  checkInDate: string
  checkOutDate: string
  nights: number
  ratePerNight: number
  status?: string
}

/**
 * Reserva → sale.order (presupuesto en borrador). La línea usa un producto
 * genérico "Estadía de hotel" (sale.order.line exige product_id).
 */
export function mapReservationToSaleOrder(
  reservation: LocalReservationForOdoo,
  opts: { partnerId: number; stayProductId: number },
): Record<string, unknown> {
  const nights = Math.max(1, Number(reservation.nights) || 1)
  const code = String(reservation.code || "").trim()
  return {
    partner_id: opts.partnerId,
    client_order_ref: code,
    note: `Reserva ${code} · ${reservation.checkInDate} → ${reservation.checkOutDate} · estado: ${String(reservation.status || "").trim() || "pendiente"}`,
    order_line: [
      [
        0,
        0,
        {
          product_id: opts.stayProductId,
          name: `Estadía ${nights} noche(s) (${reservation.checkInDate} → ${reservation.checkOutDate})`,
          product_uom_qty: nights,
          price_unit: Math.max(0, Number(reservation.ratePerNight) || 0),
          // Sin impuesto: la tarifa local YA es el precio final del huésped.
          // Si no, Odoo aplica su impuesto por defecto e infla el total.
          // (tax_ids: nombre del campo desde Odoo 17; Odoo Online siempre está al día.)
          tax_ids: [[6, 0, []]],
        },
      ],
    ],
  }
}

/**
 * Valores seguros para ACTUALIZAR en Odoo: sin los campos *_line_ids (un write
 * con [0,0,...] AGREGA líneas y duplicaría el detalle en cada re-sync).
 */
export function stripLineFields(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (key === "invoice_line_ids" || key === "order_line") continue
    out[key] = value
  }
  return out
}

// ---------- Plan de sincronización idempotente ----------

export type SyncMapEntry = { localId: string; odooId: number; recordHash: string }
export type PlannedRecord = { localId: string; hash: string }

/**
 * Un registro local listo para Odoo: su id local y los valores del modelo.
 * fingerprint (opcional) es lo que se hashea en su lugar: se usa cuando los
 * values dependen de datos que solo existen al escribir (p. ej. el partner_id
 * de Odoo) — así el plan y el dry-run no dependen de resolverlos.
 */
export type SyncableRecord = { localId: string; values: Record<string, unknown>; fingerprint?: unknown }

/** Deriva los PlannedRecord (localId + hash del contenido) para planificar. */
export function toPlannedRecords(records: SyncableRecord[]): PlannedRecord[] {
  return records.map((r) => ({
    localId: r.localId,
    hash: recordHash(r.fingerprint === undefined ? r.values : r.fingerprint),
  }))
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
