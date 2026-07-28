import { describe, expect, it } from "vitest"
import {
  canRoleUpdateStatus,
  canTransitionOrderStatus,
  getRoleTransitionError,
} from "@/lib/orderStatusPermissions"

describe("canRoleUpdateStatus · permiso rol→estado (fuente única)", () => {
  it("dueño y encargado pueden poner cualquier estado", () => {
    for (const role of ["owner", "manager"] as const) {
      for (const status of ["Nuevo", "Preparando", "Listo", "Entregado", "Cancelado"]) {
        expect(canRoleUpdateStatus(role, status)).toBe(true)
      }
    }
  })

  it("cocina solo avanza la preparación: nunca cancela ni entrega", () => {
    expect(canRoleUpdateStatus("kitchen", "Preparando")).toBe(true)
    expect(canRoleUpdateStatus("kitchen", "Listo")).toBe(true)
    expect(canRoleUpdateStatus("kitchen", "Entregado")).toBe(false)
    expect(canRoleUpdateStatus("kitchen", "Cancelado")).toBe(false)
  })

  it("mesonero solo entrega o des-marca la entrega (Listo)", () => {
    expect(canRoleUpdateStatus("waiter", "Listo")).toBe(true)
    expect(canRoleUpdateStatus("waiter", "Entregado")).toBe(true)
    expect(canRoleUpdateStatus("waiter", "Preparando")).toBe(false)
    expect(canRoleUpdateStatus("waiter", "Cancelado")).toBe(false)
  })

  it("promotor no cancela; delivery no cambia estados", () => {
    expect(canRoleUpdateStatus("promoter", "Entregado")).toBe(true)
    expect(canRoleUpdateStatus("promoter", "Cancelado")).toBe(false)
    expect(canRoleUpdateStatus("delivery", "Entregado")).toBe(false)
  })
})

describe("canTransitionOrderStatus · máquina de estados del pedido (H1)", () => {
  it("Cancelado es TERMINAL: un pedido anulado no puede revivir", () => {
    // Regresión H1 (2026-07-24): antes Cancelado → Listo/Entregado era
    // aceptado y un pedido anulado (con inventario ya devuelto) podía volver
    // a cobrarse.
    for (const to of ["Nuevo", "Preparando", "Listo", "Entregado"]) {
      expect(canTransitionOrderStatus("Cancelado", to)).toBe(false)
    }
  })

  it("Entregado solo se reabre a Listo o se anula", () => {
    expect(canTransitionOrderStatus("Entregado", "Listo")).toBe(true)
    expect(canTransitionOrderStatus("Entregado", "Cancelado")).toBe(true)
    expect(canTransitionOrderStatus("Entregado", "Nuevo")).toBe(false)
    expect(canTransitionOrderStatus("Entregado", "Preparando")).toBe(false)
  })

  it("los saltos hacia adelante siguen permitidos (flujo sin cocina)", () => {
    expect(canTransitionOrderStatus("Nuevo", "Listo")).toBe(true)
    expect(canTransitionOrderStatus("Nuevo", "Entregado")).toBe(true)
    expect(canTransitionOrderStatus("Preparando", "Entregado")).toBe(true)
    expect(canTransitionOrderStatus("Listo", "Preparando")).toBe(true)
  })

  it("todo estado activo puede anularse", () => {
    for (const from of ["Nuevo", "Preparando", "Listo", "Entregado"]) {
      expect(canTransitionOrderStatus(from, "Cancelado")).toBe(true)
    }
  })

  it("estado legado/desconocido no bloquea la operación", () => {
    expect(canTransitionOrderStatus("", "Listo")).toBe(true)
    expect(canTransitionOrderStatus("Pendiente", "Entregado")).toBe(true)
  })
})

describe("getRoleTransitionError · el mesonero solo entrega pedidos LISTOS (2026-07-28)", () => {
  it("mesonero NO puede entregar un pedido que no está Listo", () => {
    for (const from of ["Nuevo", "Preparando"]) {
      const error = getRoleTransitionError("waiter", from, "Entregado")
      expect(error).toBeTruthy()
      expect(error).toContain("LISTO")
    }
  })

  it("mesonero SÍ entrega un pedido Listo", () => {
    expect(getRoleTransitionError("waiter", "Listo", "Entregado")).toBeNull()
  })

  it("mesonero solo pone Listo como des-entregar (Entregado→Listo)", () => {
    expect(getRoleTransitionError("waiter", "Entregado", "Listo")).toBeNull()
    expect(getRoleTransitionError("waiter", "Nuevo", "Listo")).toBeTruthy()
    expect(getRoleTransitionError("waiter", "Preparando", "Listo")).toBeTruthy()
  })

  it("caja, dueño, cocina y promotor conservan sus saltos (modo sin cocina)", () => {
    for (const role of ["owner", "manager", "cashier", "kitchen", "promoter"] as const) {
      expect(getRoleTransitionError(role, "Nuevo", "Entregado")).toBeNull()
      expect(getRoleTransitionError(role, "Nuevo", "Listo")).toBeNull()
    }
  })
})
