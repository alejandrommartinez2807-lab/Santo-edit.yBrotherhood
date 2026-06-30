import { describe, it, expect, beforeEach } from "vitest"
import {
  readQueue,
  enqueueOrder,
  removeFromQueue,
  queueSize,
  flushQueue,
} from "@/lib/offlineQueue"

function fakeStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

describe("cola offline", () => {
  let store: ReturnType<typeof fakeStore>
  beforeEach(() => {
    store = fakeStore()
  })

  it("encola, lee y quita pedidos", () => {
    expect(queueSize(store)).toBe(0)
    const a = enqueueOrder({ customerName: "A" }, store)
    enqueueOrder({ customerName: "B" }, store)
    expect(queueSize(store)).toBe(2)
    expect(readQueue(store)[0].payload).toEqual({ customerName: "A" })
    removeFromQueue(a.id, store)
    expect(queueSize(store)).toBe(1)
  })

  it("flush envía los aceptados y vacía la cola", async () => {
    enqueueOrder({ n: 1 }, store)
    enqueueOrder({ n: 2 }, store)
    const r = await flushQueue(async () => ({ ok: true, status: 200 }), store)
    expect(r.sent).toBe(2)
    expect(r.remaining).toBe(0)
  })

  it("flush descarta rechazos 4xx (validación) sin reintentar", async () => {
    enqueueOrder({ bad: true }, store)
    const r = await flushQueue(async () => ({ ok: false, status: 400 }), store)
    expect(r.dropped).toBe(1)
    expect(r.remaining).toBe(0)
  })

  it("flush conserva en 5xx (reintento) e incrementa tries", async () => {
    enqueueOrder({ n: 1 }, store)
    const r = await flushQueue(async () => ({ ok: false, status: 503 }), store)
    expect(r.sent).toBe(0)
    expect(r.remaining).toBe(1)
    expect(readQueue(store)[0].tries).toBe(1)
  })

  it("flush se detiene y conserva todo si no hay red (submit lanza)", async () => {
    enqueueOrder({ n: 1 }, store)
    enqueueOrder({ n: 2 }, store)
    const r = await flushQueue(async () => {
      throw new Error("network")
    }, store)
    expect(r.sent).toBe(0)
    expect(r.remaining).toBe(2)
  })
})
