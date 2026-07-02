import { NextRequest, NextResponse } from "next/server"
import { deleteReservation, updateReservationStatus } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { isKnownReservationStatus } from "@/lib/reservationConflicts"

import { checkReservationsAccess } from "../guard"

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

// PATCH: cambia el estado (activa | completada | cancelada | no_show).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guardResponse = mutationGuard(request, "api-reservations-patch")
  if (guardResponse) return guardResponse

  try {
    const access = await checkReservationsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const reservationId = String(id || "").trim()

    if (!reservationId) {
      return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const status = String(body.status || "").trim()

    if (!isKnownReservationStatus(status)) {
      return NextResponse.json({ error: "Estado de reserva no válido" }, { status: 400 })
    }

    const reservation = await updateReservationStatus(
      reservationId,
      status,
      await resolveBranchId(request)
    )

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
  const guardResponse = mutationGuard(request, "api-reservations-delete")
  if (guardResponse) return guardResponse

  try {
    const access = await checkReservationsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const reservationId = String(id || "").trim()

    if (!reservationId) {
      return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })
    }

    await deleteReservation(reservationId, await resolveBranchId(request))

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
