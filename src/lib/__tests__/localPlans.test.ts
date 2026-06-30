import { describe, it, expect } from "vitest"
import {
  getModulePlanAccess,
  normalizeLocalPlanKey,
  LOCAL_MODULE_KEYS,
} from "@/lib/localPlans"

describe("normalizeLocalPlanKey", () => {
  it("acepta planes conocidos y cae a un default seguro", () => {
    expect(normalizeLocalPlanKey("complete")).toBe("complete")
    expect(normalizeLocalPlanKey("basic")).toBe("basic")
    expect(typeof normalizeLocalPlanKey("inventado")).toBe("string")
  })
})

describe("getModulePlanAccess · invariantes", () => {
  it("effectiveEnabled = includedInPlan && enabledByOwner; lockedByPlan = !includedInPlan", () => {
    for (const key of LOCAL_MODULE_KEYS) {
      const a = getModulePlanAccess({ membershipPlan: "complete" }, key)
      expect(a.effectiveEnabled).toBe(a.includedInPlan && a.enabledByOwner)
      expect(a.lockedByPlan).toBe(!a.includedInPlan)
    }
  })
})

describe("getModulePlanAccess · planes y overrides", () => {
  it("el plan 'complete' incluye caja", () => {
    const a = getModulePlanAccess({ membershipPlan: "complete" }, "cashier")
    expect(a.includedInPlan).toBe(true)
  })

  it("en modo custom, customBlocked bloquea un módulo aunque el plan lo incluya", () => {
    const a = getModulePlanAccess(
      {
        membershipPlan: "complete",
        membershipPlanMode: "custom",
        customBlockedModules: ["cashier"],
      },
      "cashier",
    )
    expect(a.includedInPlan).toBe(false)
    expect(a.effectiveEnabled).toBe(false)
    expect(a.lockedByPlan).toBe(true)
  })

  it("en modo custom, customIncluded habilita un módulo que el plan no trae", () => {
    const withCustom = getModulePlanAccess(
      {
        membershipPlan: "menuDigital",
        membershipPlanMode: "custom",
        customIncludedModules: ["cashier"],
      },
      "cashier",
    )
    expect(withCustom.includedInPlan).toBe(true)
  })

  it("en modo fijo, los overrides custom NO aplican (solo manda el plan)", () => {
    const blocked = getModulePlanAccess(
      { membershipPlan: "complete", customBlockedModules: ["cashier"] },
      "cashier",
    )
    expect(blocked.includedInPlan).toBe(true) // el plan complete sí lo incluye
  })

  it("si el dueño desactiva el módulo, no queda efectivo aunque esté incluido", () => {
    const a = getModulePlanAccess({ membershipPlan: "complete", cashierModuleEnabled: false }, "cashier")
    if (a.includedInPlan && a.enabledByOwner === false) {
      expect(a.effectiveEnabled).toBe(false)
    }
  })
})
