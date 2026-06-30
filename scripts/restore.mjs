#!/usr/bin/env node
// ============================================================
// RESTORE — Santo Edit  (⚠️ ESCRIBE EN LA BASE)
// ------------------------------------------------------------
// Restaura un respaldo creado por scripts/backup.mjs. Hace UPSERT por id
// (no borra filas que ya existan y no estén en el respaldo, salvo --wipe).
// Respeta el orden de tablas del respaldo (padres antes que hijos).
//
// Por seguridad NO hace nada sin --confirm. Úsalo solo para recuperación.
//
// Uso:
//   node scripts/restore.mjs --file backups/santo-backup-XXXX.json            (dry-run: solo muestra)
//   node scripts/restore.mjs --file backups/santo-backup-XXXX.json --confirm  (aplica upsert)
//   ... --only branches,suppliers   (restaura solo esas tablas)
//   ... --wipe                       (⚠️ borra cada tabla antes de reinsertar)
// ============================================================

import { readFileSync } from "node:fs"
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

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}

const file = flag("--file")
const confirm = args.includes("--confirm")
const wipe = args.includes("--wipe")
const only = (flag("--only") || "").split(",").map((s) => s.trim()).filter(Boolean)

if (!file) {
  console.error("Falta --file <ruta-del-respaldo.json>")
  process.exit(1)
}

const backup = JSON.parse(readFileSync(join(root, file), "utf8"))
const tables = (backup.meta?.tables || Object.keys(backup.data || {})).filter(
  (t) => only.length === 0 || only.includes(t),
)

const CHUNK = 500

async function restoreTable(table) {
  const rows = backup.data?.[table] || []
  if (rows.length === 0) {
    console.log(`· ${table}: 0 filas (omitido)`)
    return
  }

  if (!confirm) {
    console.log(`· ${table}: ${rows.length} filas listas para upsert${wipe ? " (con wipe)" : ""}`)
    return
  }

  if (wipe) {
    const { error } = await sb.from(table).delete().not("id", "is", null)
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await sb.from(table).upsert(chunk)
    if (error) throw new Error(`upsert ${table}: ${error.message}`)
  }
  console.log(`✓ ${table}: ${rows.length} filas restauradas`)
}

async function main() {
  console.log(`Respaldo: ${file}`)
  console.log(`Generado: ${backup.meta?.generatedAt || "desconocido"}`)
  console.log(confirm ? "MODO: APLICAR (escribe en la base)\n" : "MODO: dry-run (no escribe). Agrega --confirm para aplicar.\n")

  for (const table of tables) {
    await restoreTable(table)
  }

  if (!confirm) {
    console.log("\nNada se escribió. Revisa la lista y vuelve a correr con --confirm.")
  } else {
    console.log("\nRestauración completa.")
  }
}

main().catch((error) => {
  console.error("Restore falló:", error.message)
  process.exit(1)
})
