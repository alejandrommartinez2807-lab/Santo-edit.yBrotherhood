import { describe, expect, it, beforeEach, vi } from "vitest"

// Optimización de consumo 2026-08-03. GET /api/orders acepta ?createdFrom=
// (opt-in de cocina/delivery/mesonero/pantalla): el store pide a Supabase solo
// la jornada en curso MÁS lo aún vivo de jornadas anteriores. Lo único que se
// queda fuera es lo ya terminado (Entregado/Cancelado) de días viejos.
//
// El filtro se empuja al query (un `.or` de PostgREST), no se hace en memoria:
// la gracia es que las filas viejas ni siquiera viajen desde la base.

type Row = Record<string, unknown>

const JORNADA = "2026-08-03T09:00:00.000Z" // 5:00 Caracas del 2026-08-03

const ORDERS: Row[] = [
  { id: "hoy-nuevo", created_at: "2026-08-03T22:00:00.000Z", status: "Nuevo" },
  { id: "hoy-entregado", created_at: "2026-08-03T23:00:00.000Z", status: "Entregado" },
  { id: "viejo-activo", created_at: "2026-07-30T22:00:00.000Z", status: "Preparando" },
  { id: "viejo-deuda", created_at: "2026-07-29T22:00:00.000Z", status: "Listo" },
  { id: "viejo-entregado", created_at: "2026-07-28T22:00:00.000Z", status: "Entregado" },
  { id: "viejo-cancelado", created_at: "2026-07-27T22:00:00.000Z", status: "Cancelado" },
]

let orFiltersSeen: string[] = []

// Réplica del predicado que ejecuta PostgREST con
// `or=(created_at.gte.X,status.not.in.(Entregado,Cancelado))`.
function applyOrFilter(rows: Row[], filter: string) {
  const match = filter.match(/^created_at\.gte\.(.+),status\.not\.in\.\((.+)\)$/)
  if (!match) throw new Error(`filtro .or inesperado: ${filter}`)

  const [, from, terminalesRaw] = match
  const terminales = terminalesRaw.split(",")

  return rows.filter(
    (row) =>
      String(row.created_at) >= from ||
      !terminales.includes(String(row.status)),
  )
}

function makeQuery(table: string) {
  const state: { ids?: string[]; from: number; to: number; or?: string } = {
    from: 0,
    to: 0,
  }

  function resolve() {
    if (table === "orders") {
      let rows = ORDERS
      if (state.or) rows = applyOrFilter(rows, state.or)
      return { data: rows.slice(state.from, state.to + 1), error: null }
    }

    return { data: [], error: null }
  }

  const query = {
    select: () => query,
    order: () => query,
    eq: () => query,
    in: (_column: string, values: string[]) => {
      state.ids = values
      return query
    },
    or: (filter: string) => {
      state.or = filter
      orFiltersSeen.push(filter)
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
  itemRowToOrderItem: (row: Row) => row,
  orderRowToLocalOrder: (row: Row, items: unknown[]) => ({
    id: row.id,
    status: row.status,
    items,
  }),
}))

describe("getOrdersFromStore — ventana de la jornada (createdFrom)", () => {
  beforeEach(() => {
    orFiltersSeen = []
  })

  it("sin createdFrom NO se filtra nada (los consumidores de siempre no cambian)", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    const orders = await getOrdersFromStore("sede-1")

    expect(orders).toHaveLength(ORDERS.length)
    expect(orFiltersSeen).toEqual([])
  })

  it("con createdFrom trae la jornada + lo aún vivo, y deja fuera lo terminado viejo", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    const orders = (await getOrdersFromStore("sede-1", {
      createdFrom: JORNADA,
    })) as unknown as { id: string }[]

    const ids = orders.map((order) => order.id)

    // De hoy viene TODO (incluso lo entregado: la caja/cocina del día lo ven).
    expect(ids).toContain("hoy-nuevo")
    expect(ids).toContain("hoy-entregado")
    // Lo vivo de jornadas anteriores sobrevive: una cuenta que cruzó la
    // madrugada o un pedido Listo sin cobrar no pueden desaparecer del panel.
    expect(ids).toContain("viejo-activo")
    expect(ids).toContain("viejo-deuda")
    // El peso muerto (terminado hace días) es lo único que se queda fuera.
    expect(ids).not.toContain("viejo-entregado")
    expect(ids).not.toContain("viejo-cancelado")
  })

  it("el filtro viaja en el query a Supabase, no se recorta en memoria", async () => {
    const { getOrdersFromStore } = await import("@/lib/ordersStoreQueries")
    await getOrdersFromStore("sede-1", { createdFrom: JORNADA })

    expect(orFiltersSeen).toEqual([
      `created_at.gte.${JORNADA},status.not.in.(Entregado,Cancelado)`,
    ])
  })
})
