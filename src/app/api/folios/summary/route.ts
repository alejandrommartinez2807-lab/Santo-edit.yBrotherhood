import { NextRequest, NextResponse } from "next/server"
import {
  folioBalance,
  getFolioByReservation,
  getFolioItems,
  getFolioItemsInRange,
  getHotelReservations,
  getReservationPayments,
  getRooms,
} from "@/lib/orders"

import { resolveBranchId } from "@/lib/branch"
import { checkFolioAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

function todayCaracasISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// GET : resumen de la CAJA DE RECEPCIÓN — huéspedes en casa con el saldo de su
// folio, llegadas y salidas de hoy, depósitos por confirmar y lo cobrado hoy.
// Un solo viaje para pintar el submódulo sin encadenar consultas por reserva.
export async function GET(request: NextRequest) {
  try {
    const access = await checkFolioAccess(request, [
      "owner",
      "manager",
      "waiter",
      "support",
      "cashier",
    ])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const today = todayCaracasISO()
    const from = new Date(new Date(`${today}T00:00:00Z`).getTime() - 60 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const to = new Date(new Date(`${today}T00:00:00Z`).getTime() + 60 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10)

    const [reservations, rooms, todaysFolioItems, payments] = await Promise.all([
      getHotelReservations({ from, to }, branchId),
      getRooms(branchId),
      getFolioItemsInRange({ from: today, to: tomorrow }, branchId).catch(() => []),
      getReservationPayments({}, branchId).catch(() => []),
    ])

    const roomNameById = new Map(rooms.map((room) => [room.id, room.name]))
    const summarize = (r: (typeof reservations)[number]) => ({
      id: r.id,
      code: r.code,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      roomId: r.roomId,
      roomName: roomNameById.get(r.roomId) || "",
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: r.nights,
      totalAmount: r.totalAmount,
      status: r.status,
      source: r.source,
    })

    // Huéspedes en casa (checkin) con el saldo real de su folio.
    const inHouseReservations = reservations.filter((r) => r.status === "checkin")
    const inHouse = await Promise.all(
      inHouseReservations.map(async (r) => {
        const folio = await getFolioByReservation(r.id, branchId).catch(() => null)
        const items = folio ? await getFolioItems(folio.id, branchId).catch(() => []) : []
        let charges = 0
        let paid = 0
        for (const item of items) {
          if (item.kind === "pago") paid += item.amount
          else charges += item.amount
        }
        return {
          ...summarize(r),
          folioId: folio?.id || "",
          folioStatus: folio?.status || "",
          balance: folio ? folioBalance(items) : 0,
          charges: Math.round(charges * 100) / 100,
          payments: Math.round(paid * 100) / 100,
          departsToday: r.checkOutDate === today,
        }
      }),
    )
    inHouse.sort((a, b) =>
      a.departsToday === b.departsToday
        ? b.balance - a.balance
        : a.departsToday
          ? -1
          : 1,
    )

    // Llegadas de hoy pendientes de check-in.
    const arrivals = reservations
      .filter(
        (r) => r.checkInDate === today && (r.status === "pendiente" || r.status === "confirmada"),
      )
      .map(summarize)

    // Depósitos reportados por confirmar (con su reserva).
    const reservationById = new Map(reservations.map((r) => [r.id, r]))
    const depositsPending = payments
      .filter((p) => p.status === "reportado")
      .slice(0, 30)
      .map((p) => {
        const r = reservationById.get(p.reservationId)
        return {
          id: p.id,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          createdAt: p.createdAt,
          guestName: r?.guestName || "Reserva",
          code: r?.code || "",
        }
      })

    // Cobrado hoy = pagos de folio de hoy + depósitos confirmados hoy.
    let collectedToday = 0
    const collectedByMethod = new Map<string, number>()
    for (const item of todaysFolioItems) {
      if (item.kind !== "pago") continue
      collectedToday += item.amount
      const key = item.method || "otro"
      collectedByMethod.set(key, (collectedByMethod.get(key) || 0) + item.amount)
    }
    for (const p of payments) {
      if (p.status !== "confirmado") continue
      if (String(p.createdAt || "").slice(0, 10) !== today) continue
      collectedToday += p.amount
      const key = p.method || "otro"
      collectedByMethod.set(key, (collectedByMethod.get(key) || 0) + p.amount)
    }

    const round2 = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      ok: true,
      today,
      inHouse,
      arrivals,
      depositsPending,
      totals: {
        inHouseCount: inHouse.length,
        balanceDue: round2(inHouse.reduce((sum, r) => sum + Math.max(0, r.balance), 0)),
        arrivalsCount: arrivals.length,
        departuresCount: inHouse.filter((r) => r.departsToday).length,
        depositsPendingCount: depositsPending.length,
        collectedToday: round2(collectedToday),
        collectedByMethod: [...collectedByMethod.entries()]
          .map(([method, amount]) => ({ method, amount: round2(amount) }))
          .sort((a, b) => b.amount - a.amount),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la caja de recepción" },
      { status: 500 }
    )
  }
}
