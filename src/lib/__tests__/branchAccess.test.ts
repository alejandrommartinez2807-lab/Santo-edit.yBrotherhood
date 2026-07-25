import { describe, expect, it } from "vitest"
import {
  filterBranchesForAccess,
  filterBranchesForStaffAccess,
  getExplicitBranchIdFromRequest,
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

  it("H10: staff con 'todas las sedes' verificado por el middleware opera la sede que pida", async () => {
    // Regresión H10 (2026-07-24): un encargado con allBranches:true (branchIds
    // vacío) quedaba clavado a la sede por defecto mientras el selector le
    // mostraba todas — operaba la sede equivocada sin aviso.
    const access = getStaffBranchAccessFromRequest(
      requestWith({ "x-staff-role": "manager", "x-staff-all-branches": "true" }),
    )
    expect(access?.unrestricted).toBe(true)

    const branch = await resolveBranchId(
      requestWith({
        "x-staff-role": "manager",
        "x-staff-all-branches": "true",
        "x-branch-id": "norte",
      }),
    )
    expect(branch).toBe("norte")
  })

  it("H10: el flag solo cuenta si es exactamente 'true' (fail-closed)", () => {
    const access = getStaffBranchAccessFromRequest(
      requestWith({ "x-staff-role": "manager", "x-staff-all-branches": "false" }),
    )
    expect(access?.unrestricted).toBe(false)
  })
})

describe("filterBranchesForAccess · listado de sedes según el acceso (R3b)", () => {
  it("restringido con sedes asignadas ve solo las suyas", () => {
    const visible = filterBranchesForAccess(branches, {
      ok: true,
      role: "cashier",
      allBranches: false,
      allowedBranchIds: ["centro"],
    })
    expect(visible.map((branch) => branch.id)).toEqual(["centro"])
  })

  it("fail-closed (R3b): allBranches=false sin sedes asignadas NO ve ninguna", () => {
    // Regresión R3b (2026-07-24): este caso devolvía TODAS las sedes (el mismo
    // fail-open que R3 cerró en getStaffBranchAccessFromRequest). Es la función
    // que usa /api/branches de verdad.
    const visible = filterBranchesForAccess(branches, {
      ok: true,
      role: "cashier",
      allBranches: false,
      allowedBranchIds: [],
    })
    expect(visible).toEqual([])
  })

  it("acceso legacy sin bandera allBranches conserva el comportamiento (compatibilidad)", () => {
    const visible = filterBranchesForAccess(branches, { ok: true, role: "cashier" })
    expect(visible.map((branch) => branch.id)).toEqual(["centro", "este", "norte"])
  })

  it("owner y support ven todas las sedes", () => {
    for (const role of ["owner", "support"]) {
      const visible = filterBranchesForAccess(branches, { ok: true, role, allBranches: false })
      expect(visible.map((branch) => branch.id)).toEqual(["centro", "este", "norte"])
    }
  })
})

describe("A7 · el Referer solo elige sede en el flujo público", () => {
  const refererHeaders = { referer: "https://brotherhood-xi.vercel.app/?branch=norte" }

  it("petición pública sin header usa el ?branch= del Referer (QR por sucursal)", async () => {
    const branch = await resolveBranchId(requestWith({ ...refererHeaders }))
    expect(branch).toBe("norte")
  })

  it("sesión de staff ignora el Referer: la sede solo viene del header explícito", async () => {
    const branch = await resolveBranchId(
      requestWith({
        ...refererHeaders,
        "x-staff-role": "cashier",
        "x-staff-branch-ids": "centro,este",
      }),
    )
    expect(branch).toBe("centro")
  })

  it("getExplicitBranchIdFromRequest respeta la opción allowRefererFallback", () => {
    const request = requestWith({ ...refererHeaders })
    expect(getExplicitBranchIdFromRequest(request)).toBe("norte")
    expect(
      getExplicitBranchIdFromRequest(request, { allowRefererFallback: false }),
    ).toBeNull()
  })
})
