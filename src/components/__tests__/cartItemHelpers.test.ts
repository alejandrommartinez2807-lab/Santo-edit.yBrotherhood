import { describe, it, expect } from "vitest"
import {
  isComboItem,
  getItemPaymentMode,
  getOrderTypeSalesChannel,
  itemSupportsOrderType,
  getCartItemSalesChannels,
} from "@/components/cartItemHelpers"
import type { CartItem } from "@/components/cartTypes"

function item(p: Partial<CartItem>): CartItem {
  return { id: 1, name: "X", category: "Otros", price: 1, image: "", quantity: 1, ...p } as CartItem
}

describe("isComboItem / getItemPaymentMode", () => {
  it("combo por paymentMode o categoría", () => {
    expect(isComboItem(item({ paymentMode: "divisa" }))).toBe(true)
    expect(isComboItem(item({ category: "Combos" }))).toBe(true)
    expect(isComboItem(item({ category: "Perros" }))).toBe(false)
    expect(getItemPaymentMode(item({ category: "Combos" }))).toBe("divisa")
    expect(getItemPaymentMode(item({ category: "Perros" }))).toBe("mixto")
  })
})

describe("getOrderTypeSalesChannel", () => {
  it("mapea tipo de pedido a canal", () => {
    expect(getOrderTypeSalesChannel("Comer aquí")).toBe("local")
    expect(getOrderTypeSalesChannel("Para llevar")).toBe("takeaway")
    expect(getOrderTypeSalesChannel("Delivery")).toBe("delivery")
  })
})

describe("getCartItemSalesChannels / itemSupportsOrderType", () => {
  it("sin canales definidos soporta todos", () => {
    const i = item({})
    expect(getCartItemSalesChannels(i)).toEqual(["local", "takeaway", "delivery"])
    expect(itemSupportsOrderType(i, "Delivery")).toBe(true)
  })

  it("respeta los canales declarados del ítem", () => {
    const i = item({ salesChannels: ["local"] })
    expect(itemSupportsOrderType(i, "Comer aquí")).toBe(true)
    expect(itemSupportsOrderType(i, "Delivery")).toBe(false)
  })
})
