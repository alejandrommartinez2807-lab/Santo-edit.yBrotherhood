import { describe, expect, it } from "vitest"
import {
  getOrderPaymentLegs,
  getRequiredReportUSD,
  sumLegsUSD,
} from "@/lib/orderPaymentLegs"

// Tasa de ejemplo: 1 USD = 145,30 Bs (los strings del carrito usan formatVES
// es-VE "1.234,56" y formatUSD en-US "$1,234.56").
const RATE = 145.3

describe("getOrderPaymentLegs", () => {
  it("método único en Bs: total en bolívares con la tasa del pedido", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Pago móvil",
      totalUSD: 12.5,
      exchangeRate: RATE,
    })
    expect(legs).toEqual([
      { method: "Pago móvil", currency: "VES", amount: 1816.25, isCash: false },
    ])
  })

  it("método único en divisas: total en USD", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Zelle",
      totalUSD: 12.5,
      exchangeRate: RATE,
    })
    expect(legs).toEqual([
      { method: "Zelle", currency: "USD", amount: 12.5, isCash: false },
    ])
  })

  it("efectivo en divisas queda marcado como cash", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Efectivo en divisas",
      totalUSD: 20,
      exchangeRate: RATE,
    })
    expect(legs[0].isCash).toBe(true)
    expect(legs[0].currency).toBe("USD")
  })

  it("mixto: parsea la pata Bs (es-VE) y la pata $ (en-US)", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Mixto: Pago móvil Bs 1.816,25 + Zelle $10.00",
      totalUSD: 22.5,
      exchangeRate: RATE,
    })
    expect(legs).toEqual([
      { method: "Pago móvil", currency: "VES", amount: 1816.25, isCash: false },
      { method: "Zelle", currency: "USD", amount: 10, isCash: false },
    ])
  })

  it("mixto con efectivo y símbolo €: la pata cash se identifica", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Mixto: Transferencia Bs 2.905,99 + Efectivo €15.00",
      totalUSD: 35,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs[1]).toEqual({
      method: "Efectivo",
      currency: "USD",
      amount: 15,
      isCash: true,
    })
  })

  it("montos USD con separador de miles", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Mixto: Punto Bs 14.530,00 + Zelle $1,050.75",
      totalUSD: 1150.75,
      exchangeRate: RATE,
    })
    expect(legs[1].amount).toBe(1050.75)
  })

  it("'Por confirmar' o vacío no produce patas", () => {
    expect(
      getOrderPaymentLegs({ paymentMethod: "Por confirmar", totalUSD: 10, exchangeRate: RATE }),
    ).toEqual([])
    expect(getOrderPaymentLegs({ paymentMethod: "", totalUSD: 10, exchangeRate: RATE })).toEqual([])
  })
})

describe("sumLegsUSD / getRequiredReportUSD", () => {
  it("suma equivalente en USD de patas mixtas", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: "Mixto: Pago móvil Bs 1.816,25 + Zelle $10.00",
      totalUSD: 22.5,
      exchangeRate: RATE,
    })
    expect(sumLegsUSD(legs, RATE)).toBe(22.5)
  })

  it("lo requerido excluye la pata en efectivo del mixto", () => {
    expect(
      getRequiredReportUSD({
        paymentMethod: "Mixto: Pago móvil Bs 1.816,25 + Efectivo $10.00",
        totalUSD: 22.5,
        exchangeRate: RATE,
      }),
    ).toBe(12.5)
  })

  it("efectivo puro no exige reporte; método desconocido exige el total", () => {
    expect(
      getRequiredReportUSD({
        paymentMethod: "Efectivo en divisas",
        totalUSD: 20,
        exchangeRate: RATE,
      }),
    ).toBe(0)
    expect(
      getRequiredReportUSD({ paymentMethod: "", totalUSD: 20, exchangeRate: RATE }),
    ).toBe(20)
  })
})
