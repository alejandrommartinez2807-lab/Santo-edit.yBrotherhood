// Service worker del POS. Dos responsabilidades, ambas conservadoras:
//  1) Assets estáticos (cache-first): cargas rápidas e instalación PWA.
//  2) Navegaciones (network-first con fallback): si se cae el internet, la app
//     se puede recargar/abrir mostrando la última versión cacheada del shell
//     (o una página "sin conexión"). NUNCA cachea /api/*: los datos viajan por
//     ahí y deben ser siempre frescos; offline, /api simplemente falla y la UI
//     ya lo maneja (cola offline para pedidos).

const STATIC_CACHE = "santo-static-v1"
const PAGE_CACHE = "santo-pages-v1"
const OFFLINE_URL = "/offline.html"
const KEEP = [STATIC_CACHE, PAGE_CACHE]

self.addEventListener("install", (event) => {
  // Precachear la página de fallback offline.
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

// Navegaciones (recargar/abrir la app): network-first, con fallback a la copia
// cacheada de esa misma URL y, si no existe, a la página offline.
function handleNavigation(event) {
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(event.request)
        // Solo cacheamos respuestas completas y exitosas (no redirects ni errores).
        if (res && res.ok && res.status === 200 && res.type === "basic") {
          const cache = await caches.open(PAGE_CACHE)
          cache.put(event.request, res.clone())
        }
        return res
      } catch {
        const cache = await caches.open(PAGE_CACHE)
        const cached = await cache.match(event.request)
        if (cached) return cached
        const fallback = await cache.match(OFFLINE_URL)
        return fallback || Response.error()
      }
    })(),
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  // Navegaciones de páginas (incluye recarga manual y apertura standalone).
  if (req.mode === "navigate") {
    handleNavigation(event)
    return
  }

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Nunca interceptar /api/*: datos dinámicos y autenticación pasan directo.
  if (url.pathname.startsWith("/api/")) return

  // Solo assets estáticos: build de Next y recursos públicos por extensión.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css|js|webmanifest)$/.test(url.pathname)

  if (!isStatic) return

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch {
        return cached || Response.error()
      }
    }),
  )
})
