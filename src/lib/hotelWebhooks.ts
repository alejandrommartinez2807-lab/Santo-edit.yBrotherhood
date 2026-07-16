// ============================================================
// Hotel · P2-E · Webhooks salientes — lógica PURA (sin DB ni red).
//
// Catálogo de eventos, matching webhook↔evento y armado del payload.
// La firma HMAC y el envío viven en hotelWebhookDispatch.ts (solo servidor);
// aquí no entra node:crypto para poder importar esto desde el cliente.
// ============================================================

export const HOTEL_WEBHOOK_EVENTS = [
  { id: "reserva_creada", label: "Reserva creada" },
  { id: "reserva_confirmada", label: "Reserva confirmada" },
  { id: "pago_confirmado", label: "Pago confirmado" },
  { id: "checkin", label: "Check-in" },
  { id: "checkout", label: "Check-out" },
  { id: "prueba", label: "Prueba manual" },
] as const

export type HotelWebhookEvent = (typeof HOTEL_WEBHOOK_EVENTS)[number]["id"]

export function isKnownWebhookEvent(value: unknown): value is HotelWebhookEvent {
  return HOTEL_WEBHOOK_EVENTS.some((e) => e.id === value)
}

/** Convierte el CSV guardado en una lista limpia de eventos conocidos. */
export function parseWebhookEvents(csv: unknown): HotelWebhookEvent[] {
  return String(csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(isKnownWebhookEvent)
}

/** Un webhook escucha un evento si su lista lo incluye (lista vacía = todos). */
export function webhookMatchesEvent(
  webhook: { events?: string; active?: boolean },
  event: string,
): boolean {
  if (webhook.active === false) return false
  const events = parseWebhookEvents(webhook.events)
  if (events.length === 0) return event !== "prueba"
  return events.includes(event as HotelWebhookEvent)
}

/** Valida que la URL sea http(s) absoluta (los webhooks no aceptan otra cosa). */
export function isValidWebhookUrl(value: unknown): boolean {
  const raw = String(value || "").trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

export type HotelWebhookPayload = {
  event: string
  firedAt: string
  data: Record<string, unknown>
}

export function buildWebhookPayload(
  event: string,
  data: Record<string, unknown>,
  firedAt?: string,
): HotelWebhookPayload {
  return {
    event,
    firedAt: firedAt || new Date().toISOString(),
    data,
  }
}
