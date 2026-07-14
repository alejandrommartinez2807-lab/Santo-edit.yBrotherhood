import { NextRequest, NextResponse } from "next/server"
import {
  createRoomsBulk,
  getRoomTypes,
  getRooms,
  saveRoom,
  saveRoomType,
  type SaveRoomInput,
  type SaveRoomTypeInput,
} from "@/lib/orders"
import { normalizeRoomTypePhotos } from "@/lib/ordersStoreRooms"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkRoomsAccess } from "./guard"

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

function normalizeRoomTypePayload(source: Record<string, unknown>): SaveRoomTypeInput {
  return {
    id: cleanText(source.id) || undefined,
    name: cleanText(source.name),
    // Ausente ≠ vacío: un payload parcial no debe borrar la descripción.
    description: source.description === undefined ? undefined : cleanText(source.description),
    baseCapacity: optionalNumber(source.baseCapacity),
    maxCapacity: optionalNumber(source.maxCapacity),
    baseRate: optionalNumber(source.baseRate),
    photos: source.photos === undefined ? undefined : normalizeRoomTypePhotos(source.photos),
    sortOrder: optionalNumber(source.sortOrder),
    active: source.active === undefined ? undefined : source.active !== false,
  }
}

function normalizeRoomPayload(source: Record<string, unknown>): SaveRoomInput {
  const rate =
    source.baseRate === undefined || source.baseRate === null || source.baseRate === ""
      ? null
      : optionalNumber(source.baseRate) ?? null

  return {
    id: cleanText(source.id) || undefined,
    roomTypeId: cleanText(source.roomTypeId),
    name: cleanText(source.name),
    floor: cleanText(source.floor),
    capacity: optionalNumber(source.capacity),
    baseRate: rate,
    housekeepingStatus: cleanText(source.housekeepingStatus) || undefined,
    outOfService: source.outOfService === true,
    amenities: cleanText(source.amenities),
    notes: cleanText(source.notes),
    sortOrder: optionalNumber(source.sortOrder),
    active: source.active === undefined ? undefined : source.active !== false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkRoomsAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const [rooms, roomTypes] = await Promise.all([
      getRooms(branchId),
      getRoomTypes(branchId),
    ])

    return NextResponse.json({ ok: true, rooms, roomTypes })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar las habitaciones",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-rooms-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de habitaciones. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkRoomsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)

    // Un solo endpoint atiende tipos y habitaciones según `kind`.
    if (cleanText(body.kind) === "roomType") {
      const input = normalizeRoomTypePayload(
        body.roomType ? (body.roomType as Record<string, unknown>) : body
      )
      if (!input.name) {
        return NextResponse.json({ error: "Escribe el nombre del tipo de habitación" }, { status: 400 })
      }
      const roomType = await saveRoomType(input, branchId)
      return NextResponse.json({ ok: true, roomType }, { status: input.id ? 200 : 201 })
    }

    // Alta en serie de habitaciones numeradas (pisos completos de una vez).
    if (cleanText(body.kind) === "roomsBulk") {
      const result = await createRoomsBulk(
        {
          roomTypeId: cleanText(body.roomTypeId),
          fromNumber: Number(body.fromNumber),
          toNumber: Number(body.toNumber),
          floor: cleanText(body.floor),
          capacity: body.capacity === undefined ? undefined : Number(body.capacity),
          prefix: cleanText(body.prefix),
        },
        branchId,
      )
      return NextResponse.json(
        { ok: true, created: result.created, skipped: result.skipped },
        { status: 201 },
      )
    }

    const input = normalizeRoomPayload(
      body.room ? (body.room as Record<string, unknown>) : body
    )
    if (!input.name) {
      return NextResponse.json({ error: "Escribe el número o nombre de la habitación" }, { status: 400 })
    }
    const room = await saveRoom(input, branchId)
    return NextResponse.json({ ok: true, room }, { status: input.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar",
      },
      { status: 500 }
    )
  }
}
