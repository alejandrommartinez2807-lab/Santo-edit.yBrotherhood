import { describe, expect, it } from "vitest"
import {
  createPaymentFormFromOrder,
  derivePaymentPrefillFromProofs,
  type PaymentProof,
} from "@/app/local-santo/caja/domain"
import type { LocalOrder } from "@/types/localOrders"

// Reporte del dueño 2026-07-28: en un pedido de MESA el checkout no pide
// método de pago (se cobra al final), así que "Registrar cobro" abría en
// blanco aunque el cliente ya hubiera reportado su pago móvil/Zelle. La
// precarga debe caer al comprobante reportado.

const baseOrder = {
  id: "ord-1",
  customerName: "Cliente",
  orderType: "Comer aquí",
  status: "Nuevo",
  tableNumber: "Mesa 4",
  // El total sale de los ítems (getOrderTotals), no de un campo suelto.
  items: [{ id: 1, name: "Burger", price: 46.5, quantity: 1 }],
  exchangeRate: 742.81,
  createdAt: "2026-07-28T18:00:00.000Z",
} as unknown as LocalOrder

function proof(overrides: Partial<PaymentProof>): PaymentProof {
  return {
    id: "proof-1",
    orderId: "ord-1",
    createdAt: "2026-07-28T18:05:00.000Z",
    customerName: "Cliente",
    customerPhone: "",
    orderType: "Comer aquí",
    orderTotalUSD: 46.5,
    reportedMethod: "",
    amountReportedUSD: 0,
    amountReportedVES: 0,
    paymentReference: "",
    customerNote: "",
    status: "Comprobante enviado",
    ...overrides,
  } as PaymentProof
}

describe("derivePaymentPrefillFromProofs", () => {
  it("toma el método y el monto que el cliente reportó en bolívares", () => {
    const prefill = derivePaymentPrefillFromProofs([
      proof({ reportedMethod: "Pago móvil (Bs 34.540,69)", amountReportedVES: 34540.69 }),
    ])

    expect(prefill?.paymentMethodVES).toBe("Pago móvil")
    expect(prefill?.amountReceivedVES).toBe("34540.69")
    expect(prefill?.paymentMethodUSD).toBe("")
    expect(prefill?.deliveryPaymentIn).toBe("Bolívares")
  })

  it("un reporte en divisas precarga la columna de divisas", () => {
    const prefill = derivePaymentPrefillFromProofs([
      proof({ reportedMethod: "Zelle", amountReportedUSD: 46.5 }),
    ])

    expect(prefill?.paymentMethodUSD).toBe("Zelle")
    expect(prefill?.amountReceivedUSD).toBe("46.5")
    expect(prefill?.deliveryPaymentIn).toBe("Divisas")
  })

  it("dos comprobantes (mixto) suman por moneda y marcan Mixto", () => {
    const prefill = derivePaymentPrefillFromProofs([
      proof({ id: "p1", reportedMethod: "Zelle", amountReportedUSD: 20 }),
      proof({ id: "p2", reportedMethod: "Pago móvil", amountReportedVES: 1000 }),
    ])

    expect(prefill?.amountReceivedUSD).toBe("20")
    expect(prefill?.amountReceivedVES).toBe("1000")
    expect(prefill?.deliveryPaymentIn).toBe("Mixto")
  })

  it("los comprobantes ya resueltos (confirmado/rechazado) no precargan nada", () => {
    expect(
      derivePaymentPrefillFromProofs([
        proof({ status: "Confirmado por caja", reportedMethod: "Zelle", amountReportedUSD: 46.5 }),
      ]),
    ).toBeNull()
    expect(
      derivePaymentPrefillFromProofs([
        proof({ status: "Rechazado", reportedMethod: "Zelle", amountReportedUSD: 46.5 }),
      ]),
    ).toBeNull()
  })

  it("sin comprobantes no hay precarga", () => {
    expect(derivePaymentPrefillFromProofs([])).toBeNull()
  })
})

describe("createPaymentFormFromOrder · pedido de mesa", () => {
  it("sin método elegido y sin reporte, el modal abre vacío (como hoy)", () => {
    const form = createPaymentFormFromOrder(baseOrder)

    expect(form.paymentMethodVES).toBe("")
    expect(form.amountReceivedVES).toBe("")
  })

  it("con el pago reportado por el cliente, el modal abre precargado", () => {
    const form = createPaymentFormFromOrder(baseOrder, [
      proof({ reportedMethod: "Pago móvil (Bs 34.540,69)", amountReportedVES: 34540.69 }),
    ])

    expect(form.paymentMethodVES).toBe("Pago móvil")
    expect(form.amountReceivedVES).toBe("34540.69")
  })

  it("el método que el cliente eligió al pedir manda sobre el comprobante", () => {
    // Pick up/Delivery: el checkout sí pide método — esa precarga es la buena
    // y no la puede pisar un comprobante reportado con otra cosa.
    const pickup = {
      ...baseOrder,
      orderType: "Para llevar",
      paymentMethod: "Zelle",
    } as unknown as LocalOrder

    const form = createPaymentFormFromOrder(pickup, [
      proof({ reportedMethod: "Pago móvil", amountReportedVES: 1000 }),
    ])

    expect(form.paymentMethodUSD).toBe("Zelle")
    expect(form.paymentMethodVES).toBe("")
  })

  it("un cobro ya registrado NUNCA se pisa con la precarga", () => {
    const cobrado = {
      ...baseOrder,
      amountReceivedUSD: 10,
      paymentMethodUSD: "Efectivo divisas",
    } as unknown as LocalOrder

    const form = createPaymentFormFromOrder(cobrado, [
      proof({ reportedMethod: "Pago móvil", amountReportedVES: 34540.69 }),
    ])

    expect(form.amountReceivedUSD).toBe("10")
    expect(form.paymentMethodUSD).toBe("Efectivo divisas")
    expect(form.amountReceivedVES).toBe("")
  })
})
