import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

// ============================================================
// Test de arquitectura (fitness function) para el AISLAMIENTO MULTI-SUCURSAL.
//
// Como usamos service-role (que ignora RLS), el aislamiento entre sucursales
// depende de que CADA query a una tabla con `branch_id` lo filtre/asigne. Una
// query nueva que se olvide de hacerlo = fuga de datos entre locales.
//
// Este test escanea la capa de datos y FALLA si encuentra un acceso a una tabla
// con sucursal que no esté:
//   - filtrado/insertado por branch_id, o
//   - acotado a una fila concreta (.eq("id"...) / por order_id / item_id), o
//   - marcado explícitamente con un comentario `branch-exempt: <razón>`.
//
// Si agregas una query legítima global, anótala con `branch-exempt` y la razón.
// ============================================================

const SCOPED_TABLES = [
  "orders",
  "menu_products",
  "inventory_items",
  "inventory_movements",
  "inventory_recipes",
  "day_closes",
  "day_expenses",
  "delivery_zones",
  "payment_proofs",
  "open_accounts",
  "tables",
  "suppliers",
  "supplier_purchases",
  "reservations",
]

const SRC = resolve(__dirname, "..", "..")

// Escanea recursivamente toda la capa de datos (lib + rutas de API). Antes se
// usaba una lista fija que quedó desactualizada cuando el store monolítico se
// dividió en ordersInventory/ordersMenu/ordersStoreQueries/etc.; así una query
// nueva en cualquier archivo queda cubierta automáticamente.
function collectDataLayerFiles(): string[] {
  const roots = [resolve(SRC, "lib"), resolve(SRC, "app", "api")]
  const found: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue
        walk(full)
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        found.push(full)
      }
    }
  }

  for (const root of roots) walk(root)
  return found
}

const FILES = collectDataLayerFiles()
const WINDOW = 16 // líneas del encadenamiento de la query a revisar

const fromRegex = new RegExp(`\\.from\\("(${SCOPED_TABLES.join("|")})"\\)`)

function isScopedSafely(windowText: string): boolean {
  return (
    /branch_id/.test(windowText) || // filtrado o insertado por sucursal
    /\.eq\("id",/.test(windowText) || // una fila por id (id global único)
    /\.eq\("order_id",/.test(windowText) ||
    /\.in\("order_id",/.test(windowText) ||
    /\.eq\("item_id",/.test(windowText) ||
    /\.in\("item_id",/.test(windowText) ||
    /\.eq\("open_account_id",/.test(windowText) || // hijos de una cuenta (ya scopeada)
    /branch-exempt/.test(windowText) // excepción anotada a propósito
  )
}

describe("Aislamiento multi-sucursal · fitness function", () => {
  it("escanea realmente la capa de datos (no una lista vacía)", () => {
    // Blindaje: si el walker deja de encontrar archivos, el test no debe pasar
    // en falso. La capa de datos tiene decenas de módulos.
    expect(FILES.length).toBeGreaterThan(20)
  })

  it("toda query a una tabla con branch_id está scopeada (o anotada)", () => {
    const violations: string[] = []

    for (const path of FILES) {
      const rel = path.slice(SRC.length + 1).replace(/\\/g, "/")
      const lines = readFileSync(path, "utf8").split(/\r?\n/)

      lines.forEach((line, i) => {
        if (!fromRegex.test(line)) return
        const table = line.match(fromRegex)![1]
        // Ventana: unas líneas hacia atrás (comentarios/encadenamiento) y el
        // resto de la query hacia adelante.
        const windowText = lines.slice(Math.max(0, i - 3), i + WINDOW).join("\n")
        if (!isScopedSafely(windowText)) {
          violations.push(`${rel}:${i + 1} → .from("${table}") sin filtro de sucursal`)
        }
      })
    }

    if (violations.length) {
      throw new Error(
        "Posible fuga de datos entre sucursales (queries sin branch_id):\n" +
          violations.map((v) => "  - " + v).join("\n") +
          "\n\nFiltra por branch_id, o si es intencional global, añade un comentario `branch-exempt: <razón>`.",
      )
    }

    expect(violations).toEqual([])
  })
})
