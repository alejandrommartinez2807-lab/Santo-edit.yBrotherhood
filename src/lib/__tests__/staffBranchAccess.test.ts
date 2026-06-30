import { describe, expect, it } from "vitest"
import {
  canStaffAccessBranch,
  createStaffAccessConfig,
  getEffectiveStaffBranchAccess,
} from "../staffUsers"

describe("staff branch access", () => {
  it("usuario con una sede solo puede usar esa sede", () => {
    const config = createStaffAccessConfig({
      id: "staff-kitchen",
      username: "maria",
      role: "kitchen",
      allBranches: false,
      allowedBranchIds: ["centro"],
    })
    const branchAccess = getEffectiveStaffBranchAccess("kitchen", config)

    expect(branchAccess).toEqual({ allBranches: false, allowedBranchIds: ["centro"] })
    expect(canStaffAccessBranch(branchAccess, "centro")).toBe(true)
    expect(canStaffAccessBranch(branchAccess, "este")).toBe(false)
  })

  it("usuario con varias sedes solo puede usar sus sedes asignadas", () => {
    const config = createStaffAccessConfig({
      id: "staff-manager",
      username: "encargado",
      role: "manager",
      allBranches: false,
      allowedBranchIds: ["centro", "este"],
    })
    const branchAccess = getEffectiveStaffBranchAccess("manager", config)

    expect(canStaffAccessBranch(branchAccess, "centro")).toBe(true)
    expect(canStaffAccessBranch(branchAccess, "este")).toBe(true)
    expect(canStaffAccessBranch(branchAccess, "oeste")).toBe(false)
  })

  it("dueño y soporte ven todas las sedes", () => {
    expect(getEffectiveStaffBranchAccess("owner")).toEqual({
      allBranches: true,
      allowedBranchIds: [],
    })
    expect(canStaffAccessBranch(getEffectiveStaffBranchAccess("owner"), "oeste")).toBe(true)
    expect(canStaffAccessBranch(getEffectiveStaffBranchAccess("support"), "centro")).toBe(true)
  })

  it("mantiene compatibilidad: usuarios viejos sin metadata no se bloquean por sede", () => {
    const branchAccess = getEffectiveStaffBranchAccess("cashier", null)

    expect(branchAccess).toEqual({ allBranches: true, allowedBranchIds: [] })
    expect(canStaffAccessBranch(branchAccess, "cualquier-sede")).toBe(true)
  })
})
