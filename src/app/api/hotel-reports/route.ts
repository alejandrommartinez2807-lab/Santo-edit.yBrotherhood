import { NextRequest, NextResponse } from "next/server"
import { getHotelReservations, getRooms } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { computeHotelReport } from "@/lib/hotelReports"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"

import { checkHotelReportsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET ?from=&to= : métricas del periodo (ocupación, ADR, RevPAR).
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
    const [rooms, reservations] = await Promise.all([
      getRooms(branchId),
      // Reservas que tocan la ventana del reporte.
      getHotelReservations({ from, to }, branchId),
    ])

    // Inventario vendible = habitaciones activas y en servicio.
    const roomCount = rooms.filter((room) => room.active && !room.outOfService).length

    const report = computeHotelReport({
      roomCount,
      from,
      to,
      reservations: reservations.map((r) => ({
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        ratePerNight: r.ratePerNight,
        status: r.status,
      })),
    })

    return NextResponse.json({ ok: true, report })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el reporte" },
      { status: 500 }
    )
  }
}
