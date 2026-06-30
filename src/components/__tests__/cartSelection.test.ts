import { describe, it, expect } from "vitest"
import {
  cleanSelectionOption,
  cleanSelectionOptions,
  formatSelectionOption,
  buildSelectionLines,
  getSelectionSummary,
} from "@/components/cartSelection"
import type { CartItem } from "@/components/cartTypes"

describe("cleanSelectionOption", () => {
  it("descarta opciones sin nombre y normaliza cantidad/precio", () => {
    expect(cleanSelectionOption({ name: "" })).toBeNull()
    const o = cleanSelectionOption({ name: "Queso", priceDelta: 1.5, quantity: 0 })
    expect(o?.name).toBe("Queso")
    expect(o?.priceDelta).toBe(1.5)
    expect(o?.quantity).toBe(1) // mínimo 1
  })
})

describe("cleanSelectionOptions", () => {
  it("filtra inválidas de la lista", () => {
    const out = cleanSelectionOptions([{ name: "A" }, { name: "" }, { name: "B" }])
    expect(out.map((o) => o.name)).toEqual(["A", "B"])
  })
})

describe("formatSelectionOption", () => {
  it("incluye grupo, cantidad y precio", () => {
    expect(formatSelectionOption({ name: "Tocineta", priceDelta: 1 })).toContain("Tocineta")
    expect(formatSelectionOption({ name: "X", quantity: 2 })).toContain("x2")
    expect(formatSelectionOption({ name: "Y", groupName: "Salsa" })).toContain("Salsa:")
  })
})

describe("buildSelectionLines / getSelectionSummary", () => {
  it("arma líneas de variación, adicionales y removidos", () => {
    const item = {
      name: "Perro",
      selectedVariation: { name: "Grande" },
      selectedAddons: [{ name: "Queso" }],
      removedIngredients: [{ name: "Cebolla" }],
      requiresWaiterConfirmation: true,
    } as unknown as CartItem
    const lines = buildSelectionLines(item)
    expect(lines.some((l) => l.includes("Variación"))).toBe(true)
    expect(lines.some((l) => l.includes("Adicionales"))).toBe(true)
    expect(lines.some((l) => l.startsWith("Sin:"))).toBe(true)
    expect(lines.some((l) => l.includes("confirmación"))).toBe(true)
  })

  it("usa selectionSummary manual si está presente", () => {
    const item = { selectionSummary: "Resumen manual" } as unknown as CartItem
    expect(getSelectionSummary(item)).toBe("Resumen manual")
  })
})
