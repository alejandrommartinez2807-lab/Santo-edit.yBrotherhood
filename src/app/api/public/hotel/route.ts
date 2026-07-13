import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getHotelReservations,
  getRateSeasons,
  getRoomBlocks,
  getRoomTypes,
  getRooms,
  saveHotelReservation,
} from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import {
  isValidStayRange,
  nightsBetween,
  normalizeStayDate,
  type ConflictCandidate,
} from "@/lib/hotelReservationConflicts"
import { getReservationNow } from "@/lib/reservationConflicts"
import { availableTypesForStay, pickFreeRoomOfType } from "@/lib/hotelAvailability"
import { quoteStay } from "@/lib/rateSeasons"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Motor de reservas PÚBLICO del hotel (Fase 8). El huésped consulta tipos
// disponibles con precio (temporadas) y reserva. No expone habitaciones
// individuales; al reservar el sistema asigna una libre del tipo y crea una
// reserva `source='web'` en estado pendiente, que aparece en el módulo Reservas
// del hotel para que recepción la confirme.

const MAX_DAYS_AHEAD = 365

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return NextResponse.json(data, { ...init, headers })
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

async function isBookingEnabled() {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
  const access = getModulePlanAccess(config, "bookingEngine")
  return access.includedInPlan && access.effectiveEnabled
}

function toCandidates(
  reservations: Array<{ id: string; roomId: string; checkInDate: string; checkOutDate: string; status: string }>,
): ConflictCandidate[] {
  return reservations.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    status: r.status,
  }))
}

// GET ?checkIn=&checkOut= : tipos disponibles con precio para el rango.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const enabled = await isBookingEnabled()
    if (!enabled) return noStoreResponse({ ok: true, enabled: false, types: [] })

    const checkIn = normalizeStayDate(request.nextUrl.searchParams.get("checkIn"))
    const checkOut = normalizeStayDate(request.nextUrl.searchParams.get("checkOut"))
    if (!isValidStayRange({ checkIn, checkOut })) {
      return noStoreResponse({ ok: true, enabled: true, nights: 0, types: [] })
    }

    const branchId = await resolveBranchId(request)
    const [rooms, roomTypes, reservations, seasons, blocks] = await Promise.all([
      getRooms(branchId),
      getRoomTypes(branchId),
      getHotelReservations({ from: checkIn, to: checkOut }, branchId),
      getRateSeasons(branchId),
      getRoomBlocks({ from: checkIn, to: checkOut }, branchId),
    ])

    const types = availableTypesForStay({
      rooms,
      roomTypes,
      reservations: toCandidates(reservations),
      seasons,
      checkIn,
      checkOut,
      blocks,
    })

    return noStoreResponse({ ok: true, enabled: true, nights: nightsBetween(checkIn, checkOut), types })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel", action: "GET" })
    return noStoreResponse({ ok: false, error: "No se pudo consultar la disponibilidad" }, { status: 500 })
  }
}

// POST : crea la reserva pública (pendiente, source='web').
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-post",
    limit: 8,
    windowMs: 60_000,
    message: "Demasiadas reservas seguidas. Espera un minuto e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    if (!(await isBookingEnabled())) {
      return noStoreResponse(
        { ok: false, error: "Las reservas online no están disponibles por ahora" },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const guestName = cleanText(body.guestName).slice(0, 80)
    const guestPhone = cleanText(body.guestPhone).slice(0, 25)
    const guestEmail = cleanText(body.guestEmail).slice(0, 120)
    const note = cleanText(body.note).slice(0, 200)
    const roomTypeId = cleanText(body.roomTypeId)
    const adults = Math.min(Math.max(1, Number(body.adults) || 2), 20)
    const children = Math.min(Math.max(0, Number(body.children) || 0), 20)
    const checkIn = normalizeStayDate(body.checkIn)
    const checkOut = normalizeStayDate(body.checkOut)

    if (guestName.length < 3) {
      return noStoreResponse({ ok: false, error: "Escribe tu nombre completo" }, { status: 400 })
    }
    if (guestPhone.replace(/\D+/g, "").length < 7) {
      return noStoreResponse(
        { ok: false, error: "Escribe un teléfono válido para confirmarte la reserva" },
        { status: 400 },
      )
    }
    if (!roomTypeId) {
      return noStoreResponse({ ok: false, error: "Elige un tipo de habitación" }, { status: 400 })
    }
    if (!isValidStayRange({ checkIn, checkOut })) {
      return noStoreResponse(
        { ok: false, error: "Revisa las fechas: la salida debe ser al menos una noche después de la entrada." },
        { status: 400 },
      )
    }

    // Solo desde hoy (hora Caracas) y con tope de un año.
    const now = getReservationNow()
    if (checkIn < now.date) {
      return noStoreResponse({ ok: false, error: "La fecha de entrada ya pasó" }, { status: 400 })
    }
    const maxDate = new Date(`${now.date}T00:00:00-04:00`)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
    if (checkIn > maxDate.toISOString().slice(0, 10)) {
      return noStoreResponse(
        { ok: false, error: "Solo aceptamos reservas dentro del próximo año" },
        { status: 400 },
      )
    }

    const branchId = await resolveBranchId(request)
    const [rooms, roomTypes, reservations, seasons, blocks] = await Promise.all([
      getRooms(branchId),
      getRoomTypes(branchId),
      getHotelReservations({ from: checkIn, to: checkOut }, branchId),
      getRateSeasons(branchId),
      getRoomBlocks({ from: checkIn, to: checkOut }, branchId),
    ])

    const roomType = roomTypes.find((t) => t.id === roomTypeId)
    if (!roomType) {
      return noStoreResponse({ ok: false, error: "Ese tipo de habitación no existe" }, { status: 404 })
    }

    // Reconfirma disponibilidad justo antes de crear (evita doble reserva).
    const freeRoom = pickFreeRoomOfType({
      rooms,
      reservations: toCandidates(reservations),
      roomTypeId,
      checkIn,
      checkOut,
      blocks,
    })
    if (!freeRoom) {
      return noStoreResponse(
        { ok: false, error: "No queda una habitación de ese tipo en esas fechas. Prueba con otras fechas." },
        { status: 409 },
      )
    }

    const quote = quoteStay({
      baseRate: Math.max(0, Number(roomType.baseRate) || 0),
      roomTypeId,
      checkIn,
      checkOut,
      seasons,
    })

    const noteParts = [guestEmail ? `Email: ${guestEmail}` : "", note].filter(Boolean)
    const reservation = await saveHotelReservation(
      {
        roomId: freeRoom.id,
        roomTypeId,
        guestName,
        guestPhone,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults,
        children,
        ratePerNight: quote.averageRate,
        status: "pendiente",
        source: "web",
        note: `[Web] ${noteParts.join(" · ")}`.trim(),
      },
      branchId,
    )

    return noStoreResponse(
      {
        ok: true,
        reservation: {
          code: reservation.code,
          guestName: reservation.guestName,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          nights: reservation.nights,
          ratePerNight: reservation.ratePerNight,
          totalAmount: reservation.totalAmount,
          roomTypeName: roomType.name,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/hotel", action: "POST" })
    return noStoreResponse(
      { ok: false, error: "No se pudo registrar la reserva. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
