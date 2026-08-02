// Auditoría 2026-08-02 · el inventario se inflaba solo en hora punta.
//
// La compra a proveedor leía el stock y escribía el total calculado a pelo. Si
// entre la lectura y la escritura entraba un pedido que consumía ese insumo, la
// compra pisaba el descuento y la mercancía VENDIDA reaparecía en el stock. Las
// alertas de reposición no saltaban a tiempo, el margen quedaba falseado y el
// conteo físico no cuadraba nunca (el movimiento sí quedaba en el historial,
// pero el saldo no lo reflejaba).
//
// El consumo de las ventas ya usaba candado optimista; la compra no.
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
  documentNumber: "FT-1",
  totalUSD: 100,
  totalVES: 4000,
  note: "",
  inventoryItemId: "inv-carne",
  inventoryItemName: "Carne 150g",
  inventoryQuantity: 20,
  inventoryUnit: "kg",
}

beforeEach(() => {
  calls.length = 0
  responders = []
})

describe("compra a proveedor frente a una venta simultánea", () => {
  it("el UPDATE lleva candado: exige que el stock siga como se leyó", async () => {
    responders = [
      () => ({ data: { quantity: 2, unit: "kg" } }),
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      () => ({ error: null }),
      (call) => ({ data: { id: "compra-1", ...call.payload }, error: null }),
    ]

    await saveSupplierPurchase(INPUT, "sede-1")

    const update = calls[1]
    expect(update.table).toBe("inventory_items")
    expect(update.op).toBe("update")
    expect(update.filters).toContainEqual(["eq", "quantity", 2])
    expect(update.payload?.quantity).toBe(22)
  })

  it("si una venta se cuela entremedio, la compra NO la pisa: relee y recalcula", async () => {
    responders = [
      // 1. stock actual: 2 kg
      () => ({ data: { quantity: 2, unit: "kg" } }),
      // 2. el UPDATE 2 → 22 no empareja: entremedio un pedido consumió 0,4 kg
      //    y el stock real ya es 1,6. Devuelve cero filas.
      () => ({ data: [], error: null }),
      // 3. relectura: 1,6
      () => ({ data: { quantity: 1.6 } }),
      // 4. reintento 1,6 → 21,6 (ahora sí)
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      // 5. movimiento
      () => ({ error: null }),
      // 6. factura
      (call) => ({ data: { id: "compra-1", ...call.payload }, error: null }),
    ]

    await saveSupplierPurchase(INPUT, "sede-1")

    const reintento = calls[3]
    expect(reintento.op).toBe("update")
    // 21,6 y NO 22: los 0,4 kg vendidos siguen descontados.
    expect(reintento.payload?.quantity).toBe(21.6)
    expect(reintento.filters).toContainEqual(["eq", "quantity", 1.6])
  })

  it("el movimiento del historial refleja el saldo bueno, no el pisado", async () => {
    responders = [
      () => ({ data: { quantity: 2, unit: "kg" } }),
      () => ({ data: [], error: null }),
      () => ({ data: { quantity: 1.6 } }),
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      () => ({ error: null }),
      (call) => ({ data: { id: "compra-1", ...call.payload }, error: null }),
    ]

    await saveSupplierPurchase(INPUT, "sede-1")

    const movimiento = calls[4]
    expect(movimiento.table).toBe("inventory_movements")
    expect(movimiento.payload?.previous_quantity).toBe(1.6)
    expect(movimiento.payload?.final_quantity).toBe(21.6)
  })

  it("la entrada de mercancía NUNCA se rechaza por un choque", async () => {
    responders = [
      () => ({ data: { quantity: 2, unit: "kg" } }),
      () => ({ data: [], error: null }),
      () => ({ data: { quantity: 1.6 } }),
      () => ({ data: [], error: null }),
      () => ({ data: { quantity: 1.2 } }),
      () => ({ data: [{ id: "inv-carne" }], error: null }),
      () => ({ error: null }),
      (call) => ({ data: { id: "compra-1", ...call.payload }, error: null }),
    ]

    const compra = await saveSupplierPurchase(INPUT, "sede-1")
    expect(compra.id).toBe("compra-1")
  })
})
