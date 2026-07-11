// Expansión de links cortos de Google Maps (maps.app.goo.gl → URL completa
// con coordenadas). Vive separado de deliveryDistance.ts para que aquel siga
// siendo 100% puro/testeable. Solo se hace fetch a hosts conocidos de Google
// (isShortMapsLink), nunca a URLs arbitrarias del cliente.

import { isShortMapsLink } from "@/lib/deliveryDistance"

const EXPAND_TIMEOUT_MS = 6_000

// Cache en memoria del proceso: el mismo link corto (el del local, sobre todo)
// se consulta muchas veces y su destino no cambia.
const expandedLinkCache = new Map<string, string>()
const EXPANDED_CACHE_MAX = 500

export async function expandShortMapsLink(rawUrl: string): Promise<string | null> {
  const url = String(rawUrl || "").trim()
  if (!isShortMapsLink(url)) return null

  const cached = expandedLinkCache.get(url)
  if (cached) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EXPAND_TIMEOUT_MS)

  try {
    // fetch sigue los redirects; la URL final (con coordenadas) queda en
    // response.url aunque el HTML de la página no se use para nada.
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; SantoEdit/1.0)" },
    })

    const finalUrl = String(response.url || "").trim()
    if (!finalUrl || finalUrl === url) return null

    if (expandedLinkCache.size >= EXPANDED_CACHE_MAX) expandedLinkCache.clear()
    expandedLinkCache.set(url, finalUrl)

    return finalUrl
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
