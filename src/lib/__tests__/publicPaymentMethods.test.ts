import { describe, expect, it } from "vitest"
import {
  DEFAULT_PUBLIC_PAYMENT_METHODS,
  normalizePublicPaymentMethodDetails,
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

describe("datos de pago por método (publicPaymentMethodDetails)", () => {
  it("acepta objeto y JSON en texto; limpia líneas vacías", () => {
    const details = {
      "Pago móvil": "Banco: Banesco\n\n  Teléfono: 0412-0000000  \nCI: V-12.345.678",
    }

    const expected = {
      "Pago móvil": "Banco: Banesco\nTeléfono: 0412-0000000\nCI: V-12.345.678",
    }

    expect(normalizePublicPaymentMethodDetails(details)).toEqual(expected)
    expect(
      normalizePublicPaymentMethodDetails(JSON.stringify(details)),
    ).toEqual(expected)
  })

  it("descarta métodos sin datos y valores que no son texto", () => {
    expect(
      normalizePublicPaymentMethodDetails({
        Zelle: "correo@negocio.com",
        Efectivo: "   ",
        Binance: 123,
      }),
    ).toEqual({ Zelle: "correo@negocio.com" })
  })

  it("vacío o basura devuelve objeto vacío", () => {
    expect(normalizePublicPaymentMethodDetails(null)).toEqual({})
    expect(normalizePublicPaymentMethodDetails("")).toEqual({})
    expect(normalizePublicPaymentMethodDetails([1, 2])).toEqual({})
    expect(normalizePublicPaymentMethodDetails("no es json")).toEqual({})
  })

  it("recorta a 12 métodos, 8 líneas y 90 caracteres por línea", () => {
    const many = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`Método ${i + 1}`, "dato"]),
    )
    expect(Object.keys(normalizePublicPaymentMethodDetails(many))).toHaveLength(12)

    const longLines = { Zelle: Array.from({ length: 12 }, () => "x".repeat(120)).join("\n") }
    const [zelle] = Object.values(normalizePublicPaymentMethodDetails(longLines))
    const lines = zelle.split("\n")
    expect(lines).toHaveLength(8)
    expect(lines[0]).toHaveLength(90)
  })
})
