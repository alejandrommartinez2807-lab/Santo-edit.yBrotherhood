import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getHotelProfile,
  saveBusinessConfig,
  saveHotelProfile,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { DEFAULT_HOTEL_TERMS, normalizeHotelBookingFields } from "@/lib/hotelBooking"
import {
  normalizeHotelRoomTypeDetails,
  normalizeHotelSiteExtras,
  normalizeHotelUpsell,
} from "@/lib/hotelSite"

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
    const [profile, config] = await Promise.all([getHotelProfile(branchId), getBusinessConfig()])
    return NextResponse.json({
      ok: true,
      profile,
      bookingFields: config.hotelBookingFields,
      termsText: config.hotelTermsText,
      termsDefault: DEFAULT_HOTEL_TERMS,
      siteExtras: config.hotelSiteExtras,
      roomTypeDetails: config.hotelRoomTypeDetails,
      upsell: config.hotelUpsell,
    })
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

    // Guardado PARCIAL seguro: solo se tocan los campos que el cliente envía.
    // Un POST con solo siteExtras/roomTypeDetails no debe vaciar el perfil.
    const PROFILE_KEYS = [
      "headline",
      "about",
      "amenities",
      "address",
      "phone",
      "email",
      "checkinTime",
      "checkoutTime",
    ] as const
    const profileInput: Record<string, string> = {}
    for (const key of PROFILE_KEYS) {
      if (body[key] !== undefined) profileInput[key] = cleanText(body[key])
    }
    const profile =
      Object.keys(profileInput).length > 0
        ? await saveHotelProfile(profileInput, branchId)
        : await getHotelProfile(branchId)

    // Formulario de reserva + términos + extras de la landing + detalle por
    // tipo: viven en business_config (a nivel de negocio; la demo es una
    // propiedad). Solo se tocan si el editor los envía.
    if (
      body.bookingFields !== undefined ||
      body.termsText !== undefined ||
      body.siteExtras !== undefined ||
      body.roomTypeDetails !== undefined ||
      body.upsell !== undefined
    ) {
      await saveBusinessConfig({
        ...(body.bookingFields !== undefined
          ? { hotelBookingFields: normalizeHotelBookingFields(body.bookingFields) }
          : {}),
        ...(body.termsText !== undefined
          ? { hotelTermsText: cleanText(body.termsText).slice(0, 8000) }
          : {}),
        ...(body.siteExtras !== undefined
          ? { hotelSiteExtras: normalizeHotelSiteExtras(body.siteExtras) }
          : {}),
        ...(body.roomTypeDetails !== undefined
          ? { hotelRoomTypeDetails: normalizeHotelRoomTypeDetails(body.roomTypeDetails) }
          : {}),
        ...(body.upsell !== undefined ? { hotelUpsell: normalizeHotelUpsell(body.upsell) } : {}),
      })
    }

    const config = await getBusinessConfig()
    return NextResponse.json({
      ok: true,
      profile,
      bookingFields: config.hotelBookingFields,
      termsText: config.hotelTermsText,
      termsDefault: DEFAULT_HOTEL_TERMS,
      siteExtras: config.hotelSiteExtras,
      roomTypeDetails: config.hotelRoomTypeDetails,
      upsell: config.hotelUpsell,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la página" },
      { status: 500 }
    )
  }
}
