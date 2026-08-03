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

// Memoria corta de la respuesta, para no consultar las sucursales en CADA
// visita del público. Los dos plazos son distintos a propósito:
//
//   "hay varias sedes" (true)  → no se cachea la URL pelada. Equivocarse por
//     quedarse con este valor solo cuesta responder `no-store` de más, así que
//     se puede guardar tranquilo.
//   "hay una sola sede" (false) → sí se cachea. Este es el valor peligroso: si
//     el dueño acaba de abrir la segunda sucursal, seguir creyendo que hay una
//     serviría la misma configuración a las dos. Por eso dura poquísimo.
const TTL_VARIAS_MS = 60_000
const TTL_UNA_MS = 5_000

let recordado: { valor: boolean; hasta: number } | null = null

/**
 * ¿El negocio tiene más de una sede activa?
 *
 * Si no se puede averiguar, se responde que sí: lo conservador es no guardar
 * la URL sin sede antes que arriesgarse a servírsela a la sucursal equivocada.
 */
export async function hayVariasSedes(ahora: number = Date.now()): Promise<boolean> {
  if (recordado && ahora < recordado.hasta) return recordado.valor

  try {
    const sedes = await getActiveBranches()
    const valor = sedes.length > 1

    recordado = {
      valor,
      hasta: ahora + (valor ? TTL_VARIAS_MS : TTL_UNA_MS),
    }

    return valor
  } catch {
    // Un fallo no se recuerda: la próxima petición vuelve a preguntar.
    recordado = null

    return true
  }
}

/** Solo para las pruebas: olvida lo recordado. */
export function olvidarSedesRecordadas() {
  recordado = null
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
