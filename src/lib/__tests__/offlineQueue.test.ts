import { describe, it, expect, beforeEach } from "vitest"
import {
  readQueue,
  enqueueOrder,
  removeFromQueue,
  queueSize,
  flushQueue,
  createMemoryOfflineStore,
  type OfflineStore,
} from "@/lib/offlineQueue"

describe("cola offline", () => {
  let store: OfflineStore
  beforeEach(() => {
    store = createMemoryOfflineStore()
  })

  it("encola, lee y quita pedidos", async () => {
    expect(await queueSize(store)).toBe(0)
    const a = await enqueueOrder({ customerName: "A" }, store)
    await enqueueOrder({ customerName: "B" }, store)
    expect(await queueSize(store)).toBe(2)
    expect((await readQueue(store))[0].payload).toEqual({ customerName: "A" })
    await removeFromQueue(a.id, store)
    expect(await queueSize(store)).toBe(1)
  })

  it("flush envía los aceptados y vacía la cola", async () => {
    await enqueueOrder({ n: 1 }, store)
    await enqueueOrder({ n: 2 }, store)
    const r = await flushQueue(async () => ({ ok: true, status: 200 }), store)
    expect(r.sent).toBe(2)
    expect(r.remaining).toBe(0)
  })

  it("flush descarta rechazos 4xx (validación) sin reintentar", async () => {
    await enqueueOrder({ bad: true }, store)
    const r = await flushQueue(async () => ({ ok: false, status: 400 }), store)
    expect(r.dropped).toBe(1)
    expect(r.remaining).toBe(0)
  })

  it("flush conserva en 5xx (reintento) e incrementa tries", async () => {
    await enqueueOrder({ n: 1 }, store)
    const r = await flushQueue(async () => ({ ok: false, status: 503 }), store)
    expect(r.sent).toBe(0)
    expect(r.remaining).toBe(1)
    expect((await readQueue(store))[0].tries).toBe(1)
  })

  it("flush se detiene y conserva todo si no hay red (submit lanza)", async () => {
    await enqueueOrder({ n: 1 }, store)
    await enqueueOrder({ n: 2 }, store)
    const r = await flushQueue(async () => {
      throw new Error("network")
    }, store)
    expect(r.sent).toBe(0)
    expect(r.remaining).toBe(2)
  })

  // Auditoría 2026-08-02: el 429 es un "espera", no un "no". Antes caía en la
  // rama genérica de 4xx y el pedido se BORRABA — al volver la señal, la cola
  // chocaba con el límite de 10 pedidos/minuto y las ventas se perdían solas.
  it("flush NO borra el pedido ante un 429: lo conserva para reintentarlo", async () => {
    await enqueueOrder({ n: 1 }, store)
    const r = await flushQueue(async () => ({ ok: false, status: 429 }), store)
    expect(r.dropped).toBe(0)
    expect(r.remaining).toBe(1)
    expect((await readQueue(store))[0].tries).toBe(1)
  })

  it("con un 429 corta el flush y no quema el cupo del resto de la cola", async () => {
    await enqueueOrder({ n: 1 }, store)
    await enqueueOrder({ n: 2 }, store)
    await enqueueOrder({ n: 3 }, store)

    let intentos = 0
    const r = await flushQueue(async () => {
      intentos += 1
      return { ok: false, status: 429 }
    }, store)

    expect(intentos).toBe(1)
    expect(r.dropped).toBe(0)
    expect(r.remaining).toBe(3)
  })

  it("408 y 425 tampoco se descartan", async () => {
    for (const status of [408, 425]) {
      const localStore = createMemoryOfflineStore()
      await enqueueOrder({ n: status }, localStore)
      const r = await flushQueue(async () => ({ ok: false, status }), localStore)
      expect(r.dropped, `status ${status}`).toBe(0)
      expect(r.remaining, `status ${status}`).toBe(1)
    }
  })
})
