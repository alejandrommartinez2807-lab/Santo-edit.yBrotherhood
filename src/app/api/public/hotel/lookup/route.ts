import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getHotelReservationByCode } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { HOTEL_RESERVATION_STATUS_LABELS } from "@/lib/hotelReservationConflicts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

function digits(value: string) {
  return value.replace(/\D+/g, "")
}

async function portalEnabled() {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
  const access = getModulePlanAccess(config, "guestPortal")
  return access.includedInPlan && access.effectiveEnabled
}

// POST público: el huésped consulta su reserva con código + teléfono.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-lookup",
    limit: 20,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    if (!(await portalEnabled())) {
      return noStore({ ok: false, error: "El portal no está disponible por ahora" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const code = cleanText(body.code)
    const phone = digits(cleanText(body.phone))
    if (!code || phone.length < 4) {
      return noStore({ ok: false, error: "Indica tu código y teléfono" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    const reservation = await getHotelReservationByCode(code, branchId)

    // Verificación simple: el teléfono debe coincidir (últimos 4 dígitos).
    const match =
      reservation && digits(reservation.guestPhone).slice(-4) === phone.slice(-4) && phone.length >= 4
    if (!reservation || !match) {
      return noStore({ ok: false, error: "No encontramos una reserva con esos datos" }, { status: 404 })
    }

    return noStore({
      ok: true,
      reservation: {
        code: reservation.code,
        guestName: reservation.guestName,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        nights: reservation.nights,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount: reservation.totalAmount,
        status: reservation.status,
        statusLabel: HOTEL_RESERVATION_STATUS_LABELS[reservation.status] || reservation.status,
      },
    })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/lookup", action: "POST" })
    return noStore({ ok: false, error: "No se pudo consultar. Intenta de nuevo." }, { status: 500 })
  }
}
