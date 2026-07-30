// QA · ¿ESTÁN APLICADAS TODAS LAS MIGRACIONES EN ESTA BASE?
//
// El fitness test `dbColumnsExist` compara el CÓDIGO con los ARCHIVOS .sql:
// dice si escribimos la migración, no si alguien la aplicó. Este script
// pregunta a la BASE DE DATOS conectada, tabla por tabla y columna por
// columna, si lo que declaran las migraciones existe de verdad.
//
// Sirve para responder de una vez "¿me falta correr algún .sql en Supabase?"
// antes de entregar el sistema. NO escribe nada: solo lee.
//
// Uso:  npm run qa:migraciones
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { supabase, env } from "./qa-lib.mjs"

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")

// ── 1. Leer las migraciones y extraer tablas y columnas declaradas
const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort()

const declaredTables = new Map() // tabla -> archivo que la crea
const declaredColumns = new Map() // "tabla.columna" -> archivo

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8")
  // Quita comentarios de línea para no leer SQL comentado.
  const clean = sql.replace(/--[^\n]*/g, "")

  for (const match of clean.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-z0-9_]+)["']?/gi,
  )) {
    const table = match[1].toLowerCase()
    if (!declaredTables.has(table)) declaredTables.set(table, file)
  }

  // Cada ALTER TABLE abre un contexto de tabla; los ADD COLUMN que siguen
  // (hasta el próximo ALTER/CREATE) pertenecen a ella.
  const alterPattern =
    /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?["']?([a-z0-9_]+)["']?([\s\S]*?)(?=alter\s+table|create\s+table|create\s+index|create\s+policy|drop\s+|$)/gi
  for (const match of clean.matchAll(alterPattern)) {
    const table = match[1].toLowerCase()
    const body = match[2] || ""
    for (const col of body.matchAll(
      /add\s+column\s+(?:if\s+not\s+exists\s+)?["']?([a-z0-9_]+)["']?/gi,
    )) {
      const key = `${table}.${col[1].toLowerCase()}`
      if (!declaredColumns.has(key)) declaredColumns.set(key, file)
    }
  }
}

console.log(`Migraciones revisadas: ${files.length} archivos (${files[0]} … ${files[files.length - 1]})`)
console.log(`Declaran ${declaredTables.size} tablas y ${declaredColumns.size} columnas añadidas.`)
console.log(`Base conectada: ${String(env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^https:\/\//, "")}\n`)

// ── 2. Preguntarle a la base
const MISSING_TABLE = "42p01"
const MISSING_COLUMN = "42703"

const faltanTablas = []
const faltanColumnas = []
let tablasOk = 0
let columnasOk = 0

for (const [table, file] of declaredTables) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1)
  if (error && String(error.code || "").toLowerCase() === MISSING_TABLE) {
    faltanTablas.push({ table, file })
  } else {
    tablasOk += 1
  }
}

for (const [key, file] of declaredColumns) {
  const [table, column] = key.split(".")
  // Si la tabla entera falta, no cuentes también sus columnas (ruido).
  if (faltanTablas.some((item) => item.table === table)) continue

  const { error } = await supabase.from(table).select(column, { head: true }).limit(1)
  const code = String(error?.code || "").toLowerCase()
  if (code === MISSING_COLUMN) {
    faltanColumnas.push({ table, column, file })
  } else {
    columnasOk += 1
  }
}

// ── 3. Informe
if (faltanTablas.length === 0 && faltanColumnas.length === 0) {
  console.log(`✓ TODO APLICADO — ${tablasOk} tablas y ${columnasOk} columnas existen en la base.`)
  console.log("  No falta correr ningún .sql en Supabase.")
  process.exit(0)
}

console.log("✗ FALTA APLICAR EN SUPABASE:\n")

const porArchivo = new Map()
for (const item of faltanTablas) {
  if (!porArchivo.has(item.file)) porArchivo.set(item.file, [])
  porArchivo.get(item.file).push(`tabla ${item.table}`)
}
for (const item of faltanColumnas) {
  if (!porArchivo.has(item.file)) porArchivo.set(item.file, [])
  porArchivo.get(item.file).push(`${item.table}.${item.column}`)
}

for (const [file, items] of [...porArchivo.entries()].sort()) {
  console.log(`  ${file}`)
  for (const item of items) console.log(`     · falta ${item}`)
}

console.log(
  `\nResumen: ${faltanTablas.length} tablas y ${faltanColumnas.length} columnas sin aplicar.` +
    `\nAplica esos archivos en el SQL Editor de Supabase, en orden, y vuelve a correr este script.`,
)
process.exit(1)
