import { describe, it, expect } from "vitest"
import { computeInvoiceTotals, invoiceBaseFromFolio } from "../invoiceTotals"

describe("invoiceTotals", () => {
  it("calcula subtotal, impuesto y total", () => {
    expect(computeInvoiceTotals(100, 0.16)).toEqual({ subtotal: 100, tax: 16, total: 116 })
    expect(computeInvoiceTotals(100, 0)).toEqual({ subtotal: 100, tax: 0, total: 100 })
    expect(computeInvoiceTotals(-5, 0.16).subtotal).toBe(0)
  })

  it("saca la base de los cargos del folio (ignora pagos)", () => {
    const items = [
      { kind: "cargo", amount: 100 },
      { kind: "cargo", amount: 30 },
      { kind: "pago", amount: 130 },
    ]
    expect(invoiceBaseFromFolio(items)).toBe(130)
  })
})
