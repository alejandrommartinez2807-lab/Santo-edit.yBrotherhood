import { describe, it, expect } from "vitest"
import { receiptLegend, isNonFiscal, NON_FISCAL_LEGEND } from "@/lib/mallReceipts"

describe("receiptLegend", () => {
  it("muestra la leyenda no fiscal cuando el negocio NO está fiscalizado", () => {
    expect(receiptLegend(false)).toBe(NON_FISCAL_LEGEND)
    expect(receiptLegend(false)).toMatch(/no fiscal/i)
    expect(receiptLegend(false)).toMatch(/no es una factura/i)
  })
  it("no muestra leyenda cuando el negocio ya está fiscalizado", () => {
    expect(receiptLegend(true)).toBe("")
  })
})

describe("isNonFiscal", () => {
  it("por defecto (false) → no fiscal", () => {
    expect(isNonFiscal(false)).toBe(true)
  })
  it("fiscalizado (true) → ya no es 'solo recibo'", () => {
    expect(isNonFiscal(true)).toBe(false)
  })
})
