import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { getLocalAccessAllowedModules, type LocalRole } from "@/lib/localAccess"

// Guardia de coherencia menú ↔ API (auditoría 2026-08-02).
//
// El Encargado tenía Inventario, Alertas, Proveedores, Compras y Cuentas por
// pagar en su barra de navegación, ModuleAccessGuard lo dejaba entrar… y las
// cuatro APIs respondían 403 porque solo aceptan al dueño. Cinco módulos
// ofrecidos que nunca cargaban un dato: el encargado no podía descontar stock
// ni registrar compras, y el dueño quedaba como único cuello de botella.
//
// Este test ata las dos mitades: si un rol tiene el módulo en el menú, la ruta
// que lo sirve tiene que aceptar ese rol. Si falla, decide de qué lado corriges
// (quitar el módulo del rol, o añadir el rol a la ruta) — pero no dejes las dos
// versiones contradiciéndose.

const ROOT = join(__dirname, "..", "..")

// módulo del menú → ruta que lo alimenta (la de LECTURA: si no puede ni leer,
// la pantalla queda vacía).
const MODULE_ROUTES: { module: string; route: string }[] = [
  { module: "inventory", route: join(ROOT, "app", "api", "inventory", "route.ts") },
  { module: "suppliers", route: join(ROOT, "app", "api", "suppliers", "route.ts") },
  {
    module: "supplierPurchases",
    route: join(ROOT, "app", "api", "supplier-purchases", "route.ts"),
  },
]

const ROLES: LocalRole[] = [
  "owner",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "delivery",
  "promoter",
  "support",
]

// Roles que la ruta acepta en su primer chequeo de lectura (GET).
function readAllowedRoles(routePath: string): string[] {
  const source = readFileSync(routePath, "utf8")
  const match = source.match(/checkw*\w*Access\(\s*request\s*,\s*\[([^\]]*)\]/)

  expect(match, `no se encontró el chequeo de rol en ${routePath}`).toBeTruthy()

  return (match?.[1] ?? "")
    .split(",")
    .map((role) => role.trim().replace(/["']/g, ""))
    .filter(Boolean)
}

describe("lo que ofrece el menú es lo que la API deja usar", () => {
  for (const { module, route } of MODULE_ROUTES) {
    it(`${module}: ningún rol lo tiene en el menú sin permiso en la API`, () => {
      const allowedByApi = readAllowedRoles(route)

      const contradicciones = ROLES.filter((role) => {
        const modules = getLocalAccessAllowedModules({
          ok: true,
          role,
          roleLabel: role,
          passwordSource: "test",
        })

        const enElMenu = (modules as string[]).includes(module)
        return enElMenu && !allowedByApi.includes(role)
      })

      expect(
        contradicciones,
        `Roles con "${module}" en el menú pero con 403 en ${route}: ${contradicciones.join(", ")}`,
      ).toEqual([])
    })
  }

  it("el dueño conserva acceso a todo (si no, el guard estaría al revés)", () => {
    for (const { module, route } of MODULE_ROUTES) {
      expect(readAllowedRoles(route), route).toContain("owner")

      const modules = getLocalAccessAllowedModules({
        ok: true,
        role: "owner",
        roleLabel: "Dueño",
        passwordSource: "test",
      })

      expect(modules as string[]).toContain(module)
    }
  })
})
