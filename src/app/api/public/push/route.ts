import { NextRequest, NextResponse } from "next/server"
import { resolveBranchId } from "@/lib/branch"
import {
  getPushPublicKey,
  parsePushSubscription,
  saveOrderPushSubscription,
} from "@/lib/orderPushNotifications"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store")

  return NextResponse.json(data, { ...init, headers })
}

// GET: ¿hay push disponible? (clave pública VAPID para suscribirse).
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-push-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const publicKey = getPushPublicKey()

  return noStoreResponse({ ok: true, enabled: Boolean(publicKey), publicKey })
}

// POST: suscribe este navegador al aviso "listo" de UN pedido.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-push-post",
    limit: 20,
    windowMs: 60_000,
    message: "Demasiadas suscripciones seguidas. Espera un minuto.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const orderId = String(body.orderId || "").trim().toLowerCase()
    const subscription = parsePushSubscription(body.subscription)

    if (!orderId.startsWith("ord-") || !subscription) {
      return noStoreResponse(
        { ok: false, error: "Suscripción o pedido no válidos" },
        { status: 400 },
      )
    }

    if (!getPushPublicKey()) {
      return noStoreResponse(
        { ok: false, error: "Las notificaciones no están disponibles" },
        { status: 503 },
      )
    }

    const saved = await saveOrderPushSubscription(
      orderId,
      subscription,
      await resolveBranchId(request),
    )

    if (!saved) {
      return noStoreResponse(
        { ok: false, error: "No se pudo guardar la suscripción" },
        { status: 503 },
      )
    }

    return noStoreResponse({ ok: true }, { status: 201 })
  } catch (error) {
    captureError(error, { route: "/api/public/push", action: "POST" })

    return noStoreResponse(
      { ok: false, error: "No se pudo guardar la suscripción" },
      { status: 500 },
    )
  }
}
