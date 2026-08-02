// Regenera supabase/BROTHERHOOD-SETUP.sql concatenando TODAS las migraciones
// en orden. Ese archivo es el instalador de "un solo pegado" que sigue el
// cliente nuevo: si se queda atrás, la base nace incompleta y la app falla en
// runtime con errores de columna inexistente.
//
// Se quedó en la 0021 durante 15 migraciones (auditoría 2026-08-02). Para que
// no vuelva a pasar: `npm run setup:sql` lo regenera y
// src/lib/__tests__/setupSqlCompleto.fitness.test.ts vigila que esté al día.
//
// Uso:  npm run setup:sql

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations")
const OUTPUT = join(ROOT, "supabase", "BROTHERHOOD-SETUP.sql")

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()

const header = [
  "-- ============================================================",
  "-- BROTHERHOOD — Esquema completo (todas las migraciones en orden)",
  "-- Generado a partir de supabase/migrations/*.sql",
  "-- Pega TODO este archivo en Supabase → SQL Editor → Run.",
  "-- Es idempotente: si lo corres dos veces no rompe ni duplica.",
  "--",
  "-- NO lo edites a mano: se regenera con `npm run setup:sql`.",
  "-- ============================================================",
  "",
  "",
].join("\n")

const body = files
  .map((name) =>
    [
      "",
      "-- ============================================================",
      `-- >>> ${name}`,
      "-- ============================================================",
      "",
      readFileSync(join(MIGRATIONS_DIR, name), "utf8").replace(/\s+$/, ""),
      "",
    ].join("\n"),
  )
  .join("\n")

writeFileSync(OUTPUT, `${header}${body}\n`)

console.log(`BROTHERHOOD-SETUP.sql regenerado con ${files.length} migraciones.`)
console.log(`  primera: ${files[0]}`)
console.log(`  última:  ${files[files.length - 1]}`)
