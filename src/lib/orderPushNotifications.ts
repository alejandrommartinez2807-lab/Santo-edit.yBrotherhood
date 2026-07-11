import webPush from "web-push"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { captureError } from "@/lib/monitoring"

// Web push del seguimiento público: el cliente se suscribe desde su
// confirmación (/pedido/<id>) y al pasar el pedido a "Listo" se le notifica
// aunque tenga la página cerrada o el teléfono bloqueado.
//
// Degradación: sin claves VAPID en el entorno o sin la tabla
// push_subscriptions (migración 0023), todo esto se apaga en silencio y el
// aviso sigue funcionando por polling en la página abierta + WhatsApp del staff.

let vapidConfigured: boolean | null = null

export function isPushConfigured(): boolean {
  if (vapidConfigured !== null) return vapidConfigured

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim()
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim()
  const subject = String(process.env.VAPID_SUBJECT || "").trim() || "mailto:soporte@example.com"

  if (!publicKey || !privateKey) {
    vapidConfigured = false
    return false
  }

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
  } catch (error) {
    captureError(error, { route: "lib/orderPushNotifications", action: "setVapidDetails" })
    vapidConfigured = false
  }

  return vapidConfigured
}

export function getPushPublicKey(): string {
  return isPushConfigured() ? String(process.env.VAPID_PUBLIC_KEY || "").trim() : ""
}

type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function parsePushSubscription(value: unknown): PushSubscriptionPayload | null {
  if (!value || typeof value !== "object") return null

  const source = value as Record<string, unknown>
  const endpoint = String(source.endpoint || "").trim()
  const keys = (source.keys || {}) as Record<string, unknown>
  const p256dh = String(keys.p256dh || "").trim()
  const auth = String(keys.auth || "").trim()

  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
    return null
  }

  return { endpoint, keys: { p256dh, auth } }
}

export async function saveOrderPushSubscription(
  orderId: string,
  subscription: PushSubscriptionPayload,
  branchId?: string | null,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: la fila incluye branch_id (asignado aquí); la suscripción
    // pertenece a un pedido puntual con id imprevisible.
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        order_id: orderId,
        endpoint: subscription.endpoint,
        subscription,
        branch_id: branchId ?? null,
      },
      { onConflict: "endpoint" },
    )

    if (error) throw new Error(error.message)

    return true
  } catch (error) {
    // Tabla ausente (migración 0023 sin aplicar) u otro fallo: no rompemos el
    // flujo del cliente; queda el polling.
    captureError(error, { route: "lib/orderPushNotifications", action: "saveSubscription" })
    return false
  }
}

// Notifica "pedido listo" a todas las suscripciones del pedido y limpia las
// vencidas (410/404). Nunca lanza: se llama desde el cambio de estado y un
// fallo de push no puede tumbar la operación de caja/cocina.
export async function sendOrderReadyPush(orderId: string, displayNumber: string): Promise<void> {
  if (!isPushConfigured()) return

  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: lectura puntual por order_id (id único e imprevisible).
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("order_id", orderId)

    if (error) throw new Error(error.message)
    if (!data?.length) return

    const payload = JSON.stringify({
      title: "¡Tu pedido está listo!",
      body: `Pasa a retirar tu pedido ${displayNumber || orderId} en el mostrador.`,
      url: `/pedido/${orderId}`,
    })

    const goneEndpoints: string[] = []

    await Promise.all(
      data.map(async (row) => {
        const subscription = parsePushSubscription(row.subscription)

        if (!subscription) {
          goneEndpoints.push(String(row.endpoint || ""))
          return
        }

        try {
          await webPush.sendNotification(subscription, payload, { TTL: 60 * 60 })
        } catch (sendError) {
          const statusCode = (sendError as { statusCode?: number })?.statusCode

          if (statusCode === 404 || statusCode === 410) {
            goneEndpoints.push(subscription.endpoint)
          } else {
            captureError(sendError, {
              route: "lib/orderPushNotifications",
              action: "sendNotification",
            })
          }
        }
      }),
    )

    if (goneEndpoints.length) {
      // branch-exempt: limpieza por endpoint único.
      await supabase.from("push_subscriptions").delete().in("endpoint", goneEndpoints)
    }
  } catch (error) {
    captureError(error, { route: "lib/orderPushNotifications", action: "sendOrderReadyPush" })
  }
}
