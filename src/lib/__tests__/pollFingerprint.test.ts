import { describe, expect, it } from "vitest"

// La huella barata de los sondeos (2026-08-04): agregados de ~54 bytes
// deciden el 304 sin leer las filas (626 KB medidos en /api/orders). El audit
// de 3 agentes la aprobó con condiciones; estas pruebas fijan las que viven
// en el hash: TODAS las dimensiones entran por su VALOR (una sola que falte y
// dos contextos distintos comparten un 304 por accidente), la comparación es
// por igualdad (no por "es más nuevo") y el techo de la lectura completa
// queda dentro de los 60-120 s exigidos.

import {
  POLL_FULL_READ_INTERVAL_MS,
  buildOpenAccountsFingerprint,
  buildOrdersFingerprint,
  buildPaymentProofsFingerprint,
  getFullReadBucket,
  getPollDeployId,
  type OpenAccountsFingerprintParts,
  type OrdersFingerprintParts,
  type PaymentProofsFingerprintParts,
} from "@/lib/pollFingerprint"

const BASE: OrdersFingerprintParts = {
  count: 42,
  maxUpdatedAt: "2026-08-04T13:15:57.482913+00:00",
  branchId: "04fb974d-bd2d-4086-ae9e-c74653309b04",
  createdFrom: "2026-08-04T09:00:00.000Z",
  trainingModeActive: false,
  trainingModeAvailable: true,
  role: "cashier",
  moduleKey: "cashier",
  deployId: "dpl_abc123",
  fullReadBucket: 19_876_543,
}

describe("buildOrdersFingerprint", () => {
  it("las mismas partes producen siempre la misma huella", () => {
    expect(buildOrdersFingerprint({ ...BASE })).toBe(buildOrdersFingerprint({ ...BASE }))
  })

  it("es base64url sin puntos: el punto queda libre como separador del ETag compuesto", () => {
    expect(buildOrdersFingerprint(BASE)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  const variantes: [string, Partial<OrdersFingerprintParts>][] = [
    ["count", { count: 43 }],
    ["maxUpdatedAt", { maxUpdatedAt: "2026-08-04T13:15:58.000000+00:00" }],
    ["maxUpdatedAt nulo (conjunto vacío)", { maxUpdatedAt: null }],
    ["branchId", { branchId: "3d8a8527-4b0b-4c81-aeb7-0c69454c63f6" }],
    ["branchId nulo (consolidado del dueño)", { branchId: null }],
    ["createdFrom", { createdFrom: "2026-08-03T09:00:00.000Z" }],
    ["createdFrom nulo (histórico completo)", { createdFrom: null }],
    ["trainingModeActive", { trainingModeActive: true }],
    ["trainingModeAvailable", { trainingModeAvailable: false }],
    ["role", { role: "kitchen" }],
    ["moduleKey", { moduleKey: "kitchen" }],
    ["deployId", { deployId: "dpl_def456" }],
    ["fullReadBucket", { fullReadBucket: BASE.fullReadBucket + 1 }],
  ]

  it.each(variantes)("cambiar %s cambia la huella", (_nombre, cambio) => {
    expect(buildOrdersFingerprint({ ...BASE, ...cambio })).not.toBe(
      buildOrdersFingerprint(BASE),
    )
  })

  it("igualdad, no 'es más nuevo': un max que BAJA (se borró el pedido más reciente) también la cambia", () => {
    const masViejo = buildOrdersFingerprint({
      ...BASE,
      maxUpdatedAt: "2026-08-01T00:00:00.000000+00:00",
    })

    expect(masViejo).not.toBe(buildOrdersFingerprint(BASE))
  })

  it("las partes van en posiciones fijas: null en una no se confunde con null en otra", () => {
    const soloBranchNulo = buildOrdersFingerprint({
      ...BASE,
      branchId: null,
      createdFrom: "x",
    })
    const soloCreatedFromNulo = buildOrdersFingerprint({
      ...BASE,
      branchId: "x",
      createdFrom: null,
    })

    expect(soloBranchNulo).not.toBe(soloCreatedFromNulo)
  })
})

const BASE_CUENTAS: OpenAccountsFingerprintParts = {
  accountsCount: 4,
  accountsMaxUpdatedAt: "2026-08-04T13:10:00.100000+00:00",
  attachedOrdersCount: 9,
  attachedOrdersMaxUpdatedAt: "2026-08-04T13:12:00.200000+00:00",
  branchId: "04fb974d-bd2d-4086-ae9e-c74653309b04",
  status: "Abierta",
  role: "cashier",
  roleLabel: "Caja",
  deployId: "dpl_abc123",
  fullReadBucket: 19_876_543,
}

describe("buildOpenAccountsFingerprint", () => {
  const variantes: [string, Partial<OpenAccountsFingerprintParts>][] = [
    ["accountsCount", { accountsCount: 5 }],
    ["accountsMaxUpdatedAt", { accountsMaxUpdatedAt: "2026-08-04T13:11:00.000000+00:00" }],
    // El payload incluye los pedidos de cada cuenta: una línea marcada
    // entregada mueve orders.updated_at (0038) y TIENE que mover la huella
    // aunque la fila de la cuenta no se toque.
    ["attachedOrdersCount", { attachedOrdersCount: 10 }],
    ["attachedOrdersMaxUpdatedAt", { attachedOrdersMaxUpdatedAt: "2026-08-04T13:13:00.000000+00:00" }],
    ["branchId", { branchId: null }],
    ["status", { status: "all" }],
    ["status nulo (parámetro inválido = sin filtro)", { status: null }],
    ["role", { role: "waiter" }],
    ["roleLabel (usuarios custom con etiqueta propia)", { roleLabel: "Mesonero Luis" }],
    ["deployId", { deployId: "dpl_def456" }],
    ["fullReadBucket", { fullReadBucket: BASE_CUENTAS.fullReadBucket + 1 }],
  ]

  it.each(variantes)("cambiar %s cambia la huella", (_nombre, cambio) => {
    expect(buildOpenAccountsFingerprint({ ...BASE_CUENTAS, ...cambio })).not.toBe(
      buildOpenAccountsFingerprint(BASE_CUENTAS),
    )
  })

  it("no puede colisionar con la huella de pedidos aunque los valores coincidan", () => {
    // Discriminador de ruta dentro del hash: dos rutas jamás comparten huella.
    const cuentas = buildOpenAccountsFingerprint(BASE_CUENTAS)
    const pedidos = buildOrdersFingerprint(BASE)

    expect(cuentas).not.toBe(pedidos)
  })
})

const BASE_COMPROBANTES: PaymentProofsFingerprintParts = {
  count: 7,
  maxCreatedAt: "2026-08-04T13:05:00.300000+00:00",
  maxReviewedAt: "2026-08-04T13:08:00.400000+00:00",
  branchId: "04fb974d-bd2d-4086-ae9e-c74653309b04",
  orderId: null,
  status: null,
  role: "cashier",
  roleLabel: "Caja",
  deployId: "dpl_abc123",
  fullReadBucket: 19_876_543,
}

describe("buildPaymentProofsFingerprint", () => {
  const variantes: [string, Partial<PaymentProofsFingerprintParts>][] = [
    ["count", { count: 8 }],
    ["maxCreatedAt", { maxCreatedAt: "2026-08-04T13:06:00.000000+00:00" }],
    // La revisión no crea filas: solo estampa reviewed_at. Sin esta parte,
    // confirmar un pago sería invisible para la huella (payment_proofs no
    // tiene updated_at ni trigger).
    ["maxReviewedAt", { maxReviewedAt: "2026-08-04T13:09:00.000000+00:00" }],
    ["maxReviewedAt nulo (nada revisado)", { maxReviewedAt: null }],
    ["branchId", { branchId: null }],
    ["orderId", { orderId: "pedido-9" }],
    ["status", { status: "Comprobante enviado" }],
    ["role", { role: "promoter" }],
    ["roleLabel", { roleLabel: "Promotora Ana" }],
    ["deployId", { deployId: "dpl_def456" }],
    ["fullReadBucket", { fullReadBucket: BASE_COMPROBANTES.fullReadBucket + 1 }],
  ]

  it.each(variantes)("cambiar %s cambia la huella", (_nombre, cambio) => {
    expect(buildPaymentProofsFingerprint({ ...BASE_COMPROBANTES, ...cambio })).not.toBe(
      buildPaymentProofsFingerprint(BASE_COMPROBANTES),
    )
  })
})

describe("getFullReadBucket — el techo de la lectura completa", () => {
  it("queda dentro de los 60-120 s que exigió el audit", () => {
    expect(POLL_FULL_READ_INTERVAL_MS).toBeGreaterThanOrEqual(60_000)
    expect(POLL_FULL_READ_INTERVAL_MS).toBeLessThanOrEqual(120_000)
  })

  it("dentro de la misma cubeta no rota; al cruzarla, sí", () => {
    const t0 = 1_800_000_000_000

    expect(getFullReadBucket(t0)).toBe(
      getFullReadBucket(t0 + POLL_FULL_READ_INTERVAL_MS - 1),
    )
    expect(getFullReadBucket(t0)).not.toBe(
      getFullReadBucket(t0 + POLL_FULL_READ_INTERVAL_MS),
    )
  })
})

describe("getPollDeployId", () => {
  it("prefiere el id del deploy y va cayendo a la URL única y al commit", () => {
    expect(
      getPollDeployId({
        VERCEL_DEPLOYMENT_ID: "dpl_1",
        VERCEL_URL: "app-abc.vercel.app",
        VERCEL_GIT_COMMIT_SHA: "sha1",
      }),
    ).toBe("dpl_1")
    expect(
      getPollDeployId({
        VERCEL_URL: "app-abc.vercel.app",
        VERCEL_GIT_COMMIT_SHA: "sha1",
      }),
    ).toBe("app-abc.vercel.app")
    expect(getPollDeployId({ VERCEL_GIT_COMMIT_SHA: "sha1" })).toBe("sha1")
  })

  it("fuera de Vercel (local, tests) responde un valor estable", () => {
    expect(getPollDeployId({})).toBe("dev")
  })
})
