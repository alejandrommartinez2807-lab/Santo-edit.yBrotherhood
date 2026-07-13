import { NextRequest, NextResponse } from "next/server"
import {
  deleteRoomBlock,
  getRoomBlocks,
  getRooms,
  saveRoomBlock,
  type SaveRoomBlockInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { isValidStayRange, normalizeStayDate } from "@/lib/hotelReservationConflicts"

import { checkRoomBlocksAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET : bloqueos (próximo año) + habitaciones (para el selector).
export async function GET(request: NextRequest) {
  try {
    const access = await checkRoomBlocksAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const from = normalizeStayDate(request.nextUrl.searchParams.get("from"))
    const to = normalizeStayDate(request.nextUrl.searchParams.get("to"))
    const [blocks, rooms] = await Promise.all([
      getRoomBlocks({ from: from || undefined, to: to || undefined }, branchId),
      getRooms(branchId),
    ])

    return NextResponse.json({ ok: true, blocks, rooms })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los bloqueos" },
      { status: 500 }
    )
  }
}

// POST : guardar (crear/editar) o eliminar un bloqueo.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-room-blocks-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de bloqueos. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkRoomBlocksAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Bloqueo no indicado" }, { status: 400 })
      await deleteRoomBlock(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const input: SaveRoomBlockInput = {
      id: cleanText(body.id) || undefined,
      roomId: cleanText(body.roomId),
      fromDate: normalizeStayDate(body.fromDate),
      toDate: normalizeStayDate(body.toDate),
      reason: cleanText(body.reason),
    }

    if (!input.roomId) {
      return NextResponse.json({ error: "Elige la habitación a bloquear" }, { status: 400 })
    }
    if (!isValidStayRange({ checkIn: input.fromDate, checkOut: input.toDate })) {
      return NextResponse.json(
        { error: "Revisa las fechas: el fin del bloqueo debe ser al menos un día después del inicio." },
        { status: 400 }
      )
    }

    const block = await saveRoomBlock(input, branchId)
    return NextResponse.json({ ok: true, block }, { status: input.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el bloqueo" },
      { status: 500 }
    )
  }
}
