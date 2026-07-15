import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import {
  getPublicSurveyContext,
  parseSurveyAspects,
  savePublicSurveyResponse,
} from "@/lib/surveys"
import { enforceRateLimit } from "@/lib/rateLimit"
import { enforceRequestSizeLimit, enforceSameOriginRequest } from "@/lib/requestGuards"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Encuesta post-venta pública: el cliente entra con el link de su pedido
// (/encuesta/ord-..., id imprevisible), califica con estrellas los aspectos
// que configuró el dueño y deja una sugerencia. UNA respuesta por pedido.

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store")

  return NextResponse.json(data, { ...init, headers })
}

function cleanOrderId(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-survey-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas. Espera unos segundos.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const orderId = cleanOrderId(request.nextUrl.searchParams.get("pedido"))

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Link de encuesta no válido" },
        { status: 400 },
      )
    }

    const config = await getBusinessConfig()

    if ((config as unknown as Record<string, unknown>).postSaleSurveyEnabled === false) {
      return noStoreResponse(
        { ok: false, error: "La encuesta no está activa en este momento" },
        { status: 404 },
      )
    }

    const context = await getPublicSurveyContext(orderId)

    if (!context.orderFound) {
      return noStoreResponse(
        { ok: false, error: "No encontramos ese pedido" },
        { status: 404 },
      )
    }

    return noStoreResponse({
      ok: true,
      businessName: String(config.businessName || ""),
      displayNumber: context.displayNumber,
      customerName: context.customerName,
      aspects: parseSurveyAspects(
        (config as unknown as Record<string, unknown>).postSaleSurveyAspects,
      ),
      alreadyAnswered: context.alreadyAnswered,
    })
  } catch (error) {
    captureError(error, { route: "/api/public/survey", action: "GET" })

    return noStoreResponse(
      { ok: false, error: "No se pudo cargar la encuesta" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-survey-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiados envíos seguidos. Espera un momento.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-public-survey-post")

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: 32_000,
    message: "La respuesta es demasiado larga.",
    route: "api-public-survey-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const config = await getBusinessConfig()

    if ((config as unknown as Record<string, unknown>).postSaleSurveyEnabled === false) {
      return noStoreResponse(
        { ok: false, error: "La encuesta no está activa en este momento" },
        { status: 404 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const orderId = cleanOrderId(body.orderId)

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Link de encuesta no válido" },
        { status: 400 },
      )
    }

    const result = await savePublicSurveyResponse({
      orderId,
      ratings:
        body.ratings && typeof body.ratings === "object"
          ? (body.ratings as Record<string, number>)
          : {},
      comment: String(body.comment || ""),
    })

    if (!result.ok) {
      return noStoreResponse(
        { ok: false, error: result.error, alreadyAnswered: result.status === 409 },
        { status: result.status },
      )
    }

    return noStoreResponse({ ok: true }, { status: 201 })
  } catch (error) {
    captureError(error, { route: "/api/public/survey", action: "POST" })

    return noStoreResponse(
      { ok: false, error: "No se pudo guardar tu respuesta" },
      { status: 500 },
    )
  }
}
