// Cola de pedidos offline: si al registrar un pedido no hay red, se guarda
// localmente y se reintenta al reconectar. Así un POS no pierde ventas cuando
// se cae el internet. La lógica es pura/inyectable para poder testearla.
//
// Persistencia en IndexedDB (más robusto que localStorage: mayor cuota, no
// bloquea el hilo, transaccional). El acceso al almacenamiento está detrás de
// la interfaz `OfflineStore`, así que los tests inyectan una implementación en
// memoria y el navegador usa IndexedDB. Toda la API es asíncrona.

const DB_NAME = "santo_offline"
const DB_VERSION = 1
const STORE_NAME = "order_queue"
const LEGACY_KEY = "santo_offline_order_queue_v1"

export type QueuedOrder = {
  id: string
  payload: unknown
  createdAt: number
  tries: number
}

// Clave de idempotencia generada en el cliente (uuid). Debe crearse UNA sola vez
// por pedido y reusarse en cada reintento, para que el servidor reconozca el
// reenvío y no duplique. Ver 0018_order_idempotency.
export function newClientOrderId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    /* sin crypto: caemos al fallback */
  }
  return `co-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Almacenamiento de la cola, a nivel de registro. Implementaciones: IndexedDB
// (navegador) y en memoria (tests / fallback sin IndexedDB).
export interface OfflineStore {
  getAll(): Promise<QueuedOrder[]>
  add(item: QueuedOrder): Promise<void>
  update(item: QueuedOrder): Promise<void>
  remove(id: string): Promise<void>
}

// ---- Implementación en memoria (tests y fallback) ----------------------------

export function createMemoryOfflineStore(seed: QueuedOrder[] = []): OfflineStore {
  const map = new Map<string, QueuedOrder>(seed.map((o) => [o.id, o]))
  return {
    async getAll() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt)
    },
    async add(item) {
      map.set(item.id, item)
    },
    async update(item) {
      if (map.has(item.id)) map.set(item.id, item)
    },
    async remove(id) {
      map.delete(id)
    },
  }
}

// ---- Implementación IndexedDB ------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function createIndexedDbStore(): OfflineStore {
  let dbPromise: Promise<IDBDatabase> | null = null
  const db = () => (dbPromise ??= openDb())

  return {
    async getAll() {
      const database = await db()
      return new Promise<QueuedOrder[]>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readonly")
        const req = tx.objectStore(STORE_NAME).getAll()
        req.onsuccess = () => {
          const list = (req.result as QueuedOrder[]) ?? []
          list.sort((a, b) => a.createdAt - b.createdAt)
          resolve(list)
        }
        req.onerror = () => reject(req.error)
      })
    },
    async add(item) {
      const database = await db()
      const tx = database.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(item)
      await promisifyTx(tx)
    },
    async update(item) {
      const database = await db()
      const tx = database.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(item)
      await promisifyTx(tx)
    },
    async remove(id) {
      const database = await db()
      const tx = database.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(id)
      await promisifyTx(tx)
    },
  }
}

// Store por defecto del navegador (singleton). Si no hay IndexedDB (SSR o
// navegador muy viejo), cae a uno en memoria para no romper —no persiste, pero
// la app sigue funcionando.
let defaultStore: OfflineStore | null = null

function getDefaultStore(): OfflineStore {
  if (defaultStore) return defaultStore
  if (typeof indexedDB !== "undefined") {
    defaultStore = createIndexedDbStore()
  } else {
    defaultStore = createMemoryOfflineStore()
  }
  return defaultStore
}

function resolveStore(store?: OfflineStore): OfflineStore {
  return store ?? getDefaultStore()
}

// Migración única desde la cola vieja en localStorage (versión anterior usaba
// localStorage). Importa los pendientes a IndexedDB y limpia la clave vieja.
let migrated = false
export async function migrateLegacyQueue(store?: OfflineStore): Promise<void> {
  if (migrated) return
  migrated = true
  if (typeof window === "undefined" || !window.localStorage) return
  let raw: string | null
  try {
    raw = window.localStorage.getItem(LEGACY_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const target = resolveStore(store)
      for (const item of parsed as QueuedOrder[]) {
        if (item && typeof item.id === "string") await target.add(item)
      }
    }
  } catch {
    /* dato corrupto: lo descartamos */
  }
  try {
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

// ---- API de la cola (pura sobre OfflineStore) --------------------------------

export async function readQueue(store?: OfflineStore): Promise<QueuedOrder[]> {
  try {
    return await resolveStore(store).getAll()
  } catch {
    return []
  }
}

export async function enqueueOrder(
  payload: unknown,
  store?: OfflineStore,
): Promise<QueuedOrder> {
  const item: QueuedOrder = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    createdAt: Date.now(),
    tries: 0,
  }
  await resolveStore(store).add(item)
  return item
}

export async function removeFromQueue(id: string, store?: OfflineStore): Promise<void> {
  await resolveStore(store).remove(id)
}

export async function queueSize(store?: OfflineStore): Promise<number> {
  return (await readQueue(store)).length
}

// Envía los pedidos en cola usando `submit`. Quita los que se aceptan (200) o
// que el servidor rechaza definitivamente (4xx, ej. validación), e incrementa
// `tries` en los que fallan por red/5xx (se reintentarán luego). Si `submit`
// lanza (sin red), detiene el flush dejando la cola intacta.
export async function flushQueue(
  submit: (payload: unknown) => Promise<{ ok: boolean; status: number }>,
  store?: OfflineStore,
): Promise<{ sent: number; dropped: number; remaining: number }> {
  const target = resolveStore(store)
  let sent = 0
  let dropped = 0

  for (const item of await target.getAll()) {
    let res: { ok: boolean; status: number }
    try {
      res = await submit(item.payload)
    } catch {
      // Sin red: paramos y conservamos lo que queda.
      break
    }

    if (res.ok) {
      await target.remove(item.id)
      sent++
    } else if (res.status >= 400 && res.status < 500) {
      // Rechazo definitivo (validación, etc.): no tiene sentido reintentar.
      await target.remove(item.id)
      dropped++
    } else {
      // 5xx u otro: incrementar intentos y conservar.
      await target.update({ ...item, tries: item.tries + 1 })
    }
  }

  return { sent, dropped, remaining: await queueSize(store) }
}
