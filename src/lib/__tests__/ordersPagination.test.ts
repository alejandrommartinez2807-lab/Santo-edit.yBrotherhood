import { describe, expect, it, vi, beforeEach } from "vitest"

// Auditoría 2026-08-02 · hallazgo crítico de integridad.
//
// PostgREST corta en 1000 filas. `getOrdersFromStore` pedía TODAS las líneas de
// TODOS los pedidos en una sola consulta y además descartaba su error: pasando
// ese tope, la mayoría de los pedidos llegaba sin productos —sin avisar— al
// panel, a cocina y a la fotografía del cierre.

type Row = Record<string, unknown>

const PAGE = 1000

// Base de datos de mentira: 1200 pedidos con 1 línea cada uno. Con la consulta
// vieja (una sola página) las líneas de los últimos 200 se perdían.
const ORDERS: Row[] = Array.from({ length: 1200 }, (_, index) => ({
  id: `pedido-${index}`,
  branch_id: "sede-1",
  created_at: new Date(Date.UTC(2026, 7, 2, 0, 0, index)).toISOString(),
  status: "Entregado",
}))

const ITEMS: Row[] = ORDERS.map((order, index) => ({
  id: `linea-${index}`,
  order_id: order.id,
  sort_order: 0,
  name: "Smash burger",
  quantity: 1,
  unit_price_usd: 5,
}))

let itemQueriesSeen = 0
let itemsShouldFail = false

// El builder de Supabase encadena en cualquier orden y solo se resuelve al
// hacer `await`. El mock replica eso: todo devuelve el mismo objeto, que es
// thenable.
function makeQuery(table: string) {
  const state: { ids?: string[]; from: number; to: number } = { from: 0, to: 0 }

  function resolve() {
    if (table === "orders") {
      return { data: ORDERS.slice(state.from, state.to + 1), error: null }
    }

    itemQueriesSeen += 1

    if (itemsShouldFail) {
      return { data: null, error: { message: "boom en order_items" } }
    }

    const scoped = ITEMS.filter((item) =>
      (state.ids ?? []).includes(item.order_id as string),
    )
    return { data: scoped.slice(state.from, state.to + 1), error: null }
  }

  const query = {
    select: () => query,
    order: () => query,
    eq: () => query,
    in: (_column: string, values: string[]) => {
      state.ids = values
      return query
    },
    range: (from: number, to: number) => {
      state.from = from
      state.to = to
      return query
    },
    then: (
      onFulfilled: (value: { data: unknown[] | null; error: unknown }) => unknown,
    ) => Promise.resolve(resolve()).then(onFulfilled),
  }

  return query
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => makeQuery(table) }),
}))

vi.mock("./../ordersStoreMappers", () => ({
  itemRowToOrderItem: (row: Row) => ({ name: row.name, quantity: row.quantity }),
  orderRowToLocalOrder: (row: Row, items: unknown[]) => ({ id: row.id, items }),
}))

describe("getOrdersFromStore — paginación y errores", () => {
  beforeEach(() => {
    itemQueriesSeen = 0
    itemsShouldFail = false
  })

  it("trae los 1200 pedidos aunque cada página tope en 1000", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    const orders = await getOrdersFromStore("sede-1")

    expect(orders).toHaveLength(ORDERS.length)
  })

  it("NINGÚN pedido se queda sin sus líneas", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    const orders = (await getOrdersFromStore("sede-1")) as unknown as {
      id: string
      items: unknown[]
    }[]

    const sinLineas = orders.filter((order) => order.items.length === 0)
    expect(sinLineas).toEqual([])
  })

  it("las líneas se piden por lotes, no todas en una URL gigante", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    await getOrdersFromStore("sede-1")

    // 1200 pedidos / 200 por consulta = al menos 6 peticiones.
    expect(itemQueriesSeen).toBeGreaterThanOrEqual(6)
  })

  it("si falla la lectura de líneas, revienta en vez de devolver pedidos vacíos", async () => {
    itemsShouldFail = true
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")

    await expect(getOrdersFromStore("sede-1")).rejects.toThrow(/order_items/)
  })

  it("una página incompleta corta el bucle (no se queda pidiendo para siempre)", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    const orders = await getOrdersFromStore("sede-1")

    expect(orders.length).toBeLessThanOrEqual(PAGE * 2)
  })
})
