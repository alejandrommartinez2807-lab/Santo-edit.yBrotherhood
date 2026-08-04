import { describe, expect, it } from "vitest"

// La huella barata de /api/orders (2026-08-04): dos agregados (~54 bytes)
// deciden el 304 sin leer las filas (626 KB medidos por sondeo). El audit de
// 3 agentes la aprobó con condiciones; estas pruebas fijan las que viven en
// el hash: TODAS las dimensiones entran por su VALOR (una sola que falte y
// dos contextos distintos comparten un 304 por accidente), la comparación es
// por igualdad (no por "es más nuevo") y el techo de la lectura completa
// queda dentro de los 60-120 s exigidos.

import {
  ORDERS_FULL_READ_INTERVAL_MS,
  buildOrdersFingerprint,
  getFullReadBucket,
  getOrdersDeployId,
  type OrdersFingerprintParts,
} from "@/lib/ordersFingerprint"

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

describe("getFullReadBucket — el techo de la lectura completa", () => {
  it("queda dentro de los 60-120 s que exigió el audit", () => {
    expect(ORDERS_FULL_READ_INTERVAL_MS).toBeGreaterThanOrEqual(60_000)
    expect(ORDERS_FULL_READ_INTERVAL_MS).toBeLessThanOrEqual(120_000)
  })

  it("dentro de la misma cubeta no rota; al cruzarla, sí", () => {
    const t0 = 1_800_000_000_000

    expect(getFullReadBucket(t0)).toBe(
      getFullReadBucket(t0 + ORDERS_FULL_READ_INTERVAL_MS - 1),
    )
    expect(getFullReadBucket(t0)).not.toBe(
      getFullReadBucket(t0 + ORDERS_FULL_READ_INTERVAL_MS),
    )
  })
})

describe("getOrdersDeployId", () => {
  it("prefiere el id del deploy y va cayendo a la URL única y al commit", () => {
    expect(
      getOrdersDeployId({
        VERCEL_DEPLOYMENT_ID: "dpl_1",
        VERCEL_URL: "app-abc.vercel.app",
        VERCEL_GIT_COMMIT_SHA: "sha1",
      }),
    ).toBe("dpl_1")
    expect(
      getOrdersDeployId({
        VERCEL_URL: "app-abc.vercel.app",
        VERCEL_GIT_COMMIT_SHA: "sha1",
      }),
    ).toBe("app-abc.vercel.app")
    expect(getOrdersDeployId({ VERCEL_GIT_COMMIT_SHA: "sha1" })).toBe("sha1")
  })

  it("fuera de Vercel (local, tests) responde un valor estable", () => {
    expect(getOrdersDeployId({})).toBe("dev")
  })
})
