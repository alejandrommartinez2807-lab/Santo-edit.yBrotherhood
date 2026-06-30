import { describe, expect, it } from "vitest"
import { categories as fallbackCategories } from "@/data/products"
import { buildPublicProductCategories } from "@/lib/publicProductCategories"

describe("publicProductCategories", () => {
  it("mantiene primero las categorías base cuando no recibe productos ni categorías API", () => {
    expect(buildPublicProductCategories([])).toEqual(fallbackCategories)
  })

  it("mezcla categorías base, categorías API y categorías de productos sin duplicar", () => {
    const categories = buildPublicProductCategories(
      [{ category: "Perritos" }, { category: "Promos" }, { category: "Promos" }],
      [" Promos ", "Bebidas", "", null]
    )

    expect(categories).toEqual([...fallbackCategories, "Promos"])
  })

  it("ignora categorías API cuando el valor no es una lista", () => {
    expect(
      buildPublicProductCategories([{ category: "Especiales" }], "Especiales")
    ).toEqual([...fallbackCategories, "Especiales"])
  })
})
