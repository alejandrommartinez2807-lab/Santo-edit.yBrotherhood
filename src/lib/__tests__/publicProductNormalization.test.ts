import { describe, expect, it } from "vitest"
import {
  normalizePublicProduct,
  normalizePublicProductArray,
  normalizePublicProducts,
} from "@/lib/publicProductNormalization"
import { products as fallbackProducts } from "@/data/products"

describe("publicProductNormalization", () => {
  it("normaliza un producto público preservando campos premium", () => {
    const product = normalizePublicProduct(
      {
        id: "11.8",
        name: "  Santo especial  ",
        category: "Combos",
        description: "  Con todo  ",
        price: "4.5",
        image: "",
        paymentMode: "divisa",
        isFeatured: true,
        sortOrder: "2",
        productType: "buildable",
        salesChannels: '["local","delivery","otro"]',
        variations: '[{"id":"tamano","name":"Tamaño"}]',
        addons: "Queso,Tocineta",
        includedIngredients: "Pan\nSalchicha",
        removableIngredients: '[{"id":"cebolla","name":"Cebolla"}]',
        selectionRules: '{"maxAddons":2}',
        preparationMinutes: "12",
        requiresWaiterConfirmation: "sí",
        inventoryDiscountEnabled: "no",
        premiumSummary: "  Personalizable  ",
        ivaRate: "16",
      },
      { imageFallback: "/fallback.png" },
    )

    expect(product).toMatchObject({
      id: 12,
      name: "Santo especial",
      category: "Combos",
      description: "Con todo",
      price: 4.5,
      image: "/fallback.png",
      paymentMode: "divisa",
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
      productType: "buildable",
      salesChannels: ["local", "delivery"],
      addons: ["Queso", "Tocineta"],
      includedIngredients: ["Pan", "Salchicha"],
      selectionRules: { maxAddons: 2 },
      preparationMinutes: 12,
      requiresWaiterConfirmation: true,
      inventoryDiscountEnabled: false,
      premiumSummary: "Personalizable",
      ivaRate: 16,
    })
    expect(product?.variations).toEqual([{ id: "tamano", name: "Tamaño" }])
    expect(product?.removableIngredients).toEqual([{ id: "cebolla", name: "Cebolla" }])
  })

  it("mantiene fallback de tipo combo por categoría cuando el tipo no viene válido", () => {
    expect(
      normalizePublicProduct({ id: 1, name: "Combo", category: "Combos", productType: "otro" })
        ?.productType,
    ).toBe("combo")
    expect(
      normalizePublicProduct({ id: 2, name: "Perro", category: "Burgers", productType: "otro" })
        ?.productType,
    ).toBe("normal")
  })

  it("normaliza listas desde JSON o texto separado", () => {
    expect(normalizePublicProductArray('["A","B"]')).toEqual(["A", "B"])
    expect(normalizePublicProductArray("A,B\nC")).toEqual(["A", "B", "C"])
    expect(normalizePublicProductArray({ value: "A" })).toEqual([])
  })

  it("filtra productos inválidos e inactivos y ordena por sortOrder", () => {
    const products = normalizePublicProducts([
      { id: 3, name: "Tercero", sortOrder: 3, isActive: true },
      { id: 1, name: "Primero", sortOrder: 1, isActive: true },
      { id: 2, name: "Inactivo", sortOrder: 2, isActive: false },
      { id: 0, name: "Inválido" },
    ])

    expect(products.map((product) => product.name)).toEqual(["Primero", "Tercero"])
  })

  it("usa el menú base cuando la respuesta pública no trae productos válidos", () => {
    expect(normalizePublicProducts(null)).toBe(fallbackProducts)
    expect(normalizePublicProducts([{ id: 0, name: "" }])).toBe(fallbackProducts)
  })
})
