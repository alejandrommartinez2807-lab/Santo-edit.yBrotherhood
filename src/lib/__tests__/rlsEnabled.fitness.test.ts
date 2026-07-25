import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Fitness function (auditoría 2026-07-24, A3): TODA tabla creada en las
// migraciones debe activar Row Level Security en alguna migración. Así no se
// repite el patrón de order_branch_counters (0032) y
// supplier_purchase_payments (0034): tablas nuevas que quedan años sin RLS
// porque nadie lo nota. La app usa la service key (bypasea RLS), así que
// activar RLS sin políticas = deny-all para anon y cero impacto en el server.

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")

function readAllMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
    .join("\n")
}

function extractCreatedTables(sql: string): string[] {
  const tables = new Set<string>()
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi

  for (const match of sql.matchAll(pattern)) {
    tables.add(match[1].toLowerCase())
  }

  return [...tables].sort()
}

describe("RLS · toda tabla del esquema tiene Row Level Security", () => {
  const sql = readAllMigrationsSql()
  const tables = extractCreatedTables(sql)

  it("las migraciones crean tablas (sanity check del parser)", () => {
    expect(tables.length).toBeGreaterThan(10)
    expect(tables).toContain("orders")
  })

  it.each(tables)("la tabla %s activa row level security", (table) => {
    const rlsPattern = new RegExp(
      String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?${table}"?\s+enable\s+row\s+level\s+security`,
      "i",
    )

    expect(
      rlsPattern.test(sql),
      `La tabla "${table}" se crea en supabase/migrations pero ninguna migración ejecuta ` +
        `"alter table ${table} enable row level security". Agrega el RLS en la misma ` +
        `migración que crea la tabla (deny-all sin políticas; el server usa service key).`,
    ).toBe(true)
  })
})
