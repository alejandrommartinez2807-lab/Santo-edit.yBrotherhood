#!/usr/bin/env node
// ============================================================
// BACKUP — Santo Edit
// ------------------------------------------------------------
// Respaldo completo de las tablas de Supabase a un archivo JSON con
// marca de tiempo. Solo LECTURA (no toca la base). Pensado para correr
// a diario por una tarea programada (cron / Task Scheduler / GitHub
// Action). Sale con código != 0 si algo falla (sirve para CI/alertas).
//
// Uso:
//   node scripts/backup.mjs                 → backups/santo-backup-<fecha>.json
//   node scripts/backup.mjs --out ruta/dir  → carpeta de salida personalizada
//   node scripts/backup.mjs --pretty        → JSON indentado (más grande)
//
// Restaurar: scripts/restore.mjs (lee el archivo que genera este).
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

// Tablas a respaldar (padres antes que hijos, para que restore respete FKs).
const TABLES = [
  "branches",
  "business_config",
  "staff_users",
  "suppliers",
  "menu_products",
  "tables",
  "delivery_zones",
  "inventory_items",
  "inventory_recipes",
  "inventory_movements",
  "supplier_purchases",
  "supplier_purchase_payments",
  "orders",
  "order_items",
  "open_accounts",
  "day_closes",
  "day_expenses",
  "payment_proofs",
  "audit_logs",
]

const PAGE = 1000

// Lee una tabla completa paginando (Supabase devuelve máx 1000 filas por query).
async function dumpTable(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function main() {
  const args = process.argv.slice(2)
  const pretty = args.includes("--pretty")
  const outDir = (() => {
    const i = args.indexOf("--out")
    return i >= 0 && args[i + 1] ? args[i + 1] : join(root, "backups")
  })()

  mkdirSync(outDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const outFile = join(outDir, `santo-backup-${stamp}.json`)

  const data = {}
  const counts = {}
  let total = 0
  let failed = 0

  for (const table of TABLES) {
    try {
      const rows = await dumpTable(table)
      data[table] = rows
      counts[table] = rows.length
      total += rows.length
      console.log(`✓ ${table}: ${rows.length} filas`)
    } catch (error) {
      failed += 1
      data[table] = []
      counts[table] = -1
      console.error(`✗ ${table}: ${error.message}`)
    }
  }

  const backup = {
    meta: {
      generatedAt: new Date().toISOString(),
      supabaseUrl: url,
      tables: TABLES,
      counts,
      totalRows: total,
    },
    data,
  }

  writeFileSync(outFile, JSON.stringify(backup, null, pretty ? 2 : 0), "utf8")
  console.log(`\nRespaldo guardado en ${outFile}`)
  console.log(`Total: ${total} filas · ${TABLES.length - failed}/${TABLES.length} tablas`)

  if (failed > 0) {
    console.error(`\n${failed} tabla(s) fallaron. Revisa el respaldo antes de confiar en él.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Backup falló:", error.message)
  process.exit(1)
})
