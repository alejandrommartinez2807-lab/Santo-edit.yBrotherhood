import { NextRequest, NextResponse } from "next/server"
import { resolveBranchId } from "@/lib/branch"
import { getRequestAccess } from "@/lib/localAccess"
import {
  deleteStaffAlertPushSubscription,
  getPushPublicKey,
  parsePushSubscription,
  saveStaffAlertPushSubscription,
} from "@/lib/orderPushNotifications"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Suscripción de ALERTAS INTERNAS (anulaciones de pedidos) para los equipos
// del dueño/encargado. Reutiliza la infraestructura web push del seguimiento
// público (claves VAPID + tabla push_subscriptions, order_id reservado).

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store")

  return NextResponse.json(data, { ...init, headers })
}

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function checkOwnerOrManager(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: noStoreResponse({ error: "No autorizado" }, { status: 401 }) }
  }

  if (access.role !== "owner" && access.role !== "manager") {
    return {
      ok: false as const,
      response: noStoreResponse(
        { error: "Solo el dueño o el encargado reciben alertas de anulación" },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, access }
}

// GET: ¿hay push disponible? (clave pública VAPID para suscribirse).
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-staff-alerts-push-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const roleCheck = checkOwnerOrManager(request)
  if (!roleCheck.ok) return roleCheck.response

  const publicKey = getPushPublicKey()

  return noStoreResponse({ ok: true, enabled: Boolean(publicKey), publicKey })
}

// POST: suscribe este equipo a las alertas internas de la sede actual.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-staff-alerts-push-post",
    limit: 20,
    windowMs: 60_000,
    message: "Demasiadas suscripciones seguidas. Espera un minuto.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const roleCheck = checkOwnerOrManager(request)
    if (!roleCheck.ok) return roleCheck.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const subscription = parsePushSubscription(body.subscription)

    if (!subscription) {
      return noStoreResponse({ ok: false, error: "Suscripción no válida" }, { status: 400 })
    }

    if (!getPushPublicKey()) {
      return noStoreResponse(
        { ok: false, error: "Las notificaciones no están disponibles en el servidor" },
        { status: 503 },
      )
    }

    const saved = await saveStaffAlertPushSubscription(
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
    captureError(error, { route: "/api/staff/alerts-push", action: "POST" })

    return noStoreResponse(
      { ok: false, error: "No se pudo guardar la suscripción" },
      { status: 500 },
    )
  }
}

// DELETE: este equipo deja de recibir alertas internas.
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-staff-alerts-push-delete",
    limit: 20,
    windowMs: 60_000,
    message: "Demasiadas solicitudes seguidas. Espera un minuto.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const roleCheck = checkOwnerOrManager(request)
    if (!roleCheck.ok) return roleCheck.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const endpoint = String(body.endpoint || "").trim()

    if (!endpoint.startsWith("https://")) {
      return noStoreResponse({ ok: false, error: "Endpoint no válido" }, { status: 400 })
    }

    await deleteStaffAlertPushSubscription(endpoint)

    return noStoreResponse({ ok: true })
  } catch (error) {
    captureError(error, { route: "/api/staff/alerts-push", action: "DELETE" })

    return noStoreResponse(
      { ok: false, error: "No se pudo quitar la suscripción" },
      { status: 500 },
    )
  }
}
