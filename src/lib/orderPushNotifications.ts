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

// Envía un payload a una lista de filas de push_subscriptions y limpia las
// suscripciones vencidas (410/404). Compartido por el aviso al cliente y las
// alertas internas del staff.
async function sendPushToSubscriptionRows(
  rows: Array<{ endpoint: unknown; subscription: unknown }>,
  payload: string,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const goneEndpoints: string[] = []

  await Promise.all(
    rows.map(async (row) => {
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

    await sendPushToSubscriptionRows(data, payload)
  } catch (error) {
    captureError(error, { route: "lib/orderPushNotifications", action: "sendOrderReadyPush" })
  }
}

// Notifica al CLIENTE cuando caja revisa su comprobante (confirmado /
// rechazado / necesita corrección): su página de seguimiento ya sondea, pero
// con push se entera aunque la tenga cerrada. Solo estados accionables; "En
// revisión" o "Comprobante enviado" son su propia acción, no avisan. Nunca lanza.
export async function sendOrderPaymentReviewedPush(
  orderId: string,
  status: string,
  displayNumber: string,
  internalNote = "",
): Promise<void> {
  if (!isPushConfigured()) return

  const orderLabel = displayNumber ? `tu pedido ${displayNumber}` : "tu pedido"

  const messages: Record<string, { title: string; body: string }> = {
    "Confirmado por caja": {
      title: "✅ Pago confirmado",
      body: `Confirmamos el pago de ${orderLabel}. ¡Ya entra a preparación!`,
    },
    Rechazado: {
      title: "Tu pago fue rechazado",
      body: `Revisa el pago de ${orderLabel} y vuelve a reportarlo desde tu página de seguimiento.`,
    },
    "Necesita corrección": {
      title: "Tu pago necesita corrección",
      body: internalNote
        ? `${orderLabel}: ${internalNote}`
        : `Corrige y vuelve a reportar el pago de ${orderLabel}.`,
    },
  }

  const message = messages[status]
  if (!message) return

  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: lectura puntual por order_id (id único e imprevisible).
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("order_id", orderId)

    if (error) throw new Error(error.message)
    if (!data?.length) return

    await sendPushToSubscriptionRows(
      data,
      JSON.stringify({ ...message, url: `/pedido/${orderId}` }),
    )
  } catch (error) {
    captureError(error, {
      route: "lib/orderPushNotifications",
      action: "sendOrderPaymentReviewedPush",
    })
  }
}

// --- Alertas internas (dueño / encargado) --------------------------------
// Reutiliza push_subscriptions con un order_id reservado: cada equipo del
// dueño/encargado que active "alertas de anulación" guarda aquí su
// suscripción, con la sede a la que pertenece (null = todas).

export const STAFF_ALERTS_ORDER_ID = "staff-alerts"

export async function saveStaffAlertPushSubscription(
  subscription: PushSubscriptionPayload,
  branchId?: string | null,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: la fila guarda branch_id; el id reservado no es un pedido.
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        order_id: STAFF_ALERTS_ORDER_ID,
        endpoint: subscription.endpoint,
        subscription,
        branch_id: branchId ?? null,
      },
      { onConflict: "endpoint" },
    )

    if (error) throw new Error(error.message)

    return true
  } catch (error) {
    captureError(error, { route: "lib/orderPushNotifications", action: "saveStaffAlertSubscription" })
    return false
  }
}

export async function deleteStaffAlertPushSubscription(endpoint: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: borrado por endpoint único del propio equipo.
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("order_id", STAFF_ALERTS_ORDER_ID)
      .eq("endpoint", endpoint)

    if (error) throw new Error(error.message)

    return true
  } catch (error) {
    captureError(error, { route: "lib/orderPushNotifications", action: "deleteStaffAlertSubscription" })
    return false
  }
}

// Envío genérico a los equipos suscritos del dueño/encargado (alertas de
// anulación, reposición de inventario, etc.). Filtra por sede: llegan a los
// equipos de esa sede + los suscritos sin sede fija. Nunca lanza.
export async function sendStaffAlertPush(
  branchId: string | null | undefined,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!isPushConfigured()) return

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("order_id", STAFF_ALERTS_ORDER_ID)

    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    if (!data?.length) return

    await sendPushToSubscriptionRows(
      data,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/pedidos",
      }),
    )
  } catch (error) {
    captureError(error, {
      route: "lib/orderPushNotifications",
      action: "sendStaffAlertPush",
    })
  }
}

// Push SOLO al dueño (suscripciones con branch_id NULL: la API de alertas
// staff asigna null únicamente al rol owner). Lo usa el código de anulación,
// que NO debe llegar a encargados ni cajeros. Nunca lanza.
export async function sendOwnerOnlyPush(payload: {
  title: string
  body: string
  url?: string
}): Promise<void> {
  if (!isPushConfigured()) return

  try {
    const supabase = getSupabaseAdmin()
    // branch-exempt: el dueño se suscribe globalmente (branch_id null).
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("order_id", STAFF_ALERTS_ORDER_ID)
      .is("branch_id", null)

    if (error) throw new Error(error.message)
    if (!data?.length) return

    await sendPushToSubscriptionRows(
      data,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/local-santo/dueno",
      }),
    )
  } catch (error) {
    captureError(error, {
      route: "lib/orderPushNotifications",
      action: "sendOwnerOnlyPush",
    })
  }
}

// Alarma de anulación: avisa a los equipos suscritos del dueño/encargado que
// un pedido fue anulado, con quién lo hizo y qué productos llevaba. Nunca
// lanza: un fallo de push no puede tumbar la anulación en caja.
export async function sendOrderCancelledStaffPush(input: {
  displayNumber: string
  customerName?: string
  itemsSummary?: string
  totalUSD?: number
  cancelledBy?: string
  branchId?: string | null
}): Promise<void> {
  if (!isPushConfigured()) return

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("order_id", STAFF_ALERTS_ORDER_ID)

    if (input.branchId) {
      // Alertas de la sede del pedido + equipos suscritos sin sede fija.
      query = query.or(`branch_id.eq.${input.branchId},branch_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    if (!data?.length) return

    const bodyParts = [
      `Pedido ${input.displayNumber}${input.customerName ? ` de ${input.customerName}` : ""} fue ANULADO`,
      input.cancelledBy ? `por ${input.cancelledBy}` : "",
    ]
      .filter(Boolean)
      .join(" ")

    const detailParts = [
      input.itemsSummary ? `Productos: ${input.itemsSummary}` : "",
      input.totalUSD && input.totalUSD > 0 ? `Total: $${input.totalUSD.toFixed(2)}` : "",
    ]
      .filter(Boolean)
      .join(" · ")

    const payload = JSON.stringify({
      title: "🚨 Pedido anulado",
      body: detailParts ? `${bodyParts}. ${detailParts}` : `${bodyParts}.`,
      url: "/pedidos",
    })

    await sendPushToSubscriptionRows(data, payload)
  } catch (error) {
    captureError(error, {
      route: "lib/orderPushNotifications",
      action: "sendOrderCancelledStaffPush",
    })
  }
}
