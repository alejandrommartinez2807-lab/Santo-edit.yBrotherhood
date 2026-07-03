import { NextResponse, type NextRequest } from "next/server"
import { getBusinessConfig, getRawBusinessConfig } from "@/lib/orders"
import { getBranchConfig, getExplicitBranchIdFromRequest } from "@/lib/branch"
import { buildPublicBusinessConfigResponse } from "@/lib/publicBusinessConfigResponse"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

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
    const branchId =
      getExplicitBranchIdFromRequest(request) ||
      request.nextUrl.searchParams.get("branch") ||
      request.nextUrl.searchParams.get("branchId")
    let scopedConfig: Record<string, unknown> = businessConfig as Record<string, unknown>

    if (branchId) {
      const branchConfig = getBranchConfig(await getRawBusinessConfig(), branchId)

      if ("localTables" in branchConfig) scopedConfig = { ...scopedConfig, localTables: branchConfig.localTables }
      if (branchConfig.mainWhatsapp) scopedConfig = { ...scopedConfig, mainWhatsapp: branchConfig.mainWhatsapp }
      if (branchConfig.deliveryWhatsapp) {
        scopedConfig = { ...scopedConfig, deliveryWhatsapp: branchConfig.deliveryWhatsapp }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        businessConfig: buildPublicBusinessConfigResponse(scopedConfig),
      },
      {
        headers: NO_STORE_HEADERS,
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
