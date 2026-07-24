// Permiso ÚNICO de "qué estado puede poner cada rol" sobre order.status.
// Antes vivía solo en /api/orders/[orderId] y el endpoint de cuentas abiertas
// autorizaba distinto (el mesonero podía entregar por una puerta y no por la
// otra — auditoría 2026-07-23, P1). Toda ruta que cambie el estado de un
// pedido debe validar con ESTA función.

import type { LocalRole } from "@/lib/localAccess"

export function canRoleUpdateStatus(role: LocalRole, status: string): boolean {
  if (role === "owner" || role === "manager") {
    return true
  }

  if (role === "cashier") {
    // "Listo": en los flujos mixto/sin cocina (kitchenFlowMode) caja marca
    // Listo directamente sin pasar por cocina.
    return (
      status === "Nuevo" ||
      status === "Preparando" ||
      status === "Listo" ||
      status === "Entregado" ||
      status === "Cancelado"
    )
  }

  // Cocina solo avanza la preparación: nunca cancela ni entrega.
  if (role === "kitchen") {
    return status === "Preparando" || status === "Listo"
  }

  // El promotor de eventos entrega lo que vende, pero no cancela pedidos.
  if (role === "promoter") {
    return (
      status === "Nuevo" ||
      status === "Preparando" ||
      status === "Listo" ||
      status === "Entregado"
    )
  }

  // El mesonero ENTREGA en la mesa (y puede des-marcar una entrega volviendo
  // el pedido a "Listo"). No prepara, no cancela, no cobra.
  if (role === "waiter") {
    return status === "Listo" || status === "Entregado"
  }

  return false
}
