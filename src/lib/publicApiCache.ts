// Colapsa la ráfaga de peticiones IDÉNTICAS que dispara una sola carga de la
// carta pública (auditoría 2026-08-02, medido contra producción):
//
//   /api/public/business-config → 13 llamadas
//   /api/public/branches        →  5 llamadas
//   /api/public/products        →  3 llamadas (130 KB cada una)
//
// No es un fallo de nadie en concreto: son ~25 componentes independientes
// (Hero, Navbar, Products, CartDrawer, PublicFooter…) y cada uno pide la
// configuración por su cuenta con `cache: "no-store"`. En el móvil de un
// cliente, con datos, eso es medio mega y decenas de idas y vueltas antes de
// poder pedir una hamburguesa.
//
// La ventana es deliberadamente corta: solo tiene que cubrir el montaje de la
// página. Pasados unos segundos todo vuelve a pedirse fresco, así que un cambio
// del dueño en Configuración se sigue viendo enseguida.

const CACHEABLE_PATHS = new Set([
  "/api/public/business-config",
  "/api/public/branches",
  "/api/public/products",
])

export const PUBLIC_API_CACHE_TTL_MS = 5_000

type CacheEntry = { at: number; response: Response }

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<Response>>()

function getPathname(url: string): string {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    return new URL(url, base).pathname
  } catch {
    return ""
  }
}

// Devuelve la clave de caché, o null si esta petición no se debe cachear.
//
// La respuesta depende de la SEDE (el puente de auth adjunta x-branch-id), así
// que la sede entra en la clave: dos sucursales nunca comparten configuración.
// El parámetro `theme=<timestamp>` que añade PublicThemeSync para saltarse la
// caché del navegador se ignora a propósito: si no, esa llamada quedaría
// siempre fuera y volveríamos a tener una petición extra en cada montaje.
export function getPublicApiCacheKey(
  method: string,
  url: string,
  branchId = "",
): string | null {
  if (String(method || "GET").toUpperCase() !== "GET") return null

  const pathname = getPathname(url)

  if (!CACHEABLE_PATHS.has(pathname)) return null

  let search = ""

  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    const params = new URLSearchParams(new URL(url, base).search)
    params.delete("theme")
    params.sort()
    search = params.toString()
  } catch {
    search = ""
  }

  return `${pathname}?${search}#${branchId}`
}

// Una sola petición de verdad por clave y ventana. Los demás llamadores
// esperan a esa misma y reciben su propia copia del cuerpo.
export async function withPublicApiCache(
  key: string,
  run: () => Promise<Response>,
  now: number = Date.now(),
): Promise<Response> {
  const cached = cache.get(key)

  if (cached && now - cached.at < PUBLIC_API_CACHE_TTL_MS) {
    return cached.response.clone()
  }

  const pending = inFlight.get(key)

  if (pending) return (await pending).clone()

  const request = run()
    .then((response) => {
      // Solo se guarda lo que salió bien: un 500 no debe quedarse pegado cinco
      // segundos para todos los componentes de la página.
      if (response.ok) cache.set(key, { at: now, response: response.clone() })
      return response
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, request)

  return (await request).clone()
}

// La sede cambió (o el dueño tocó la configuración): lo cacheado ya no vale.
export function clearPublicApiCache() {
  cache.clear()
  inFlight.clear()
}

export function getPublicApiCacheSizeForTests() {
  return cache.size
}
