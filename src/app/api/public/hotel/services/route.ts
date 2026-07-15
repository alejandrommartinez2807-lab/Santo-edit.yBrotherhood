import { NextRequest, NextResponse } from "next/server"
import {
  createServiceBooking,
  getBusinessConfig,
  getHotelReservationByCode,
  getResortServices,
  getServiceBookings,
} from "@/lib/orders"
import { canBookService } from "@/lib/resortServices"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"
import { getReservationNow } from "@/lib/reservationConflicts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_DAYS_AHEAD = 365

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function digits(value: string) {
  return value.replace(/\D+/g, "")
}

async function getServicesContext() {
  const config = await getBusinessConfig()
  const raw = config as unknown as Record<string, unknown>
  const access = getModulePlanAccess(raw, "resortServices")
  return {
    enabled: access.includedInPlan && access.effectiveEnabled,
    upsell: config.hotelUpsell,
  }
}

// GET público: catálogo de servicios/actividades activos (spa, tours, eventos…)
// para mostrarlos en la landing del hotel. Solo campos vitrina, sin cupos.
export async function GET(request: NextRequest) {
  try {
    const context = await getServicesContext()
    if (!context.enabled) {
      return noStore({ ok: true, enabled: false, services: [] })
    }
    const branchId = await resolveBranchId(request)
    const all = await getResortServices(branchId)
    const services = all
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
        imageUrl:
          context.upsell.style === "fotos" ? context.upsell.serviceImages[s.id] || "" : "",
      }))
    return noStore({ ok: true, enabled: true, style: context.upsell.style, services })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/services", action: "GET" })
    return noStore({ ok: true, enabled: false, services: [] })
  }
}

// POST público: el huésped reserva un servicio desde la web. Si trae el código
// de su reserva (y el teléfono coincide), la reserva de servicio queda
// VINCULADA a su estadía: al hacer check-in aparece en el folio y se carga a
// su cuenta, sin quedar suelta a nombre de nadie.
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-services-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiadas reservas seguidas. Espera un minuto e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const context = await getServicesContext()
    if (!context.enabled) {
      return noStore(
        { ok: false, error: "Las reservas de servicios no están disponibles por ahora" },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const serviceId = cleanText(body.serviceId)
    const date = normalizeStayDate(body.date)
    const time = cleanText(body.time).slice(0, 10)
    const people = Math.min(Math.max(1, Number(body.people) || 1), 20)
    const code = cleanText(body.code).toUpperCase().slice(0, 12)
    let guestName = cleanText(body.guestName).slice(0, 80)
    let guestPhone = cleanText(body.guestPhone).slice(0, 25)

    if (!serviceId) {
      return noStore({ ok: false, error: "Elige el servicio que quieres reservar" }, { status: 400 })
    }
    if (!date) {
      return noStore({ ok: false, error: "Indica la fecha del servicio" }, { status: 400 })
    }

    // Fechas razonables: desde hoy (hora Caracas) hasta un año.
    const now = getReservationNow()
    if (date < now.date) {
      return noStore({ ok: false, error: "Esa fecha ya pasó" }, { status: 400 })
    }
    const maxDate = new Date(`${now.date}T00:00:00-04:00`)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
    if (date > maxDate.toISOString().slice(0, 10)) {
      return noStore(
        { ok: false, error: "Solo aceptamos reservas dentro del próximo año" },
        { status: 400 },
      )
    }

    const branchId = await resolveBranchId(request)

    // Con código: valida que el teléfono corresponda a la reserva (mismos
    // últimos 4 dígitos, como en /lookup) y toma los datos del huésped.
    let reservationId: string | undefined
    let reservationCode = ""
    if (code) {
      const reservation = await getHotelReservationByCode(code, branchId)
      const phoneDigits = digits(guestPhone)
      const match =
        reservation &&
        phoneDigits.length >= 4 &&
        digits(reservation.guestPhone).slice(-4) === phoneDigits.slice(-4)
      if (!reservation || !match) {
        return noStore(
          { ok: false, error: "No encontramos una reserva con ese código y teléfono" },
          { status: 404 },
        )
      }
      if (reservation.status === "cancelada" || reservation.status === "no_show") {
        return noStore(
          { ok: false, error: "Esa reserva ya no está activa. Escríbenos para ayudarte." },
          { status: 409 },
        )
      }
      reservationId = reservation.id
      reservationCode = reservation.code
      guestName = reservation.guestName || guestName
      guestPhone = reservation.guestPhone || guestPhone
    } else {
      if (guestName.length < 3) {
        return noStore({ ok: false, error: "Escribe tu nombre completo" }, { status: 400 })
      }
      if (digits(guestPhone).length < 7) {
        return noStore(
          { ok: false, error: "Escribe un teléfono válido para confirmarte" },
          { status: 400 },
        )
      }
    }

    const services = await getResortServices(branchId)
    const service = services.find((s) => s.id === serviceId && s.active)
    if (!service) {
      return noStore({ ok: false, error: "Ese servicio no está disponible" }, { status: 404 })
    }

    // Control de cupo en la franja (fecha + hora), igual que en recepción.
    const dayBookings = await getServiceBookings({ from: date, to: date, serviceId }, branchId)
    const check = canBookService({
      capacity: service.capacity,
      bookings: dayBookings,
      serviceId,
      date,
      time,
      people,
    })
    if (!check.allowed) {
      return noStore({ ok: false, error: check.reason }, { status: 409 })
    }

    const booking = await createServiceBooking(
      {
        serviceId,
        reservationId,
        guestName,
        guestPhone,
        date,
        time,
        people,
        note: reservationCode ? `[Web] Huésped de la reserva #${reservationCode}` : "[Web]",
      },
      branchId,
    )

    return noStore(
      {
        ok: true,
        booking: {
          id: booking.id,
          serviceName: service.name,
          date: booking.date,
          time: booking.time,
          people: booking.people,
          price: service.price,
          total: Math.max(0, service.price * booking.people),
          linkedToReservation: Boolean(reservationId),
          reservationCode,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/services", action: "POST" })
    return noStore(
      { ok: false, error: "No se pudo reservar el servicio. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
