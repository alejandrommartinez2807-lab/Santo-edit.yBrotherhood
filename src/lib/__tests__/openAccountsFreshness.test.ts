import { beforeEach, describe, expect, it, vi } from "vitest"

// La huella de /api/open-accounts (2026-08-04) agrega sobre DOS conjuntos:
// las cuentas filtradas (mismo filtro que el cuerpo) y los pedidos anclados a
// alguna cuenta — porque el payload incluye los pedidos de cada cuenta y sus
// líneas, y esas escrituras no tocan open_accounts. Un conjunto más angosto
// congelaría el panel sin error; estas pruebas fijan cada pieza.

type Row = Record<string, unknown>

type Captura = {
  select?: { columns: string; options?: { count?: string } }
  order?: [string, { ascending: boolean }]
  limit?: number
  eq: [string, unknown][]
  not: [string, string, unknown][]
}

let capturas: Record<string, Captura>
let resultados: Record<
  string,
  { data: Row[] | null; count: number | null; error: { message: string } | null }
>

function makeQuery(tabla: string) {
  const captura = capturas[tabla]
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
    not: (column: string, operator: string, value: unknown) => {
      captura.not.push([column, operator, value])
      return query
    },
    then: (
      onFulfilled: (value: (typeof resultados)[string]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resultados[tabla]).then(onFulfilled, onRejected),
  }

  return query
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ from: (tabla: string) => makeQuery(tabla) }),
}))

describe("getOpenAccountsFreshnessFromStore", () => {
  beforeEach(() => {
    capturas = {
      open_accounts: { eq: [], not: [] },
      orders: { eq: [], not: [] },
    }
    resultados = {
      open_accounts: {
        data: [{ updated_at: "2026-08-04T13:10:00.100000+00:00" }],
        count: 4,
        error: null,
      },
      orders: {
        data: [{ updated_at: "2026-08-04T13:12:00.200000+00:00" }],
        count: 9,
        error: null,
      },
    }
  })

  it("pide bytes mínimos en ambos conjuntos: updated_at, conteo exacto y UNA fila", async () => {
    const { getOpenAccountsFreshnessFromStore } = await import(
      "@/lib/ordersStoreOpenAccounts"
    )
    const freshness = await getOpenAccountsFreshnessFromStore(
      { status: "Abierta" },
      "sede-1",
    )

    for (const tabla of ["open_accounts", "orders"] as const) {
      expect(capturas[tabla].select).toEqual({
        columns: "updated_at",
        options: { count: "exact" },
      })
      expect(capturas[tabla].order).toEqual(["updated_at", { ascending: false }])
      expect(capturas[tabla].limit).toBe(1)
    }

    expect(freshness).toEqual({
      accountsCount: 4,
      accountsMaxUpdatedAt: "2026-08-04T13:10:00.100000+00:00",
      attachedOrdersCount: 9,
      attachedOrdersMaxUpdatedAt: "2026-08-04T13:12:00.200000+00:00",
    })
  })

  it("cuentas: repite el filtro del cuerpo (status + sede)", async () => {
    const { getOpenAccountsFreshnessFromStore } = await import(
      "@/lib/ordersStoreOpenAccounts"
    )
    await getOpenAccountsFreshnessFromStore({ status: "Abierta" }, "sede-1")

    expect(capturas.open_accounts.eq).toEqual([
      ["status", "Abierta"],
      ["branch_id", "sede-1"],
    ])
  })

  it("con status 'all' (o inválido→undefined) NO se filtra por estado, igual que el cuerpo", async () => {
    const { getOpenAccountsFreshnessFromStore } = await import(
      "@/lib/ordersStoreOpenAccounts"
    )
    await getOpenAccountsFreshnessFromStore({ status: "all" }, "sede-1")

    expect(capturas.open_accounts.eq).toEqual([["branch_id", "sede-1"]])
  })

  it("pedidos: el superconjunto anclado (open_account_id not null) + la sede, SIN status", async () => {
    // Superconjunto a propósito: más ancho solo cuesta una lectura de más;
    // más angosto escondería el cambio de un pedido de una cuenta cerrada.
    const { getOpenAccountsFreshnessFromStore } = await import(
      "@/lib/ordersStoreOpenAccounts"
    )
    await getOpenAccountsFreshnessFromStore({ status: "Abierta" }, "sede-1")

    expect(capturas.orders.not).toEqual([["open_account_id", "is", null]])
    expect(capturas.orders.eq).toEqual([["branch_id", "sede-1"]])
  })

  it("un error en cualquiera de los dos conjuntos revienta visible, no inventa huella", async () => {
    resultados.orders = { data: null, count: null, error: { message: "boom" } }

    const { getOpenAccountsFreshnessFromStore } = await import(
      "@/lib/ordersStoreOpenAccounts"
    )

    await expect(
      getOpenAccountsFreshnessFromStore({ status: "Abierta" }, "sede-1"),
    ).rejects.toThrow("boom")
  })
})
