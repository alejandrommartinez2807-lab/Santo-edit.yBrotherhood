import { describe, expect, it } from "vitest"
import {
  DEFAULT_BUSINESS_CONFIG,
  normalizeBusinessConfig,
  type BusinessConfig,
} from "@/lib/orders"
import { getModulePlanAccess, LOCAL_MODULE_DEFINITIONS } from "@/lib/localPlans"

const defaults = DEFAULT_BUSINESS_CONFIG as unknown as Record<string, unknown>

describe("Configuración del negocio · módulos y sedes", () => {
  it("cada módulo editable por el dueño tiene una bandera guardable en la configuración", () => {
    const ownerConfigKeys = LOCAL_MODULE_DEFINITIONS
      .map((moduleDefinition) => moduleDefinition.ownerConfigKey)
      .filter((key): key is string => Boolean(key))

    expect(new Set(ownerConfigKeys).size).toBe(ownerConfigKeys.length)

    for (const key of ownerConfigKeys) {
      expect(defaults[key], `falta default para ${key}`).not.toBeUndefined()
      expect(typeof defaults[key], `tipo incorrecto en ${key}`).toBe("boolean")
    }
  })

  it("normaliza y evalúa la bandera de Productos del menú según el plan", () => {
    const completeConfig = normalizeBusinessConfig({
      membershipPlan: "complete",
      menuProductsModuleEnabled: false,
    })

    expect(completeConfig.menuProductsModuleEnabled).toBe(false)
    expect(getModulePlanAccess(completeConfig, "menuProducts").effectiveEnabled).toBe(false)

    const basicConfig = normalizeBusinessConfig({
      membershipPlan: "basic",
      menuProductsModuleEnabled: true,
    })

    expect(basicConfig.menuProductsModuleEnabled).toBe(true)
    expect(getModulePlanAccess(basicConfig, "menuProducts").includedInPlan).toBe(false)
    expect(getModulePlanAccess(basicConfig, "menuProducts").effectiveEnabled).toBe(false)
  })

  it("mantiene mesas configuradas para la respuesta pública y QR por mesa", () => {
    const config: BusinessConfig = normalizeBusinessConfig({
      localTables: [
        { id: "terraza-2", name: "Terraza 2", area: "Terraza", sortOrder: 2, isActive: true },
        { id: "barra", name: "Barra", area: "Barra", sortOrder: 1, isActive: false },
      ],
    })

    expect(config.localTables).toEqual([
      { id: "barra", name: "Barra", area: "Barra", sortOrder: 1, isActive: false, note: "" },
      { id: "terraza-2", name: "Terraza 2", area: "Terraza", sortOrder: 2, isActive: true, note: "" },
    ])
  })
})
