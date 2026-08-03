import { NextResponse, type NextRequest } from "next/server"
import { getBusinessConfig, getRawBusinessConfig } from "@/lib/orders"
import {
  getBranchConfig,
  getDefaultBranchId,
  getExplicitBranchIdFromRequest,
} from "@/lib/branch"
import { buildPublicBusinessConfigResponse } from "@/lib/publicBusinessConfigResponse"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { NO_STORE_HEADERS, publicReadHeaders } from "@/lib/publicCacheHeaders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// El dueño edita la configuración desde el panel y quiere verla enseguida:
// un minuto en el borde, y hasta una hora sirviendo la copia guardada
// mientras se refresca por detrás.
const CACHE_SECONDS = 60
const STALE_SECONDS = 3600

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-business-config-get",
    limit: 240,
    windowMs: 60_000,
    message: "Demasiadas consultas de configuración. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const businessConfig = await getBusinessConfig()

    // Sede solicitada: header x-branch-id (lo adjunta AuthBridge en cada fetch)
    // o ?branch= en la URL. Si la sede tiene configuración propia, sus campos
    // públicos (mesas, whatsapps) pisan los globales.
    // Sin sede explícita (visitante que aún no elige, o llegó sin QR) se usa la
    // sede PRINCIPAL. Antes se caía a los valores globales, que en un negocio
    // configurado por sede están vacíos: el botón de ubicación, el de WhatsApp
    // y el de reseñas simplemente desaparecían hasta elegir sede (2026-07-25).
    // Un fallo de BD aquí no puede tumbar la configuración pública: se sigue
    // con lo global.
    const branchId =
      getExplicitBranchIdFromRequest(request) ||
      request.nextUrl.searchParams.get("branch") ||
      request.nextUrl.searchParams.get("branchId") ||
      (await getDefaultBranchId().catch(() => null))
    let scopedConfig: Record<string, unknown> = businessConfig as Record<string, unknown>

    if (branchId) {
      const branchConfig = getBranchConfig(await getRawBusinessConfig(), branchId)

      if ("localTables" in branchConfig) scopedConfig = { ...scopedConfig, localTables: branchConfig.localTables }
      if (branchConfig.mainWhatsapp) scopedConfig = { ...scopedConfig, mainWhatsapp: branchConfig.mainWhatsapp }
      if (branchConfig.deliveryWhatsapp) {
        scopedConfig = { ...scopedConfig, deliveryWhatsapp: branchConfig.deliveryWhatsapp }
      }
      // Ubicación de Google POR SEDE (lote v6.1): el botón "Abrir ubicación"
      // del hero/nav/pie debe llevar a la sede que el cliente eligió, no a la
      // global. El dueño la edita en Sucursales → Configuración por sede.
      if (branchConfig.googleMapsUrl) {
        scopedConfig = { ...scopedConfig, googleMapsUrl: branchConfig.googleMapsUrl }
      }
      // Reseñas e Instagram POR SEDE (2026-07-25): cada local tiene su ficha de
      // Google y su cuenta. Sin valor propio se hereda el general del negocio.
      if (branchConfig.googleReviewUrl) {
        scopedConfig = { ...scopedConfig, googleReviewUrl: branchConfig.googleReviewUrl }
      }
      if (branchConfig.instagramUrl) {
        scopedConfig = { ...scopedConfig, instagramUrl: branchConfig.instagramUrl }
      }
      if (branchConfig.address) scopedConfig = { ...scopedConfig, address: branchConfig.address }
      if (branchConfig.zone) scopedConfig = { ...scopedConfig, zone: branchConfig.zone }
    }

    return NextResponse.json(
      {
        ok: true,
        businessConfig: buildPublicBusinessConfigResponse(scopedConfig),
      },
      {
        headers: publicReadHeaders(request, CACHE_SECONDS, STALE_SECONDS),
      }
    )
  } catch (error) {
    captureError(error, { route: "/api/public/business-config", action: "GET" })

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración pública",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    )
  }
}
