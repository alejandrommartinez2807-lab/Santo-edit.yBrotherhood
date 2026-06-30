import { describe, expect, it } from "vitest"
import {
  canStaffAccessModule,
  createStaffAccessConfig,
  getEffectiveStaffModules,
} from "../staffUsers"

describe("staff module permissions", () => {
  it("aplica permisos por rol para cocina", () => {
    const modules = getEffectiveStaffModules("kitchen")

    expect(modules).toContain("kitchen")
    expect(modules).toContain("kitchenItems")
    expect(modules).not.toContain("cashier")
    expect(modules).not.toContain("settings")
  })

  it("aplica permisos por rol para caja sin darle configuración", () => {
    const modules = getEffectiveStaffModules("cashier")

    expect(modules).toContain("cashier")
    expect(modules).toContain("paymentProofs")
    expect(modules).toContain("tickets")
    expect(modules).not.toContain("settings")
    expect(modules).not.toContain("reports")
  })

  it("respeta permisos personalizados cuando el dueño los ajusta", () => {
    const config = createStaffAccessConfig({
      id: "staff-cashier",
      username: "jose",
      role: "cashier",
      permissionsMode: "custom",
      allowedModules: ["cashier", "history"],
    })

    expect(canStaffAccessModule("cashier", "cashier", config)).toBe(true)
    expect(canStaffAccessModule("cashier", "history", config)).toBe(true)
    expect(canStaffAccessModule("cashier", "settings", config)).toBe(false)
    expect(canStaffAccessModule("cashier", "reports", config)).toBe(false)
  })

  it("dueño y soporte conservan acceso total aunque no tengan metadata", () => {
    expect(canStaffAccessModule("owner", "settings")).toBe(true)
    expect(canStaffAccessModule("owner", "branches")).toBe(true)
    expect(canStaffAccessModule("support", "support")).toBe(true)
    expect(canStaffAccessModule("support", "roles")).toBe(true)
  })
})
