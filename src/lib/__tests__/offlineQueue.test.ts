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
})
