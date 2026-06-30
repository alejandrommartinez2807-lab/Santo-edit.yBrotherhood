import { describe, it, expect } from "vitest"
import {
  roundMoney,
  parseMoneyInput,
  calculatePaymentStatus,
  calculateOrderTotalsFromItems,
  calculatePaymentDraft,
  normalizeDeliveryPaymentIn,
} from "@/lib/localOrderMoney"
import type { LocalOrder, OrderItem, PaymentForm } from "@/types/localOrders"

function item(partial: Partial<OrderItem>): OrderItem {
  return {
    id: 1,
    name: "Item",
    category: "Otros",
    price: 0,
    image: "",
    quantity: 1,
    ...partial,
  } as OrderItem
}

describe("roundMoney", () => {
  it("redondea a 2 decimales", () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(2.344)).toBe(2.34)
    expect(roundMoney("abc")).toBe(0)
  })
})

describe("parseMoneyInput", () => {
  it("acepta coma o punto decimal", () => {
    expect(parseMoneyInput("1.234,56")).toBe(1234.56) // formato es-VE
    expect(parseMoneyInput("1,5")).toBe(1.5)
    expect(parseMoneyInput("10.50")).toBe(10.5)
    expect(parseMoneyInput("")).toBe(0)
    expect(parseMoneyInput("-3")).toBe(0)
  })
})

describe("calculatePaymentStatus", () => {
  it("clasifica pendiente/parcial/pagado", () => {
    expect(calculatePaymentStatus(0, 10)).toBe("Pendiente")
    expect(calculatePaymentStatus(4, 10)).toBe("Pago parcial")
    expect(calculatePaymentStatus(10, 10)).toBe("Pagado")
    expect(calculatePaymentStatus(9.995, 10)).toBe("Pagado") // tolerancia 0.01
  })
})

describe("calculateOrderTotalsFromItems", () => {
  it("separa combos (divisa) de productos normales y calcula VES + delivery", () => {
    const items = [
      item({ price: 5, quantity: 2, paymentMode: "mixto", category: "Perros" }), // 10 regular
      item({ price: 8, quantity: 1, paymentMode: "divisa", category: "Combos" }), // 8 combo
    ]
    const t = calculateOrderTotalsFromItems(items, 40, 2)
    expect(t.totalRegularUSD).toBe(10)
    expect(t.totalCombosUSD).toBe(8)
    expect(t.totalRegularVES).toBe(400) // 10 * 40
    expect(t.totalBeforeDeliveryUSD).toBe(18)
    expect(t.deliveryCostUSD).toBe(2)
    expect(t.totalUSD).toBe(20) // 18 + 2
  })
})

describe("calculatePaymentDraft", () => {
  const order = {
    exchangeRate: 40,
    items: [item({ price: 10, quantity: 1, paymentMode: "mixto", category: "Perros" })],
  } as unknown as LocalOrder

  it("suma USD + equivalente de VES y deja pagado", () => {
    const form: PaymentForm = {
      amountReceivedUSD: "6",
      amountReceivedVES: "160", // 160/40 = 4 USD
      paymentMethodUSD: "Efectivo divisas",
      paymentMethodVES: "Pago móvil",
      deliveryPaymentIn: "Mixto",
      paymentNote: "",
    }
    const d = calculatePaymentDraft(order, form)
    expect(d.totalOrderUSD).toBe(10)
    expect(d.receivedEquivalentUSD).toBe(10) // 6 + 4
    expect(d.status).toBe("Pagado")
    expect(d.pendingUSD).toBe(0)
  })

  it("marca parcial y calcula pendiente", () => {
    const form: PaymentForm = {
      amountReceivedUSD: "3",
      amountReceivedVES: "",
      paymentMethodUSD: "",
      paymentMethodVES: "",
      deliveryPaymentIn: "Divisas",
      paymentNote: "",
    }
    const d = calculatePaymentDraft(order, form)
    expect(d.status).toBe("Pago parcial")
    expect(d.pendingUSD).toBe(7)
  })
})

describe("normalizeDeliveryPaymentIn", () => {
  it("normaliza variantes de texto", () => {
    expect(normalizeDeliveryPaymentIn("divisas")).toBe("Divisas")
    expect(normalizeDeliveryPaymentIn("bs")).toBe("Bolívares")
    expect(normalizeDeliveryPaymentIn("mixta")).toBe("Mixto")
    expect(normalizeDeliveryPaymentIn("???")).toBe("Sin registrar")
  })
})
