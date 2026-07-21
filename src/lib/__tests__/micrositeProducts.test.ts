import { describe, expect, it } from "vitest"
import { parseProductsInput, productsToInput, sanitizeProducts } from "../mallText"

describe("sanitizeProducts", () => {
  it("acepta sólo filas con nombre y normaliza precio/imagen/descripción", () => {
    const out = sanitizeProducts([
      { name: "  Combo doble  ", price: "5.5", image: " https://img/1.jpg ", description: " Con papas " },
      { name: "", price: 3, image: "x", description: "sin nombre: fuera" },
      { name: "Sin precio", price: "no-numérico" },
    ])
    expect(out).toEqual([
      { name: "Combo doble", price: 5.5, image: "https://img/1.jpg", description: "Con papas" },
      { name: "Sin precio", price: 0, image: "", description: "" },
    ])
  })

  it("tolera basura (no-array, objetos raros) y limita a 24 productos", () => {
    expect(sanitizeProducts(null)).toEqual([])
    expect(sanitizeProducts("hola")).toEqual([])
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}` }))
    expect(sanitizeProducts(many)).toHaveLength(24)
  })

  it("precios negativos o cero quedan como 'sin precio' (0)", () => {
    expect(sanitizeProducts([{ name: "Gratis", price: -2 }])[0].price).toBe(0)
  })
})

describe("parseProductsInput", () => {
  it("parsea 'Nombre | precio | imagen | descripción' una línea por producto", () => {
    const out = parseProductsInput(
      "Hamburguesa Clásica | 6 | https://img/burger.jpg | Carne 100% res\n" +
      "Papas | 2,50\n" +
      "\n" +
      "Refresco | | https://img/soda.jpg"
    )
    expect(out).toEqual([
      { name: "Hamburguesa Clásica", price: 6, image: "https://img/burger.jpg", description: "Carne 100% res" },
      { name: "Papas", price: 2.5, image: "", description: "" },
      { name: "Refresco", price: 0, image: "https://img/soda.jpg", description: "" },
    ])
  })

  it("acepta precio con símbolo ($6.00) y coma decimal", () => {
    expect(parseProductsInput("Corte | $8.00")[0].price).toBe(8)
    expect(parseProductsInput("Corte | 8,5")[0].price).toBe(8.5)
  })
})

describe("productsToInput", () => {
  it("es inverso de parseProductsInput (round-trip)", () => {
    const text = "Combo | 5.5 | https://img/1.jpg | Con papas\nSolo nombre"
    expect(productsToInput(parseProductsInput(text))).toBe(text)
    expect(parseProductsInput(productsToInput(parseProductsInput(text)))).toEqual(parseProductsInput(text))
  })

  it("omite campos vacíos al final de la línea", () => {
    expect(productsToInput([{ name: "Papas", price: 0, image: "", description: "" }])).toBe("Papas")
  })
})
