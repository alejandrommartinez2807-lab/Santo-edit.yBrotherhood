import { describe, expect, it } from "vitest"
import {
  calculateSupplierPayableTotals,
  isSupplierPurchaseOverdue,
  normalizeSupplierPaymentStatus,
} from "@/lib/supplierPayables"

describe("supplierPayables", () => {
  it("normaliza estados visibles de cuentas por pagar", () => {
    expect(normalizeSupplierPaymentStatus("pagado")).toBe("Pagado")
    expect(normalizeSupplierPaymentStatus("Parcial")).toBe("Parcial")
    expect(normalizeSupplierPaymentStatus("cualquier cosa")).toBe("Pendiente")
  })

  it("calcula pendiente y estado para compras en USD", () => {
    expect(calculateSupplierPayableTotals({ totalUSD: 100, paidUSD: 0 })).toMatchObject({
      pendingUSD: 100,
      status: "Pendiente",
    })

    expect(calculateSupplierPayableTotals({ totalUSD: 100, paidUSD: 40 })).toMatchObject({
      pendingUSD: 60,
      status: "Parcial",
    })

    expect(calculateSupplierPayableTotals({ totalUSD: 100, paidUSD: 100 })).toMatchObject({
      pendingUSD: 0,
      status: "Pagado",
    })
  })

  it("soporta compras solo en bolívares", () => {
    expect(calculateSupplierPayableTotals({ totalVES: 500, paidVES: 200 })).toMatchObject({
      pendingVES: 300,
      status: "Parcial",
    })
  })

  it("marca vencida solo si no está pagada", () => {
    expect(isSupplierPurchaseOverdue({ dueDate: "2026-06-20", paymentStatus: "Pendiente", today: "2026-06-30" })).toBe(true)
    expect(isSupplierPurchaseOverdue({ dueDate: "2026-06-20", paymentStatus: "Pagado", today: "2026-06-30" })).toBe(false)
    expect(isSupplierPurchaseOverdue({ dueDate: "2026-07-01", paymentStatus: "Parcial", today: "2026-06-30" })).toBe(false)
  })
})
