import { describe, expect, it } from "vitest"
import type {
  LocalOrder,
  OpenAccount,
  OpenAccountOrderSummary,
} from "@/types/localOrders"
import {
  getAccountDeliveryStats,
  getAccountDeliveryTone,
  getAccountOperationalTone,
  getAccountPendingOrdersCount,
  getAccountRepresentativeExchangeRate,
  getComputedAccountTotals,
  isEligibleOrderForOpenAccount,
  isSameTable,
  mergeAccountOrders,
} from "../openAccountsDomain"

function account(overrides: Partial<OpenAccount> = {}): OpenAccount {
  return {
    id: "acc-1",
    createdAt: "2026-07-12T10:00:00Z",
    tableNumber: "Mesa 1",
    customerName: "Mesa 1",
    status: "Abierta",
    orderIds: [],
    totalEstimatedUSD: 0,
    totalCollectedUSD: 0,
    pendingUSD: 0,
    ...overrides,
  } as OpenAccount
}

function summary(
  overrides: Partial<OpenAccountOrderSummary> = {},
): OpenAccountOrderSummary {
  return {
    id: "ord-1",
    customerName: "Cliente",
    tableNumber: "Mesa 1",
    orderType: "Comer aquí",
    status: "Preparando",
    paymentStatus: "Pendiente",
    totalUSD: 10,
    receivedEquivalentUSD: 0,
    pendingUSD: 10,
    ...overrides,
  } as OpenAccountOrderSummary
}

function localOrder(overrides: Record<string, unknown> = {}): LocalOrder {
  return {
    id: "ord-1",
    customerName: "Cliente",
    tableNumber: "Mesa 1",
    orderType: "Comer aquí",
    status: "Nuevo",
    createdAt: "2026-07-12T10:05:00Z",
    items: [],
    exchangeRate: 0,
    ...overrides,
  } as unknown as LocalOrder
}

describe("isEligibleOrderForOpenAccount", () => {
  it("solo acepta pedidos de consumo local no cancelados", () => {
    expect(isEligibleOrderForOpenAccount(localOrder())).toBe(true)
    expect(isEligibleOrderForOpenAccount(localOrder({ status: "Cancelado" }))).toBe(false)
    expect(isEligibleOrderForOpenAccount(localOrder({ orderType: "Delivery" }))).toBe(false)
  })
})

describe("isSameTable", () => {
  it("compara mesas ignorando acentos, mayúsculas y espacios extra", () => {
    expect(isSameTable(account({ tableNumber: "Mesa  Única" }), localOrder({ tableNumber: "mesa unica" }))).toBe(true)
    expect(isSameTable(account({ tableNumber: "Mesa 1" }), localOrder({ tableNumber: "Mesa 2" }))).toBe(false)
    expect(isSameTable(account({ tableNumber: "" }), localOrder({ tableNumber: "" }))).toBe(false)
  })
})

describe("mergeAccountOrders", () => {
  it("mezcla pedidos locales vinculados con resúmenes guardados sin duplicar", () => {
    const acc = account({
      id: "acc-1",
      orderIds: ["ord-1"],
      orders: [
        summary({ id: "ord-1", createdAt: "2026-07-12T10:05:00Z" }),
        summary({ id: "ord-viejo", createdAt: "2026-07-12T09:00:00Z" }),
      ],
    })
    const merged = mergeAccountOrders(acc, [
      localOrder({ id: "ord-1" }),
      localOrder({ id: "ord-2", openAccountId: "acc-1", createdAt: "2026-07-12T11:00:00Z" }),
      localOrder({ id: "ord-ajeno", openAccountId: "otra-cuenta" }),
    ])

    expect(merged.map((order) => order.id)).toEqual(["ord-viejo", "ord-1", "ord-2"])
  })
})

describe("getComputedAccountTotals", () => {
  it("suma los pedidos cuando hay resúmenes", () => {
    const totals = getComputedAccountTotals(account(), [
      summary({ totalUSD: 10, receivedEquivalentUSD: 4, pendingUSD: 6 }),
      summary({ id: "ord-2", totalUSD: 5, receivedEquivalentUSD: 5, pendingUSD: 0 }),
    ])

    expect(totals).toEqual({
      totalEstimatedUSD: 15,
      totalCollectedUSD: 9,
      pendingUSD: 6,
    })
  })

  it("cae a los totales guardados de la cuenta cuando no hay pedidos", () => {
    const totals = getComputedAccountTotals(
      account({ totalEstimatedUSD: 20, totalCollectedUSD: 12, pendingUSD: 8 }),
      [],
    )

    expect(totals).toEqual({
      totalEstimatedUSD: 20,
      totalCollectedUSD: 12,
      pendingUSD: 8,
    })
  })
})

describe("getAccountRepresentativeExchangeRate", () => {
  // Regresión: los resúmenes construidos desde pedidos locales deben traer
  // exchangeRate; sin él, "Completar en Bs" quedaba deshabilitado.
  it("toma la primera tasa disponible entre los pedidos", () => {
    expect(
      getAccountRepresentativeExchangeRate([
        summary({ exchangeRate: 0 }),
        summary({ id: "ord-2", exchangeRate: 44.85 }),
      ]),
    ).toBe(44.85)
  })

  it("devuelve 0 si ningún pedido tiene tasa", () => {
    expect(getAccountRepresentativeExchangeRate([summary()])).toBe(0)
  })
})

describe("estados operativos de la cuenta", () => {
  it("cuenta entregados/listos/en curso y detecta pendientes de cobro", () => {
    const orders = [
      summary({ status: "Entregado", pendingUSD: 0 }),
      summary({ id: "ord-2", status: "Listo", pendingUSD: 3 }),
      summary({ id: "ord-3", status: "Cancelado", pendingUSD: 0 }),
    ]

    expect(getAccountDeliveryStats(orders)).toEqual({
      delivered: 1,
      ready: 1,
      inProgress: 0,
      cancelled: 1,
    })
    expect(getAccountPendingOrdersCount(orders)).toBe(1)
    expect(getAccountDeliveryTone(orders).label).toBe("Listo para entregar")
    expect(
      getAccountOperationalTone({ pendingUSD: 3 }, orders).label,
    ).toBe("Por cobrar")
  })

  it("todo entregado y sin pendiente", () => {
    const orders = [summary({ status: "Entregado", pendingUSD: 0 })]

    expect(getAccountDeliveryTone(orders).label).toBe("Todo entregado")
    expect(getAccountOperationalTone({ pendingUSD: 0 }, orders).label).toBe("Sin pendiente")
  })
})
