import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardia de respaldo (auditoría 2026-08-02).
//
// `npm run backup` copiaba 19 tablas de las 26 del esquema. Las que faltaban
// llevaban ahí desde las migraciones 0019-0029: reservas, subrecetas,
// encuestas, tarifas de delivery por distancia, anulaciones pendientes, las
// suscripciones de push y —la más peligrosa— `order_branch_counters`, el
// contador de numeración por sede: restaurar sin él deja los correlativos en
// cero y los pedidos nuevos repiten números ya emitidos.
//
// Si este test falla: añade la tabla al array TABLES de scripts/backup.mjs, en
// el sitio correcto (padres antes que hijos).

const ROOT = join(__dirname, "..", "..", "..")
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations")
const BACKUP_SCRIPT = join(ROOT, "scripts", "backup.mjs")

// Tablas que a propósito NO se respaldan.
const EXCLUIDAS = new Set<string>([
  // Contadores del rate limit (migración 0037). Son efímeros: cada fila vive lo
  // que dura su ventana y se purgan solas. Restaurar contadores viejos no
  // recupera nada y hasta podría dejar bloqueada una IP por intentos de hace
  // meses.
  "rate_limit_hits",
])

function tablasDelEsquema(): string[] {
  const sql = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
    .join("\n")

  const found = new Set<string>()
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi

  let match: RegExpExecArray | null
  while ((match = pattern.exec(sql))) {
    found.add(match[1].toLowerCase())
  }

  return [...found].filter((table) => !EXCLUIDAS.has(table)).sort()
}

function tablasRespaldadas(): string[] {
  const source = readFileSync(BACKUP_SCRIPT, "utf8")
  const block = source.match(/const\s+TABLES\s*=\s*\[([\s\S]*?)\]/)

  expect(block, "no se encontró el array TABLES en scripts/backup.mjs").toBeTruthy()

  return (block?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"') || line.startsWith("'"))
    .map((line) => line.replace(/["',]/g, "").trim())
    .filter(Boolean)
}

describe("el respaldo cubre el esquema entero", () => {
  it("el parser encuentra tablas (si no, el guard sería decorativo)", () => {
    expect(tablasDelEsquema().length).toBeGreaterThan(20)
    expect(tablasRespaldadas().length).toBeGreaterThan(20)
  })

  it("ninguna tabla del esquema se queda fuera del respaldo", () => {
    const respaldadas = new Set(tablasRespaldadas())
    const faltan = tablasDelEsquema().filter((table) => !respaldadas.has(table))

    expect(
      faltan,
      `Tablas que existen pero NO se respaldan:\n${faltan.join("\n")}\n\nAñádelas a TABLES en scripts/backup.mjs`,
    ).toEqual([])
  })

  it("el respaldo no nombra tablas que ya no existen", () => {
    const delEsquema = new Set(tablasDelEsquema())
    const fantasmas = tablasRespaldadas().filter((table) => !delEsquema.has(table))

    expect(
      fantasmas,
      `El respaldo pide tablas inexistentes:\n${fantasmas.join("\n")}`,
    ).toEqual([])
  })

  it("el contador de numeración por sede está respaldado", () => {
    expect(tablasRespaldadas()).toContain("order_branch_counters")
  })
})
