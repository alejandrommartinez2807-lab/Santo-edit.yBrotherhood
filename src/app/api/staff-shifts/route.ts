import { NextRequest, NextResponse } from "next/server"
import {
  deleteStaffShift,
  getStaffShiftById,
  getStaffShifts,
  markStaffShift,
  saveStaffShift,
} from "@/lib/orders"
import { getStaffUsersConfig } from "@/lib/staffUsers"
import { canMarkShift, isValidShiftTime } from "@/lib/hotelStaffShifts"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkStaffShiftsAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Todos los roles operativos pueden VER la semana y marcar su asistencia;
// planificar/eliminar turnos es de dueño/encargado.
const VIEW_ROLES = ["owner", "manager", "support", "cashier", "waiter", "kitchen", "delivery", "promoter"] as const

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function migrationHint(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error || "")
  if (/staff_shifts/i.test(msg)) {
    return "Falta aplicar la migración 0044 en Supabase para activar el módulo de turnos."
  }
  return null
}

// GET ?from=&to= : turnos del rango + roster de usuarios para planificar.
export async function GET(request: NextRequest) {
  try {
    const access = await checkStaffShiftsAccess(request, [...VIEW_ROLES])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const from = cleanText(request.nextUrl.searchParams.get("from"))
    const to = cleanText(request.nextUrl.searchParams.get("to"))
    const [shifts, roster] = await Promise.all([
      getStaffShifts({ from: from || undefined, to: to || undefined }, branchId),
      getStaffUsersConfig().catch(() => []),
    ])
    return NextResponse.json({
      ok: true,
      shifts,
      roster: roster.map((u) => ({ username: u.username, displayName: u.displayName || u.username })),
    })
  } catch (error) {
    const hint = migrationHint(error)
    if (hint) return NextResponse.json({ error: hint }, { status: 409 })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los turnos" },
      { status: 500 },
    )
  }
}

// POST: save | delete | mark {id, kind: in|out}
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-staff-shifts-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = cleanText(body.action) || "save"
    const branchId = await resolveBranchId(request)

    if (action === "mark") {
      // Marcar asistencia: cualquier rol operativo con el módulo activo.
      const access = await checkStaffShiftsAccess(request, [...VIEW_ROLES])
      if (!access.ok) return access.response
      const id = cleanText(body.id)
      const kind = cleanText(body.kind) === "out" ? "out" : "in"
      if (!id) return NextResponse.json({ error: "Turno no indicado" }, { status: 400 })
      const shift = await getStaffShiftById(id, branchId)
      if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
      if (!canMarkShift(shift, kind)) {
        return NextResponse.json(
          { error: kind === "in" ? "La entrada ya está marcada." : "Marca primero la entrada." },
          { status: 409 },
        )
      }
      const updated = await markStaffShift(id, kind, branchId)
      return NextResponse.json({ ok: true, shift: updated })
    }

    // Planificar y eliminar: dueño/encargado.
    const access = await checkStaffShiftsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    if (action === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Turno no indicado" }, { status: 400 })
      await deleteStaffShift(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const staffName = cleanText(body.staffName)
    const shiftDate = cleanText(body.shiftDate)
    if (!staffName) return NextResponse.json({ error: "Elige el usuario del turno" }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
      return NextResponse.json({ error: "Indica la fecha del turno" }, { status: 400 })
    }
    if (!isValidShiftTime(body.plannedStart) || !isValidShiftTime(body.plannedEnd)) {
      return NextResponse.json({ error: "Las horas del turno deben ser HH:MM (24 h)" }, { status: 400 })
    }

    const shift = await saveStaffShift(
      {
        id: cleanText(body.id) || undefined,
        staffUsername: cleanText(body.staffUsername),
        staffName,
        shiftDate,
        shiftLabel: cleanText(body.shiftLabel).slice(0, 40),
        plannedStart: cleanText(body.plannedStart),
        plannedEnd: cleanText(body.plannedEnd),
        note: cleanText(body.note).slice(0, 200),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, shift }, { status: body.id ? 200 : 201 })
  } catch (error) {
    const hint = migrationHint(error)
    if (hint) return NextResponse.json({ error: hint }, { status: 409 })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el turno" },
      { status: 500 },
    )
  }
}
