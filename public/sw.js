// Service worker del POS. Dos responsabilidades, ambas conservadoras:
//  1) Assets estáticos (cache-first): cargas rápidas e instalación PWA.
//  2) Navegaciones (network-first con fallback): si se cae el internet, la app
//     se puede recargar/abrir mostrando la última versión cacheada del shell
//     (o una página "sin conexión"). NUNCA cachea /api/*: los datos viajan por
//     ahí y deben ser siempre frescos; offline, /api simplemente falla y la UI
//     ya lo maneja (cola offline para pedidos).

// La VERSIÓN va en el nombre de la caché: al subirla, el handler `activate`
// borra las cachés viejas (KEEP solo incluye las actuales), así los dispositivos
// no se quedan sirviendo assets/HTML de un deploy anterior. SUBIR ESTE NÚMERO
// en cada release que deba forzar refresco (bug histórico: estaba fijo en v1 y
// nunca purgaba, por eso las features nuevas "no aparecían" tras publicar).
const STATIC_CACHE = "santo-static-v8"
const PAGE_CACHE = "santo-pages-v8"
const OFFLINE_URL = "/offline.html"
const KEEP = [STATIC_CACHE, PAGE_CACHE]

self.addEventListener("install", (event) => {
  // Precachear la página de fallback offline.
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  )
  self.skipWaiting()
})

// Permite que la página fuerce la activación inmediata de un SW en espera
// (auto-actualización tras publicar). Redundante con el skipWaiting del install,
// pero deja el mecanismo listo si algún día se quita de ahí.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
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

// Web push del seguimiento de pedido ("¡tu pedido está listo!"). El payload
// llega como JSON {title, body, url} desde el servidor (lib/orderPushNotifications).
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || "Tu pedido"
  const options = {
    body: data.body || "Hay novedades de tu pedido.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Tocar la notificación abre (o enfoca) la página de seguimiento del pedido.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
