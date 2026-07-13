import { NextRequest, NextResponse } from "next/server"
import {
  deleteRoom,
  deleteRoomType,
  updateRoomHousekeeping,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkRoomsAccess } from "../guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function mutationGuard(request: NextRequest, id: string) {
  return enforceApiMutationGuards(request, {
    id,
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Demasiados cambios de habitaciones. Espera unos segundos e intenta nuevamente.",
  })
}

// PATCH: cambia el estado de limpieza de la habitación.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guardResponse = mutationGuard(request, "api-rooms-patch")
  if (guardResponse) return guardResponse

  try {
    const access = await checkRoomsAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const roomId = String(id || "").trim()
    if (!roomId) {
      return NextResponse.json({ error: "Indica la habitación" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const status = String(body.housekeepingStatus || "").trim()
    if (!status) {
      return NextResponse.json({ error: "Indica el estado de limpieza" }, { status: 400 })
    }

    const room = await updateRoomHousekeeping(roomId, status, await resolveBranchId(request))
    return NextResponse.json({ ok: true, room })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la habitación",
      },
      { status: 500 }
    )
  }
}

// DELETE: elimina una habitación o un tipo (?kind=roomType).
export async function DELETE(request: NextRequest, context: RouteContext) {
  const guardResponse = mutationGuard(request, "api-rooms-delete")
  if (guardResponse) return guardResponse

  try {
    const access = await checkRoomsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const targetId = String(id || "").trim()
    if (!targetId) {
      return NextResponse.json({ error: "Indica el elemento a eliminar" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    const kind = String(request.nextUrl.searchParams.get("kind") || "").trim()

    if (kind === "roomType") {
      await deleteRoomType(targetId, branchId)
    } else {
      await deleteRoom(targetId, branchId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar",
      },
      { status: 500 }
    )
  }
}
