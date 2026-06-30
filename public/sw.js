// Service worker conservador: SOLO cachea assets estáticos (cache-first) para
// cargas más rápidas e instalación PWA. NO intercepta navegaciones ni /api/*,
// para no afectar el contenido dinámico ni la autenticación.

const STATIC_CACHE = "santo-static-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Solo assets estáticos: build de Next y recursos públicos por extensión.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css|js|webmanifest)$/.test(url.pathname)

  if (!isStatic) return // navegaciones y /api/* pasan directo a la red

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
