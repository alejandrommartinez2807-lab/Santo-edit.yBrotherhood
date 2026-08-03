import { NextResponse, type NextRequest } from "next/server"
import type { MenuProduct } from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { getPublicMenuProductsForBranch } from "@/lib/publicBranchMenu"
import {
  buildPublicProductsFallbackResponse,
  buildPublicProductsResponse,
} from "@/lib/publicProductsResponse"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { NO_STORE_HEADERS, publicReadHeaders } from "@/lib/publicCacheHeaders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Un cambio de precio o de foto en el menú aparece en un minuto como mucho.
const CACHE_SECONDS = 60
const STALE_SECONDS = 3600

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-products-get",
    limit: 240,
    windowMs: 60_000,
    message: "Demasiadas consultas del menú. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    // Sede sin menú propio (o id de sede viejo guardado en el navegador):
    // hereda el menú de la sede por defecto en vez de mostrar el menú base.
    const menuProducts: MenuProduct[] = await getPublicMenuProductsForBranch(
      await resolveBranchId(request),
    )

    return NextResponse.json(buildPublicProductsResponse(menuProducts), {
      headers: publicReadHeaders(request, CACHE_SECONDS, STALE_SECONDS),
    })
  } catch (error) {
    captureError(error, { route: "/api/public/products", action: "GET" })

    return NextResponse.json(buildPublicProductsFallbackResponse(error), {
      headers: NO_STORE_HEADERS,
    })
  }
}
