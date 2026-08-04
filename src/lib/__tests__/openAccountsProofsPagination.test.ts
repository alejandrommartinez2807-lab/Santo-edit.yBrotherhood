import { beforeEach, describe, expect, it, vi } from "vitest"

// H-2 (auditoría 2026-07-30, cerrado 2026-08-04): PostgREST corta en 1000
// filas. Pedidos se paginó el 2026-08-02; cuentas abiertas y comprobantes
// eran las últimas listas operativas sin paginar: la vista histórica de
// cuentas, los pedidos/líneas de una cuenta longeva y el buzón de
// comprobantes perdían filas EN SILENCIO pasando el tope.

type Row = Record<string, unknown>

const PAGE = 1000

let db: {
  open_accounts: Row[]
  orders: Row[]
  order_items: Row[]
  payment_proofs: Row[]
}

function makeQuery(table: keyof typeof db) {
  const state: {
    from: number
    to: number
    eq: [string, unknown][]
    in?: [string, unknown[]]
  } = { from: 0, to: PAGE - 1, eq: [] }

  function resolve() {
    let rows = db[table]
    for (const [column, value] of state.eq) {
      rows = rows.filter((row) => row[column] === value)
    }
    if (state.in) {
      const [column, values] = state.in
      rows = rows.filter((row) => values.includes(row[column]))
    }
    return { data: rows.slice(state.from, state.to + 1), error: null }
  }

  const query = {
    select: () => query,
    order: () => query,
    limit: () => query,
    eq: (column: string, value: unknown) => {
      state.eq.push([column, value])
      return query
    },
    in: (column: string, values: unknown[]) => {
      state.in = [column, values]
      return query
    },
    not: () => query,
    or: () => query,
    range: (from: number, to: number) => {
      state.from = from
      state.to = to
      return query
    },
    then: (
      onFulfilled: (value: { data: Row[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
  }

  return query
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: (table: keyof typeof db) => makeQuery(table),
    storage: {
      from: () => ({
        createSignedUrls: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
  }),
}))

describe("H-2 · paginación de cuentas abiertas y comprobantes", () => {
  beforeEach(() => {
    db = { open_accounts: [], orders: [], order_items: [], payment_proofs: [] }
  })

  it("el histórico de cuentas devuelve MÁS de 1000 (la vista 'todas' no se corta)", async () => {
    db.open_accounts = Array.from({ length: 1200 }, (_, index) => ({
      id: `cuenta-${index}`,
      branch_id: "sede-1",
      status: "Cerrada",
      created_at: new Date(Date.UTC(2026, 7, 4, 0, 0, index % 60, index)).toISOString(),
      customer_name: `Cliente ${index}`,
      table_number: `Mesa ${index % 12}`,
    }))

    const { getOpenAccounts } = await import("@/lib/ordersStoreOpenAccounts")
    const accounts = await getOpenAccounts({ status: "all" }, "sede-1")

    expect(accounts).toHaveLength(1200)
  })

  it("una cuenta con 1200 pedidos los trae TODOS y con sus líneas", async () => {
    db.open_accounts = [
      {
        id: "cuenta-grande",
        branch_id: "sede-1",
        status: "Abierta",
        created_at: "2026-08-04T10:00:00.000Z",
        customer_name: "Mesa larga",
        table_number: "Mesa 1",
      },
    ]
    db.orders = Array.from({ length: 1200 }, (_, index) => ({
      id: `pedido-${index}`,
      branch_id: "sede-1",
      open_account_id: "cuenta-grande",
      status: "Entregado",
      created_at: new Date(Date.UTC(2026, 7, 4, 1, 0, index % 60, index)).toISOString(),
      customer_name: "Mesa larga",
      table_number: "Mesa 1",
      total_usd: 5,
    }))
    db.order_items = db.orders.map((order, index) => ({
      id: `linea-${index}`,
      order_id: order.id,
      sort_order: 0,
      name: "Smash burger",
      quantity: 1,
      unit_price_usd: 5,
    }))

    const { getOpenAccounts } = await import("@/lib/ordersStoreOpenAccounts")
    const [account] = await getOpenAccounts({ status: "Abierta" }, "sede-1")

    const orders = account.orders ?? []
    expect(orders).toHaveLength(1200)
    // Las líneas del pedido 1001+ eran las que se perdían en silencio.
    const conLineas = orders.filter((order) => order.items?.length)
    expect(conLineas).toHaveLength(1200)
  })

  it("el buzón de comprobantes devuelve MÁS de 1000", async () => {
    db.payment_proofs = Array.from({ length: 1200 }, (_, index) => ({
      id: `proof-${index}`,
      branch_id: "sede-1",
      order_id: `pedido-${index}`,
      status: "Comprobante enviado",
      created_at: new Date(Date.UTC(2026, 7, 4, 2, 0, index % 60, index)).toISOString(),
    }))

    const { getPaymentProofs } = await import("@/lib/ordersPaymentProofs")
    const proofs = await getPaymentProofs({}, "sede-1")

    expect(proofs).toHaveLength(1200)
  })
})
