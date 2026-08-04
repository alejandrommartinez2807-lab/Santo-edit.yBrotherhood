import { beforeEach, describe, expect, it, vi } from "vitest"

// La huella de /api/payment-proofs (2026-08-04). Esta ruta ni siquiera se
// beneficiaba del ETag por contenido: cada lectura re-firma las URLs del
// bucket privado y el JSON cambiaba en TODAS las respuestas. payment_proofs
// no tiene updated_at ni trigger, y no hace falta: INSERT mueve count y
// max(created_at), el DELETE del cierre mueve count, y la revisión SIEMPRE
// estampa reviewed_at = now(). Estas pruebas fijan los dos agregados y sus
// filtros (los mismos del cuerpo).

type Row = Record<string, unknown>

type Captura = {
  select?: { columns: string; options?: { count?: string } }
  order?: [string, { ascending: boolean }]
  limit?: number
  eq: [string, unknown][]
  not: [string, string, unknown][]
}

let capturas: Captura[]
let resultadoPorColumna: Record<
  string,
  { data: Row[] | null; count: number | null; error: { message: string } | null }
>

function makeQuery() {
  const captura: Captura = { eq: [], not: [] }
  capturas.push(captura)

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
      onFulfilled: (value: (typeof resultadoPorColumna)[string]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve(resultadoPorColumna[captura.select?.columns || ""]).then(
        onFulfilled,
        onRejected,
      ),
  }

  return query
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ from: () => makeQuery() }),
}))

describe("getPaymentProofsFreshness", () => {
  beforeEach(() => {
    capturas = []
    resultadoPorColumna = {
      created_at: {
        data: [{ created_at: "2026-08-04T13:05:00.300000+00:00" }],
        count: 7,
        error: null,
      },
      reviewed_at: {
        data: [{ reviewed_at: "2026-08-04T13:08:00.400000+00:00" }],
        count: null,
        error: null,
      },
    }
  })

  const cargar = () => import("@/lib/ordersPaymentProofs")

  it("dos agregados mínimos: count+max(created_at) y max(reviewed_at) sin nulos", async () => {
    const { getPaymentProofsFreshness } = await cargar()
    const freshness = await getPaymentProofsFreshness({}, "sede-1")

    const created = capturas.find((c) => c.select?.columns === "created_at")
    const reviewed = capturas.find((c) => c.select?.columns === "reviewed_at")

    expect(created?.select?.options).toEqual({ count: "exact" })
    expect(created?.order).toEqual(["created_at", { ascending: false }])
    expect(created?.limit).toBe(1)

    // Sin el not-null, Postgres pone los NULL primero en desc y el máximo
    // real de revisión quedaría escondido: confirmar un pago sería invisible.
    expect(reviewed?.not).toEqual([["reviewed_at", "is", null]])
    expect(reviewed?.order).toEqual(["reviewed_at", { ascending: false }])
    expect(reviewed?.limit).toBe(1)

    expect(freshness).toEqual({
      count: 7,
      maxCreatedAt: "2026-08-04T13:05:00.300000+00:00",
      maxReviewedAt: "2026-08-04T13:08:00.400000+00:00",
    })
  })

  it("repite los filtros del cuerpo (sede, orderId, status) en AMBOS agregados", async () => {
    const { getPaymentProofsFreshness } = await cargar()
    await getPaymentProofsFreshness(
      { orderId: "pedido-9", status: "Comprobante enviado" },
      "sede-1",
    )

    for (const captura of capturas) {
      expect(captura.eq).toEqual([
        ["branch_id", "sede-1"],
        ["order_id", "pedido-9"],
        ["status", "Comprobante enviado"],
      ])
    }
  })

  it("buzón vacío o nada revisado: máximos nulos, count 0", async () => {
    resultadoPorColumna.created_at = { data: [], count: 0, error: null }
    resultadoPorColumna.reviewed_at = { data: [], count: null, error: null }

    const { getPaymentProofsFreshness } = await cargar()
    const freshness = await getPaymentProofsFreshness({}, "sede-1")

    expect(freshness).toEqual({ count: 0, maxCreatedAt: null, maxReviewedAt: null })
  })

  it("un error de la base revienta visible, no inventa huella", async () => {
    resultadoPorColumna.reviewed_at = {
      data: null,
      count: null,
      error: { message: "boom" },
    }

    const { getPaymentProofsFreshness } = await cargar()

    await expect(getPaymentProofsFreshness({}, "sede-1")).rejects.toThrow("boom")
  })
})
