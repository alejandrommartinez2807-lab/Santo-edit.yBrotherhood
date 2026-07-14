import { NextRequest, NextResponse } from "next/server"
import { getHotelReservations, getNotificationLog, logNotification } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkNotificationsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET : reservas próximas + registro de avisos enviados.
export async function GET(request: NextRequest) {
  try {
    const access = await checkNotificationsAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const today = new Date().toISOString().slice(0, 10)
    const to = `${new Date().getFullYear() + 1}-01-01`
    const [reservations, log] = await Promise.all([
      getHotelReservations({ from: today, to }, branchId),
      getNotificationLog(branchId),
    ])
    const upcoming = reservations
      .filter((r) => r.status !== "cancelada" && r.status !== "no_show")
      .map((r) => ({
        id: r.id,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        code: r.code,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        nights: r.nights,
        totalAmount: r.totalAmount,
        status: r.status,
      }))
      .slice(0, 80)
    return NextResponse.json({ ok: true, reservations: upcoming, log })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las notificaciones" },
      { status: 500 }
    )
  }
}

// POST : registra que se envió un aviso (para no repetirlo).
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-notifications-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkNotificationsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const reservationId = cleanText(body.reservationId)
    if (!reservationId) return NextResponse.json({ error: "Reserva no indicada" }, { status: 400 })
    const entry = await logNotification({ reservationId, kind: cleanText(body.kind), channel: "whatsapp" }, branchId)
    return NextResponse.json({ ok: true, entry }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar" },
      { status: 500 }
    )
  }
}
