// ============================================================
// NOTIFICACIONES · lógica pura (Hotel · Fase 12)
// Arma el texto de los avisos (confirmación, recordatorio, post-estadía) y el
// enlace de WhatsApp (wa.me) para enviarlos SIN API externa. Sin DB.
// ============================================================

export type NotificationKind = "confirmacion" | "recordatorio" | "post"

export type NotificationReservation = {
  guestName: string
  guestPhone?: string
  code?: string
  checkInDate: string
  checkOutDate: string
  nights?: number
  totalAmount?: number
}

export function buildMessage(
  kind: NotificationKind,
  reservation: NotificationReservation,
  hotelName = "el hotel",
): string {
  const name = reservation.guestName || "huésped"
  const inOut = `${reservation.checkInDate} al ${reservation.checkOutDate}`
  if (kind === "recordatorio") {
    return `Hola ${name}, te recordamos tu reserva en ${hotelName} del ${inOut}. ¡Te esperamos! Código: ${reservation.code || ""}`.trim()
  }
  if (kind === "post") {
    return `Hola ${name}, gracias por hospedarte en ${hotelName}. Nos encantaría saber cómo estuvo tu estadía. ¡Vuelve pronto!`
  }
  // confirmación
  const total = reservation.totalAmount ? ` Total: $${reservation.totalAmount}.` : ""
  return `Hola ${name}, tu reserva en ${hotelName} quedó confirmada del ${inOut}.${total} Código: ${reservation.code || ""}`.trim()
}

/** Enlace wa.me con el mensaje prellenado. Devuelve "" si el teléfono es inválido. */
export function whatsappUrl(phone: string, message: string): string {
  const digits = String(phone || "").replace(/\D+/g, "")
  if (digits.length < 7) return ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
