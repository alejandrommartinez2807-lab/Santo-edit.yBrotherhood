import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { LocalRole } from "@/lib/localAccess"

// Auditoría 2026-08-02 · fraude interno con precios libres.
//
// POST /api/orders deja que el STAFF fije precio unitario y tasa a mano (ítems
// manuales, combos, descuentos puntuales). Esa excepción es para quien vende.
// Cocina y Delivery no registran pedidos desde ninguna pantalla —solo leen y
// cambian estados— pero su clave, compartida y guardada en el .env, permitía
// crear por API un pedido de $40 con precio 0,01 y tasa 1. El cierre del día
// cuadraba porque el total del pedido nacía falseado.
//
// Este guard vigila la lista: si alguien vuelve a meter kitchen o delivery
// entre los que pueden poner su propio precio, el test lo canta.

const ROUTE = join(__dirname, "..", "..", "app", "api", "orders", "route.ts")

function readRoute() {
  return readFileSync(ROUTE, "utf8")
}

describe("quién puede fijar precios y tasa a mano", () => {
  it("la ruta declara explícitamente los roles SIN precio libre", () => {
    expect(readRoute()).toMatch(/ROLES_WITHOUT_FREE_PRICING\s*:\s*LocalRole\[\]/)
  })

  it("Cocina y Delivery están en esa lista", () => {
    const declaration = readRoute().match(
      /ROLES_WITHOUT_FREE_PRICING\s*:\s*LocalRole\[\]\s*=\s*\[([^\]]*)\]/,
    )

    expect(declaration, "no se encontró la lista de roles sin precio libre").toBeTruthy()

    const listed = (declaration?.[1] ?? "")
      .split(",")
      .map((role) => role.trim().replace(/["']/g, ""))
      .filter(Boolean) as LocalRole[]

    expect(listed).toContain("kitchen")
    expect(listed).toContain("delivery")
  })

  it("los roles que SÍ venden conservan su flexibilidad", () => {
    const declaration = readRoute().match(
      /ROLES_WITHOUT_FREE_PRICING\s*:\s*LocalRole\[\]\s*=\s*\[([^\]]*)\]/,
    )

    const listed = (declaration?.[1] ?? "")
      .split(",")
      .map((role) => role.trim().replace(/["']/g, ""))
      .filter(Boolean)

    // Si alguno de estos entrara en la lista, el mesonero o la caja no podrían
    // registrar un ítem manual o un descuento y se bloquearía la venta.
    for (const role of ["owner", "manager", "cashier", "waiter", "promoter"]) {
      expect(listed, `${role} no puede quedarse sin precio libre`).not.toContain(role)
    }
  })

  it("el reprecio se aplica cuando NO se puede fijar precio propio", () => {
    const source = readRoute()

    // El guard cuelga de canSetOwnPrices, no de "¿hay sesión?".
    expect(source).toMatch(/const\s+canSetOwnPrices\s*=/)
    expect(source).toMatch(/if\s*\(!canSetOwnPrices\)\s*\{/)
    expect(source).toMatch(/repricePublicOrderItems\(items,\s*publicMenu\)/)
    expect(source).toMatch(/resolvePublicExchangeRate\(exchangeRate,\s*serverRate\)/)
  })
})
