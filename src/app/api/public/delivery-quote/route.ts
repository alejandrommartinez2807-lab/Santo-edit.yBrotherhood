import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getDeliveryDistanceSettings } from "@/lib/orders"
import {
  getDeliveryDistanceMaxKm,
  isDeliveryDistanceReady,
  isShortMapsLink,
  parseCoordsFromText,
  quoteDeliveryByDistance,
  type LatLng,
} from "@/lib/deliveryDistance"
import { expandShortMapsLink } from "@/lib/deliveryDistanceServer"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { enforceRateLimit } from "@/lib/rateLimit"
import { enforceSameOriginRequest } from "@/lib/requestGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Cotización pública del delivery por distancia: el cliente pega su link de
// Google Maps (o comparte su GPS) y recibe km + costo según los rangos que
// configuró el negocio. No expone datos del negocio más allá de las tarifas.

async function isDeliveryModuleEnabled() {
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "delivery",
  )
  return moduleAccess.effectiveEnabled
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isDeliveryModuleEnabled())) {
      return NextResponse.json({ ok: true, enabled: false, tiers: [], maxKm: 0 })
    }

    const settings = await getDeliveryDistanceSettings(await resolveBranchId(request))
    const ready = isDeliveryDistanceReady(settings)

    return NextResponse.json({
      ok: true,
      enabled: ready,
      tiers: ready ? settings.tiers : [],
      maxKm: ready ? getDeliveryDistanceMaxKm(settings) : 0,
      // Punto de partida del negocio: centra el mapa "elige tu punto" del
      // carrito. Es información pública (la landing ya enlaza la ubicación).
      originLat: ready ? settings.originLat : null,
      originLng: ready ? settings.originLng : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el envío por distancia",
      },
      { status: 500 },
    )
  }
}

type QuoteBody = {
  mapsUrl?: unknown
  lat?: unknown
  lng?: unknown
}

function readDestination(body: QuoteBody): { coords: LatLng | null; usedText: string } {
  const lat = Number(body.lat)
  const lng = Number(body.lng)

  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    const coords = parseCoordsFromText(`${lat}, ${lng}`)
    if (coords) return { coords, usedText: "" }
  }

  return { coords: null, usedText: String(body.mapsUrl || "").trim() }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-delivery-quote-post",
    limit: 20,
    windowMs: 60_000,
    message: "Demasiadas consultas de delivery. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(
    request,
    undefined,
    "api-public-delivery-quote-post",
  )

  if (originGuardResponse) return originGuardResponse

  try {
    if (!(await isDeliveryModuleEnabled())) {
      return NextResponse.json(
        { error: "Delivery no está disponible por ahora." },
        { status: 403 },
      )
    }

    const settings = await getDeliveryDistanceSettings(await resolveBranchId(request))

    if (!isDeliveryDistanceReady(settings)) {
      return NextResponse.json(
        { error: "El negocio no tiene configurado el envío por distancia." },
        { status: 409 },
      )
    }

    const body = (await request.json()) as QuoteBody
    const { coords, usedText } = readDestination(body)
    let destination = coords

    if (!destination && usedText) {
      const link = isShortMapsLink(usedText) ? await expandShortMapsLink(usedText) : usedText
      destination = link ? parseCoordsFromText(link) : null
    }

    if (!destination) {
      return NextResponse.json(
        {
          error:
            "No se pudieron leer las coordenadas de ese link. Abre Google Maps, mantén presionado tu punto de entrega, toca Compartir y pega aquí el link.",
        },
        { status: 400 },
      )
    }

    const quote = quoteDeliveryByDistance(settings, destination)

    if (!quote.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: quote.reason,
          distanceKm: quote.distanceKm,
          maxKm: quote.maxKm,
          error:
            quote.reason === "out_of_range"
              ? `Estás a ~${quote.distanceKm.toFixed(1)} km y el delivery llega hasta ${quote.maxKm} km. Escríbenos por WhatsApp para coordinar.`
              : "El negocio no tiene configurado el envío por distancia.",
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      ok: true,
      distanceKm: quote.distanceKm,
      costUSD: quote.costUSD,
      destination,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo calcular el delivery",
      },
      { status: 500 },
    )
  }
}
