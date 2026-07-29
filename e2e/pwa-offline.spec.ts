import { test, expect } from "@playwright/test"

// §11.4 — PWA, Service Worker, caché y OFFLINE real. Corre contra el build de
// producción local (el SW no se registra en dev) apuntando a la base de
// PRUEBA. El guard de abajo impide correr contra cualquier host remoto.

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(String(baseURL)).hostname
  test.skip(
    !["localhost", "127.0.0.1"].includes(host),
    "Solo contra el entorno local de simulación",
  )
})

test("el manifest de la PWA existe y es instalable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest")
  expect(res.status()).toBe(200)
  const manifest = await res.json()
  expect(String(manifest.name || manifest.short_name || "")).not.toBe("")
  expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBe(true)
  expect(String(manifest.start_url || "")).not.toBe("")
})

test("el service worker se registra y queda activo (build de producción)", async ({ page }) => {
  await page.goto("/")
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return { active: Boolean(registration.active), scope: registration.scope }
  })
  expect(state.active).toBe(true)
})

test("la caché del SW existe y la app sobrevive OFFLINE (recarga sin red)", async ({ page, context }) => {
  await page.goto("/")
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Segunda carga ya bajo control del SW: el documento entra a la caché de
  // páginas (network-first con fallback cacheado).
  await page.reload()
  await page.waitForLoadState("load")

  const cacheNames = await page.evaluate(() => caches.keys())
  expect(cacheNames.join(",")).toContain("santo")

  await context.setOffline(true)
  // Sin SW esta recarga muere con ERR_INTERNET_DISCONNECTED: que no muera ES
  // la prueba. El contenido puede ser la página cacheada o el fallback
  // offline — ambas son el comportamiento diseñado.
  await page.reload()
  const bodyText = (await page.locator("body").innerText()).trim()
  expect(bodyText.length).toBeGreaterThan(0)
  await context.setOffline(false)
})
