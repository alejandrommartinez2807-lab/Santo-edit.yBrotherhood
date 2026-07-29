import { test, expect } from "@playwright/test"

// §20 — responsive (móvil/tablet/escritorio sin desborde horizontal),
// estados de carga y botón deshabilitado durante el envío (prevención de
// doble clic) en el formulario real de login.

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(String(baseURL)).hostname
  test.skip(
    !["localhost", "127.0.0.1"].includes(host),
    "Solo contra el entorno local de simulación",
  )
})

const VIEWPORTS = [
  { name: "móvil", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "escritorio", width: 1280, height: 800 },
]

for (const viewport of VIEWPORTS) {
  test(`menú público sin desborde horizontal en ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto("/")
    await page.waitForLoadState("load")
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(overflow, `scrollWidth desborda ${overflow}px`).toBeLessThanOrEqual(1)
  })
}

test("el botón de login se deshabilita durante el envío (doble clic imposible) y muestra estado de carga", async ({ page }) => {
  await page.goto("/acceso")

  // Se retrasa la respuesta del auth para poder OBSERVAR el estado de envío.
  await page.route("**/auth/v1/token**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200))
    await route.continue()
  })

  await page.getByPlaceholder(/maria, jose/).fill("doble-clic-e2e")
  await page.locator('input[type="password"]').fill("clave-incorrecta")
  const submit = page.getByRole("button", { name: /iniciar sesión|entrando/i })
  await submit.click()

  // Mientras espera: deshabilitado + texto de carga (un segundo clic no hace nada).
  await expect(submit).toBeDisabled()
  await expect(submit).toContainText(/entrando/i)

  // Al fallar: error comprensible y el botón vuelve a estar disponible.
  await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible({
    timeout: 15_000,
  })
  await expect(submit).toBeEnabled()
})
