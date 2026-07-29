import { readFileSync } from "node:fs"
import { test, expect, type Page } from "@playwright/test"

// §11.4 — multipestaña, persistencia local, sesión expirada y navegación
// según rol, siguiendo el CONTRATO real de la app:
// - El panel (/local-santo) se abre con la CLAVE del local/rol (se guarda en
//   localStorage y se comparte entre pestañas). Una clave de rol trabajador
//   (cocina) redirige a su pantalla, no al panel del dueño.
// - La sesión de /acceso es Supabase (localStorage) y también persiste entre
//   pestañas.
// Usa las claves del entorno de SIMULACIÓN (.env.simulacion), nunca de
// producción.

function simEnvValue(key: string): string {
  const text = readFileSync(".env.simulacion", "utf8")
  const line = text
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith(`${key}=`))
  return line ? line.slice(line.indexOf("=") + 1).trim() : ""
}

const OWNER_KEY = simEnvValue("ORDERS_OWNER_PASSWORD")
const KITCHEN_KEY = simEnvValue("ORDERS_KITCHEN_PASSWORD")

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(String(baseURL)).hostname
  test.skip(
    !["localhost", "127.0.0.1"].includes(host),
    "Solo contra el entorno local de simulación",
  )
  test.skip(!OWNER_KEY || !KITCHEN_KEY, "Faltan claves en .env.simulacion")
})

async function unlockPanel(page: Page, clave: string) {
  await page.goto("/local-santo")
  const gate = page.getByPlaceholder("Ingresa la clave del local")
  await gate.waitFor({ timeout: 20_000 })
  await gate.fill(clave)
  await gate.press("Enter")
}

test("multipestaña + persistencia local: el panel abierto en una pestaña abre directo en la segunda", async ({ context }) => {
  const tabA = await context.newPage()
  await unlockPanel(tabA, OWNER_KEY)
  await expect(tabA.getByRole("heading", { name: /control de pedidos/i })).toBeVisible({
    timeout: 30_000,
  })

  // Misma sesión de navegador, segunda pestaña: SIN teclear la clave.
  const tabB = await context.newPage()
  await tabB.goto("/local-santo")
  await expect(tabB.getByRole("heading", { name: /control de pedidos/i })).toBeVisible({
    timeout: 30_000,
  })
  await expect(tabB.getByPlaceholder("Ingresa la clave del local")).toHaveCount(0)
})

test("sesión expirada: al perderse la clave guardada, el panel vuelve a la puerta de acceso", async ({ page }) => {
  await unlockPanel(page, OWNER_KEY)
  await expect(page.getByRole("heading", { name: /control de pedidos/i })).toBeVisible({
    timeout: 30_000,
  })

  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByText(/acceso privado/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByPlaceholder("Ingresa la clave del local")).toBeVisible()
})

test("navegación según rol: la clave de COCINA no abre el panel del dueño — redirige a su pantalla", async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await unlockPanel(ownerPage, OWNER_KEY)
  await expect(ownerPage.getByRole("heading", { name: /control de pedidos/i })).toBeVisible({
    timeout: 30_000,
  })
  const ownerBody = await ownerPage.locator("body").innerText()
  expect(/historial de cierres/i.test(ownerBody)).toBe(true)

  const kitchenContext = await browser.newContext()
  const kitchenPage = await kitchenContext.newPage()
  await unlockPanel(kitchenPage, KITCHEN_KEY)
  // El rol trabajador sale del panel hacia su módulo.
  await kitchenPage.waitForURL("**/local-santo/cocina**", { timeout: 30_000 })
  const kitchenBody = await kitchenPage.locator("body").innerText()
  expect(/historial de cierres/i.test(kitchenBody)).toBe(false)

  await ownerContext.close()
  await kitchenContext.close()
})

test("la sesión de /acceso (Supabase) persiste entre pestañas", async ({ context }) => {
  const tabA = await context.newPage()
  await tabA.goto("/acceso")
  await tabA.getByPlaceholder(/maria, jose/).fill("alejandro")
  await tabA.locator('input[type="password"]').fill("Sim-alejandro-2026!")
  await tabA.getByRole("button", { name: /iniciar sesión/i }).click()
  await tabA.waitForURL("**/local-santo**", { timeout: 30_000 })

  const tabB = await context.newPage()
  await tabB.goto("/acceso")
  // Con sesión viva, /acceso ofrece entrar directo en vez del formulario.
  await expect(tabB.getByText(/sesión iniciada como/i)).toBeVisible({ timeout: 20_000 })
  await expect(tabB.getByRole("button", { name: /entrar al panel/i })).toBeVisible()
})
