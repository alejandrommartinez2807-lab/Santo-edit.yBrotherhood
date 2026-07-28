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

// Compuerta por ROL sobre la transición (pedido del dueño 2026-07-28): el
// mesonero ENTREGA solo lo que cocina/caja ya marcaron LISTO — sin esto podía
// saltar Nuevo→Entregado (la máquina permite saltos porque el modo sin cocina
// de caja los usa, pero ese privilegio no es del mesonero). "Listo" para el
// mesonero solo existe como des-entregar (Entregado→Listo).
export function getRoleTransitionError(
  role: LocalRole,
  from: string,
  to: string,
): string | null {
  if (role !== "waiter") return null

  if (to === "Entregado" && from !== "Listo") {
    return "Cocina o caja deben marcar este pedido como LISTO antes de que el mesonero lo entregue."
  }

  if (to === "Listo" && from !== "Entregado") {
    return "El mesonero solo puede devolver a Listo un pedido ya Entregado."
  }

  return null
}

// Máquina de estados del pedido (H1, 2026-07-24). Hasta ahora el servidor
// aceptaba cualquier transición: un pedido ANULADO (con inventario devuelto y
// motivo estampado) podía "revivir" a Listo/Entregado y volver a cobrarse.
// Reglas: Cancelado es TERMINAL; Entregado solo puede reabrirse a Listo (botón
// "No entregado") o anularse; los saltos hacia adelante siguen permitidos
// porque el flujo sin cocina (kitchenFlowMode direct/mixed) los usa.
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  Nuevo: ["Preparando", "Listo", "Entregado", "Cancelado"],
  Preparando: ["Listo", "Entregado", "Cancelado"],
  Listo: ["Preparando", "Entregado", "Cancelado"],
  Entregado: ["Listo", "Cancelado"],
  Cancelado: [],
}

export function canTransitionOrderStatus(from: string, to: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from]
  // Estado legado/desconocido en la BD: no bloquear la operación del negocio.
  if (!allowed) return true
  return allowed.includes(to)
}
