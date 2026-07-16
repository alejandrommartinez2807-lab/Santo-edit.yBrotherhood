import { NextRequest, NextResponse } from "next/server"
import { deleteHotelReservation, updateHotelReservationStatus } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { isKnownHotelReservationStatus } from "@/lib/hotelReservationConflicts"
import { dispatchHotelWebhooks } from "@/lib/hotelWebhookDispatch"

import { checkHotelReservationsAccess } from "../guard"

// Estado de reserva → evento de webhook (los demás estados no avisan).
const STATUS_WEBHOOK_EVENTS: Record<string, string> = {
  confirmada: "reserva_confirmada",
  checkin: "checkin",
  checkout: "checkout",
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function mutationGuard(request: NextRequest, id: string) {
  return enforceApiMutationGuards(request, {
    id,
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Demasiados cambios de reservas. Espera unos segundos e intenta nuevamente.",
  })
}

// PATCH: cambia el estado (confirmada | checkin | checkout | cancelada | no_show).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guardResponse = mutationGuard(request, "api-hotel-reservations-patch")
  if (guardResponse) return guardResponse

  try {
    const access = await checkHotelReservationsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const reservationId = String(id || "").trim()
    if (!reservationId) {
      return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const status = String(body.status || "").trim()
    if (!isKnownHotelReservationStatus(status)) {
      return NextResponse.json({ error: "Estado de reserva no válido" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    const reservation = await updateHotelReservationStatus(reservationId, status, branchId)

    // Webhooks salientes (awaiteados: en serverless el trabajo suelto se congela).
    const webhookEvent = STATUS_WEBHOOK_EVENTS[status]
    if (webhookEvent) {
      await dispatchHotelWebhooks(
        webhookEvent,
        {
          code: reservation.code,
          guestName: reservation.guestName,
          checkIn: reservation.checkInDate,
          checkOut: reservation.checkOutDate,
          status: reservation.status,
        },
        branchId,
      )
    }

    return NextResponse.json({ ok: true, reservation })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la reserva",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guardResponse = mutationGuard(request, "api-hotel-reservations-delete")
  if (guardResponse) return guardResponse

  try {
    const access = await checkHotelReservationsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const reservationId = String(id || "").trim()
    if (!reservationId) {
      return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    }

    await deleteHotelReservation(reservationId, await resolveBranchId(request))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar la reserva",
      },
      { status: 500 }
    )
  }
}
