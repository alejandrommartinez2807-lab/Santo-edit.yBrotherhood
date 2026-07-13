import { NextRequest, NextResponse } from "next/server"
import { getHotelProfile, saveHotelProfile } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

import { checkHotelLandingAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkHotelLandingAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const profile = await getHotelProfile(branchId)
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la página" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-hotel-profile-post",
    limit: 40,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios. Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkHotelLandingAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const profile = await saveHotelProfile(
      {
        headline: cleanText(body.headline),
        about: cleanText(body.about),
        amenities: cleanText(body.amenities),
        address: cleanText(body.address),
        phone: cleanText(body.phone),
        email: cleanText(body.email),
        checkinTime: cleanText(body.checkinTime),
        checkoutTime: cleanText(body.checkoutTime),
      },
      branchId,
    )
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la página" },
      { status: 500 }
    )
  }
}
