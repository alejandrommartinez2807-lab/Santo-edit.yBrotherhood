import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getReservations,
  normalizeLocalTablesConfig,
  saveReservation,
} from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import {
  findReservationConflict,
  getReservationNow,
  isValidReservationSlot,
  normalizeReservationDate,
  normalizeReservationTime,
  reservationTimeToMinutes,
} from "@/lib/reservationConflicts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Reservas online del sitio público: el cliente pide fecha/hora/personas y el
// sistema asigna una mesa activa libre (las mesas internas no se exponen).
// La reserva entra "activa" con nota [Online] y aparece de una vez en el
// módulo Reservas del panel, donde el staff puede cancelarla si hace falta.

const PUBLIC_RESERVATION_DURATION_MINUTES = 90
const MAX_DAYS_AHEAD = 60

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

  return NextResponse.json(data, { ...init, headers })
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const start = reservationTimeToMinutes(time)

  if (start < 0) return ""

  // La franja no cruza medianoche: se recorta a 23:59 si hiciera falta.
  const end = Math.min(start + minutesToAdd, 23 * 60 + 59)
  const hours = Math.floor(end / 60)
  const minutes = end % 60

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

async function getReservationsAvailability() {
  const businessConfig = await getBusinessConfig()
  const config = businessConfig as unknown as Record<string, unknown>
  const access = getModulePlanAccess(config, "reservations")
  const tables = normalizeLocalTablesConfig(config.localTables, []).filter(
    (table) => table.isActive !== false && cleanText(table.id),
  )

  return {
    enabled: access.includedInPlan && access.effectiveEnabled && tables.length > 0,
    tables,
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-reservations-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas de reservas. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const { enabled } = await getReservationsAvailability()

    return noStoreResponse({ ok: true, enabled })
  } catch (error) {
    captureError(error, { route: "/api/public/reservations", action: "GET" })

    return noStoreResponse(
      { ok: false, error: "No se pudo consultar la disponibilidad de reservas" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-reservations-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiadas reservas seguidas. Espera un minuto e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const { enabled, tables } = await getReservationsAvailability()

    if (!enabled) {
      return noStoreResponse(
        { ok: false, error: "Las reservas online no están disponibles por ahora" },
        { status: 403 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const customerName = cleanText(body.customerName).slice(0, 80)
    const customerPhone = cleanText(body.customerPhone).slice(0, 25)
    const note = cleanText(body.note).slice(0, 200)
    const partySize = Math.min(Math.max(1, Number(body.partySize) || 2), 30)
    const reservationDate = normalizeReservationDate(body.reservationDate)
    const startTime = normalizeReservationTime(body.startTime)
    const endTime = addMinutesToTime(startTime, PUBLIC_RESERVATION_DURATION_MINUTES)

    if (customerName.length < 3) {
      return noStoreResponse({ ok: false, error: "Escribe tu nombre completo" }, { status: 400 })
    }

    const phoneDigits = customerPhone.replace(/\D+/g, "")
    if (phoneDigits.length < 7) {
      return noStoreResponse(
        { ok: false, error: "Escribe un teléfono válido para confirmarte la reserva" },
        { status: 400 },
      )
    }

    const slot = { reservationDate, startTime, endTime }

    if (!isValidReservationSlot(slot)) {
      return noStoreResponse(
        { ok: false, error: "Revisa la fecha y la hora de tu reserva" },
        { status: 400 },
      )
    }

    // Solo fechas de hoy en adelante (hora Caracas) y con tope razonable.
    const now = getReservationNow()

    if (reservationDate < now.date) {
      return noStoreResponse(
        { ok: false, error: "La fecha de la reserva ya pasó" },
        { status: 400 },
      )
    }

    if (reservationDate === now.date && reservationTimeToMinutes(startTime) <= now.minutes) {
      return noStoreResponse(
        { ok: false, error: "Elige una hora más adelante para hoy" },
        { status: 400 },
      )
    }

    const maxDate = new Date(`${now.date}T00:00:00-04:00`)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
    if (reservationDate > maxDate.toISOString().slice(0, 10)) {
      return noStoreResponse(
        { ok: false, error: "Solo aceptamos reservas dentro de los próximos 2 meses" },
        { status: 400 },
      )
    }

    const branchId = await resolveBranchId(request)
    const sameDay = await getReservations({ date: reservationDate, status: "activa" }, branchId)

    // Asigna la primera mesa activa sin choque de franja (orden del panel).
    const freeTable = tables.find(
      (table) =>
        !findReservationConflict(sameDay, { tableId: String(table.id), slot }),
    )

    if (!freeTable) {
      return noStoreResponse(
        {
          ok: false,
          error:
            "No queda mesa libre en ese horario. Prueba con otra hora o escríbenos por WhatsApp.",
        },
        { status: 409 },
      )
    }

    const reservation = await saveReservation(
      {
        tableId: String(freeTable.id),
        tableName: freeTable.name,
        customerName,
        customerPhone,
        partySize,
        reservationDate,
        startTime,
        endTime,
        status: "activa",
        note: note ? `[Online] ${note}` : "[Online]",
      },
      branchId,
    )

    return noStoreResponse(
      {
        ok: true,
        reservation: {
          id: reservation.id,
          tableName: reservation.tableName,
          reservationDate: reservation.reservationDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          partySize: reservation.partySize,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    captureError(error, { route: "/api/public/reservations", action: "POST" })

    return noStoreResponse(
      { ok: false, error: "No se pudo registrar la reserva. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
