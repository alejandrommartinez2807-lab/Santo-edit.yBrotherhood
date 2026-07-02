import { NextRequest, NextResponse } from "next/server"
import {
  getReservations,
  normalizeLocalTablesConfig,
  saveReservation,
  type SaveReservationInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  findReservationConflict,
  isValidReservationSlot,
  normalizeReservationDate,
  normalizeReservationStatus,
  normalizeReservationTime,
} from "@/lib/reservationConflicts"

import { checkReservationsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeReservationPayload(source: Record<string, unknown>): SaveReservationInput {
  return {
    id: cleanText(source.id) || undefined,
    tableId: cleanText(source.tableId),
    tableName: cleanText(source.tableName),
    customerName: cleanText(source.customerName),
    customerPhone: cleanText(source.customerPhone),
    partySize: Math.max(1, Number(source.partySize) || 2),
    reservationDate: normalizeReservationDate(source.reservationDate),
    startTime: normalizeReservationTime(source.startTime),
    endTime: normalizeReservationTime(source.endTime),
    status: normalizeReservationStatus(source.status),
    note: cleanText(source.note),
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkReservationsAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const reservations = await getReservations(
      {
        date: cleanText(request.nextUrl.searchParams.get("date")) || undefined,
        status: cleanText(request.nextUrl.searchParams.get("status")) || undefined,
      },
      await resolveBranchId(request)
    )

    // Mesas activas de la configuración: el selector de la página las necesita
    // y roles como mesonero no pueden leer /api/business-config.
    const tables = normalizeLocalTablesConfig(
      (access.businessConfig as unknown as Record<string, unknown>).localTables,
      []
    ).filter((table) => table.isActive !== false)

    return NextResponse.json({ ok: true, reservations, tables })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar las reservas",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-reservations-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de reservas. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkReservationsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const reservationInput = normalizeReservationPayload(
      body.reservation ? (body.reservation as Record<string, unknown>) : body
    )

    if (!reservationInput.customerName) {
      return NextResponse.json({ error: "Escribe el nombre del cliente" }, { status: 400 })
    }

    if (!reservationInput.tableId) {
      return NextResponse.json({ error: "Elige la mesa a reservar" }, { status: 400 })
    }

    const slot = {
      reservationDate: reservationInput.reservationDate,
      startTime: reservationInput.startTime,
      endTime: reservationInput.endTime,
    }

    if (!isValidReservationSlot(slot)) {
      return NextResponse.json(
        { error: "Revisa la fecha y la franja horaria (la hora de fin debe ser mayor a la de inicio)" },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchId(request)

    // La mesa debe existir y estar activa en la configuración del negocio.
    const tables = normalizeLocalTablesConfig(
      (access.businessConfig as unknown as Record<string, unknown>).localTables,
      []
    )
    const table = tables.find((item) => item.id === reservationInput.tableId)

    if (!table || table.isActive === false) {
      return NextResponse.json({ error: "Mesa no encontrada o inactiva" }, { status: 400 })
    }

    reservationInput.tableName = table.name

    // Solape contra las reservas activas de esa fecha en esta sucursal.
    const sameDay = await getReservations(
      { date: slot.reservationDate, status: "activa" },
      branchId
    )
    const conflict = findReservationConflict(sameDay, {
      tableId: reservationInput.tableId,
      slot,
      ignoreReservationId: reservationInput.id,
    })

    if (conflict) {
      return NextResponse.json(
        {
          error: `La mesa ${table.name} ya está reservada de ${conflict.startTime} a ${conflict.endTime} (${conflict.customerName}).`,
        },
        { status: 409 }
      )
    }

    const reservation = await saveReservation(reservationInput, branchId)

    return NextResponse.json({ ok: true, reservation }, { status: reservationInput.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar la reserva",
      },
      { status: 500 }
    )
  }
}
