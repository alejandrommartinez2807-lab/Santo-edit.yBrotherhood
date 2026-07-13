import { NextRequest, NextResponse } from "next/server"
import {
  createServiceBooking,
  deleteResortService,
  deleteServiceBooking,
  getResortServices,
  getServiceBookings,
  saveResortService,
  updateServiceBookingStatus,
  type SaveResortServiceInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"
import { canBookService } from "@/lib/resortServices"

import { checkResortServicesAccess } from "./guard"

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

// GET : catálogo + reservas de servicio (próximo año).
export async function GET(request: NextRequest) {
  try {
    const access = await checkResortServicesAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const today = normalizeStayDate(new Date().toISOString().slice(0, 10))
    const [services, bookings] = await Promise.all([
      getResortServices(branchId),
      getServiceBookings({ from: today }, branchId),
    ])

    return NextResponse.json({ ok: true, services, bookings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los servicios" },
      { status: 500 }
    )
  }
}

// POST : saveService | deleteService | createBooking | bookingStatus | deleteBooking.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-resort-services-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de servicios. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkResortServicesAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "saveService"

    // --- Catálogo ---
    if (action === "saveService") {
      const input: SaveResortServiceInput = {
        id: cleanText(body.id) || undefined,
        name: cleanText(body.name),
        kind: cleanText(body.kind) || undefined,
        description: cleanText(body.description),
        price: optionalNumber(body.price),
        capacity: optionalNumber(body.capacity),
        durationMin: optionalNumber(body.durationMin),
        active: body.active === undefined ? undefined : body.active !== false,
        sortOrder: optionalNumber(body.sortOrder),
      }
      if (!input.name) {
        return NextResponse.json({ error: "Escribe el nombre del servicio" }, { status: 400 })
      }
      const service = await saveResortService(input, branchId)
      return NextResponse.json({ ok: true, service }, { status: input.id ? 200 : 201 })
    }

    if (action === "deleteService") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Servicio no indicado" }, { status: 400 })
      await deleteResortService(id, branchId)
      return NextResponse.json({ ok: true })
    }

    // --- Reservas de servicio ---
    if (action === "createBooking") {
      const serviceId = cleanText(body.serviceId)
      const date = normalizeStayDate(body.date)
      const time = cleanText(body.time)
      const people = Math.max(1, Number(body.people) || 1)
      if (!serviceId || !date) {
        return NextResponse.json({ error: "Indica el servicio y la fecha" }, { status: 400 })
      }

      const services = await getResortServices(branchId)
      const service = services.find((s) => s.id === serviceId)
      if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })

      // Control de cupo en esa franja.
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
        return NextResponse.json({ error: check.reason }, { status: 409 })
      }

      const booking = await createServiceBooking(
        {
          serviceId,
          reservationId: cleanText(body.reservationId) || undefined,
          guestName: cleanText(body.guestName),
          guestPhone: cleanText(body.guestPhone),
          date,
          time,
          people,
          note: cleanText(body.note),
        },
        branchId,
      )
      return NextResponse.json({ ok: true, booking }, { status: 201 })
    }

    if (action === "bookingStatus") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Reserva no indicada" }, { status: 400 })
      const booking = await updateServiceBookingStatus(id, cleanText(body.status), branchId)
      return NextResponse.json({ ok: true, booking })
    }

    if (action === "deleteBooking") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Reserva no indicada" }, { status: 400 })
      await deleteServiceBooking(id, branchId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el servicio" },
      { status: 500 }
    )
  }
}
