import { NextRequest, NextResponse } from "next/server"
import { createReview, getBusinessConfig, getHotelReservationByCode, getReviews } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { clampRating, summarizeReviews } from "@/lib/reviewsSummary"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { HOTEL_DEMO_MODE, demoReviewsPayload } from "@/lib/hotelDemoSite"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

async function reviewsEnabled() {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
  const access = getModulePlanAccess(config, "guestReviews")
  return access.includedInPlan && access.effectiveEnabled
}

// GET público: reseñas publicadas + resumen (para testimonios en la landing).
export async function GET(request: NextRequest) {
  // Demo estática sin backend: testimonios de muestra (ver hotelDemoSite).
  if (HOTEL_DEMO_MODE) return noStore(demoReviewsPayload())

  try {
    if (!(await reviewsEnabled())) {
      return noStore({ ok: true, enabled: false, summary: { count: 0, average: 0 }, reviews: [] })
    }
    const branchId = await resolveBranchId(request)
    const all = await getReviews(branchId)
    const published = all.filter((r) => r.published)
    const summary = summarizeReviews(published)
    const reviews = published
      .slice(0, 12)
      .map((r) => ({ guestName: r.guestName, rating: r.rating, comment: r.comment, createdAt: r.createdAt }))
    return noStore({ ok: true, enabled: true, summary: { count: summary.count, average: summary.average }, reviews })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/review", action: "GET" })
    return noStore({ ok: true, enabled: false, summary: { count: 0, average: 0 }, reviews: [] })
  }
}

// POST público: el huésped deja una reseña (opcionalmente con su código).
export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-hotel-review",
    limit: 6,
    windowMs: 60_000,
    message: "Demasiadas reseñas seguidas. Espera un minuto e intenta nuevamente.",
  })
  if (rateLimitResponse) return rateLimitResponse

  // Demo estática: la reseña se "recibe" pero no se persiste.
  if (HOTEL_DEMO_MODE) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (cleanText(body.guestName).length < 2) {
      return noStore({ ok: false, error: "Escribe tu nombre" }, { status: 400 })
    }
    return noStore({ ok: true }, { status: 201 })
  }

  try {
    if (!(await reviewsEnabled())) {
      return noStore({ ok: false, error: "Las reseñas no están disponibles por ahora" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const guestName = cleanText(body.guestName).slice(0, 80)
    const comment = cleanText(body.comment).slice(0, 500)
    const rating = clampRating(body.rating)
    const code = cleanText(body.code)

    if (guestName.length < 2) {
      return noStore({ ok: false, error: "Escribe tu nombre" }, { status: 400 })
    }

    const branchId = await resolveBranchId(request)
    // Si trae código, vincula la reseña a esa reserva.
    let reservationId: string | undefined
    if (code) {
      const reservation = await getHotelReservationByCode(code, branchId)
      reservationId = reservation?.id
    }

    await createReview({ reservationId, guestName, rating, comment }, branchId)
    return noStore({ ok: true }, { status: 201 })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/review", action: "POST" })
    return noStore({ ok: false, error: "No se pudo enviar la reseña. Intenta de nuevo." }, { status: 500 })
  }
}
