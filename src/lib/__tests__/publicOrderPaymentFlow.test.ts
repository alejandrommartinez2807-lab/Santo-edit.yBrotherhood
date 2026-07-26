import { describe, expect, it } from "vitest"
import { isDestinationOrderType, needsPaymentReport } from "@/lib/publicOrderPaymentFlow"

// Regresión del reporte del dueño (2026-07-25): en PICK UP, un pedido con
// método electrónico y sin captura/referencia mostraba "¡Pedido enviado!" y
// "Ver el avance de mi pedido" en vez de la advertencia y "Reportar pago".
// La regla debe ser IDÉNTICA a la de delivery.

const base = {
  paymentMethods: ["Pago móvil"],
  proofsEnabled: true,
}

describe("isDestinationOrderType", () => {
  it("cuenta pick up y delivery, no la mesa", () => {
    expect(isDestinationOrderType("Para llevar")).toBe(true)
    expect(isDestinationOrderType("Delivery")).toBe(true)
    expect(isDestinationOrderType("Comer aquí")).toBe(false)
    expect(isDestinationOrderType(undefined)).toBe(false)
  })
})

describe("needsPaymentReport", () => {
  it("pick up y delivery se comportan igual con método electrónico", () => {
    expect(needsPaymentReport({ ...base, orderType: "Para llevar" })).toBe(true)
    expect(needsPaymentReport({ ...base, orderType: "Delivery" })).toBe(true)
  })

  it("en mesa no pide reporte", () => {
    expect(needsPaymentReport({ ...base, orderType: "Comer aquí" })).toBe(false)
  })

  it("en efectivo no pide reporte (se paga al retirar o recibir)", () => {
    expect(
      needsPaymentReport({
        orderType: "Para llevar",
        paymentMethods: ["Efectivo divisas"],
        proofsEnabled: true,
      }),
    ).toBe(false)
  })

  it("en pago mixto basta con que UNA pata sea electrónica", () => {
    expect(
      needsPaymentReport({
        orderType: "Para llevar",
        paymentMethods: ["Efectivo divisas", "Pago móvil"],
        proofsEnabled: true,
      }),
    ).toBe(true)
  })

  // Regresión: en mixto, la FOTO DE LOS BILLETES no puede dar el pago por
  // reportado — la pata de Pago móvil sigue sin captura y hay que pedirla.
  // Solo el comprobante electrónico marca `alreadyReported`.
  it("la foto del efectivo no tapa el aviso de la pata electrónica", () => {
    expect(
      needsPaymentReport({
        orderType: "Para llevar",
        paymentMethods: ["Efectivo divisas", "Pago móvil"],
        proofsEnabled: true,
        alreadyReported: false,
      }),
    ).toBe(true)
  })

  it("no pide reporte si ya reportó, si se anuló, si quedó offline o si es cuenta abierta", () => {
    expect(needsPaymentReport({ ...base, orderType: "Para llevar", alreadyReported: true })).toBe(false)
    expect(needsPaymentReport({ ...base, orderType: "Para llevar", cancelled: true })).toBe(false)
    expect(needsPaymentReport({ ...base, orderType: "Para llevar", offline: true })).toBe(false)
    expect(
      needsPaymentReport({ ...base, orderType: "Para llevar", attachedToOpenAccount: true }),
    ).toBe(false)
  })

  it("sin módulo de comprobantes público no pide reporte", () => {
    expect(
      needsPaymentReport({ orderType: "Delivery", paymentMethods: ["Zelle"], proofsEnabled: false }),
    ).toBe(false)
  })

  it("sin método elegido no pide reporte", () => {
    expect(needsPaymentReport({ orderType: "Para llevar", paymentMethods: [], proofsEnabled: true })).toBe(
      false,
    )
  })
})
