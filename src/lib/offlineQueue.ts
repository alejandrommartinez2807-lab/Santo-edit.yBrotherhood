// Cola de pedidos offline: si al registrar un pedido no hay red, se guarda
// localmente y se reintenta al reconectar. Así un POS no pierde ventas cuando
// se cae el internet. La lógica es pura/inyectable para poder testearla.

const QUEUE_KEY = "santo_offline_order_queue_v1"

export type QueuedOrder = {
  id: string
  payload: unknown
  createdAt: number
  tries: number
}

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getStore(storage?: StorageLike): StorageLike | null {
  if (storage) return storage
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage
  return null
}

export function readQueue(storage?: StorageLike): QueuedOrder[] {
  const store = getStore(storage)
  if (!store) return []
  try {
    const raw = store.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as QueuedOrder[]) : []
  } catch {
    return []
  }
}

function writeQueue(list: QueuedOrder[], storage?: StorageLike) {
  const store = getStore(storage)
  if (!store) return
  try {
    store.setItem(QUEUE_KEY, JSON.stringify(list))
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function enqueueOrder(payload: unknown, storage?: StorageLike): QueuedOrder {
  const item: QueuedOrder = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    createdAt: Date.now(),
    tries: 0,
  }
  const list = readQueue(storage)
  list.push(item)
  writeQueue(list, storage)
  return item
}

export function removeFromQueue(id: string, storage?: StorageLike) {
  writeQueue(
    readQueue(storage).filter((q) => q.id !== id),
    storage,
  )
}

export function queueSize(storage?: StorageLike): number {
  return readQueue(storage).length
}

// Envía los pedidos en cola usando `submit`. Quita los que se aceptan (200) o
// que el servidor rechaza definitivamente (4xx, ej. validación), e incrementa
// `tries` en los que fallan por red/5xx (se reintentarán luego). Si `submit`
// lanza (sin red), detiene el flush dejando la cola intacta.
export async function flushQueue(
  submit: (payload: unknown) => Promise<{ ok: boolean; status: number }>,
  storage?: StorageLike,
): Promise<{ sent: number; dropped: number; remaining: number }> {
  let sent = 0
  let dropped = 0

  for (const item of readQueue(storage)) {
    let res: { ok: boolean; status: number }
    try {
      res = await submit(item.payload)
    } catch {
      // Sin red: paramos y conservamos lo que queda.
      break
    }

    if (res.ok) {
      removeFromQueue(item.id, storage)
      sent++
    } else if (res.status >= 400 && res.status < 500) {
      // Rechazo definitivo (validación, etc.): no tiene sentido reintentar.
      removeFromQueue(item.id, storage)
      dropped++
    } else {
      // 5xx u otro: incrementar intentos y conservar.
      writeQueue(
        readQueue(storage).map((q) => (q.id === item.id ? { ...q, tries: q.tries + 1 } : q)),
        storage,
      )
    }
  }

  return { sent, dropped, remaining: queueSize(storage) }
}
