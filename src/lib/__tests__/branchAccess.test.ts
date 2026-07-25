import { describe, expect, it } from "vitest"
import {
  filterBranchesForStaffAccess,
  getStaffBranchAccessFromRequest,
  isBranchAllowedForStaffAccess,
  resolveBranchId,
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

  it("fail-closed (R3): usuario sin sede asignada queda restringido; el dueño ve todo", () => {
    // Blindaje R3 (2026-07-24): antes un usuario NO privilegiado sin sedes
    // asignadas veía TODAS las sedes (fail-open). Ahora queda restringido; en
    // operaciones resolveBranchId lo clampa a la sede por defecto (no lo bloquea).
    const sinAsignar = getStaffBranchAccessFromRequest(requestWith({ "x-staff-role": "cashier" }))
    const owner = getStaffBranchAccessFromRequest(
      requestWith({ "x-staff-role": "owner", "x-staff-branch-ids": "centro" }),
    )

    expect(sinAsignar?.unrestricted).toBe(false)
    expect(owner?.unrestricted).toBe(true)
    expect(filterBranchesForStaffAccess(branches, sinAsignar).map((branch) => branch.id)).toEqual(
      [],
    )
    expect(filterBranchesForStaffAccess(branches, owner).map((branch) => branch.id)).toEqual([
      "centro",
      "este",
      "norte",
    ])
  })
})

describe("resolveBranchId · enforcement de sede en operaciones", () => {
  it("staff restringido conserva la sede pedida si es suya", async () => {
    const branch = await resolveBranchId(
      requestWith({ "x-staff-role": "cashier", "x-staff-branch-ids": "centro,este", "x-branch-id": "este" }),
    )
    expect(branch).toBe("este")
  })

  it("staff restringido que pide otra sede se clampa a la suya (no fuga de datos)", async () => {
    const branch = await resolveBranchId(
      requestWith({ "x-staff-role": "cashier", "x-staff-branch-ids": "centro,este", "x-branch-id": "norte" }),
    )
    expect(branch).toBe("centro")
  })

  it("staff restringido sin sede explícita cae a su primera sede asignada", async () => {
    const branch = await resolveBranchId(
      requestWith({ "x-staff-role": "cashier", "x-staff-branch-ids": "este,centro" }),
    )
    expect(branch).toBe("este")
  })

  it("owner (no restringido) puede pedir cualquier sede", async () => {
    const branch = await resolveBranchId(
      requestWith({ "x-staff-role": "owner", "x-branch-id": "norte" }),
    )
    expect(branch).toBe("norte")
  })
})
