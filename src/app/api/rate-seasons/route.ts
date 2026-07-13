import { NextRequest, NextResponse } from "next/server"
import {
  deleteRateSeason,
  getRateSeasons,
  getRoomTypes,
  saveRateSeason,
  type SaveRateSeasonInput,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkRateSeasonsAccess } from "./guard"

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

function normalizePayload(source: Record<string, unknown>): SaveRateSeasonInput {
  return {
    id: cleanText(source.id) || undefined,
    roomTypeId: cleanText(source.roomTypeId),
    name: cleanText(source.name),
    startDate: cleanText(source.startDate),
    endDate: cleanText(source.endDate),
    mode: cleanText(source.mode) || undefined,
    rate: optionalNumber(source.rate),
    multiplier: optionalNumber(source.multiplier),
    priority: optionalNumber(source.priority),
    active: source.active === undefined ? undefined : source.active !== false,
  }
}

// GET : temporadas + tipos de habitación (para el selector).
export async function GET(request: NextRequest) {
  try {
    const access = await checkRateSeasonsAccess(request, ["owner", "manager", "waiter", "support"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const [seasons, roomTypes] = await Promise.all([
      getRateSeasons(branchId),
      getRoomTypes(branchId),
    ])

    return NextResponse.json({ ok: true, seasons, roomTypes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las tarifas" },
      { status: 500 }
    )
  }
}

// POST : guardar (crear/editar) o eliminar una temporada.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-rate-seasons-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de tarifas. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkRateSeasonsAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Temporada no indicada" }, { status: 400 })
      await deleteRateSeason(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const input = normalizePayload(body.season ? (body.season as Record<string, unknown>) : body)
    if (!input.name) {
      return NextResponse.json({ error: "Escribe el nombre de la temporada" }, { status: 400 })
    }
    if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
      return NextResponse.json(
        { error: "Revisa las fechas: la temporada debe terminar en la fecha de inicio o después." },
        { status: 400 }
      )
    }

    const season = await saveRateSeason(input, branchId)
    return NextResponse.json({ ok: true, season }, { status: input.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la tarifa" },
      { status: 500 }
    )
  }
}
