import { describe, expect, it } from "vitest"
import {
  DEFAULT_PUBLIC_PAYMENT_METHODS,
  normalizePublicPaymentMethods,
} from "@/lib/publicPageConfig"

describe("métodos de pago públicos editables", () => {
  it("acepta lista y texto multilínea, limpia y deduplica", () => {
    expect(
      normalizePublicPaymentMethods(["  Pago móvil ", "Zelle", "zelle", "", "Binance"]),
    ).toEqual(["Pago móvil", "Zelle", "Binance"])

    expect(normalizePublicPaymentMethods("Pago móvil\nZelle\n\nEfectivo")).toEqual([
      "Pago móvil",
      "Zelle",
      "Efectivo",
    ])
  })

  it("vacío o basura cae a las opciones estándar", () => {
    expect(normalizePublicPaymentMethods([])).toEqual(DEFAULT_PUBLIC_PAYMENT_METHODS)
    expect(normalizePublicPaymentMethods("")).toEqual(DEFAULT_PUBLIC_PAYMENT_METHODS)
    expect(normalizePublicPaymentMethods(null)).toEqual(DEFAULT_PUBLIC_PAYMENT_METHODS)
    expect(normalizePublicPaymentMethods(["", "   "])).toEqual(
      DEFAULT_PUBLIC_PAYMENT_METHODS,
    )
  })

  it("recorta a 12 opciones y 40 caracteres por método", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Método ${i + 1}`)
    expect(normalizePublicPaymentMethods(many)).toHaveLength(12)

    const [long] = normalizePublicPaymentMethods(["x".repeat(80)])
    expect(long).toHaveLength(40)
  })
})
