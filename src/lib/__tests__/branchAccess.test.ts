import { describe, expect, it } from "vitest"
import {
  filterBranchesForStaffAccess,
  getStaffBranchAccessFromRequest,
  isBranchAllowedForStaffAccess,
  type BranchRecord,
} from "@/lib/branch"

function requestWith(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null
      },
    },
  }
}

const branches: BranchRecord[] = [
  { id: "centro", name: "Sede Centro", is_active: true, sort_order: 1 },
  { id: "este", name: "Sede Este", is_active: true, sort_order: 2 },
  { id: "norte", name: "Sede Norte", is_active: true, sort_order: 3 },
]

describe("branch access for staff", () => {
  it("restringe las sedes visibles cuando el staff tiene asignación", () => {
    const access = getStaffBranchAccessFromRequest(
      requestWith({ "x-staff-role": "cashier", "x-staff-branch-ids": "centro, este" }),
    )

    expect(access?.unrestricted).toBe(false)
    expect(filterBranchesForStaffAccess(branches, access).map((branch) => branch.id)).toEqual([
      "centro",
      "este",
    ])
    expect(isBranchAllowedForStaffAccess("norte", access)).toBe(false)
  })

  it("mantiene compatibilidad para usuarios sin asignación y deja al dueño ver todo", () => {
    const legacy = getStaffBranchAccessFromRequest(requestWith({ "x-staff-role": "cashier" }))
    const owner = getStaffBranchAccessFromRequest(
      requestWith({ "x-staff-role": "owner", "x-staff-branch-ids": "centro" }),
    )

    expect(legacy?.unrestricted).toBe(true)
    expect(owner?.unrestricted).toBe(true)
    expect(filterBranchesForStaffAccess(branches, legacy).map((branch) => branch.id)).toEqual([
      "centro",
      "este",
      "norte",
    ])
    expect(filterBranchesForStaffAccess(branches, owner).map((branch) => branch.id)).toEqual([
      "centro",
      "este",
      "norte",
    ])
  })
})
