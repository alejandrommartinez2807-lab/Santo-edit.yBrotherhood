import { NextRequest, NextResponse } from "next/server"
import { getHotelReservations, getRooms } from "@/lib/orders"
import { getActiveBranches } from "@/lib/branch"
import {
  computeHotelReport,
  consolidateHotelReports,
  type PropertyReportRow,
} from "@/lib/hotelReports"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"
import { captureError } from "@/lib/monitoring"

import { checkHotelReportsAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Estados que NO cuentan para llegadas/salidas/en casa.
const DEAD_STATUSES = new Set(["cancelada", "no_show"])

function addDaysISO(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

// GET ?from=&to= — dueño consolidado (P2-F): una fila por propiedad
// (ocupación, ingreso, llegadas de HOY) + totales del grupo calculados
// desde las sumas. Solo dueño/soporte: es la vista de TODAS las sedes.
export async function GET(request: NextRequest) {
  try {
    const access = await checkHotelReportsAccess(request, ["owner", "support"])
    if (!access.ok) return access.response

    const from = normalizeStayDate(request.nextUrl.searchParams.get("from"))
    const to = normalizeStayDate(request.nextUrl.searchParams.get("to"))
    if (!from || !to || to <= from) {
      return NextResponse.json({ error: "Indica un rango válido (desde / hasta)." }, { status: 400 })
    }

    const branches = await getActiveBranches()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = addDaysISO(today, 1)

    const rows: PropertyReportRow[] = await Promise.all(
      branches.map(async (branch) => {
        const branchId = String(branch.id)
        const [rooms, reservations, todayReservations] = await Promise.all([
          getRooms(branchId).catch(() => []),
          getHotelReservations({ from, to }, branchId).catch(() => []),
          // Ventana corta alrededor de HOY para llegadas/salidas/en casa.
          getHotelReservations({ from: today, to: tomorrow }, branchId).catch(() => []),
        ])

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

        let arrivalsToday = 0
        let departuresToday = 0
        let inHouse = 0
        for (const r of todayReservations) {
          if (DEAD_STATUSES.has(r.status)) continue
          if (r.checkInDate === today) arrivalsToday += 1
          if (r.checkOutDate === today && (r.status === "checkin" || r.status === "checkout")) {
            departuresToday += 1
          }
          if (r.status === "checkin") inHouse += 1
        }

        return {
          branchId,
          branchName: String(branch.name || "Propiedad"),
          report,
          arrivalsToday,
          departuresToday,
          inHouse,
        }
      }),
    )

    return NextResponse.json({ ok: true, from, to, rows, totals: consolidateHotelReports(rows) })
  } catch (error) {
    captureError(error, { route: "/api/hotel-reports/consolidado", action: "GET" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo consolidar el reporte" },
      { status: 500 },
    )
  }
}
