import { describe, it, expect } from "vitest"
import { BUSINESS_TYPE_PRESETS, getBusinessTypePreset } from "@/lib/businessTypes"

describe("BUSINESS_TYPE_PRESETS", () => {
  it("incluye los rubros principales con etiqueta de ubicación", () => {
    const ids = BUSINESS_TYPE_PRESETS.map((p) => p.id)
    expect(ids).toContain("restaurante")
    expect(ids).toContain("comida_rapida")
    expect(ids).toContain("tienda")
    for (const p of BUSINESS_TYPE_PRESETS) {
      expect(p.locationLabel.length).toBeGreaterThan(0)
      expect(Object.keys(p.config).length).toBeGreaterThan(0)
    }
  })

  it("comida rápida desactiva mesas y cuentas, activa caja", () => {
    const p = getBusinessTypePreset("comida_rapida")!
    expect(p.config.tablesModuleEnabled).toBe(false)
    expect(p.config.openAccountsModuleEnabled).toBe(false)
    expect(p.config.cashierModuleEnabled).toBe(true)
  })

  it("tienda desactiva cocina", () => {
    expect(getBusinessTypePreset("tienda")!.config.kitchenModuleEnabled).toBe(false)
  })

  it("devuelve undefined para id desconocido", () => {
    expect(getBusinessTypePreset("xxx")).toBeUndefined()
  })
})
