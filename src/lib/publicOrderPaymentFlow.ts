import { isElectronicPaymentMethod } from "@/lib/paymentOptions"

// Fuente ÚNICA de "este pedido quedó SIN PAGAR y el cliente tiene que
// reportarlo". La usan la ventana emergente post-registro, la advertencia
// grande de la confirmación y el botón "Reportar pago" del carrito.
//
// Por qué existe (dueño 2026-07-25): el mismo criterio estaba escrito DOS
// veces en el carrito con condiciones distintas — una miraba solo el aviso de
// pago anticipado y la otra ese aviso O el modo "comprobante antes de
// registrar". Con esos interruptores en cierta combinación, un pedido de
// PICK UP con Pago móvil y sin captura terminaba mostrando "¡Pedido enviado!"
// y "Ver el avance de mi pedido" en vez de la advertencia, justo lo que el
// dueño reportó. Ahora hay un solo criterio y vale igual para pick up y
// delivery.
//
// Regla: el aviso NO depende de ningún interruptor de textos. Si el cliente
// eligió un método ELECTRÓNICO (pago móvil, transferencia, Zelle…) en un
// pedido con destino (pick up o delivery) y todavía no hay reporte, se le
// dice. En efectivo no aplica: se paga al retirar o recibir.

export type DestinationOrderType = "Para llevar" | "Delivery"

export function isDestinationOrderType(orderType: unknown): boolean {
  return orderType === "Para llevar" || orderType === "Delivery"
}

// Pedido de mesa: el cliente puede pagar al final en el local, así que las
// pantallas de pago hablan en tono OPCIONAL ("puedes pagar ya o al final"),
// nunca imperativo ("tienes que pagar") — ese tono es del prepago de
// pick up/delivery (ronda QA 2026-07-29).
export function isDineInOrderType(orderType: unknown): boolean {
  return orderType === "Comer aquí"
}

export type PostRegisterPaymentInput = {
  orderType: unknown
  // Métodos elegidos por el cliente (2 si el pago es mixto).
  paymentMethods: unknown[]
  // El pedido se sumó a una cuenta abierta: lo cobra caja al cerrarla.
  attachedToOpenAccount?: boolean
  // Guardado sin conexión: todavía no existe en el servidor.
  offline?: boolean
  cancelled?: boolean
  // Módulo de comprobantes disponible para el público.
  proofsEnabled: boolean
  // Ya hay comprobante/reporte (propio o visto en el sondeo del estado).
  alreadyReported?: boolean
}

export function needsPaymentReport(input: PostRegisterPaymentInput): boolean {
  if (!isDestinationOrderType(input.orderType)) return false
  if (input.attachedToOpenAccount) return false
  if (input.offline) return false
  if (input.cancelled) return false
  if (!input.proofsEnabled) return false
  if (input.alreadyReported) return false

  const methods = Array.isArray(input.paymentMethods) ? input.paymentMethods : []
  return methods.some((method) => isElectronicPaymentMethod(method))
}
