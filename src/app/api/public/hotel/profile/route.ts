import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getHotelProfile } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { HOTEL_DEMO_MODE, demoProfilePayload } from "@/lib/hotelDemoSite"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

// GET público: contenido de la landing del hotel.
export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-profile",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  // Demo estática sin backend: contenido de muestra (ver hotelDemoSite).
  if (HOTEL_DEMO_MODE) return noStore(demoProfilePayload())

  try {
    const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
    const access = getModulePlanAccess(config, "hotelLanding")
    const enabled = access.includedInPlan && access.effectiveEnabled
    if (!enabled) return noStore({ ok: true, enabled: false, profile: null })

    const branchId = await resolveBranchId(request)
    const profile = await getHotelProfile(branchId)
    // Extras editables de la landing (portada, sellos, redes, WhatsApp): son
    // contenido público por diseño, así que viajan junto al perfil.
    return noStore({ ok: true, enabled: true, profile, extras: config.hotelSiteExtras })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/profile", action: "GET" })
    return noStore({ ok: false, error: "No se pudo cargar" }, { status: 500 })
  }
}
