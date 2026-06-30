import { describe, it, expect } from "vitest"
import {
  normalizeItems,
  isComboItem,
  normalizePhoneForWhatsApp,
  getDisplayOrderNumber,
  getOrderStaffConfirmationSummary,
  isValidOrderType,
} from "@/lib/localOrderHelpers"
import type { LocalOrder } from "@/types/localOrders"

describe("normalizeItems", () => {
  it("limpia y descarta ítems inválidos", () => {
    const result = normalizeItems([
      { id: 1, name: "Perro", category: "Perros", price: 5, quantity: 2 },
      { id: 2, name: "", price: 3, quantity: 1 }, // sin nombre → fuera
      { id: 3, name: "Gratis", price: 0, quantity: 1 }, // price 0 permitido
      { id: 4, name: "CeroQty", price: 2, quantity: 0 }, // qty 0 → fuera
    ])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("Perro")
    expect(result[1].name).toBe("Gratis")
  })

  it("marca paymentMode divisa para categoría Combos", () => {
    const [combo] = normalizeItems([
      { id: 1, name: "Combo", category: "Combos", price: 8, quantity: 1 },
    ])
    expect(combo.paymentMode).toBe("divisa")
    expect(isComboItem(combo)).toBe(true)
  })
})

describe("normalizePhoneForWhatsApp", () => {
  it("normaliza números venezolanos a formato internacional", () => {
    expect(normalizePhoneForWhatsApp("04141234567")).toBe("584141234567")
    expect(normalizePhoneForWhatsApp("4141234567")).toBe("584141234567")
    expect(normalizePhoneForWhatsApp("584141234567")).toBe("584141234567")
    expect(normalizePhoneForWhatsApp("123")).toBe("")
  })
})

describe("getDisplayOrderNumber", () => {
  it("usa rowNumber para el número visible", () => {
    const order = { id: "ord-x", rowNumber: 5 } as LocalOrder
    expect(getDisplayOrderNumber(order)).toBe("#04")
  })

  it("cae al sufijo del id si no hay rowNumber", () => {
    const order = { id: "ord-abc-123" } as LocalOrder
    expect(getDisplayOrderNumber(order)).toBe("#123")
  })
})

describe("getOrderStaffConfirmationSummary", () => {
  it("no requiere revisión si ningún ítem la pide", () => {
    const order = {
      items: [{ id: 1, name: "A", quantity: 1, price: 1 }],
    } as unknown as LocalOrder
    const s = getOrderStaffConfirmationSummary(order)
    expect(s.status).toBe("not_required")
    expect(s.requiredCount).toBe(0)
  })

  it("queda pendiente si un ítem requiere confirmación y no está confirmado", () => {
    const order = {
      items: [
        {
          id: 1,
          name: "Especial",
          quantity: 1,
          price: 5,
          requiresWaiterConfirmation: true,
          staffConfirmationStatus: "pending",
        },
      ],
    } as unknown as LocalOrder
    const s = getOrderStaffConfirmationSummary(order)
    expect(s.requiredCount).toBe(1)
    expect(s.pendingCount).toBe(1)
    expect(s.status).toBe("pending")
  })

  it("queda confirmado cuando el ítem requerido está confirmado", () => {
    const order = {
      items: [
        {
          id: 1,
          name: "Especial",
          quantity: 1,
          price: 5,
          requiresWaiterConfirmation: true,
          staffConfirmationStatus: "confirmed",
        },
      ],
    } as unknown as LocalOrder
    const s = getOrderStaffConfirmationSummary(order)
    expect(s.confirmedCount).toBe(1)
    expect(s.status).toBe("confirmed")
  })
})

describe("isValidOrderType", () => {
  it("valida los tipos permitidos", () => {
    expect(isValidOrderType("Comer aquí")).toBe(true)
    expect(isValidOrderType("Para llevar")).toBe(true)
    expect(isValidOrderType("Delivery")).toBe(true)
    expect(isValidOrderType("Otro")).toBe(false)
  })
})
