import { captureError } from "@/lib/monitoring"
import { getGuestProfiles } from "@/lib/ordersGuestProfiles"
import { getMenuProducts } from "@/lib/ordersMenu"
import { getInvoices } from "@/lib/ordersStoreInvoices"
import { getReservationPayments, type ReservationPayment } from "@/lib/ordersStoreReservationPayments"
import {
  getHotelReservationByCode,
  getHotelReservationById,
  getHotelReservations,
  type HotelReservation,
} from "@/lib/ordersStoreHotelReservations"
import {
  getOdooIntegration,
  getOdooSyncMap,
  updateOdooConnectionState,
  upsertOdooSyncEntry,
  type OdooIntegration,
} from "@/lib/ordersStoreOdoo"
import { odooAuthenticate, odooExecute, type OdooConnection } from "@/lib/odooClient"
import {
  mapGuestToPartner,
  mapInvoiceToAccountMove,
  mapPaymentToOdoo,
  mapProductToOdoo,
  mapReservationToSaleOrder,
  planSync,
  recordHash,
  stripLineFields,
  toPlannedRecords,
  type SyncableRecord,
} from "@/lib/odooSync"

// ============================================================
// Hotel · V8-B/V8-C · Motor de sincronización con Odoo — SOLO SERVIDOR.
//
// El botón "Sincronizar ahora": empuja huéspedes (→ res.partner), productos
// (→ product.product), reservas (→ sale.order), facturas (→ account.move en
// borrador) y pagos confirmados (→ account.payment) a Odoo, idempotente vía
// odoo_sync_map (crea los nuevos, actualiza los cambiados por hash, salta los
// iguales).
//
// dryRun = simulación: NO toca Odoo, solo cuenta qué haría (comparando contra el
// mapa local). Verificable sin instancia Odoo. La escritura real solo corre con
// dryRun=false y una conexión activa y autenticada.
// ============================================================

export type SyncEntityResult = {
  entity: string
  model: string
  created: number
  updated: number
  unchanged: number
  errors: string[]
}

export type SyncReport = {
  ok: boolean
  dryRun: boolean
  message: string
  entities: SyncEntityResult[]
}

type EntitySpec = {
  entity: string
  localType: string
  model: string
  records: SyncableRecord[]
  /**
   * Para entidades cuyo payload depende de Odoo (partner_id, producto genérico):
   * arma los values recién al escribir. null ⇒ el registro no se puede empujar
   * (queda como error legible, no tumba al resto).
   */
  buildValues?: (localId: string) => Promise<Record<string, unknown> | null>
  /** Transforma los values antes de un write (p. ej. quitar *_line_ids). */
  prepareUpdate?: (values: Record<string, unknown>) => Record<string, unknown>
  /** Si la entidad no se puede sincronizar (módulo Odoo ausente), el motivo. */
  unavailableReason?: string
}

/** Sincroniza un tipo de entidad. En dryRun solo cuenta; si no, escribe en Odoo. */
async function syncEntity(
  conn: OdooConnection,
  uid: number,
  branchId: string | null | undefined,
  spec: EntitySpec,
  dryRun: boolean,
): Promise<SyncEntityResult> {
  const result: SyncEntityResult = { entity: spec.entity, model: spec.model, created: 0, updated: 0, unchanged: 0, errors: [] }
  const existing = await getOdooSyncMap(branchId, spec.localType)
  const plan = planSync(toPlannedRecords(spec.records), existing)
  result.unchanged = plan.unchanged.length

  if (dryRun) {
    result.created = plan.toCreate.length
    result.updated = plan.toUpdate.length
    return result
  }

  if (spec.unavailableReason && (plan.toCreate.length > 0 || plan.toUpdate.length > 0)) {
    result.errors.push(`${spec.entity}: ${spec.unavailableReason}`)
    return result
  }

  const valuesById = new Map(spec.records.map((r) => [r.localId, r.values]))
  const resolveValues = async (localId: string): Promise<Record<string, unknown> | null> => {
    if (spec.buildValues) return spec.buildValues(localId)
    return valuesById.get(localId) ?? null
  }

  for (const item of plan.toCreate) {
    const values = await resolveValues(item.localId)
    if (!values) {
      result.errors.push(`${spec.entity}: no se pudo armar el registro (cliente no resuelto en Odoo)`)
      continue
    }
    const res = await odooExecute(conn, uid, spec.model, "create", [values])
    if (res.ok && typeof res.result === "number") {
      await upsertOdooSyncEntry(
        { localType: spec.localType, localId: item.localId, odooModel: spec.model, odooId: res.result, recordHash: item.hash },
        branchId,
      ).catch((e) => result.errors.push(e instanceof Error ? e.message : "map"))
      result.created += 1
    } else {
      result.errors.push(res.ok ? `${spec.entity}: Odoo no devolvió id` : `${spec.entity}: ${res.error}`)
    }
  }

  for (const item of plan.toUpdate) {
    const raw = await resolveValues(item.localId)
    if (!raw) {
      result.errors.push(`${spec.entity}: no se pudo armar el registro (cliente no resuelto en Odoo)`)
      continue
    }
    const values = spec.prepareUpdate ? spec.prepareUpdate(raw) : raw
    const res = await odooExecute(conn, uid, spec.model, "write", [[item.odooId], values])
    if (res.ok) {
      await upsertOdooSyncEntry(
        { localType: spec.localType, localId: item.localId, odooModel: spec.model, odooId: item.odooId, recordHash: item.hash },
        branchId,
      ).catch((e) => result.errors.push(e instanceof Error ? e.message : "map"))
      result.updated += 1
    } else {
      result.errors.push(`${spec.entity}: ${res.error}`)
    }
  }

  return result
}

// ---------------- Resolución de apoyo en Odoo (partner, producto, impuesto) ----------------

type OdooHelpers = {
  conn: OdooConnection
  uid: number
  branchId: string | null | undefined
  partnerCache: Map<string, number>
  taxCache: Map<number, number | null>
  stayProductId: number | null
  guestPartnerByLocalId: Map<string, number>
}

function firstId(result: unknown): number | null {
  if (Array.isArray(result) && typeof result[0] === "number" && result[0] > 0) return result[0]
  return null
}

/**
 * Encuentra (o crea) el cliente en Odoo para un nombre/documento. Idempotente
 * por búsqueda: primero por vat (RIF/cédula), luego por nombre exacto; si no
 * existe, lo crea. Devuelve null si Odoo falla (el registro queda como error).
 */
async function ensurePartnerId(
  h: OdooHelpers,
  who: { name: string; vat?: string; phone?: string; email?: string },
): Promise<number | null> {
  const name = String(who.name || "").trim() || "Huésped sin nombre"
  const vat = String(who.vat || "").trim()
  const key = `${vat.toLowerCase()}|${name.toLowerCase()}`
  const cached = h.partnerCache.get(key)
  if (cached) return cached

  if (vat) {
    const byVat = await odooExecute(h.conn, h.uid, "res.partner", "search", [[["vat", "=", vat]]], { limit: 1 })
    const id = byVat.ok ? firstId(byVat.result) : null
    if (id) {
      h.partnerCache.set(key, id)
      return id
    }
  }
  const byName = await odooExecute(h.conn, h.uid, "res.partner", "search", [[["name", "=", name]]], { limit: 1 })
  const nameId = byName.ok ? firstId(byName.result) : null
  if (nameId) {
    h.partnerCache.set(key, nameId)
    return nameId
  }

  const created = await odooExecute(h.conn, h.uid, "res.partner", "create", [
    mapGuestToPartner({ fullName: name, phone: who.phone, email: who.email, documentNumber: vat }),
  ])
  if (created.ok && typeof created.result === "number") {
    h.partnerCache.set(key, created.result)
    return created.result
  }
  return null
}

/** El producto genérico "Estadía de hotel" (sale.order.line exige product_id). */
async function ensureStayProductId(h: OdooHelpers): Promise<number | null> {
  if (h.stayProductId) return h.stayProductId
  const found = await odooExecute(
    h.conn,
    h.uid,
    "product.product",
    "search",
    [[["default_code", "=", "HOTEL-STAY"]]],
    { limit: 1 },
  )
  let id = found.ok ? firstId(found.result) : null
  if (!id) {
    const created = await odooExecute(h.conn, h.uid, "product.product", "create", [
      { name: "Estadía de hotel", type: "service", default_code: "HOTEL-STAY", list_price: 0 },
    ])
    id = created.ok && typeof created.result === "number" ? created.result : null
  }
  h.stayProductId = id
  return id
}

/** Impuesto de venta de Odoo con la misma tasa (para que el asiento cuadre solo). */
async function findSaleTaxId(h: OdooHelpers, rate: number): Promise<number | null> {
  const clean = Math.max(0, Number(rate) || 0)
  if (clean <= 0) return null
  if (h.taxCache.has(clean)) return h.taxCache.get(clean) ?? null
  const found = await odooExecute(
    h.conn,
    h.uid,
    "account.tax",
    "search",
    [[["type_tax_use", "=", "sale"], ["amount_type", "=", "percent"], ["amount", "=", clean]]],
    { limit: 1 },
  )
  const id = found.ok ? firstId(found.result) : null
  h.taxCache.set(clean, id)
  return id
}

/** ¿Existe el modelo en esta instancia (app instalada)? p. ej. sale.order. */
async function modelAvailable(h: OdooHelpers, model: string): Promise<boolean> {
  const res = await odooExecute(h.conn, h.uid, model, "search", [[]], { limit: 1 })
  return res.ok
}

/** El partner del huésped ya sincronizado (V8-B), si existe en el mapa. */
async function loadGuestPartnerMap(branchId: string | null | undefined): Promise<Map<string, number>> {
  const entries = await getOdooSyncMap(branchId, "guest").catch(() => [])
  return new Map(entries.map((e) => [e.localId, e.odooId]))
}

// ---------------- Huellas locales (hash estable sin datos de Odoo) ----------------

function reservationFingerprint(r: HotelReservation) {
  return {
    code: r.code,
    guest: r.guestName,
    checkIn: r.checkInDate,
    checkOut: r.checkOutDate,
    nights: r.nights,
    rate: r.ratePerNight,
    total: r.totalAmount,
    status: r.status,
  }
}

function paymentFingerprint(p: ReservationPayment) {
  return { amount: p.amount, method: p.method, reference: p.reference, reservation: p.reservationId, status: p.status }
}

/** Estados de reserva que valen la pena en Odoo (canceladas y no-show no van). */
function isSyncableReservation(r: HotelReservation): boolean {
  return r.status !== "cancelada" && r.status !== "no_show"
}

// ---------------- Sincronización completa (el botón) ----------------

/** Junta un resumen de una línea de todas las entidades. */
function summarize(entities: SyncEntityResult[], dryRun: boolean): string {
  const c = entities.reduce((a, e) => a + e.created, 0)
  const u = entities.reduce((a, e) => a + e.updated, 0)
  const s = entities.reduce((a, e) => a + e.unchanged, 0)
  const errs = entities.reduce((a, e) => a + e.errors.length, 0)
  const verb = dryRun ? "se crearían" : "creados"
  const verb2 = dryRun ? "se actualizarían" : "actualizados"
  return `${c} ${verb} · ${u} ${verb2} · ${s} sin cambios${errs ? ` · ${errs} errores` : ""}`
}

/**
 * Corre la sincronización completa (huéspedes + productos + reservas + facturas
 * + pagos confirmados). dryRun=true no toca Odoo (verificable offline). Nunca lanza.
 */
export async function runOdooSync(
  branchId: string | null | undefined,
  options: { dryRun: boolean },
): Promise<SyncReport> {
  const dryRun = options.dryRun
  try {
    const integration = await getOdooIntegration(branchId)
    if (!integration || !integration.active) {
      return { ok: false, dryRun, message: "Primero configura y activa la conexión con Odoo.", entities: [] }
    }
    const conn: OdooConnection = {
      baseUrl: integration.baseUrl,
      dbName: integration.dbName,
      login: integration.login,
      apiKey: integration.apiKey,
    }

    // La escritura real exige autenticar; el dry-run no toca Odoo.
    let uid = 0
    if (!dryRun) {
      const auth = await odooAuthenticate(conn)
      if (!auth.ok) return { ok: false, dryRun, message: auth.error, entities: [] }
      uid = auth.uid
    }

    const [guests, products, reservationsAll, invoices, paymentsAll] = await Promise.all([
      getGuestProfiles(branchId).catch(() => []),
      getMenuProducts({ includeInactive: false }, branchId).catch(() => []),
      getHotelReservations({}, branchId).catch(() => []),
      getInvoices(branchId).catch(() => []),
      getReservationPayments({}, branchId).catch(() => []),
    ])
    const reservations = reservationsAll.filter(isSyncableReservation)
    const payments = paymentsAll.filter((p) => p.status === "confirmado")
    const reservationById = new Map(reservations.map((r) => [r.id, r]))

    const helpers: OdooHelpers = {
      conn,
      uid,
      branchId,
      partnerCache: new Map(),
      taxCache: new Map(),
      stayProductId: null,
      guestPartnerByLocalId: dryRun ? new Map() : await loadGuestPartnerMap(branchId),
    }

    // El cliente en Odoo de una reserva: su huésped del CRM si ya se sincronizó
    // (V8-B corre antes), o buscar/crear por nombre y teléfono.
    const partnerForReservation = async (r: HotelReservation): Promise<number | null> => {
      const fromGuest = r.guestId ? helpers.guestPartnerByLocalId.get(r.guestId) : undefined
      if (fromGuest) return fromGuest
      return ensurePartnerId(helpers, { name: r.guestName, phone: r.guestPhone })
    }

    // Con las apps de Odoo ausentes (Ventas/Contabilidad), avisar claro en vez
    // de un error crudo por registro. Solo se consulta al escribir de verdad.
    const canSale = dryRun || reservations.length === 0 ? true : await modelAvailable(helpers, "sale.order")
    const canInvoice = dryRun || invoices.length === 0 ? true : await modelAvailable(helpers, "account.move")
    const canPayment = dryRun || payments.length === 0 ? true : await modelAvailable(helpers, "account.payment")

    const specs: EntitySpec[] = [
      {
        entity: "Huéspedes",
        localType: "guest",
        model: "res.partner",
        records: guests.map((g) => ({
          localId: g.id,
          values: mapGuestToPartner({ fullName: g.fullName, phone: g.phone, email: g.email }),
        })),
      },
      {
        entity: "Productos",
        localType: "product",
        model: "product.product",
        records: products.map((p) => ({
          localId: String(p.id),
          values: mapProductToOdoo({ name: p.name, price: p.price, sku: `MENU-${p.id}` }),
        })),
      },
      {
        entity: "Reservas",
        localType: "reservation",
        model: "sale.order",
        unavailableReason: canSale ? undefined : "la app Ventas no está instalada en ese Odoo",
        records: reservations.map((r) => ({ localId: r.id, values: {}, fingerprint: reservationFingerprint(r) })),
        buildValues: async (localId) => {
          const r = reservationById.get(localId)
          if (!r) return null
          const partnerId = await partnerForReservation(r)
          const stayProductId = await ensureStayProductId(helpers)
          if (!partnerId || !stayProductId) return null
          return mapReservationToSaleOrder(r, { partnerId, stayProductId })
        },
        prepareUpdate: stripLineFields,
      },
      {
        entity: "Facturas",
        localType: "invoice",
        model: "account.move",
        unavailableReason: canInvoice ? undefined : "la app Contabilidad/Facturación no está instalada en ese Odoo",
        records: invoices.map((inv) => ({
          localId: inv.id,
          values: {},
          fingerprint: {
            number: inv.number,
            serie: inv.serie,
            name: inv.customerName,
            rif: inv.customerRif,
            subtotal: inv.subtotal,
            taxRate: inv.taxRate,
            tax: inv.tax,
            total: inv.total,
          },
        })),
        buildValues: async (localId) => {
          const inv = invoices.find((i) => i.id === localId)
          if (!inv) return null
          const partnerId = await ensurePartnerId(helpers, { name: inv.customerName, vat: inv.customerRif })
          if (!partnerId) return null
          const taxId = await findSaleTaxId(helpers, inv.taxRate)
          return mapInvoiceToAccountMove(inv, { partnerId, taxId })
        },
        prepareUpdate: stripLineFields,
      },
      {
        entity: "Pagos",
        localType: "payment",
        model: "account.payment",
        unavailableReason: canPayment ? undefined : "la app Contabilidad no está instalada en ese Odoo",
        records: payments.map((p) => ({ localId: p.id, values: {}, fingerprint: paymentFingerprint(p) })),
        buildValues: async (localId) => {
          const p = payments.find((x) => x.id === localId)
          if (!p) return null
          const r = p.reservationId ? reservationById.get(p.reservationId) : undefined
          const partnerId = r
            ? await partnerForReservation(r)
            : await ensurePartnerId(helpers, { name: "Huésped del hotel" })
          if (!partnerId) return null
          return mapPaymentToOdoo(
            { amount: p.amount, method: p.method, reference: p.reference, reservationCode: r?.code, createdAt: p.createdAt },
            { partnerId },
          )
        },
      },
    ]

    const entities: SyncEntityResult[] = []
    for (const spec of specs) {
      entities.push(await syncEntity(conn, uid, branchId, spec, dryRun))
    }

    const message = summarize(entities, dryRun)
    await updateOdooConnectionState(branchId, {
      lastResult: `${dryRun ? "Simulación" : "Sincronización"}: ${message}`,
      touchSync: !dryRun,
    }).catch(() => {})

    return { ok: true, dryRun, message, entities }
  } catch (error) {
    captureError(error, { route: "lib/odooSyncEngine", action: "runOdooSync" })
    return { ok: false, dryRun, message: error instanceof Error ? error.message : "Error de sincronización", entities: [] }
  }
}

// ---------------- V8-D · Empuje individual (sincronización en vivo) ----------------

function liveHelpers(conn: OdooConnection, uid: number, branchId: string | null | undefined): OdooHelpers {
  return { conn, uid, branchId, partnerCache: new Map(), taxCache: new Map(), stayProductId: null, guestPartnerByLocalId: new Map() }
}

function connectionOf(integration: OdooIntegration): OdooConnection {
  return { baseUrl: integration.baseUrl, dbName: integration.dbName, login: integration.login, apiKey: integration.apiKey }
}

/**
 * Empuja UNA reserva a Odoo (sale.order) al vuelo: crea o actualiza según el
 * mapa. Best-effort para el modo "en vivo" (V8-D). Nunca lanza.
 */
export async function pushReservationToOdoo(
  code: string,
  branchId: string | null | undefined,
  integration: OdooIntegration,
): Promise<void> {
  try {
    const reservation = await getHotelReservationByCode(code, branchId)
    if (!reservation || !isSyncableReservation(reservation)) return
    const conn = connectionOf(integration)
    const auth = await odooAuthenticate(conn)
    if (!auth.ok) return
    const helpers = liveHelpers(conn, auth.uid, branchId)
    helpers.guestPartnerByLocalId = await loadGuestPartnerMap(branchId)

    const fromGuest = reservation.guestId ? helpers.guestPartnerByLocalId.get(reservation.guestId) : undefined
    const partnerId =
      fromGuest ?? (await ensurePartnerId(helpers, { name: reservation.guestName, phone: reservation.guestPhone }))
    const stayProductId = await ensureStayProductId(helpers)
    if (!partnerId || !stayProductId) return

    const values = mapReservationToSaleOrder(reservation, { partnerId, stayProductId })
    const hash = recordHash(reservationFingerprint(reservation))
    const existing = await getOdooSyncMap(branchId, "reservation")
    const prev = existing.find((e) => e.localId === reservation.id)

    if (prev) {
      if (prev.recordHash === hash) return
      const res = await odooExecute(conn, auth.uid, "sale.order", "write", [[prev.odooId], stripLineFields(values)])
      if (!res.ok) return
      await upsertOdooSyncEntry(
        { localType: "reservation", localId: reservation.id, odooModel: "sale.order", odooId: prev.odooId, recordHash: hash },
        branchId,
      )
      return
    }
    const created = await odooExecute(conn, auth.uid, "sale.order", "create", [values])
    if (created.ok && typeof created.result === "number") {
      await upsertOdooSyncEntry(
        { localType: "reservation", localId: reservation.id, odooModel: "sale.order", odooId: created.result, recordHash: hash },
        branchId,
      )
    }
  } catch (error) {
    captureError(error, { route: "lib/odooSyncEngine", action: "pushReservationToOdoo" })
  }
}

/**
 * Empuja UN pago confirmado a Odoo (account.payment) al vuelo. Idempotente por
 * el mapa (un pago ya empujado no se repite). Best-effort. Nunca lanza.
 */
export async function pushPaymentToOdoo(
  paymentId: string,
  reservationId: string,
  branchId: string | null | undefined,
  integration: OdooIntegration,
): Promise<void> {
  try {
    if (!paymentId || !reservationId) return
    const payments = await getReservationPayments({ reservationId }, branchId)
    const payment = payments.find((p) => p.id === paymentId)
    if (!payment || payment.status !== "confirmado") return

    const existing = await getOdooSyncMap(branchId, "payment")
    if (existing.some((e) => e.localId === payment.id)) return

    const conn = connectionOf(integration)
    const auth = await odooAuthenticate(conn)
    if (!auth.ok) return
    const helpers = liveHelpers(conn, auth.uid, branchId)
    helpers.guestPartnerByLocalId = await loadGuestPartnerMap(branchId)

    const reservation = await getHotelReservationById(reservationId, branchId).catch(() => null)
    const fromGuest = reservation?.guestId ? helpers.guestPartnerByLocalId.get(reservation.guestId) : undefined
    const partnerId =
      fromGuest ??
      (await ensurePartnerId(helpers, {
        name: reservation?.guestName || "Huésped del hotel",
        phone: reservation?.guestPhone,
      }))
    if (!partnerId) return

    const values = mapPaymentToOdoo(
      {
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        reservationCode: reservation?.code,
        createdAt: payment.createdAt,
      },
      { partnerId },
    )
    const created = await odooExecute(conn, auth.uid, "account.payment", "create", [values])
    if (created.ok && typeof created.result === "number") {
      await upsertOdooSyncEntry(
        {
          localType: "payment",
          localId: payment.id,
          odooModel: "account.payment",
          odooId: created.result,
          recordHash: recordHash(paymentFingerprint(payment)),
        },
        branchId,
      )
    }
  } catch (error) {
    captureError(error, { route: "lib/odooSyncEngine", action: "pushPaymentToOdoo" })
  }
}
