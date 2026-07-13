import { describe, expect, it } from "vitest"
import { isVesPaymentMethod } from "@/lib/paymentOptions"

describe("isVesPaymentMethod", () => {
  it("detecta métodos en bolívares (con o sin acento)", () => {
    for (const method of [
      "Pago móvil",
      "Pago movil",
      "PAGO MÓVIL",
      "Punto",
      "Punto de venta",
      "Transferencia",
      "Efectivo Bs",
      "Biopago",
      "Bolívares",
    ]) {
      expect(isVesPaymentMethod(method)).toBe(true)
    }
  })

  it("trata los métodos en divisas como NO bolívares", () => {
    for (const method of [
      "Efectivo divisas",
      "Zelle",
      "Binance",
      "USDT",
      "Transferencia internacional", // "internacional" manda: es en $
      "PayPal",
      "",
    ]) {
      expect(isVesPaymentMethod(method)).toBe(false)
    }
  })
})
