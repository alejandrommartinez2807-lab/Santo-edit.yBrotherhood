import { NextResponse, type NextRequest } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
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

    return NextResponse.json(
      {
        ok: true,
        businessConfig: buildPublicBusinessConfigResponse(businessConfig),
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
