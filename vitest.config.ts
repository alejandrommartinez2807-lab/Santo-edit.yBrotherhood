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
  },
})
