import { describe, expect, it } from "vitest"

import { computeInventoryConsumption } from "../inventoryConsumption"

describe("computeInventoryConsumption", () => {
  it("descuenta según la receta multiplicando por la cantidad vendida", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 1, name: "Perro", quantity: 2 }],
      recipes: [
        { productId: 1, ingredients: [{ itemId: "pan", quantity: 1, unit: "u" }, { itemId: "salchicha", quantity: 1.5, unit: "u" }] },
      ],
    })

    expect(lines).toEqual([
      { itemId: "pan", itemName: "pan", unit: "u", quantity: 2 },
      { itemId: "salchicha", itemName: "salchicha", unit: "u", quantity: 3 },
    ])
  })

  it("acumula el mismo insumo usado por varios productos del pedido", () => {
    const lines = computeInventoryConsumption({
      items: [
        { id: 1, quantity: 2 },
        { id: 2, quantity: 1 },
      ],
      recipes: [
        { productId: 1, ingredients: [{ itemId: "pan", quantity: 1 }] },
        { productId: 2, ingredients: [{ itemId: "pan", quantity: 3 }] },
      ],
    })

    expect(lines).toEqual([{ itemId: "pan", itemName: "pan", unit: "", quantity: 5 }])
  })

  it("usa los ingredientes vinculados del producto cuando no hay receta", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 7, quantity: 3 }],
      recipes: [],
      products: [
        {
          id: 7,
          includedIngredients: [
            { inventoryItemId: "queso", name: "Queso", inventoryQuantity: 2, inventoryUnit: "g" },
            { name: "Sin vínculo" },
          ],
        },
      ],
    })

    expect(lines).toEqual([{ itemId: "queso", itemName: "Queso", unit: "g", quantity: 6 }])
  })

  it("el vínculo sin cantidad cuenta como 1 por unidad vendida", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 7, quantity: 4 }],
      recipes: [],
      products: [{ id: 7, includedIngredients: [{ inventoryItemId: "servilleta", name: "Servilleta" }] }],
    })

    expect(lines).toEqual([{ itemId: "servilleta", itemName: "Servilleta", unit: "", quantity: 4 }])
  })

  it("respeta el interruptor por producto (inventoryDiscountEnabled=false)", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 1, quantity: 5 }],
      recipes: [{ productId: 1, ingredients: [{ itemId: "pan", quantity: 1 }] }],
      products: [{ id: 1, inventoryDiscountEnabled: false }],
    })

    expect(lines).toEqual([])
  })

  it("la receta tiene prioridad sobre los vínculos del producto", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 1, quantity: 1 }],
      recipes: [{ productId: 1, ingredients: [{ itemId: "pan", quantity: 1 }] }],
      products: [{ id: 1, includedIngredients: [{ inventoryItemId: "queso", inventoryQuantity: 9 }] }],
    })

    expect(lines).toEqual([{ itemId: "pan", itemName: "pan", unit: "", quantity: 1 }])
  })

  it("ignora recetas inactivas y cae al respaldo de vínculos", () => {
    const lines = computeInventoryConsumption({
      items: [{ id: 1, quantity: 1 }],
      recipes: [{ productId: 1, isActive: false, ingredients: [{ itemId: "pan", quantity: 1 }] }],
      products: [{ id: 1, includedIngredients: [{ inventoryItemId: "queso", inventoryQuantity: 2 }] }],
    })

    expect(lines).toEqual([{ itemId: "queso", itemName: "queso", unit: "", quantity: 2 }])
  })

  it("descarta cantidades no válidas y pedidos sin cantidad", () => {
    const lines = computeInventoryConsumption({
      items: [
        { id: 1, quantity: 0 },
        { id: 2, quantity: 1 },
      ],
      recipes: [
        { productId: 1, ingredients: [{ itemId: "pan", quantity: 1 }] },
        { productId: 2, ingredients: [{ itemId: "", quantity: 1 }, { itemId: "sal", quantity: 0 }, { itemId: "agua", quantity: 2 }] },
      ],
    })

    expect(lines).toEqual([{ itemId: "agua", itemName: "agua", unit: "", quantity: 2 }])
  })
})
