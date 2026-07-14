import { NextRequest, NextResponse } from "next/server"
import { closeBusinessDay, getBusinessDays, getHotelReservations } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"
import { dayAuditSummary } from "@/lib/nightAudit"

import { checkNightAuditAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// GET ?date= : resumen del día + historial de cierres.
export async function GET(request: NextRequest) {
  try {
    const access = await checkNightAuditAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const date = normalizeStayDate(request.nextUrl.searchParams.get("date")) || todayISO()
    const nextDay = new Date(`${date}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const [reservations, history] = await Promise.all([
      // Ventana amplia alrededor de la fecha para capturar estadías en curso.
      getHotelReservations({ from: `${new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}`, to: nextDay.toISOString().slice(0, 10) }, branchId),
      getBusinessDays(branchId),
    ])
    const summary = dayAuditSummary({ reservations, date })
    return NextResponse.json({ ok: true, summary, history })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el cierre" },
      { status: 500 }
    )
  }
}

// POST : cierra el día (guarda el snapshot).
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-night-audit-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkNightAuditAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const date = normalizeStayDate(body.date) || todayISO()
    const nextDay = new Date(`${date}T00:00:00Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const reservations = await getHotelReservations(
      { from: `${new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}`, to: nextDay.toISOString().slice(0, 10) },
      branchId,
    )
    const summary = dayAuditSummary({ reservations, date })
    const day = await closeBusinessDay(
      {
        date,
        arrivals: summary.arrivals,
        departures: summary.departures,
        inHouse: summary.inHouse,
        roomRevenue: summary.roomRevenue,
        note: String(body.note || ""),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, day }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cerrar el día" },
      { status: 500 }
    )
  }
}
