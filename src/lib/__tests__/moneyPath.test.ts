import { describe, it, expect } from "vitest"
import {
  calculatePaymentStatus,
  calculateOrderTotalsFromItems,
  calculatePaymentDraft,
  getOrderTotals,
  normalizePaymentMethodUSD,
  normalizePaymentMethodVES,
} from "@/lib/localOrderMoney"
import type { LocalOrder, OrderItem } from "@/types/localOrders"

// Tests de la RUTA DEL DINERO (totales, estados de pago, cobro). Casos borde
// que protegen lo más sensible del POS: que las cuentas cuadren.

function item(over: Partial<OrderItem>): OrderItem {
  return {
    id: 1,
    name: "P",
    category: "",
    price: 10,
    image: "",
    quantity: 1,
    paymentMode: "mixto",
    ...over,
  } as OrderItem
}

function order(over: Partial<LocalOrder>): LocalOrder {
  return {
    id: "o1",
    createdAt: "",
    customerName: "x",
    tableNumber: "M1",
    orderType: "Comer aquí",
    customerNote: "",
    items: [],
    itemsText: "",
    totalPrice: 0,
    totalVES: 0,
    exchangeRate: 36,
    status: "Nuevo",
    ...over,
  } as LocalOrder
}

describe("calculatePaymentStatus", () => {
  it("sin pago = Pendiente", () => {
    expect(calculatePaymentStatus(0, 100)).toBe("Pendiente")
    expect(calculatePaymentStatus(-5, 100)).toBe("Pendiente")
  })
  it("pago menor = Pago parcial", () => {
    expect(calculatePaymentStatus(50, 100)).toBe("Pago parcial")
  })
  it("pago exacto = Pagado", () => {
    expect(calculatePaymentStatus(100, 100)).toBe("Pagado")
  })
  it("tolera 1 centavo de redondeo", () => {
    expect(calculatePaymentStatus(99.99, 100)).toBe("Pagado")
    expect(calculatePaymentStatus(99.98, 100)).toBe("Pago parcial")
  })
  it("sobrepago = Pagado", () => {
    expect(calculatePaymentStatus(120, 100)).toBe("Pagado")
  })
})

describe("calculateOrderTotalsFromItems", () => {
  it("separa combos (divisa) de productos normales y calcula VES", () => {
    const t = calculateOrderTotalsFromItems(
      [
        item({ category: "Combos", price: 20, quantity: 1 }),
        item({ price: 10, quantity: 2 }),
      ],
      36,
    )
    expect(t.totalCombosUSD).toBe(20)
    expect(t.totalRegularUSD).toBe(20)
    expect(t.totalRegularVES).toBe(720) // 20 * 36
    expect(t.totalUSD).toBe(40)
  })
  it("suma el delivery al total (pero no a la base)", () => {
    const t = calculateOrderTotalsFromItems([item({ price: 10, quantity: 1 })], 36, 5)
    expect(t.totalBeforeDeliveryUSD).toBe(10)
    expect(t.deliveryCostUSD).toBe(5)
    expect(t.totalUSD).toBe(15)
  })
  it("carrito vacío = todo en cero", () => {
    const t = calculateOrderTotalsFromItems([], 36)
    expect(t.totalUSD).toBe(0)
    expect(t.totalRegularVES).toBe(0)
  })
  it("tasa 0 deja VES en 0 sin romper", () => {
    const t = calculateOrderTotalsFromItems([item({ price: 10 })], 0)
    expect(t.totalRegularVES).toBe(0)
    expect(t.totalUSD).toBe(10)
  })
})

describe("getOrderTotals · respaldo a totales guardados", () => {
  it("usa los ítems cuando existen", () => {
    const t = getOrderTotals(order({ items: [item({ price: 15, quantity: 2 })] }))
    expect(t.totalUSD).toBe(30)
  })
  it("cae a los totales guardados si no hay ítems legibles", () => {
    const t = getOrderTotals(order({ items: [], totalRegularUSD: 42, totalCombosUSD: 0 }))
    expect(t.totalUSD).toBe(42)
  })
})

describe("calculatePaymentDraft", () => {
  const o = order({ items: [item({ price: 100, quantity: 1 })], exchangeRate: 40 })

  it("USD + equivalente de VES y queda Pagado", () => {
    const d = calculatePaymentDraft(o, {
      amountReceivedUSD: "60",
      amountReceivedVES: "1600", // 1600/40 = 40
      paymentMethodUSD: "",
      paymentMethodVES: "",
      deliveryPaymentIn: "Sin registrar",
      paymentNote: "",
    })
    expect(d.receivedEquivalentUSD).toBe(100)
    expect(d.status).toBe("Pagado")
    expect(d.pendingUSD).toBe(0)
  })

  it("pago parcial calcula el pendiente", () => {
    const d = calculatePaymentDraft(o, {
      amountReceivedUSD: "30",
      amountReceivedVES: "",
      paymentMethodUSD: "",
      paymentMethodVES: "",
      deliveryPaymentIn: "Sin registrar",
      paymentNote: "",
    })
    expect(d.status).toBe("Pago parcial")
    expect(d.pendingUSD).toBe(70)
  })

  it("sobrepago no deja pendiente negativo", () => {
    const d = calculatePaymentDraft(o, {
      amountReceivedUSD: "150",
      amountReceivedVES: "",
      paymentMethodUSD: "",
      paymentMethodVES: "",
      deliveryPaymentIn: "Sin registrar",
      paymentNote: "",
    })
    expect(d.status).toBe("Pagado")
    expect(d.pendingUSD).toBe(0)
  })

  it("VES sin tasa no aporta equivalente (evita dividir por 0)", () => {
    const d = calculatePaymentDraft(order({ items: [item({ price: 50 })], exchangeRate: 0 }), {
      amountReceivedUSD: "",
      amountReceivedVES: "1000",
      paymentMethodUSD: "",
      paymentMethodVES: "",
      deliveryPaymentIn: "Sin registrar",
      paymentNote: "",
    })
    expect(d.receivedEquivalentUSD).toBe(0)
    expect(d.status).toBe("Pendiente")
    expect(d.pendingUSD).toBe(50)
  })
})

describe("normalización de métodos de pago", () => {
  it("USD: agrupa efectivo/zelle/binance/usdt", () => {
    expect(normalizePaymentMethodUSD("efectivo")).toBe("Efectivo divisas")
    expect(normalizePaymentMethodUSD("Zelle")).toBe("Zelle")
    expect(normalizePaymentMethodUSD("binance pay")).toBe("Binance")
    expect(normalizePaymentMethodUSD("USDT")).toBe("USDT")
    expect(normalizePaymentMethodUSD("")).toBe("")
    expect(normalizePaymentMethodUSD("algo raro")).toBe("Otro")
  })
  it("VES: reconoce pago móvil", () => {
    expect(normalizePaymentMethodVES("pago movil")).toBe("Pago móvil")
    expect(normalizePaymentMethodVES("")).toBe("")
  })
})
