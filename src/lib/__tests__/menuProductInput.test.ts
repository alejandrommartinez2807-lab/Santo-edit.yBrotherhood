import { describe, expect, it } from "vitest"
import { normalizeMenuProductInput, normalizeProductIds } from "@/lib/menuProductInput"

describe("normalizeMenuProductInput", () => {
  it("normaliza campos base sin cambiar los defaults actuales", () => {
    const input = normalizeMenuProductInput({
      id: "12.4",
      name: "  Perro especial  ",
      category: "   ",
      description: "  Con todo  ",
      price: "4.567",
      image: "  https://example.com/perro.png  ",
      paymentMode: "otro",
      isActive: "no",
      isFeatured: "sí",
      sortOrder: "3.456",
      productType: "raro",
      preparationMinutes: "7.6",
      requiresWaiterConfirmation: "activo",
      inventoryDiscountEnabled: "inactivo",
      ivaRate: "16",
    })

    expect(input).toMatchObject({
      id: 12,
      name: "Perro especial",
      category: "Otros",
      description: "Con todo",
      price: 4.57,
      image: "https://example.com/perro.png",
      paymentMode: "mixto",
      isActive: false,
      isFeatured: true,
      sortOrder: 3.46,
      productType: "normal",
      preparationMinutes: 8,
      requiresWaiterConfirmation: true,
      inventoryDiscountEnabled: false,
      ivaRate: 16,
    })
  })

  it("deja id inválido como undefined y precio negativo en cero", () => {
    const input = normalizeMenuProductInput({
      id: "abc",
      name: "Producto",
      price: -10,
    })

    expect(input.id).toBeUndefined()
    expect(input.price).toBe(0)
  })

  it("mantiene paymentMode divisa y tipos premium permitidos", () => {
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, paymentMode: "divisa" }).paymentMode
    ).toBe("divisa")
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, productType: "variations" })
        .productType
    ).toBe("variations")
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, productType: "addons" }).productType
    ).toBe("addons")
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, productType: "buildable" })
        .productType
    ).toBe("buildable")
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, productType: "combo" }).productType
    ).toBe("combo")
  })

  it("normaliza canales desde array, JSON y texto separado", () => {
    expect(
      normalizeMenuProductInput({
        name: "A",
        price: 1,
        salesChannels: ["local", "delivery", "local", "otro"],
      }).salesChannels
    ).toEqual(["local", "delivery"])

    expect(
      normalizeMenuProductInput({
        name: "A",
        price: 1,
        salesChannels: '["takeaway","delivery"]',
      }).salesChannels
    ).toEqual(["takeaway", "delivery"])

    expect(
      normalizeMenuProductInput({
        name: "A",
        price: 1,
        salesChannels: "local;takeaway|delivery",
      }).salesChannels
    ).toEqual(["local", "takeaway", "delivery"])
  })

  it("usa los tres canales cuando no recibe canales válidos", () => {
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, salesChannels: "otro" })
        .salesChannels
    ).toEqual(["local", "takeaway", "delivery"])
  })

  it("parsea arrays JSON del builder y descarta valores no array", () => {
    const input = normalizeMenuProductInput({
      name: "A",
      price: 1,
      variations: '[{"name":"Tamaño"}]',
      addons: [{ name: "Queso" }],
      includedIngredients: "no-json",
      removableIngredients: '{"name":"Cebolla"}',
    })

    expect(input.variations).toEqual([{ name: "Tamaño" }])
    expect(input.addons).toEqual([{ name: "Queso" }])
    expect(input.includedIngredients).toEqual([])
    expect(input.removableIngredients).toEqual([])
  })

  it("parsea reglas de selección solo cuando son objeto", () => {
    expect(
      normalizeMenuProductInput({
        name: "A",
        price: 1,
        selectionRules: '{"maxAddons":2}',
      }).selectionRules
    ).toEqual({ maxAddons: 2 })

    expect(
      normalizeMenuProductInput({
        name: "A",
        price: 1,
        selectionRules: "[]",
      }).selectionRules
    ).toEqual({})
  })

  it("preparationMinutes solo acepta valores positivos", () => {
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, preparationMinutes: "0" })
        .preparationMinutes
    ).toBe(0)
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, preparationMinutes: "-2" })
        .preparationMinutes
    ).toBe(0)
    expect(
      normalizeMenuProductInput({ name: "A", price: 1, preparationMinutes: "4.3" })
        .preparationMinutes
    ).toBe(4)
  })

  it("mantiene defaults booleanos actuales", () => {
    const input = normalizeMenuProductInput({ name: "A", price: 1 })

    expect(input.isActive).toBe(true)
    expect(input.isFeatured).toBe(false)
    expect(input.requiresWaiterConfirmation).toBe(false)
    expect(input.inventoryDiscountEnabled).toBe(true)
  })

  it("ivaRate acepta 0 a 100 o cae en null", () => {
    expect(normalizeMenuProductInput({ name: "A", price: 1, ivaRate: 0 }).ivaRate).toBe(0)
    expect(normalizeMenuProductInput({ name: "A", price: 1, ivaRate: 100 }).ivaRate).toBe(100)
    expect(normalizeMenuProductInput({ name: "A", price: 1, ivaRate: "" }).ivaRate).toBeNull()
    expect(normalizeMenuProductInput({ name: "A", price: 1, ivaRate: 101 }).ivaRate).toBeNull()
    expect(normalizeMenuProductInput({ name: "A", price: 1, ivaRate: "abc" }).ivaRate).toBeNull()
  })
})

describe("normalizeProductIds", () => {
  it("normaliza IDs destacados desde array, JSON y texto separado", () => {
    expect(normalizeProductIds(["1", 2.4, "x", 2, -1])).toEqual([1, 2])
    expect(normalizeProductIds('[3,"4",0,"x"]')).toEqual([3, 4])
    expect(normalizeProductIds("5;6|7,5")).toEqual([5, 6, 7])
  })
})
