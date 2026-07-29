import { defineConfig, devices } from "@playwright/test"

// Pruebas de NAVEGADOR (§11.4/§20 del Prompt Maestro): PWA, Service Worker,
// offline, multipestaña, accesibilidad, responsive.
//
// SOLO contra el entorno de SIMULACIÓN (base de prueba), jamás producción:
//   1. cp .env.simulacion .env.local
//   2. npx next build            (el SW solo se registra en producción)
//   3. npx next start -p 3181
//   4. npx playwright test
// Los specs verifican la identidad del entorno antes de escribir nada.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3181",
    ...devices["Desktop Chrome"],
    // Evidencia en fallos, no en cada corrida.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
