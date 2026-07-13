import { NextRequest, NextResponse } from "next/server"
import {
  getHotelReservations,
  getRateSeasons,
  getRoomTypes,
  getRooms,
  saveHotelReservation,
  type SaveHotelReservationInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  findRoomStayConflict,
  isValidStayRange,
  normalizeStayDate,
} from "@/lib/hotelReservationConflicts"

import { checkHotelReservationsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizePayload(source: Record<string, unknown>): SaveHotelReservationInput {
  return {
    id: cleanText(source.id) || undefined,
    roomId: cleanText(source.roomId),
    roomTypeId: cleanText(source.roomTypeId),
    guestName: cleanText(source.guestName),
    guestPhone: cleanText(source.guestPhone),
    checkInDate: normalizeStayDate(source.checkInDate),
    checkOutDate: normalizeStayDate(source.checkOutDate),
    adults: optionalNumber(source.adults),
    children: optionalNumber(source.children),
    ratePerNight: optionalNumber(source.ratePerNight),
    status: cleanText(source.status) || undefined,
    source: cleanText(source.source) || undefined,
    note: cleanText(source.note),
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkHotelReservationsAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const [reservations, rooms, roomTypes, rateSeasons] = await Promise.all([
      getHotelReservations(
        {
          from: cleanText(request.nextUrl.searchParams.get("from")) || undefined,
          to: cleanText(request.nextUrl.searchParams.get("to")) || undefined,
          status: cleanText(request.nextUrl.searchParams.get("status")) || undefined,
        },
        branchId,
      ),
      getRooms(branchId),
      getRoomTypes(branchId),
      getRateSeasons(branchId),
    ])

    return NextResponse.json({ ok: true, reservations, rooms, roomTypes, rateSeasons })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar las reservas del hotel",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-hotel-reservations-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de reservas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkHotelReservationsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizePayload(body.reservation ? (body.reservation as Record<string, unknown>) : body)

    if (!input.guestName) {
      return NextResponse.json({ error: "Escribe el nombre del huésped" }, { status: 400 })
    }

    const range = { checkIn: input.checkInDate, checkOut: input.checkOutDate }
    if (!isValidStayRange(range)) {
      return NextResponse.json(
        { error: "Revisa las fechas: la salida debe ser al menos una noche después de la entrada." },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchId(request)

    // Si se asignó habitación, validar que esté libre en ese rango.
    if (input.roomId) {
      const overlapping = await getHotelReservations(
        { from: input.checkInDate, to: input.checkOutDate },
        branchId,
      )
      const conflict = findRoomStayConflict(
        overlapping.map((r) => ({
          id: r.id,
          roomId: r.roomId,
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          status: r.status,
          guestName: r.guestName,
        })),
        { roomId: input.roomId, range, ignoreReservationId: input.id },
      )

      if (conflict) {
        return NextResponse.json(
          {
            error: `Esa habitación ya está reservada del ${conflict.checkInDate} al ${conflict.checkOutDate} (${conflict.guestName}).`,
          },
          { status: 409 }
        )
      }
    }

    const reservation = await saveHotelReservation(input, branchId)
    return NextResponse.json({ ok: true, reservation }, { status: input.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar la reserva",
      },
      { status: 500 }
    )
  }
}
