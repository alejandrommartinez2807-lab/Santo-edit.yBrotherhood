import { NextRequest, NextResponse } from "next/server"
import {
  deleteRateRestriction,
  getRateRestrictions,
  getRoomTypes,
  saveRateRestriction,
  type SaveRateRestrictionInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { normalizeStayDate } from "@/lib/hotelReservationConflicts"

import { checkRateRestrictionsAccess } from "./guard"

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

// GET : restricciones + tipos de habitación (para el selector).
export async function GET(request: NextRequest) {
  try {
    const access = await checkRateRestrictionsAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const [restrictions, roomTypes] = await Promise.all([
      getRateRestrictions(branchId),
      getRoomTypes(branchId),
    ])

    return NextResponse.json({ ok: true, restrictions, roomTypes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las restricciones" },
      { status: 500 }
    )
  }
}

// POST : guardar (crear/editar) o eliminar una restricción.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-rate-restrictions-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de restricciones. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkRateRestrictionsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Restricción no indicada" }, { status: 400 })
      await deleteRateRestriction(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const input: SaveRateRestrictionInput = {
      id: cleanText(body.id) || undefined,
      roomTypeId: cleanText(body.roomTypeId),
      fromDate: normalizeStayDate(body.fromDate),
      toDate: normalizeStayDate(body.toDate),
      minStay: optionalNumber(body.minStay),
      closedToArrival: body.closedToArrival === true,
      closedToDeparture: body.closedToDeparture === true,
      active: body.active === undefined ? undefined : body.active !== false,
    }

    if (!input.fromDate || !input.toDate || input.toDate < input.fromDate) {
      return NextResponse.json(
        { error: "Revisa las fechas: el fin debe ser en la fecha de inicio o después." },
        { status: 400 }
      )
    }

    const restriction = await saveRateRestriction(input, branchId)
    return NextResponse.json({ ok: true, restriction }, { status: input.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la restricción" },
      { status: 500 }
    )
  }
}
