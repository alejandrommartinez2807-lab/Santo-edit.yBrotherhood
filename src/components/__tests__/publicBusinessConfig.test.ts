import { describe, it, expect } from "vitest"
import {
  normalizeMembershipPlan,
  doesPlanAllowLocalOrders,
  doesPlanAllowDelivery,
  normalizePublicBoolean,
  getActivePublicLocalTableNames,
  DEFAULT_QUICK_PLACES,
  normalizePublicBusinessConfig,
} from "@/components/publicBusinessConfig"

describe("normalizeMembershipPlan", () => {
  it("reconoce variantes y cae a complete", () => {
    expect(normalizeMembershipPlan("menu digital")).toBe("menuDigital")
    expect(normalizeMembershipPlan("basico")).toBe("basic")
    expect(normalizeMembershipPlan("operativo")).toBe("operational")
    expect(normalizeMembershipPlan("pro")).toBe("pro")
    expect(normalizeMembershipPlan("loquesea")).toBe("complete")
  })
})

describe("permisos de plan", () => {
  it("menuDigital no permite pedidos locales", () => {
    expect(doesPlanAllowLocalOrders("menuDigital")).toBe(false)
    expect(doesPlanAllowLocalOrders("basic")).toBe(true)
  })
  it("delivery solo en operational/pro/complete", () => {
    expect(doesPlanAllowDelivery("basic")).toBe(false)
    expect(doesPlanAllowDelivery("operational")).toBe(true)
    expect(doesPlanAllowDelivery("complete")).toBe(true)
  })
})

describe("normalizePublicBoolean", () => {
  it("interpreta strings y respeta el fallback", () => {
    expect(normalizePublicBoolean("si")).toBe(true)
    expect(normalizePublicBoolean("no")).toBe(false)
    expect(normalizePublicBoolean(undefined, true)).toBe(true)
    expect(normalizePublicBoolean(undefined, false)).toBe(false)
  })
})

describe("getActivePublicLocalTableNames", () => {
  it("usa los nombres activos o cae a los por defecto", () => {
    expect(getActivePublicLocalTableNames([{ name: "Mesa A" }])).toEqual(["Mesa A"])
    expect(getActivePublicLocalTableNames([])).toEqual(DEFAULT_QUICK_PLACES)
  })
})

describe("normalizePublicBusinessConfig", () => {
  it("normaliza textos públicos editables", () => {
    const config = normalizePublicBusinessConfig({
      businessConfig: {
        publicCustomizeButtonText: " Personaliza ",
        publicCustomizerTitle: " Elige tus opciones ",
        publicMenuTitle: " Menú principal ",
      },
    })

    expect(config.publicCustomizeButtonText).toBe("Personaliza")
    expect(config.publicCustomizerTitle).toBe("Elige tus opciones")
    expect(config.publicMenuTitle).toBe("Menú principal")
  })
})
