import { createHmac } from "crypto"
import { captureError } from "@/lib/monitoring"
import { buildWebhookPayload, webhookMatchesEvent } from "@/lib/hotelWebhooks"
import { getWebhooks, recordWebhookResult, type Webhook } from "@/lib/ordersStoreWebhooks"
import { pushOdooLiveEvent } from "@/lib/odooLiveSync"

// ============================================================
// Hotel · P2-E · Disparo de webhooks — SOLO SERVIDOR (usa node:crypto y red).
//
// Best-effort: un webhook caído nunca debe tumbar la operación que lo originó
// (reservar, cobrar, check-in). Pero en serverless el trabajo suelto se
// congela al responder, así que los disparos SÍ se awaitean (Promise.allSettled
// con timeout corto por destino).
// ============================================================

const WEBHOOK_TIMEOUT_MS = 5000

/** Firma HMAC-SHA256 (hex) del cuerpo con el secreto del webhook. */
export function signWebhookPayload(secret: string, body: string): string {
  return createHmac("sha256", String(secret || "")).update(body, "utf8").digest("hex")
}

async function fireOne(webhook: Webhook, event: string, body: string, branchId?: string | null) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hotel-event": event,
        "x-hotel-signature": signWebhookPayload(webhook.secret, body),
      },
      body,
      signal: controller.signal,
    })
    await recordWebhookResult(webhook.id, String(response.status), branchId).catch(() => {})
  } catch (error) {
    captureError(error, { route: "lib/hotelWebhookDispatch", action: `fire:${event}` })
    await recordWebhookResult(webhook.id, "error", branchId).catch(() => {})
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Dispara el evento a todos los webhooks activos que lo escuchan, y además a
 * Odoo si la sincronización en vivo está encendida (V8-D: Odoo es un destino
 * más). Nunca lanza: cualquier fallo queda en monitoreo y en last_status.
 */
export async function dispatchHotelWebhooks(
  event: string,
  data: Record<string, unknown>,
  branchId?: string | null,
): Promise<void> {
  try {
    const jobs: Promise<unknown>[] = [pushOdooLiveEvent(event, data, branchId)]
    const hooks = (await getWebhooks(branchId).catch(() => [] as Webhook[])).filter((h) =>
      webhookMatchesEvent(h, event),
    )
    if (hooks.length > 0) {
      const body = JSON.stringify(buildWebhookPayload(event, data))
      jobs.push(...hooks.map((h) => fireOne(h, event, body, branchId)))
    }
    await Promise.allSettled(jobs)
  } catch (error) {
    captureError(error, { route: "lib/hotelWebhookDispatch", action: `dispatch:${event}` })
  }
}

/** Disparo directo a UN webhook (botón "Probar" del panel). Devuelve el estado. */
export async function fireWebhookTest(webhook: Webhook, branchId?: string | null): Promise<string> {
  const body = JSON.stringify(
    buildWebhookPayload("prueba", {
      mensaje: "Webhook de prueba del hotel. Si lees esto, la integración funciona.",
      webhookName: webhook.name,
    }),
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hotel-event": "prueba",
        "x-hotel-signature": signWebhookPayload(webhook.secret, body),
      },
      body,
      signal: controller.signal,
    })
    const status = String(response.status)
    await recordWebhookResult(webhook.id, status, branchId).catch(() => {})
    return status
  } catch (error) {
    captureError(error, { route: "lib/hotelWebhookDispatch", action: "fire:prueba" })
    await recordWebhookResult(webhook.id, "error", branchId).catch(() => {})
    return "error"
  } finally {
    clearTimeout(timer)
  }
}
