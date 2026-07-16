import { describe, expect, it } from "vitest"
import {
  activeReservationPaymentMethodDetails,
  summarizeReservationPayments,
} from "@/lib/hotelReservationPayments"

describe("summarizeReservationPayments", () => {
  it("separa confirmados de reportados y calcula los saldos", () => {
    const summary = summarizeReservationPayments(
      [
        { amount: 50, status: "confirmado" },
        { amount: 30, status: "reportado" },
        { amount: 10, status: "rechazado" },
      ],
      200,
    )
    expect(summary.paidConfirmed).toBe(50)
    expect(summary.paidReported).toBe(30)
    expect(summary.balance).toBe(150) // 200 - 50 confirmados
    expect(summary.pendingBalance).toBe(120) // 200 - 50 - 30
  })

  it("nunca devuelve saldo negativo aunque se pague de más", () => {
    const summary = summarizeReservationPayments(
      [{ amount: 300, status: "confirmado" }],
      200,
    )
    expect(summary.balance).toBe(0)
    expect(summary.pendingBalance).toBe(0)
  })

  it("ignora montos inválidos o negativos", () => {
    const summary = summarizeReservationPayments(
      [
        { amount: Number.NaN, status: "confirmado" },
        { amount: -5, status: "reportado" },
      ],
      100,
    )
    expect(summary.paidConfirmed).toBe(0)
    expect(summary.paidReported).toBe(0)
    expect(summary.balance).toBe(100)
  })
})

describe("activeReservationPaymentMethodDetails", () => {
  it("deja solo los métodos activos que tienen datos cargados", () => {
    const details = activeReservationPaymentMethodDetails(
      ["Pago móvil", "Zelle", "Efectivo"],
      {
        "Pago móvil": "0102 · 0424-1234567 · V-12.345.678",
        Zelle: "pagos@hotel.com",
        Binance: "id-123",
      },
    )
    expect(details).toEqual({
      "Pago móvil": "0102 · 0424-1234567 · V-12.345.678",
      Zelle: "pagos@hotel.com",
    })
  })

  it("devuelve vacío si no hay métodos activos", () => {
    expect(activeReservationPaymentMethodDetails([], { Zelle: "x" })).toEqual({})
  })
})
