import { describe, expect, it } from "vitest"
import { buildPaymentFromProof } from "@/lib/paymentProofRegistration"

const PROOF_PAGO_MOVIL = {
  reportedMethod: "Pago móvil Banesco 0412-0000000",
  amountReportedUSD: 0,
  amountReportedVES: 3650,
  paymentReference: "004512",
}

describe("verificación de comprobantes · buildPaymentFromProof", () => {
  it("registra un pago móvil reportado en Bs con la referencia en la nota", () => {
    const decision = buildPaymentFromProof(PROOF_PAGO_MOVIL, {
      amountReceivedUSD: 0,
      amountReceivedVES: 0,
    })

    expect(decision.ok).toBe(true)
    if (!decision.ok) return

    expect(decision.payment.amountReceivedVES).toBe(3650)
    expect(decision.payment.amountReceivedUSD).toBe(0)
    expect(decision.payment.paymentMethodVES).toBe("Pago móvil Banesco 0412-0000000")
    expect(decision.payment.paymentMethodUSD).toBe("")
    expect(decision.payment.deliveryPaymentIn).toBe("Bolívares")
    expect(decision.payment.paymentNote).toContain("Ref 004512")
  })

  it("un pago en divisas queda del lado USD y un mixto queda Mixto", () => {
    const usd = buildPaymentFromProof(
      { reportedMethod: "Zelle correo@ejemplo.com", amountReportedUSD: 25, amountReportedVES: 0, paymentReference: "" },
      { amountReceivedUSD: 0, amountReceivedVES: 0 },
    )

    expect(usd.ok).toBe(true)
    if (usd.ok) {
      expect(usd.payment.paymentMethodUSD).toBe("Zelle correo@ejemplo.com")
      expect(usd.payment.paymentMethodVES).toBe("")
      expect(usd.payment.deliveryPaymentIn).toBe("Divisas")
      expect(usd.payment.paymentNote).toBe("Cobro verificado por comprobante")
    }

    const mixto = buildPaymentFromProof(
      { reportedMethod: "Efectivo + pago móvil", amountReportedUSD: 10, amountReportedVES: 500, paymentReference: "9" },
      { amountReceivedUSD: 0, amountReceivedVES: 0 },
    )

    expect(mixto.ok).toBe(true)
    if (mixto.ok) expect(mixto.payment.deliveryPaymentIn).toBe("Mixto")
  })

  it("NO pisa un cobro ya registrado (updateOrderPayment reemplaza montos)", () => {
    const decision = buildPaymentFromProof(PROOF_PAGO_MOVIL, {
      amountReceivedUSD: 5,
      amountReceivedVES: 0,
    })

    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.reason).toContain("ya tiene un cobro")
  })

  it("sin montos reportados o sin pedido, se salta con motivo claro", () => {
    const sinMonto = buildPaymentFromProof(
      { reportedMethod: "Pago móvil", amountReportedUSD: 0, amountReportedVES: 0, paymentReference: "1" },
      { amountReceivedUSD: 0, amountReceivedVES: 0 },
    )

    expect(sinMonto.ok).toBe(false)
    if (!sinMonto.ok) expect(sinMonto.reason).toContain("no indica monto")

    const sinPedido = buildPaymentFromProof(PROOF_PAGO_MOVIL, null)

    expect(sinPedido.ok).toBe(false)
    if (!sinPedido.ok) expect(sinPedido.reason).toContain("No se encontró el pedido")
  })

  it("montos corruptos (NaN/negativos) cuentan como cero", () => {
    const decision = buildPaymentFromProof(
      {
        reportedMethod: "Pago móvil",
        amountReportedUSD: Number.NaN,
        amountReportedVES: -10,
        paymentReference: "",
      },
      { amountReceivedUSD: 0, amountReceivedVES: 0 },
    )

    expect(decision.ok).toBe(false)
  })
})
