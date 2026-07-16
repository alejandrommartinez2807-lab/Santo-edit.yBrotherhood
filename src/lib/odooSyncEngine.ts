import { captureError } from "@/lib/monitoring"
import { getGuestProfiles } from "@/lib/ordersGuestProfiles"
import { getMenuProducts } from "@/lib/ordersMenu"
import {
  getOdooIntegration,
  getOdooSyncMap,
  updateOdooConnectionState,
  upsertOdooSyncEntry,
} from "@/lib/ordersStoreOdoo"
import { odooAuthenticate, odooExecute, type OdooConnection } from "@/lib/odooClient"
import {
  mapGuestToPartner,
  mapProductToOdoo,
  planSync,
  toPlannedRecords,
  type SyncableRecord,
} from "@/lib/odooSync"

// ============================================================
// Hotel · V8-B · Motor de sincronización con Odoo — SOLO SERVIDOR.
//
// El botón "Sincronizar ahora": empuja huéspedes (→ res.partner) y productos
// (→ product.product) a Odoo, idempotente vía odoo_sync_map (crea los nuevos,
// actualiza los cambiados por hash, salta los iguales).
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

  const valuesById = new Map(spec.records.map((r) => [r.localId, r.values]))

  for (const item of plan.toCreate) {
    const values = valuesById.get(item.localId)
    if (!values) continue
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
    const values = valuesById.get(item.localId)
    if (!values) continue
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
 * Corre la sincronización completa (huéspedes + productos).
 * dryRun=true no toca Odoo (verificable offline). Nunca lanza.
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

    const [guests, products] = await Promise.all([
      getGuestProfiles(branchId).catch(() => []),
      getMenuProducts({ includeInactive: false }, branchId).catch(() => []),
    ])

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
