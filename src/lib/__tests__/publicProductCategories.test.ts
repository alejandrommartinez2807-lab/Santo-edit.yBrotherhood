import { describe, expect, it } from "vitest"
import { categories as fallbackCategories } from "@/data/products"
import { buildPublicProductCategories } from "@/lib/publicProductCategories"

describe("publicProductCategories", () => {
  it("mantiene las categorías base cuando no recibe productos ni categorías API", () => {
    expect(buildPublicProductCategories([])).toEqual(fallbackCategories)
  })

  it("deriva las categorías del menú real sin colar categorías base vacías", () => {
    const categories = buildPublicProductCategories(
      [{ category: "Antojos" }, { category: "Promos" }, { category: "Promos" }],
      [" Promos ", "Bebidas", "", null]
    )

    expect(categories).toEqual(["Todos", "Antojos", "Promos"])
  })

  it("respeta el orden del menú (sortOrder) al derivar categorías", () => {
    const categories = buildPublicProductCategories([
      { category: "Bebidas", sortOrder: 30 },
      { category: "Favorita", sortOrder: 1 },
      { category: "Burgers", sortOrder: 10 },
      { category: "Burgers", sortOrder: 11 },
    ])

    expect(categories).toEqual(["Todos", "Favorita", "Burgers", "Bebidas"])
  })

  it("usa las categorías API solo cuando no hay productos", () => {
    expect(buildPublicProductCategories([], ["Especiales", "Bebidas"])).toEqual([
      "Todos",
      "Especiales",
      "Bebidas",
    ])
  })

  it("ignora categorías API cuando el valor no es una lista", () => {
    expect(
      buildPublicProductCategories([{ category: "Especiales" }], "Especiales")
    ).toEqual(["Todos", "Especiales"])
  })
})
