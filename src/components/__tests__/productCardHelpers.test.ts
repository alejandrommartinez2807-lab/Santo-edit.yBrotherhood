import { describe, it, expect } from "vitest"
import {
  getProductType,
  getSalesChannels,
  normalizeSelectionRules,
  toDisplayOptions,
  flattenAddonOptions,
} from "@/components/productCardHelpers"

describe("getProductType", () => {
  it("respeta tipos válidos y deduce combo por categoría", () => {
    expect(getProductType("variations", "Otros")).toBe("variations")
    expect(getProductType(undefined, "Combos")).toBe("combo")
    expect(getProductType(undefined, "Perros")).toBe("normal")
  })
})

describe("getSalesChannels", () => {
  it("cae a los tres canales si no hay válidos", () => {
    expect(getSalesChannels(undefined)).toEqual(["local", "takeaway", "delivery"])
    expect(getSalesChannels(["local", "x"] as never)).toEqual(["local"])
  })
})

describe("normalizeSelectionRules", () => {
  it("lee máximos/mínimos desde varias claves", () => {
    const r = normalizeSelectionRules({ maxAddons: 4, minExtras: 1 } as never)
    expect(r.maxAddons).toBe(4)
    expect(r.minAddons).toBe(1)
    expect(r.requiresStaffReview).toBe(false)
  })
})

describe("toDisplayOptions", () => {
  it("convierte opciones e ignora inactivas", () => {
    const out = toDisplayOptions(
      [
        "Queso",
        { name: "Tocineta", priceDelta: 1 },
        { name: "Inactiva", isActive: false },
      ],
      "Ingrediente",
    )
    expect(out.map((o) => o.label)).toEqual(["Queso", "Tocineta"])
  })
})

describe("flattenAddonOptions", () => {
  it("normaliza adicionales con su precio", () => {
    const out = flattenAddonOptions([{ name: "Extra queso", price: 1.5 }])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe("Extra queso")
    expect(out[0].priceDelta).toBe(1.5)
  })
})
