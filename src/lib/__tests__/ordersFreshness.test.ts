import { beforeEach, describe, expect, it, vi } from "vitest"

// La consulta de frescura (2026-08-04) sostiene el camino rápido del sondeo:
// dos agregados (~54 bytes) en vez de todas las filas (626 KB). La condición
// mortal (audit de la huella) es que agregue EXACTAMENTE sobre el conjunto
// que el panel ve: misma sede, misma ventana de jornada y el mismo lado de
// is_training que el filtro en memoria de la ruta. Un conjunto más angosto
// congela el panel sin error; estas pruebas fijan cada pieza del predicado.

type Row = Record<string, unknown>

const JORNADA = "2026-08-03T09:00:00.000Z"

type Captura = {
  table?: string
  select?: { columns: string; options?: { count?: string } }
  order?: [string, { ascending: boolean }]
  limit?: number
  eq: [string, unknown][]
  or: string[]
  is: [string, unknown][]
  not: [string, string, unknown][]
}

let captura: Captura
let resultado: {
  data: Row[] | null
  count: number | null
  error: { message: string } | null
}

function makeQuery() {
  const query = {
    select: (columns: string, options?: { count?: string }) => {
      captura.select = { columns, options }
      return query
    },
    order: (column: string, options: { ascending: boolean }) => {
      captura.order = [column, options]
      return query
    },
    limit: (n: number) => {
      captura.limit = n
      return query
    },
    eq: (column: string, value: unknown) => {
      captura.eq.push([column, value])
      return query
    },
    or: (filter: string) => {
      captura.or.push(filter)
      return query
    },
    is: (column: string, value: unknown) => {
      captura.is.push([column, value])
      return query
    },
    not: (column: string, operator: string, value: unknown) => {
      captura.not.push([column, operator, value])
      return query
    },
    then: (
      onFulfilled: (value: typeof resultado) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resultado).then(onFulfilled, onRejected),
  }

  return query
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      captura.table = table
      return makeQuery()
    },
  }),
}))

describe("getOrdersFreshnessFromStore — la huella agrega sobre lo que el panel ve", () => {
  beforeEach(() => {
    captura = { eq: [], or: [], is: [], not: [] }
    resultado = {
      data: [{ updated_at: "2026-08-04T13:15:57.482913+00:00" }],
      count: 42,
      error: null,
    }
  })

  it("pide bytes mínimos: solo updated_at, conteo exacto, orden desc y UNA fila", async () => {
    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")
    const freshness = await getOrdersFreshnessFromStore("sede-1", {
      createdFrom: JORNADA,
    })

    expect(captura.table).toBe("orders")
    expect(captura.select).toEqual({ columns: "updated_at", options: { count: "exact" } })
    expect(captura.order).toEqual(["updated_at", { ascending: false }])
    expect(captura.limit).toBe(1)
    expect(freshness).toEqual({
      count: 42,
      maxUpdatedAt: "2026-08-04T13:15:57.482913+00:00",
    })
  })

  it("repite EXACTO el filtro del cuerpo: mismo helper de ventana y misma sede", async () => {
    const { getOrdersFreshnessFromStore, liveOrdersWindowOrFilter } = await import(
      "@/lib/ordersStoreQueries"
    )
    await getOrdersFreshnessFromStore("sede-1", { createdFrom: JORNADA })

    // El literal se fija aquí Y en ordersLiveWindow.test.ts (el cuerpo): si el
    // helper compartido cambiara, ambos tests cantan a la vez.
    expect(liveOrdersWindowOrFilter(JORNADA)).toBe(
      `created_at.gte.${JORNADA},status.not.in.(Entregado,Cancelado)`,
    )
    expect(captura.or).toEqual([liveOrdersWindowOrFilter(JORNADA)])
    expect(captura.eq).toEqual([["branch_id", "sede-1"]])
  })

  it("sin createdFrom no hay ventana, y sin sede (consolidado) no hay eq", async () => {
    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")
    await getOrdersFreshnessFromStore(null)

    expect(captura.or).toEqual([])
    expect(captura.eq).toEqual([])
  })

  it("modo normal: agrega sobre `not is_training is true` (las filas viejas son null, no false)", async () => {
    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")
    await getOrdersFreshnessFromStore("sede-1", { createdFrom: JORNADA })

    expect(captura.not).toEqual([["is_training", "is", true]])
    expect(captura.is).toEqual([])
  })

  it("modo entrenamiento: agrega sobre el sandbox (`is_training is true`)", async () => {
    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")
    await getOrdersFreshnessFromStore("sede-1", {
      createdFrom: JORNADA,
      trainingActive: true,
    })

    expect(captura.is).toEqual([["is_training", true]])
    expect(captura.not).toEqual([])
  })

  it("conjunto vacío: count 0 y max nulo (la huella igual los distingue por contexto)", async () => {
    resultado = { data: [], count: 0, error: null }

    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")
    const freshness = await getOrdersFreshnessFromStore("sede-1")

    expect(freshness).toEqual({ count: 0, maxUpdatedAt: null })
  })

  it("un error de la base NO se traga: mejor un 500 visible que una huella inventada", async () => {
    resultado = { data: null, count: null, error: { message: "boom" } }

    const { getOrdersFreshnessFromStore } = await import("@/lib/ordersStoreQueries")

    await expect(getOrdersFreshnessFromStore("sede-1")).rejects.toThrow("boom")
  })
})
