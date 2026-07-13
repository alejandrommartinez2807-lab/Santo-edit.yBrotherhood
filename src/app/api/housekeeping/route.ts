import { NextRequest, NextResponse } from "next/server"
import {
  createHousekeepingTask,
  deleteHousekeepingTask,
  getHousekeepingTasks,
  getRooms,
  updateHousekeepingTask,
  updateRoomHousekeeping,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkHousekeepingAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET : tablero completo = habitaciones (con estado de limpieza) + tareas.
export async function GET(request: NextRequest) {
  try {
    const access = await checkHousekeepingAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const [rooms, tasks] = await Promise.all([
      getRooms(branchId),
      getHousekeepingTasks(branchId),
    ])

    return NextResponse.json({ ok: true, rooms, tasks })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el tablero de limpieza" },
      { status: 500 }
    )
  }
}

// POST : acciones (setRoomStatus | createTask | updateTask | deleteTask).
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-housekeeping-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de limpieza. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkHousekeepingAccess(request, ["owner", "manager", "waiter"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "setRoomStatus"

    // --- Cambiar el estado de limpieza de una habitación ---
    if (action === "setRoomStatus") {
      const roomId = cleanText(body.roomId)
      const status = cleanText(body.status)
      if (!roomId) return NextResponse.json({ error: "Habitación no indicada" }, { status: 400 })
      const room = await updateRoomHousekeeping(roomId, status, branchId)
      return NextResponse.json({ ok: true, room })
    }

    // --- Crear una tarea de limpieza para una habitación ---
    if (action === "createTask") {
      const roomId = cleanText(body.roomId)
      if (!roomId) return NextResponse.json({ error: "Habitación no indicada" }, { status: 400 })
      const task = await createHousekeepingTask(
        {
          roomId,
          type: cleanText(body.type) || undefined,
          status: cleanText(body.status) || undefined,
          assignedTo: cleanText(body.assignedTo),
          note: cleanText(body.note),
        },
        branchId,
      )
      return NextResponse.json({ ok: true, task }, { status: 201 })
    }

    // --- Actualizar una tarea (estado, responsable, nota o tipo) ---
    if (action === "updateTask") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Tarea no indicada" }, { status: 400 })
      const task = await updateHousekeepingTask(
        id,
        {
          type: body.type === undefined ? undefined : cleanText(body.type),
          status: body.status === undefined ? undefined : cleanText(body.status),
          assignedTo: body.assignedTo === undefined ? undefined : cleanText(body.assignedTo),
          note: body.note === undefined ? undefined : cleanText(body.note),
        },
        branchId,
      )
      return NextResponse.json({ ok: true, task })
    }

    // --- Eliminar una tarea ---
    if (action === "deleteTask") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Tarea no indicada" }, { status: 400 })
      await deleteHousekeepingTask(id, branchId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar la limpieza" },
      { status: 500 }
    )
  }
}
