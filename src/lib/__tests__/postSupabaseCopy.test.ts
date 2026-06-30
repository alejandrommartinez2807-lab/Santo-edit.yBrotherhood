import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const LEGACY_BACKEND_TERMS = [
  "Google Sheets",
  "Apps Script",
  "Google Apps Script",
  "DESTINO REAL",
  "Copia todo este contenido",
]

const PUBLIC_OR_SUPPORT_FILES = [
  "README.md",
  "CHECKLIST-CLIENTE-NUEVO.md",
  ".env.example",
  "src/app/api/local-support/status/route.ts",
  "src/app/local-santo/cierres/domain.ts",
  "src/app/local-santo/cierres/page.tsx",
  "src/app/local-santo/cocina/page.tsx",
  "src/app/local-santo/delivery/page.tsx",
  "src/app/local-santo/inventario/page.tsx",
  "src/app/local-santo/menu/page.tsx",
  "src/app/local-santo/soporte/page.tsx",
  "src/app/pedidos/domain.tsx",
  "src/components/cartDrawerDomain.ts",
  "src/lib/orders.ts",
  "src/lib/ordersStore.ts",
]

describe("post-Supabase copy", () => {
  it("no mantiene textos visibles ni instrucciones viejas del backend anterior", () => {
    for (const filePath of PUBLIC_OR_SUPPORT_FILES) {
      const content = readFileSync(join(process.cwd(), filePath), "utf8")

      for (const legacyTerm of LEGACY_BACKEND_TERMS) {
        expect(content, `${filePath} no debe contener ${legacyTerm}`).not.toContain(legacyTerm)
      }
    }
  })
})
