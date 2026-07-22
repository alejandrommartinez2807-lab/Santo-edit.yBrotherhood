import { NextRequest, NextResponse } from "next/server"
import { getRequestAccess } from "@/lib/localAccess"
import { listCancellationRequestsForOwner } from "@/lib/cancellationRequests"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Códigos de anulación pendientes/recientes — SOLO el dueño (ni siquiera el
// encargado): es el canal de respaldo para leer el código si no le llegó el
// push o el WhatsApp.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-cancellation-requests-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const access = getRequestAccess(request, getRequestPassword(request))

    if (!access.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    if (access.role !== "owner") {
      return NextResponse.json(
        { error: "Solo el dueño puede ver los códigos de anulación" },
        { status: 403 },
      )
    }

    // El dueño ve TODAS las sedes (sin filtro de sucursal).
    const requests = await listCancellationRequestsForOwner(null)

    return NextResponse.json({
      ok: true,
      requests: requests.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        displayNumber: item.displayNumber,
        reason: item.reason,
        requestedBy: item.requestedBy,
        code: item.code,
        status: item.status,
        createdAt: item.createdAt,
      })),
    })
  } catch (error) {
    captureError(error, { route: "/api/cancellation-requests", action: "GET" })

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las solicitudes de anulación",
      },
      { status: 500 },
    )
  }
}
