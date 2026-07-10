import { describe, expect, it } from "vitest"
import { summarizeEventOrders } from "@/lib/branchProvisioning"

describe("comparativo de eventos · summarizeEventOrders", () => {
  it("suma ventas/cobrado y calcula días y promedios", () => {
    const summary = summarizeEventOrders([
      // Dos pedidos el mismo día (Caracas) y uno al día siguiente.
      { total_usd: 10, payment_received_equiv_usd: 10, created_at: "2026-07-04T15:00:00Z" },
      { total_usd: 5.5, payment_received_equiv_usd: 5, created_at: "2026-07-04T20:00:00Z" },
      { total_usd: 14.5, payment_received_equiv_usd: 0, created_at: "2026-07-05T16:30:00Z" },
    ])

    expect(summary.ordersCount).toBe(3)
    expect(summary.salesUSD).toBe(30)
    expect(summary.collectedUSD).toBe(15)
    expect(summary.days).toBe(2)
    expect(summary.salesPerDayUSD).toBe(15)
    expect(summary.averageTicketUSD).toBe(10)
    expect(summary.lastOrderAt).toBe("2026-07-05T16:30:00Z")
  })

  it("sin pedidos devuelve ceros (sin divisiones por cero)", () => {
    const summary = summarizeEventOrders([])

    expect(summary.ordersCount).toBe(0)
    expect(summary.salesUSD).toBe(0)
    expect(summary.days).toBe(0)
    expect(summary.averageTicketUSD).toBe(0)
    expect(summary.salesPerDayUSD).toBe(0)
  })

  it("ignora valores no numéricos sin romper", () => {
    const summary = summarizeEventOrders([
      { total_usd: "12.25", payment_received_equiv_usd: null, created_at: "2026-07-04T15:00:00Z" },
      { total_usd: undefined, payment_received_equiv_usd: "no-numero", created_at: "" },
    ])

    expect(summary.ordersCount).toBe(2)
    expect(summary.salesUSD).toBe(12.25)
    expect(summary.collectedUSD).toBe(0)
    expect(summary.days).toBe(1)
  })
})
