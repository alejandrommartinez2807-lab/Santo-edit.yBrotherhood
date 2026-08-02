// §18 (semana real, barrido 2026-07-29) — familia "operación a medias" en la
// COMPRA a proveedor. El flujo real aplica el stock ANTES de guardar la
// factura: si la factura falla, el inventario quedaba inflado con un
// movimiento "Compra" apuntando a una factura que nunca existió; y si el
// movimiento fallaba, el stock cambiaba SIN rastro (el mismo agujero de
// trazabilidad de BH-SIM-004, al revés). Estos tests fijan la compensación.
import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = {
  table: string
  op: string
  payload?: Record<string, unknown>
  filters: Array<[string, string, unknown]>
}

const calls: Call[] = []
let responders: Array<(call: Call) => { data?: unknown; error?: unknown }> = []

function makeBuilder(table: string) {
  const call: Call = { table, op: "", payload: undefined, filters: [] }
  const finish = () => {
    calls.push(call)
    const responder = responders.shift()
    return Promise.resolve(responder ? responder(call) : { data: null, error: null })
  }
  const builder: Record<string, unknown> = {
    insert: (p: Record<string, unknown>) => {
      call.op = "insert"
      call.payload = p
      return builder
    },
    update: (p: Record<string, unknown>) => {
      call.op = "update"
      call.payload = p
      return builder
    },
    delete: () => {
      call.op = "delete"
      return builder
    },
    select: () => {
      if (!call.op) call.op = "select"
      return builder
    },
    eq: (column: string, value: unknown) => {
      call.filters.push(["eq", column, value])
      return builder
    },
    maybeSingle: finish,
    single: finish,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      finish().then(resolve, reject),
  }
  return builder
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => makeBuilder(table) }),
}))

import { saveSupplierPurchase } from "@/lib/ordersStoreSupplierPurchases"

const INPUT = {
  supplierId: "sup-1",
  supplierName: "Carnes El Toro",
  purchaseDate: "2026-08-04",
  dueDate: "",
  documentNumber: "FT-9999",
  totalUSD: 120,
  totalVES: 4800,
  note: "",
  inventoryItemId: "inv-carne",
  inventoryItemName: "Carne 150g",
  inventoryQuantity: 5,
  inventoryUnit: "kg",
}

beforeEach(() => {
  calls.length = 0
  responders = []
})

describe("saveSupplierPurchase — operación a medias (§18)", () => {
  it("factura falla tras aplicar stock: revierte el stock y borra el movimiento huérfano", async () => {
    responders = [
      // 1. stock actual
      () => ({ data: { quantity: 10, unit: "kg" } }),
      // 2. stock 10 → 15. Con el candado optimista el UPDATE pide la fila
      //    tocada: si vuelve vacío es que alguien cambió el stock entremedio.
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      // 3. movimiento "Compra" OK
      () => ({ error: null }),
      // 4. LA FACTURA FALLA
      () => ({ data: null, error: { message: "insert de factura reventó" } }),
      // 5. compensación: relee stock
      () => ({ data: { quantity: 15 } }),
      // 6. compensación: stock 15 → 10
      () => ({ error: null }),
      // 7. compensación: borra el movimiento huérfano
      () => ({ error: null }),
    ]

    await expect(saveSupplierPurchase(INPUT, "sede-1")).rejects.toThrow(
      "insert de factura reventó",
    )

    // El stock volvió a 10 con lock optimista (solo si seguía en 15).
    const revert = calls[5]
    expect(revert.table).toBe("inventory_items")
    expect(revert.op).toBe("update")
    expect(revert.payload?.quantity).toBe(10)
    expect(revert.filters).toContainEqual(["eq", "quantity", 15])

    // El movimiento borrado es EXACTAMENTE el que nació en esta compra.
    const movementId = calls[2].payload?.id
    const cleanup = calls[6]
    expect(cleanup.table).toBe("inventory_movements")
    expect(cleanup.op).toBe("delete")
    expect(cleanup.filters).toContainEqual(["eq", "id", movementId])
  })

  it("movimiento falla tras subir el stock: el stock vuelve atrás (nunca stock sin rastro)", async () => {
    responders = [
      // 1. stock actual
      () => ({ data: { quantity: 10, unit: "kg" } }),
      // 2. stock 10 → 15 (con candado: devuelve la fila tocada)
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      // 3. EL MOVIMIENTO FALLA
      () => ({ error: { message: "insert de movimiento reventó" } }),
      // 4. compensación: stock de vuelta a 10
      () => ({ error: null }),
    ]

    await expect(saveSupplierPurchase(INPUT, "sede-1")).rejects.toThrow(
      "insert de movimiento reventó",
    )

    const revert = calls[3]
    expect(revert.table).toBe("inventory_items")
    expect(revert.op).toBe("update")
    expect(revert.payload?.quantity).toBe(10)
    // Lock optimista: solo si el stock seguía en el valor que dejamos.
    expect(revert.filters).toContainEqual(["eq", "quantity", 15])
  })

  it("el camino feliz no cambia: stock, movimiento y factura en ese orden", async () => {
    responders = [
      () => ({ data: { quantity: 10, unit: "kg" } }),
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      () => ({ error: null }),
      (call) => ({ data: { id: "compra-1", ...call.payload }, error: null }),
    ]

    const purchase = await saveSupplierPurchase(INPUT, "sede-1")
    expect(purchase.id).toBe("compra-1")
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      "inventory_items:select",
      "inventory_items:update",
      "inventory_movements:insert",
      "supplier_purchases:insert",
    ])
  })
})
