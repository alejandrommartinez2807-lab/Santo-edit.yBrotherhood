import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

// §20 — accesibilidad automatizada con axe (WCAG 2.0/2.1 A y AA) sobre las
// pantallas públicas clave, más navegación por teclado en el login.
//
// Criterio honesto: las violaciones CRÍTICAS rompen el test; las "serious"
// se listan en la salida para decidirlas una a una (contraste de una marca
// es decisión de diseño, no se "arregla" en silencio desde un test).

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(String(baseURL)).hostname
  test.skip(
    !["localhost", "127.0.0.1"].includes(host),
    "Solo contra el entorno local de simulación",
  )
})

async function scan(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("load")
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  const critical = results.violations.filter((v) => v.impact === "critical")
  const serious = results.violations.filter((v) => v.impact === "serious")
  for (const v of serious) {
    console.log(
      `  [serious] ${path} · ${v.id}: ${v.help} (${v.nodes.length} nodo(s))`,
    )
  }
  return { critical, serious }
}

test("menú público (/): sin violaciones críticas de accesibilidad", async ({ page }) => {
  const { critical } = await scan(page, "/")
  expect(
    critical.map((v) => `${v.id}: ${v.help} [${v.nodes.length}]`),
  ).toEqual([])
})

test("login del personal (/acceso): sin violaciones críticas", async ({ page }) => {
  const { critical } = await scan(page, "/acceso")
  expect(
    critical.map((v) => `${v.id}: ${v.help} [${v.nodes.length}]`),
  ).toEqual([])
})

test("los campos del login tienen nombre accesible (etiquetas §20)", async ({ page }) => {
  await page.goto("/acceso")
  const results = await new AxeBuilder({ page })
    .withRules(["label", "label-title-only", "button-name"])
    .analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} [${v.nodes.length}]`),
  ).toEqual([])
})

test("navegación por teclado en el login: Tab recorre y Enter envía", async ({ page }) => {
  await page.goto("/acceso")
  await page.waitForLoadState("load")

  // Tab hasta llegar al campo usuario (el orden exacto puede incluir el logo/enlaces).
  const userInput = page.getByPlaceholder(/maria, jose/)
  await userInput.waitFor()
  let reached = false
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab")
    if (await userInput.evaluate((el) => el === document.activeElement)) {
      reached = true
      break
    }
  }
  expect(reached, "Tab nunca llegó al campo de usuario").toBe(true)

  await page.keyboard.type("teclado-e2e")
  await page.keyboard.press("Tab")
  const passwordFocused = await page
    .locator('input[type="password"]')
    .evaluate((el) => el === document.activeElement)
  expect(passwordFocused, "Tab no pasó del usuario a la contraseña").toBe(true)

  await page.keyboard.type("clave-mala")
  await page.keyboard.press("Enter")
  // El formulario se envía con Enter y muestra un error COMPRENSIBLE.
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible({
    timeout: 15_000,
  })
})
