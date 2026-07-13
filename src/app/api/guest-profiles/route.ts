import { NextRequest, NextResponse } from "next/server"
import { deleteGuestProfile, getGuestProfiles, saveGuestProfile } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkGuestCrmAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkGuestCrmAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const profiles = await getGuestProfiles(branchId)
    return NextResponse.json({ ok: true, profiles })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las fichas" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-guest-profiles-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de fichas. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkGuestCrmAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (cleanText(body.action) === "delete") {
      const id = cleanText(body.id)
      if (!id) return NextResponse.json({ error: "Ficha no indicada" }, { status: 400 })
      await deleteGuestProfile(id, branchId)
      return NextResponse.json({ ok: true })
    }

    const fullName = cleanText(body.fullName)
    if (!fullName) return NextResponse.json({ error: "Escribe el nombre del huésped" }, { status: 400 })

    const profile = await saveGuestProfile(
      {
        id: cleanText(body.id) || undefined,
        fullName,
        phone: cleanText(body.phone),
        email: cleanText(body.email),
        tags: cleanText(body.tags),
        vip: body.vip === true,
        notes: cleanText(body.notes),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, profile }, { status: body.id ? 200 : 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la ficha" },
      { status: 500 }
    )
  }
}
