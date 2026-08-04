// QA · ¿ESTÁN APLICADAS TODAS LAS MIGRACIONES EN ESTA BASE?
//
// El fitness test `dbColumnsExist` compara el CÓDIGO con los ARCHIVOS .sql:
// dice si escribimos la migración, no si alguien la aplicó. Este script
// pregunta a la BASE DE DATOS conectada, tabla por tabla y columna por
// columna, si lo que declaran las migraciones existe de verdad.
//
// Sirve para responder de una vez "¿me falta correr algún .sql en Supabase?"
// antes de entregar el sistema. Casi todo es lectura; la ÚNICA excepción son
// las dos sondas de triggers del final: un trigger solo se puede probar por
// comportamiento, así que reescriben UNA fila con su propio valor, protegidas
// con compare-and-swap (si la fila cambió bajo la sonda, no se escribe nada).
// El único rastro que dejan es el updated_at del pedido sondeado — lo que a
// los paneles les cuesta, como mucho, una lectura completa extra.
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

// Migraciones que este script NO puede comprobar: las que no crean tablas ni
// añaden columnas (cambios de TIPO con `alter column`, índices, políticas RLS,
// funciones, triggers, backfills). Su existencia no se puede deducir mirando si
// una columna responde.
//
// Sin esto el informe cantaba "TODO APLICADO · no falta correr ningún .sql"
// aunque faltara, por ejemplo, la 0028 —una línea que cambia el tipo de
// order_items.product_id a bigint— y con ella rota la creación de pedidos con
// cualquier producto del editor. El único instrumento que responde "¿me falta
// algo antes de entregar?" daba falso verde justo en lo que cuesta dinero
// (auditoría 2026-08-02).
const archivosVerificados = new Set([
  ...declaredTables.values(),
  ...declaredColumns.values(),
])

// ── Triggers que NO se pueden deducir mirando columnas, pero de los que
// depende que el panel muestre datos frescos. Se comprueban por COMPORTAMIENTO
// (es lo único que prueba que el trigger está vivo, no solo declarado):
// se toca una fila y se mira si `orders.updated_at` se movió.
//
// Por qué importa: la optimización de consumo responde "nada cambió" mirando
// `updated_at`. Si estos triggers faltan o quedan deshabilitados, el panel se
// congela SIN dar ningún error — el peor tipo de fallo. (2026-08-04.)
// Ambas sondas escriben con COMPARE-AND-SWAP: el UPDATE lleva en el WHERE el
// valor recién leído, así que si la operación real del local tocó esa fila en
// los milisegundos intermedios, el UPDATE no alcanza ninguna fila y NO puede
// revertir un cambio legítimo (revisión adversarial 2026-08-04: sin el guard,
// la sonda podía devolver un pedido de 'Listo' a 'Preparando' en silencio).
// Si la fila cambió bajo la sonda, se reintenta con una muestra fresca.
const INTENTOS_SONDA = 3

async function comprobarTriggersDeFrescura() {
  for (let intento = 0; intento < INTENTOS_SONDA; intento += 1) {
    // Se selecciona TAMBIÉN sort_order: sin él, el update de abajo escribía un
    // 0 real en una línea cuyo sort_order no fuera 0 (la sonda que promete
    // "sin efecto real" mutando datos de producción, 2026-08-04).
    const { data: muestra } = await supabase
      .from("order_items")
      .select("id, order_id, sort_order")
      .limit(1)

    if (!muestra?.length) {
      return { estado: "sin-datos", detalle: "no hay pedidos con líneas para probarlo" }
    }

    const { id: itemId, order_id: orderId, sort_order: sortOrder } = muestra[0]
    const leer = async () =>
      (await supabase.from("orders").select("updated_at").eq("id", orderId).maybeSingle())
        .data?.updated_at

    const antes = await leer()
    // Escritura sin efecto real: se reescribe la línea con su propio valor.
    // Postgres dispara el trigger igual, así que basta para saber si está vivo.
    const { data: tocadas, error } = await supabase
      .from("order_items")
      .update({ sort_order: sortOrder })
      .eq("id", itemId)
      .eq("sort_order", sortOrder)
      .select("id")

    if (error) return { estado: "error", detalle: error.message }
    // La línea cambió (o desapareció) entre la lectura y la escritura: nada se
    // escribió. Muestra fresca y de nuevo.
    if (!tocadas?.length) continue

    const despues = await leer()
    return antes !== despues
      ? { estado: "ok", detalle: "tocar una línea marca su pedido" }
      : {
          estado: "falta",
          detalle:
            "tocar order_items NO movió orders.updated_at — falta 0038 o está deshabilitado",
        }
  }

  return {
    estado: "carrera",
    detalle: `la línea cambió bajo la sonda ${INTENTOS_SONDA} veces (base en plena escritura); vuelve a correr`,
  }
}

// La sonda de 0038 NO prueba este otro: touch_order_from_items estampa
// updated_at DIRECTO, así que pasaría aunque trg_orders_updated (0001) hubiera
// desaparecido. Y la huella depende de los DOS: cambiar el estado de un pedido
// (cobrar, marcar listo) solo toca la fila de `orders`.
async function comprobarTriggerDelPedido() {
  for (let intento = 0; intento < INTENTOS_SONDA; intento += 1) {
    const { data: muestra } = await supabase
      .from("orders")
      .select("id, status, updated_at")
      .limit(1)

    if (!muestra?.length) {
      return { estado: "sin-datos", detalle: "no hay pedidos para probarlo" }
    }

    const { id, status, updated_at: antes } = muestra[0]
    // Reescritura del pedido con su propio valor: dispara el BEFORE UPDATE
    // (único trigger de UPDATE en orders junto con el estampado) sin cambiar
    // nada. El .eq("status", ...) es el compare-and-swap: si caja o cocina
    // movieron el pedido entre la lectura y esta línea, no se escribe nada.
    const { data: tocadas, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .eq("status", status)
      .select("id")

    if (error) return { estado: "error", detalle: error.message }
    if (!tocadas?.length) continue

    const despues = (
      await supabase.from("orders").select("updated_at").eq("id", id).maybeSingle()
    ).data?.updated_at

    return antes !== despues
      ? { estado: "ok", detalle: "reescribir el pedido lo marca" }
      : {
          estado: "falta",
          detalle:
            "reescribir orders NO movió updated_at — falta trg_orders_updated (0001) o está deshabilitado",
        }
  }

  return {
    estado: "carrera",
    detalle: `el pedido cambió bajo la sonda ${INTENTOS_SONDA} veces (base en plena escritura); vuelve a correr`,
  }
}

const triggerFrescura = await comprobarTriggersDeFrescura()
console.log(
  `${triggerFrescura.estado === "ok" ? "✓" : triggerFrescura.estado === "falta" ? "✗" : "⚠"}` +
    ` Trigger de frescura (0038) — ${triggerFrescura.detalle}`,
)
const triggerPedido = await comprobarTriggerDelPedido()
console.log(
  `${triggerPedido.estado === "ok" ? "✓" : triggerPedido.estado === "falta" ? "✗" : "⚠"}` +
    ` Trigger de frescura (0001) — ${triggerPedido.detalle}`,
)
console.log("")

const noVerificables = files
  .filter((file) => !archivosVerificados.has(file))
  // 0038 sí se acaba de comprobar, por comportamiento.
  .filter((file) => !(triggerFrescura.estado === "ok" && file.includes("0038")))

if (triggerFrescura.estado === "falta") {
  console.log("✗ FALTA el trigger de 0038_order_items_touch_order.sql.")
  console.log("  Sin él, marcar un producto entregado no marca su pedido: la")
  console.log("  optimización que responde 'nada cambió' se volvería CIEGA a eso")
  console.log("  y el panel se congelaría sin avisar. Aplícalo antes de seguir.")
  process.exit(1)
}

if (triggerPedido.estado === "falta") {
  console.log("✗ FALTA trg_orders_updated (0001_initial_schema.sql).")
  console.log("  Sin él, cobrar o cambiar el estado de un pedido no mueve su")
  console.log("  updated_at: la huella que responde 'nada cambió' se congelaría")
  console.log("  sin avisar. Restáuralo antes de seguir:")
  console.log("    create trigger trg_orders_updated before update on orders")
  console.log("      for each row execute function set_updated_at();")
  process.exit(1)
}

if (faltanTablas.length === 0 && faltanColumnas.length === 0 && erroresRaros.length === 0) {
  console.log(`✓ Tablas y columnas OK — ${tablasOk} tablas y ${columnasOk} columnas existen en la base.`)

  if (noVerificables.length) {
    console.log("")
    console.log(`⚠ NO es un "todo aplicado": ${noVerificables.length} migración(es) no se pueden`)
    console.log("  comprobar por este medio (cambian tipos, crean índices, RLS o funciones).")
    console.log("  Confírmalas a mano en el SQL Editor de Supabase:\n")
    for (const file of noVerificables) console.log(`  · ${file}`)
    console.log("")
    console.log("  Atajo seguro: pega supabase/BROTHERHOOD-SETUP.sql entero (es idempotente,")
    console.log("  correrlo de nuevo no rompe ni duplica nada).")
    process.exit(1)
  }

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
