import { describe, expect, it } from "vitest"
import {
  getAllowedModulesForLocalRole,
  getLocalAccessAllowedModules,
  type LocalAccessResult,
} from "../localAccess"

// La barra de navegación del staff (LocalModuleNav) muestra los módulos que
// devuelve getLocalAccessAllowedModules. Estos tests fijan el contrato: rol
// puro usa la tabla del rol, permisos custom usan la lista del usuario.

function accessForRole(
  role: "owner" | "cashier" | "waiter",
): Extract<LocalAccessResult, { ok: true }> {
  return {
    ok: true,
    role,
    roleLabel: "x",
    passwordSource: "test",
  }
}

describe("getLocalAccessAllowedModules", () => {
  it("clave rechazada no tiene módulos", () => {
    expect(
      getLocalAccessAllowedModules({
        ok: false,
        role: null,
        roleLabel: "",
        passwordSource: "",
      })
    ).toEqual([])
  })

  it("rol sin lista custom hereda los módulos del rol", () => {
    expect(getLocalAccessAllowedModules(accessForRole("cashier"))).toEqual(
      getAllowedModulesForLocalRole("cashier")
    )
    expect(getLocalAccessAllowedModules(accessForRole("owner"))).toEqual(
      getAllowedModulesForLocalRole("owner")
    )
  })

  it("caja solo ve módulos de operación de caja, nunca configuración", () => {
    const modules = getLocalAccessAllowedModules(accessForRole("cashier"))
    expect(modules).toContain("cashier")
    expect(modules).not.toContain("settings")
    expect(modules).not.toContain("support")
    expect(modules).not.toContain("branches")
  })

  it("permisos custom del usuario mandan sobre la tabla del rol", () => {
    const access: LocalAccessResult = {
      ...accessForRole("waiter"),
      permissionsMode: "custom",
      allowedModules: ["cashier", "tickets"],
    }
    expect(getLocalAccessAllowedModules(access)).toEqual(["cashier", "tickets"])
  })

  it("lista de módulos reenviada por el middleware se respeta aun en modo rol", () => {
    const access: LocalAccessResult = {
      ...accessForRole("waiter"),
      permissionsMode: "role",
      allowedModules: ["openAccounts", "tables"],
    }
    expect(getLocalAccessAllowedModules(access)).toEqual(["openAccounts", "tables"])
  })
})
