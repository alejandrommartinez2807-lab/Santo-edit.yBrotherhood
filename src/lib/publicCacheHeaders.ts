import type { NextRequest } from "next/server"
import { getExplicitBranchIdFromRequest } from "@/lib/branch"

/**
 * Cabeceras de caché del CDN para las rutas públicas de lectura.
 *
 * Estas rutas son `force-dynamic` con `no-store`, así que cada visita del
 * público era una invocación de función. Con caché en el borde, la primera
 * consulta paga y el resto se sirve desde el CDN.
 *
 * El detalle fino es la SEDE. La clave de caché del CDN es la URL y nada más:
 * no incluye cabeceras. Como aquí la sede puede llegar por `x-branch-id` o por
 * el `Referer` del QR, cachear a ciegas serviría la configuración de una sede
 * a los clientes de otra. Por eso solo se cachea cuando la sede viaja en la
 * propia URL (o cuando no hay sede y la respuesta es la global): ahí la URL sí
 * identifica la respuesta de forma única.
 */

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

function cdnHeaders(cacheSeconds: number, staleSeconds: number) {
  const shared = `s-maxage=${cacheSeconds}, stale-while-revalidate=${staleSeconds}`

  return {
    // El navegador revalida siempre; quien guarda es el borde.
    "Cache-Control": `public, max-age=0, ${shared}`,
    "CDN-Cache-Control": `public, ${shared}`,
    "Vercel-CDN-Cache-Control": `public, ${shared}`,
  }
}

/**
 * ¿La URL identifica por sí sola a qué sede corresponde la respuesta?
 *
 * Sin sede → sí (respuesta global). Con sede, solo si esa misma sede está en
 * la query. Si llegó por cabecera o por `Referer`, no: la URL sería idéntica
 * para dos sedes distintas.
 */
export function isBranchCacheSafe(request: NextRequest): boolean {
  const branchId = getExplicitBranchIdFromRequest(request)

  if (!branchId) return true

  const params = request.nextUrl.searchParams

  return branchId === params.get("branch") || branchId === params.get("branchId")
}

/** Cacheable en el borde solo si la sede no puede confundirse. */
export function publicReadHeaders(
  request: NextRequest,
  cacheSeconds: number,
  staleSeconds: number
) {
  return isBranchCacheSafe(request)
    ? cdnHeaders(cacheSeconds, staleSeconds)
    : NO_STORE_HEADERS
}
