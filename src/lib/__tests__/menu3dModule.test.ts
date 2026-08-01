// Módulo "Platos en 3D y realidad aumentada": es opcional y desactivable.
//
// Lo que estos tests fijan es lo que hace que sea un MÓDULO de verdad y no un
// interruptor de mentira: que apagarlo apague el 3D en la carta pública, que
// NO borre los modelos ya cargados en los productos, y que el plan mande sobre
// el interruptor del dueño.
import { describe, expect, it } from "vitest"
import {
  LOCAL_MODULE_DEFINITIONS,
  getModulePlanAccess,
  getModuleEnabledByOwner,
  getIncludedModulesForPlan,
} from "@/lib/localPlans"
import { DEFAULT_BUSINESS_CONFIG, normalizeBusinessConfig } from "@/lib/ordersBusinessConfig"
import { buildPublicBusinessConfigResponse } from "@/lib/publicBusinessConfigResponse"

const definicion = LOCAL_MODULE_DEFINITIONS.find((item) => item.key === "menu3d")

describe("el módulo existe y está bien declarado", () => {
  it("está en el registro con su interruptor del dueño", () => {
    expect(definicion).toBeTruthy()
    expect(definicion?.ownerConfigKey).toBe("menu3dModuleEnabled")
    expect(definicion?.visibleForOwnerSettings).toBe(true)
  })

  it("se vende desde el plan Pro (y por lo tanto también en Completo)", () => {
    expect(definicion?.minimumPlan).toBe("pro")
    expect(getIncludedModulesForPlan("pro")).toContain("menu3d")
    expect(getIncludedModulesForPlan("complete")).toContain("menu3d")
  })

  it("los planes de abajo NO lo traen", () => {
    expect(getIncludedModulesForPlan("menuDigital")).not.toContain("menu3d")
    expect(getIncludedModulesForPlan("basic")).not.toContain("menu3d")
  })
})

describe("el interruptor del dueño", () => {
  it("viene encendido por defecto", () => {
    expect(DEFAULT_BUSINESS_CONFIG.menu3dModuleEnabled).toBe(true)
    expect(getModuleEnabledByOwner({}, "menu3d")).toBe(true)
  })

  it("se puede apagar", () => {
    expect(getModuleEnabledByOwner({ menu3dModuleEnabled: false }, "menu3d")).toBe(false)
  })

  it("el plan manda sobre el interruptor: en un plan sin el módulo queda apagado", () => {
    // El candado por plan NO vive en normalizeBusinessConfig (que solo sanea):
    // se aplica al leer/guardar y en effectiveEnabled, que es lo que consulta
    // la carta pública.
    const acceso = getModulePlanAccess(
      { membershipPlan: "basic", menu3dModuleEnabled: true },
      "menu3d",
    )

    expect(acceso.includedInPlan).toBe(false)
    expect(acceso.effectiveEnabled).toBe(false)
  })

  it("en un plan que sí lo incluye, respeta lo que eligió el dueño", () => {
    expect(
      getModulePlanAccess({ membershipPlan: "complete", menu3dModuleEnabled: true }, "menu3d")
        .effectiveEnabled,
    ).toBe(true)
    expect(
      getModulePlanAccess({ membershipPlan: "complete", menu3dModuleEnabled: false }, "menu3d")
        .effectiveEnabled,
    ).toBe(false)
  })

  it("getModulePlanAccess lo reporta como cualquier otro módulo", () => {
    const acceso = getModulePlanAccess(
      { membershipPlan: "complete", menu3dModuleEnabled: false },
      "menu3d",
    )

    expect(acceso.includedInPlan).toBe(true)
    expect(acceso.enabledByOwner).toBe(false)
  })
})

describe("la carta pública se entera", () => {
  it("la config pública lleva la bandera", () => {
    const encendido = buildPublicBusinessConfigResponse(
      normalizeBusinessConfig({ membershipPlan: "complete", menu3dModuleEnabled: true }),
    )
    const apagado = buildPublicBusinessConfigResponse(
      normalizeBusinessConfig({ membershipPlan: "complete", menu3dModuleEnabled: false }),
    )

    expect(encendido.menu3dModuleEnabled).toBe(true)
    expect(apagado.menu3dModuleEnabled).toBe(false)
  })

  it("sin la clave guardada, la carta asume que está encendido", () => {
    const respuesta = buildPublicBusinessConfigResponse(normalizeBusinessConfig({}))

    expect(respuesta.menu3dModuleEnabled).toBe(true)
  })

  it("con un plan que no incluye el módulo, la carta lo recibe apagado", () => {
    // Aunque la config traiga el interruptor en true: el plan manda.
    const respuesta = buildPublicBusinessConfigResponse({
      membershipPlan: "basic",
      menu3dModuleEnabled: true,
    })

    expect(respuesta.menu3dModuleEnabled).toBe(false)
  })
})

describe("apagarlo NO borra lo cargado", () => {
  it("los modelos de los productos viven en menu_products, no en la config", () => {
    // Es la garantía de poder apagar y volver a encender sin perder trabajo:
    // la bandera del módulo y los modelos de cada plato son cosas separadas.
    const config = normalizeBusinessConfig({
      membershipPlan: "complete",
      menu3dModuleEnabled: false,
    })

    expect(config.menu3dModuleEnabled).toBe(false)
    expect(Object.keys(config).some((key) => key.startsWith("model3d"))).toBe(false)
  })
})
