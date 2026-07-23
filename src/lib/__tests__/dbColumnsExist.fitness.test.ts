import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardia de arquitectura (lote v6.1): TODA columna pedida en un
// .select("...") explícito debe existir en supabase/migrations. Nació de un
// incidente real: orders.payment_method se LEYÓ durante varios lotes sin
// haber existido nunca — los selects fallaban 500 dentro de try/catch
// silenciosos y features enteras (reporte de pago, anulación automática)
// quedaron muertas sin que nadie lo notara. Si este test falla: o falta
// escribir la migración de esa columna, o el select pide una columna
// equivocada. NO lo resuelvas con un catch: resuélvelo en la base o en el
// select (con fallback explícito si la migración aún no se aplica).

const ROOT = join(__dirname, "..", "..", "..")
const SRC_DIR = join(ROOT, "src")
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations")

function readMigrationsText(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
    .join("\n")
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkSourceFiles(full, files)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
  return files
}

type SelectUsage = { file: string; table: string; column: string }

// Extrae pares tabla→columna de cada `.from("tabla")…​.select("a,b,c")` con
// lista explícita (los select("*") no aplican).
function collectSelectUsages(): SelectUsage[] {
  const usages: SelectUsage[] = []
  const fromSelectPattern =
    /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)[\s\S]{0,260}?\.select\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g

  for (const file of walkSourceFiles(SRC_DIR)) {
    const text = readFileSync(file, "utf8")
    let match: RegExpExecArray | null

    while ((match = fromSelectPattern.exec(text))) {
      const table = match[1]
      const rawColumns = (match[2] ?? match[3] ?? match[4] ?? "").trim()
      if (!rawColumns || rawColumns === "*") continue

      for (const rawColumn of rawColumns.split(",")) {
        // Solo identificadores simples: se ignoran joins/embeds ("tabla(...)"),
        // agregados y alias con espacios — esos fallan ruidosamente en dev.
        const column = rawColumn.trim()
        if (!/^[a-z0-9_]+$/.test(column) || column === "*") continue
        usages.push({ file: file.slice(SRC_DIR.length + 1), table, column })
      }
    }
  }

  return usages
}

describe("columnas seleccionadas vs migraciones", () => {
  it("toda columna con select explícito existe en supabase/migrations", () => {
    const migrationsText = readMigrationsText()
    const usages = collectSelectUsages()

    // Sanidad del propio guard: si el parser deja de encontrar usos, el test
    // se volvió decorativo y hay que ajustar el patrón.
    expect(usages.length).toBeGreaterThan(20)

    const missing = usages.filter(({ column }) => {
      const pattern = new RegExp(`(?<![a-z0-9_])${column}(?![a-z0-9_])`, "i")
      return !pattern.test(migrationsText)
    })

    const report = missing
      .map((usage) => `${usage.table}.${usage.column} (en ${usage.file})`)
      .join("\n")

    expect(missing, `Columnas leídas que NO existen en ninguna migración:\n${report}`).toEqual([])
  })
})
