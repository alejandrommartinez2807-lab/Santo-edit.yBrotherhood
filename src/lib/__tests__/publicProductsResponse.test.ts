import { describe, expect, it } from "vitest"
import {
  buildCategories,
  buildPublicProductsFallbackResponse,
  buildPublicProductsResponse,
  menuProductToPublicProduct,
} from "@/lib/publicProductsResponse"
import { categories as fallbackCategories, products as fallbackProducts } from "@/data/products"
import type { MenuProduct } from "@/lib/orders"

function makeMenuProduct(overrides: Partial<MenuProduct> = {}): MenuProduct {
  return {
    id: 101,
    name: "Perro especial",
    category: "Burgers",
    description: "Con todo",
    price: 4.5,
    image: "/perro.png",
    paymentMode: "mixto",
    isActive: true,
    isFeatured: false,
    sortOrder: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("publicProductsResponse", () => {
  it("convierte un producto activo al formato público sin cambiar campos base", () => {
    const product = makeMenuProduct({ isFeatured: true, paymentMode: "divisa" })

    expect(menuProductToPublicProduct(product)).toMatchObject({
      id: 101,
      name: "Perro especial",
      category: "Burgers",
      description: "Con todo",
      price: 4.5,
      image: "/perro.png",
      paymentMode: "divisa",
      isActive: true,
      isFeatured: true,
      sortOrder: 10,
    })
  })

  it("no incluye productos inactivos en la respuesta pública", () => {
    const response = buildPublicProductsResponse([
      makeMenuProduct({ id: 1, name: "Activo", isActive: true }),
      makeMenuProduct({ id: 2, name: "Inactivo", isActive: false }),
    ])

    expect(response.fallback).toBe(false)
    expect(response.products.map((product) => product.name)).toEqual(["Activo"])
    expect(response.warning).toBeUndefined()
  })

  it("usa /logo.png cuando la imagen editable viene vacía", () => {
    expect(menuProductToPublicProduct(makeMenuProduct({ image: "" })).image).toBe("/logo.png")
  })

  it("deriva las categorías del menú real sin colar categorías base vacías", () => {
    const categories = buildCategories([
      menuProductToPublicProduct(makeMenuProduct({ category: "Burgers" })),
      menuProductToPublicProduct(makeMenuProduct({ category: "Promos" })),
      menuProductToPublicProduct(makeMenuProduct({ category: "Promos" })),
    ])

    expect(categories).toEqual(["Todos", "Burgers", "Promos"])
  })

  it("usa el menú base cuando no hay productos activos", () => {
    const response = buildPublicProductsResponse([
      makeMenuProduct({ id: 1, isActive: false }),
      makeMenuProduct({ id: 2, isActive: false }),
    ])

    expect(response.products).toBe(fallbackProducts)
    expect(response.fallback).toBe(true)
    expect(response.warning).toBe(
      "El menú editable todavía no tiene productos activos. Se está mostrando el menú base."
    )
    expect(response.categories).toEqual(buildCategories(fallbackProducts))
  })

  it("preserva campos premium del producto editable", () => {
    const variations = [{ id: "tamano", name: "Tamaño" }]
    const addons = [{ id: "queso", name: "Queso", price: 1 }]
    const includedIngredients = [{ id: "pan", name: "Pan", included: true }]
    const removableIngredients = [{ id: "cebolla", name: "Cebolla", removable: true }]
    const selectionRules = { maxAddons: 2 }

    const product = menuProductToPublicProduct(
      makeMenuProduct({
        productType: "buildable",
        salesChannels: ["local", "delivery"],
        variations,
        addons,
        includedIngredients,
        removableIngredients,
        selectionRules,
        preparationMinutes: 12,
        requiresWaiterConfirmation: true,
        inventoryDiscountEnabled: true,
        premiumSummary: "Personalizable",
        ivaRate: 16,
      })
    )

    expect(product).toMatchObject({
      productType: "buildable",
      salesChannels: ["local", "delivery"],
      variations,
      addons,
      includedIngredients,
      removableIngredients,
      selectionRules,
      preparationMinutes: 12,
      requiresWaiterConfirmation: true,
      inventoryDiscountEnabled: true,
      premiumSummary: "Personalizable",
      ivaRate: 16,
    })
  })

  it("mantiene la respuesta fallback de errores con detalle cuando recibe Error", () => {
    const response = buildPublicProductsFallbackResponse(new Error("falló Supabase"))

    expect(response.products).toBe(fallbackProducts)
    expect(response.categories).toBe(fallbackCategories)
    expect(response.fallback).toBe(true)
    expect(response.warning).toBe(
      "No se pudo cargar el menú editable. Se está mostrando el menú base. Detalle: falló Supabase"
    )
  })

  it("mantiene la respuesta fallback de errores sin detalle para errores desconocidos", () => {
    const response = buildPublicProductsFallbackResponse("falló")

    expect(response.warning).toBe(
      "No se pudo cargar el menú editable. Se está mostrando el menú base."
    )
  })
})
