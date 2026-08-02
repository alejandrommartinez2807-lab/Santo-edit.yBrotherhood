import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Los worktrees en .claude/ son otras ramas (marca/tema distintos); sus
    // tests corren en su propio worktree, no desde el repo principal.
    // e2e/ es de Playwright (otro runner): vitest no debe recogerlo.
    exclude: ["**/node_modules/**", "**/.claude/**", "e2e/**"],
    // Los tests de fitness (columnas vs migraciones, aislamiento por sede, RLS,
    // cableado del menú…) recorren TODO src/ y las 36 migraciones con lecturas
    // síncronas de disco. Con la caché fría o los 94 archivos corriendo en
    // paralelo pasan de los 5 s por defecto y fallaban por TIEMPO, no por una
    // aserción: la suite se ponía en rojo al azar y dejaba de creerse
    // (auditoría 2026-08-02). No relaja ninguna comprobación, solo el reloj.
    testTimeout: 60_000,
  },
})
