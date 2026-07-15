import { NextRequest, NextResponse } from "next/server"
import {
  getFolioItemsInRange,
  getHotelReservations,
  getReservationPayments,
  getRoomTypes,
  getRooms,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import {
  computeHotelDailySeries,
  computeHotelReport,
  computeRoomTypeBreakdown,
  computeSourceBreakdown,
  computeStayStats,
  type ReservationForReport,
} from "@/lib/hotelReports"
import { nightsBetween, normalizeStayDate } from "@/lib/hotelReservationConflicts"

import { checkHotelReportsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

function shiftISO(iso: string, days: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

function toReportInput(
  reservations: Awaited<ReturnType<typeof getHotelReservations>>,
): ReservationForReport[] {
  return reservations.map((r) => ({
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    ratePerNight: r.ratePerNight,
    status: r.status,
    roomTypeId: r.roomTypeId,
    source: r.source,
    adults: r.adults,
    children: r.children,
  }))
}

// GET ?from=&to= : reporte completo del periodo — KPIs (ocupación, ADR,
// RevPAR), serie diaria, desgloses por tipo/canal, ingresos del folio por
// categoría, pagos por método y comparación contra el periodo anterior.
export async function GET(request: NextRequest) {
  try {
    const access = await checkHotelReportsAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response

    const from = normalizeStayDate(request.nextUrl.searchParams.get("from"))
    const to = normalizeStayDate(request.nextUrl.searchParams.get("to"))
    if (!from || !to || to <= from) {
      return NextResponse.json(
        { error: "Indica un rango válido (desde / hasta)." },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchId(request)

    // Periodo anterior de la misma longitud, para los deltas de los KPIs.
    const periodDays = nightsBetween(from, to)
    const prevFrom = shiftISO(from, -periodDays)
    const prevTo = from

    const [rooms, roomTypes, reservations, prevReservations, folioItems, reservationPayments] =
      await Promise.all([
        getRooms(branchId),
        getRoomTypes(branchId),
        getHotelReservations({ from, to }, branchId),
        getHotelReservations({ from: prevFrom, to: prevTo }, branchId),
        getFolioItemsInRange({ from, to }, branchId).catch(() => []),
        getReservationPayments({}, branchId).catch(() => []),
      ])

    // Inventario vendible = habitaciones activas y en servicio.
    const roomCount = rooms.filter((room) => room.active && !room.outOfService).length

    const input = toReportInput(reservations)
    const report = computeHotelReport({ roomCount, from, to, reservations: input })
    const previous = computeHotelReport({
      roomCount,
      from: prevFrom,
      to: prevTo,
      reservations: toReportInput(prevReservations),
    })
    const daily = computeHotelDailySeries({ roomCount, from, to, reservations: input })
    const stay = computeStayStats({ from, to, reservations: input })

    // Nombres legibles para el desglose por tipo.
    const typeNames = new Map(roomTypes.map((t) => [t.id, t.name]))
    const byRoomType = computeRoomTypeBreakdown({ from, to, reservations: input }).map((row) => ({
      ...row,
      name: typeNames.get(row.key) || "Sin tipo",
    }))
    const bySource = computeSourceBreakdown({ from, to, reservations: input })

    // Ingresos del folio por categoría (lo realmente facturado en el periodo:
    // habitación, restaurante, servicios, paquetes, minibar…).
    const folioByCategory = new Map<string, number>()
    const paymentsByMethod = new Map<string, number>()
    for (const item of folioItems) {
      if (item.kind === "cargo") {
        const key = item.category || "extra"
        folioByCategory.set(key, (folioByCategory.get(key) || 0) + item.amount)
      } else {
        const key = item.method || "otro"
        paymentsByMethod.set(key, (paymentsByMethod.get(key) || 0) + item.amount)
      }
    }
    // Depósitos de reserva confirmados dentro del periodo también son cobros.
    let depositsConfirmed = 0
    for (const payment of reservationPayments) {
      if (payment.status !== "confirmado") continue
      const day = String(payment.createdAt || "").slice(0, 10)
      if (!day || day < from || day >= to) continue
      depositsConfirmed += payment.amount
      const key = payment.method || "otro"
      paymentsByMethod.set(key, (paymentsByMethod.get(key) || 0) + payment.amount)
    }

    const round2 = (n: number) => Math.round(n * 100) / 100
    const toRows = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([key, amount]) => ({ key, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      ok: true,
      report,
      previous,
      daily,
      byRoomType,
      bySource,
      stay,
      folioByCategory: toRows(folioByCategory),
      paymentsByMethod: toRows(paymentsByMethod),
      depositsConfirmed: round2(depositsConfirmed),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el reporte" },
      { status: 500 }
    )
  }
}
