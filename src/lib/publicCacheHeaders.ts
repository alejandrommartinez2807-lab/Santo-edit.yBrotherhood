import type { NextRequest } from "next/server"
import { getActiveBranches, getExplicitBranchIdFromRequest } from "@/lib/branch"

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
 * Con la sede en la query, sí: la clave de caché ya distingue una sede de otra.
 *
 * Sin sede en la query la respuesta es la global, y ahí está el detalle que
 * costó verificar en producción: una vez guardada, el CDN le entrega esa misma
 * copia a cualquiera que pida la URL pelada — **incluido quien mande la sede
 * por cabecera**, porque la función ni siquiera llega a ejecutarse. Por eso la
 * URL sin sede solo puede cachearse cuando la respuesta es igual para todos,
 * es decir cuando el negocio tiene una sola sede.
 *
 * En cuanto exista una segunda sucursal, `multiSede` pasa a true y la URL
 * pelada deja de guardarse: solo cachean las que llevan `?branch=`.
 */
export function isBranchCacheSafe(
  request: NextRequest,
  multiSede: boolean
): boolean {
  const params = request.nextUrl.searchParams
  const enLaUrl = params.get("branch") || params.get("branchId")
  const branchId = getExplicitBranchIdFromRequest(request)

  if (!branchId) return !multiSede

  if (branchId === enLaUrl) return true

  // La sede llegó por cabecera o por el Referer del QR: la URL no la refleja.
  return false
}

/**
 * ¿El negocio tiene más de una sede activa?
 *
 * Si no se puede averiguar, se responde que sí: lo conservador es no guardar
 * la URL sin sede antes que arriesgarse a servírsela a la sucursal equivocada.
 */
export async function hayVariasSedes(): Promise<boolean> {
  try {
    const sedes = await getActiveBranches()

    return sedes.length > 1
  } catch {
    return true
  }
}

/** Cacheable en el borde solo si la sede no puede confundirse. */
export function publicReadHeaders(
  request: NextRequest,
  cacheSeconds: number,
  staleSeconds: number,
  multiSede: boolean
) {
  return isBranchCacheSafe(request, multiSede)
    ? cdnHeaders(cacheSeconds, staleSeconds)
    : NO_STORE_HEADERS
}
