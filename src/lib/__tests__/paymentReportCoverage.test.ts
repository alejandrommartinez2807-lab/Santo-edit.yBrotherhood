// Matriz de flujos de pago (lote v9, pedido del dueño 2026-07-23):
// cada combinación de método × orden de reporte debe decidir bien qué falta,
// qué cuenta como reportado y qué cuenta como pagado. La foto de los billetes
// (efectivo) NUNCA cubre lo electrónico ni registra cobro.
import { describe, expect, it } from "vitest"
import {
  computePendingElectronicUSD,
  getOrderPaymentLegs,
  getRequiredReportUSD,
  isCashReportedMethod,
} from "@/lib/orderPaymentLegs"
import { buildPaymentFromProof } from "@/lib/paymentProofRegistration"

const RATE = 166.02 // Bs por USD (tasa realista)

// Pedido tipo: $24.50 repartidos Bs 3.320,47 (≈$20... no: 3320.47/166.02=20)
// Usamos el caso real del dueño: Mixto Pago móvil Bs 3.320,47 + Efectivo €20.
const MIXTO_CASH = "Mixto: Pago móvil Bs 3.320,47 + Efectivo en divisas €20.00"
const MIXTO_ELECTRONICO = "Mixto: Pago móvil Bs 1.660,20 + Zelle $14.50"

const cashPhotoProof = {
  method: "Efectivo en divisas (€20.00) · pata en efectivo del pago mixto",
  amountUSD: 20,
  amountVES: 0,
}
const pagoMovilProof = (amountVES: number) => ({
  method: "Pago móvil",
  amountUSD: 0,
  amountVES,
})
const zelleProof = (amountUSD: number) => ({
  method: "Zelle",
  amountUSD,
  amountVES: 0,
})

describe("patas por método (todas las variantes del checkout)", () => {
  it("mixto efectivo + pago móvil se parte en sus dos patas", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs.find((l) => l.currency === "VES")).toMatchObject({
      method: "Pago móvil",
      amount: 3320.47,
      isCash: false,
    })
    expect(legs.find((l) => l.currency === "USD")).toMatchObject({
      method: "Efectivo en divisas",
      amount: 20,
      isCash: true,
    })
  })

  it("mixto pago móvil + Zelle: DOS patas electrónicas", () => {
    const legs = getOrderPaymentLegs({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(2)
    expect(legs.every((l) => !l.isCash)).toBe(true)
  })

  it.each([
    ["Pago móvil", false],
    ["Zelle", false],
    ["Efectivo en divisas", true],
    ["Efectivo en bolívares", true],
  ])("método único %s (isCash=%s)", (method, cash) => {
    const legs = getOrderPaymentLegs({
      paymentMethod: method,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(legs).toHaveLength(1)
    expect(legs[0].isCash).toBe(cash)
  })
})

describe("cuánto se DEBE reportar (solo lo electrónico)", () => {
  it("mixto efectivo+pago móvil exige solo la pata electrónica", () => {
    const required = getRequiredReportUSD({
      paymentMethod: MIXTO_CASH,
      totalUSD: 40,
      exchangeRate: RATE,
    })
    expect(required).toBeCloseTo(3320.47 / RATE, 2)
  })

  it("mixto doble electrónico exige ambas patas (el total)", () => {
    const required = getRequiredReportUSD({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    expect(required).toBeCloseTo(24.5, 1)
  })

  it("efectivo puro no exige reporte electrónico", () => {
    expect(
      getRequiredReportUSD({
        paymentMethod: "Efectivo en divisas",
        totalUSD: 24.5,
        exchangeRate: RATE,
      }),
    ).toBe(0)
  })
})

describe("cobertura según el ORDEN en que llegan los comprobantes", () => {
  const requiredUSD = getRequiredReportUSD({
    paymentMethod: MIXTO_CASH,
    totalUSD: 40,
    exchangeRate: RATE,
  })

  it("sin comprobantes: falta toda la pata electrónica", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [],
    })
    expect(pending).toBeCloseTo(requiredUSD, 2)
  })

  it("PRIMERO la foto del efectivo: sigue faltando lo electrónico (caso que preocupaba al dueño)", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [cashPhotoProof],
    })
    expect(pending).toBeCloseTo(requiredUSD, 2)
  })

  it("DESPUÉS llega el pago móvil: queda cubierto", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [cashPhotoProof, pagoMovilProof(3320.47)],
    })
    expect(pending).toBe(0)
  })

  it("el pago móvil ANTES que la foto también cubre (orden inverso)", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [pagoMovilProof(3320.47), cashPhotoProof],
    })
    expect(pending).toBe(0)
  })

  it("mixto Zelle+pago móvil: reportar solo el Zelle deja pendiente el pago móvil", () => {
    const requiredBoth = getRequiredReportUSD({
      paymentMethod: MIXTO_ELECTRONICO,
      totalUSD: 24.5,
      exchangeRate: RATE,
    })
    const pending = computePendingElectronicUSD({
      requiredUSD: requiredBoth,
      exchangeRate: RATE,
      proofs: [zelleProof(14.5)],
    })
    expect(pending).toBeCloseTo(1660.2 / RATE, 1)

    const pendingBoth = computePendingElectronicUSD({
      requiredUSD: requiredBoth,
      exchangeRate: RATE,
      proofs: [zelleProof(14.5), pagoMovilProof(1660.2)],
    })
    expect(pendingBoth).toBe(0)
  })

  it("un reporte parcial (menos plata de la debida) NO cubre", () => {
    const pending = computePendingElectronicUSD({
      requiredUSD,
      exchangeRate: RATE,
      proofs: [pagoMovilProof(1000)],
    })
    expect(pending).toBeGreaterThan(0)
  })
})

describe("qué método reportado cuenta como efectivo", () => {
  it.each([
    ["Efectivo en divisas (€20.00) · pata en efectivo del pago mixto", true],
    ["EFECTIVO en bolívares", true],
    ["Pago móvil (Bs 18.078,10)", false],
    ["Zelle correo@ejemplo.com", false],
    ["", false],
  ])("%s → %s", (method, expected) => {
    expect(isCashReportedMethod(method)).toBe(expected)
  })
})

describe("confirmar comprobantes registra (o no) el cobro", () => {
  const emptySnapshot = { amountReceivedUSD: 0, amountReceivedVES: 0 }

  it("la foto del efectivo NO registra cobro (el efectivo se recibe en persona)", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: cashPhotoProof.method,
        amountReportedUSD: 20,
        amountReportedVES: 0,
        paymentReference: "",
      },
      emptySnapshot,
    )
    expect(decision.ok).toBe(false)
  })

  it("un pago móvil confirmado SÍ registra el cobro de su pata", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Pago móvil",
        amountReportedUSD: 0,
        amountReportedVES: 3320.47,
        paymentReference: "123456",
      },
      emptySnapshot,
    )
    expect(decision.ok).toBe(true)
    if (decision.ok) {
      expect(decision.payment.amountReceivedVES).toBe(3320.47)
      expect(decision.payment.deliveryPaymentIn).toBe("Bolívares")
    }
  })

  it("con cobro previo no se pisa nada", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Pago móvil",
        amountReportedUSD: 0,
        amountReportedVES: 100,
        paymentReference: "",
      },
      { amountReceivedUSD: 5, amountReceivedVES: 0 },
    )
    expect(decision.ok).toBe(false)
  })
})
