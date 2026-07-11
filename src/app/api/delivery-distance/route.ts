import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getDeliveryDistanceSettings, saveDeliveryDistanceSettings } from "@/lib/orders"
import {
  isShortMapsLink,
  normalizeDeliveryDistanceSettings,
  parseCoordsFromText,
} from "@/lib/deliveryDistance"
import { expandShortMapsLink } from "@/lib/deliveryDistanceServer"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

function forbiddenResponse(message = "Esta clave no tiene permiso para esta acción") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role)) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  return { ok: true as const, response: null, role: access.role }
}

async function getDeliveryModuleAccess() {
  const businessConfig = await getBusinessConfig()
  return getModulePlanAccess(businessConfig as unknown as Record<string, unknown>, "delivery")
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "support"])
    if (!access.ok) return access.response

    const settings = await getDeliveryDistanceSettings(await resolveBranchId(request))

    return NextResponse.json({ ok: true, settings })
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

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-delivery-distance-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage:
      "Demasiados cambios de envío por distancia. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner", "support"])
    if (!access.ok) return access.response

    const moduleAccess = await getDeliveryModuleAccess()
    if (!moduleAccess.effectiveEnabled) {
      return forbiddenResponse(
        moduleAccess.lockedByPlan
          ? "Delivery no está incluido en el plan activo."
          : "Delivery está desactivado desde la configuración del negocio.",
      )
    }

    const body = await request.json()
    const settings = normalizeDeliveryDistanceSettings(body.settings || body)

    // El dueño pega el link de Maps de su local: aquí se resuelven las
    // coordenadas del origen (expandiendo el link corto si hace falta), para
    // que las cotizaciones públicas no tengan que hacerlo en cada pedido.
    if (settings.originMapsUrl && (settings.originLat === null || settings.originLng === null)) {
      const link = isShortMapsLink(settings.originMapsUrl)
        ? await expandShortMapsLink(settings.originMapsUrl)
        : settings.originMapsUrl
      const coords = link ? parseCoordsFromText(link) : null

      if (coords) {
        settings.originLat = coords.lat
        settings.originLng = coords.lng
      }
    }

    if (settings.enabled && (settings.originLat === null || settings.originLng === null)) {
      return NextResponse.json(
        {
          error:
            "No se pudieron leer las coordenadas del link del local. Pega el link de Google Maps de tu negocio (botón Compartir en Maps) e intenta de nuevo.",
        },
        { status: 400 },
      )
    }

    if (settings.enabled && settings.tiers.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos un rango de precio (por ejemplo: hasta 10 km → $6)." },
        { status: 400 },
      )
    }

    const savedSettings = await saveDeliveryDistanceSettings(
      settings,
      await resolveBranchId(request),
    )

    return NextResponse.json({ ok: true, settings: savedSettings })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el envío por distancia",
      },
      { status: 500 },
    )
  }
}
