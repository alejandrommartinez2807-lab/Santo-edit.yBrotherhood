import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getHotelReservations } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { isBlockingHotelStatus } from "@/lib/hotelReservationConflicts"
import { buildIcal, type IcalEvent } from "@/lib/icalFeed"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET público: feed iCal de las fechas ocupadas, para que las OTAs se suscriban.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-ical",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
    const access = getModulePlanAccess(config, "channelManager")
    if (!access.includedInPlan || !access.effectiveEnabled) {
      return new NextResponse("Feed no disponible", { status: 403 })
    }

    const branchId = await resolveBranchId(request)
    const today = new Date().toISOString().slice(0, 10)
    const to = `${new Date().getFullYear() + 2}-01-01`
    const reservations = await getHotelReservations({ from: today, to }, branchId)

    const events: IcalEvent[] = reservations
      .filter((r) => isBlockingHotelStatus(r.status) || r.status === "checkout")
      .map((r) => ({
        uid: `res-${r.id}@santo-hotel`,
        start: r.checkInDate,
        end: r.checkOutDate,
        summary: `Ocupada · ${r.guestName || r.code || ""}`.trim(),
      }))

    const ics = buildIcal(events, "Disponibilidad hotel")
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="hotel.ics"',
      },
    })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/ical", action: "GET" })
    return new NextResponse("Error", { status: 500 })
  }
}
