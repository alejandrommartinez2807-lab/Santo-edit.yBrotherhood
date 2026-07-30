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

  // Columnas añadidas a VARIAS tablas dentro de un bucle PL/pgSQL
  // (`foreach t in array tables loop … execute format('alter table %I add
  // column …', t)`). El patrón de arriba NO las ve: ahí el nombre de la tabla
  // es un `%I`, no un literal.
  //
  // No es teórico: por este hueco este script cantó "TODO APLICADO" sobre una
  // base a la que le faltaba `branch_id` en las tres tablas de inventario, y
  // los reportes se caían con un 500 sin cuerpo (2026-07-30). Justo la columna
  // que sostiene el aislamiento entre sedes, y en el único script que responde
  // "¿me falta correr algún .sql antes de entregar?".
  for (const block of clean.matchAll(/do\s+\$\$([\s\S]*?)\$\$/gi)) {
    const body = block[1] || ""
    const arrayMatch = body.match(/array\s*\[([^\]]+)\]/i)
    if (!arrayMatch) continue

    // Solo se expanden los nombres que YA son tablas declaradas: así un arreglo
    // de textos cualquiera no fabrica comprobaciones inventadas.
    const loopTables = [...arrayMatch[1].matchAll(/'([a-z0-9_]+)'/g)]
      .map((m) => m[1].toLowerCase())
      .filter((name) => declaredTables.has(name))
    if (!loopTables.length) continue

    for (const col of body.matchAll(
      /add\s+column\s+(?:if\s+not\s+exists\s+)?["']?([a-z0-9_]+)["']?/gi,
    )) {
      for (const table of loopTables) {
        const key = `${table}.${col[1].toLowerCase()}`
        if (!declaredColumns.has(key)) declaredColumns.set(key, file)
      }
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
const erroresRaros = []
let tablasOk = 0
let columnasOk = 0

for (const [table, file] of declaredTables) {
  const { error } = await supabase.from(table).select("*", { count: "exact" }).limit(1)
  const code = String(error?.code || "").toLowerCase()
  if (code === MISSING_TABLE) {
    faltanTablas.push({ table, file })
  } else if (error) {
    // Fallar en ABIERTO era el problema: cualquier error que no fuera el
    // esperado se contaba como "existe". Ahora se dice en voz alta.
    erroresRaros.push({ what: table, file, message: error.message })
  } else {
    tablasOk += 1
  }
}

for (const [key, file] of declaredColumns) {
  const [table, column] = key.split(".")
  // Si la tabla entera falta, no cuentes también sus columnas (ruido).
  if (faltanTablas.some((item) => item.table === table)) continue

  // SIN `head: true`. Con HEAD, PostgREST no devuelve cuerpo y una columna
  // inexistente responde SIN error: la sonda daba por buena una columna que no
  // existe. Comprobado el 2026-07-30 contra una base a la que le faltaba
  // `branch_id` en las 3 tablas de inventario — este script decía "TODO
  // APLICADO" mientras los reportes se caían con un 500.
  const { error } = await supabase.from(table).select(column).limit(1)
  const code = String(error?.code || "").toLowerCase()
  if (code === MISSING_COLUMN) {
    faltanColumnas.push({ table, column, file })
  } else if (error) {
    erroresRaros.push({ what: `${table}.${column}`, file, message: error.message })
  } else {
    columnasOk += 1
  }
}

// ── 3. Informe
if (erroresRaros.length) {
  console.log("⚠ No se pudo comprobar todo (esto NO es un 'todo aplicado'):\n")
  for (const item of erroresRaros.slice(0, 15)) {
    console.log(`  · ${item.what} — ${item.message}`)
  }
  if (erroresRaros.length > 15) console.log(`  … y ${erroresRaros.length - 15} más`)
  console.log("")
}

if (faltanTablas.length === 0 && faltanColumnas.length === 0 && erroresRaros.length === 0) {
  console.log(`✓ TODO APLICADO — ${tablasOk} tablas y ${columnasOk} columnas existen en la base.`)
  console.log("  No falta correr ningún .sql en Supabase.")
  process.exit(0)
}

if (faltanTablas.length === 0 && faltanColumnas.length === 0) {
  console.log("✗ Sin faltantes confirmados, pero quedaron comprobaciones sin respuesta (arriba).")
  process.exit(1)
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
