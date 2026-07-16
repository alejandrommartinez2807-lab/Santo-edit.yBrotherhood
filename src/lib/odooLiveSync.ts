import { captureError } from "@/lib/monitoring"
import { getOdooIntegration } from "@/lib/ordersStoreOdoo"
import { pushPaymentToOdoo, pushReservationToOdoo } from "@/lib/odooSyncEngine"

// ============================================================
// Hotel · V8-D · Sincronización EN VIVO con Odoo — SOLO SERVIDOR.
//
// Odoo es "un destino más" de los eventos del hotel (P2-E): cuando el negocio
// tiene la conexión activa Y el interruptor "sincronizar en vivo" encendido,
// cada reserva creada/confirmada, check-in/out y pago confirmado se empuja a
// Odoo al vuelo, sin esperar al botón "Sincronizar ahora".
//
// Best-effort SIEMPRE: un Odoo caído jamás tumba la operación que originó el
// evento. Todo el empuje corre bajo un tope de tiempo duro; si no llega, el
// registro quedará al día en la próxima sincronización manual (mismo mapa).
// ============================================================

const LIVE_PUSH_MAX_MS = 8_000

const RESERVATION_EVENTS = new Set(["reserva_creada", "reserva_confirmada", "checkin", "checkout"])

/** Corre el trabajo con tope de tiempo: si se pasa, se suelta (best-effort). */
async function withDeadline(work: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, LIVE_PUSH_MAX_MS)
  })
  try {
    await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Empuja el evento a Odoo si el modo "en vivo" está encendido. Nunca lanza.
 * data es el mismo payload que reciben los webhooks HTTP (P2-E).
 */
export async function pushOdooLiveEvent(
  event: string,
  data: Record<string, unknown>,
  branchId?: string | null,
): Promise<void> {
  try {
    const integration = await getOdooIntegration(branchId)
    if (!integration || !integration.active || !integration.liveSync || !integration.apiKey) return

    if (RESERVATION_EVENTS.has(event)) {
      const code = String(data.code || data.reservationCode || "").trim()
      if (!code) return
      await withDeadline(pushReservationToOdoo(code, branchId, integration))
      return
    }

    if (event === "pago_confirmado") {
      const paymentId = String(data.paymentId || "").trim()
      const reservationId = String(data.reservationId || "").trim()
      if (!paymentId || !reservationId) return
      await withDeadline(pushPaymentToOdoo(paymentId, reservationId, branchId, integration))
    }
  } catch (error) {
    captureError(error, { route: "lib/odooLiveSync", action: `push:${event}` })
  }
}
