// OPTIMIZAR LAS IMÁGENES DEL MENÚ (Parte 1 · punto 5 del plan de consumo).
//
// Qué hace: toma cada imagen del menú (bucket público `menu-images`), la
// convierte a WebP comprimido (máx. 1200 px de ancho) y la sube a una ruta
// NUEVA con caché de 1 año — las rutas llevan timestamp único, así que la
// caché larga jamás sirve una versión vieja. Después apunta los productos a
// la URL nueva (columna `image` Y cualquier aparición dentro del JSONB
// `config`). Los archivos originales NO se tocan ni se borran: revertir es
// restaurar las URLs del respaldo que este script escribe antes de cambiar.
//
// Por qué: las 62 fotos pesan ~11,6 MB en total y salían con max-age=3600
// (el default del bucket): lentitud real en el teléfono del cliente.
//
// Uso:
//   node scripts/optimizar-imagenes-menu.mjs            (simulación, no escribe)
//   node scripts/optimizar-imagenes-menu.mjs --aplicar  (sube y actualiza)
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { supabase } from "./qa-lib.mjs"

const APLICAR = process.argv.includes("--aplicar")
const BUCKET = "menu-images"
const MAX_ANCHO = 1200
const CALIDAD_WEBP = 78
const CACHE_UN_ANO = "31536000"

// ── 1. Leer los productos y juntar todas las URLs del bucket
const { data: rows, error } = await supabase
  .from("menu_products")
  .select("id, branch_id, name, is_active, image, config")

if (error) throw new Error(error.message)

const patronBucket = /https?:\/\/[^"\s]+\/storage\/v1\/object\/public\/menu-images\/[^"\s]+/g

const urlsPorFila = new Map() // fila -> Set<url>
const urlsUnicas = new Set()

for (const row of rows ?? []) {
  const texto = `${String(row.image || "")}\n${JSON.stringify(row.config || {})}`
  const urls = new Set(texto.match(patronBucket) || [])
  if (urls.size) {
    urlsPorFila.set(row, urls)
    for (const url of urls) urlsUnicas.add(url)
  }
}

console.log(`Productos: ${rows?.length ?? 0} filas · con imagen del bucket: ${urlsPorFila.size}`)
console.log(`URLs únicas a optimizar: ${urlsUnicas.size}\n`)

// ── 2. Convertir y (si aplica) subir cada imagen única
const nuevaPorVieja = new Map()
let bytesAntes = 0
let bytesDespues = 0
let saltadas = 0

for (const url of urlsUnicas) {
  const ruta = decodeURIComponent(url.split("/object/public/menu-images/")[1] || "")
  const base = ruta.split("/").pop() || "imagen"

  // Ya optimizada por una corrida anterior: no se reprocesa.
  if (ruta.startsWith("products/opt/")) {
    saltadas += 1
    continue
  }

  const res = await fetch(url)
  if (!res.ok) {
    console.log(`  ✗ no se pudo bajar (${res.status}): ${base}`)
    continue
  }
  const original = Buffer.from(await res.arrayBuffer())

  let webp
  try {
    webp = await sharp(original)
      .rotate() // respeta la orientación EXIF antes de descartar metadatos
      .resize({ width: MAX_ANCHO, withoutEnlargement: true })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer()
  } catch (e) {
    console.log(`  ✗ sharp no pudo con ${base}: ${e.message}`)
    continue
  }

  // Si el WebP no gana, se resube el original tal cual (la caché larga sigue
  // valiendo la pena); conserva su extensión para no mentir en el nombre.
  const gana = webp.length < original.length
  const cuerpo = gana ? webp : original
  const contentType = gana ? "image/webp" : res.headers.get("content-type") || "image/jpeg"
  const nombre = gana ? `${base.replace(/\.[a-z0-9]+$/i, "")}.webp` : base
  const rutaNueva = `products/opt/${nombre}`

  bytesAntes += original.length
  bytesDespues += cuerpo.length

  const detalle = `${(original.length / 1024).toFixed(0)} KB → ${(cuerpo.length / 1024).toFixed(0)} KB${gana ? "" : " (se quedó el original)"}`

  if (!APLICAR) {
    console.log(`  · ${base}: ${detalle}`)
    continue
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(rutaNueva, cuerpo, {
      contentType,
      upsert: true,
      cacheControl: CACHE_UN_ANO,
    })

  if (uploadError) {
    console.log(`  ✗ no se pudo subir ${nombre}: ${uploadError.message}`)
    continue
  }

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(rutaNueva)
  if (!publica?.publicUrl) {
    console.log(`  ✗ sin URL pública para ${nombre}`)
    continue
  }

  nuevaPorVieja.set(url, publica.publicUrl)
  console.log(`  ✓ ${base}: ${detalle}`)
}

console.log(
  `\nTotal: ${(bytesAntes / 1024 / 1024).toFixed(1)} MB → ${(bytesDespues / 1024 / 1024).toFixed(1)} MB` +
    (saltadas ? ` · ${saltadas} ya optimizadas` : ""),
)

if (!APLICAR) {
  console.log("\nSimulación: nada se subió ni se cambió. Corre con --aplicar para ejecutar.")
  process.exit(0)
}

// ── 3. Respaldo ANTES de tocar las filas (revertir = restaurar estas URLs)
const respaldo = []
for (const [row, urls] of urlsPorFila) {
  for (const url of urls) {
    if (nuevaPorVieja.has(url)) {
      respaldo.push({
        id: row.id,
        branch_id: row.branch_id,
        name: row.name,
        vieja: url,
        nueva: nuevaPorVieja.get(url),
      })
    }
  }
}
const rutaRespaldo = join(
  process.cwd(),
  `respaldo-imagenes-menu-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
)
writeFileSync(rutaRespaldo, JSON.stringify(respaldo, null, 2))
console.log(`\nRespaldo de URLs: ${rutaRespaldo}`)

// ── 4. Apuntar los productos a las URLs nuevas (image + config, por texto:
// las URLs son cadenas únicas sin comillas, el reemplazo es exacto)
let filasActualizadas = 0
for (const [row, urls] of urlsPorFila) {
  let image = String(row.image || "")
  let configTexto = JSON.stringify(row.config ?? {})
  let cambio = false

  for (const url of urls) {
    const nueva = nuevaPorVieja.get(url)
    if (!nueva) continue
    if (image.includes(url)) {
      image = image.split(url).join(nueva)
      cambio = true
    }
    if (configTexto.includes(url)) {
      configTexto = configTexto.split(url).join(nueva)
      cambio = true
    }
  }

  if (!cambio) continue

  const { error: updateError } = await supabase
    .from("menu_products")
    .update({ image, config: JSON.parse(configTexto) })
    .eq("id", row.id)
    .eq("branch_id", row.branch_id)

  if (updateError) {
    console.log(`  ✗ fila ${row.id} (${row.name}): ${updateError.message}`)
  } else {
    filasActualizadas += 1
  }
}

console.log(`Filas de productos actualizadas: ${filasActualizadas}`)
console.log("Los archivos originales quedan intactos en el bucket (red de seguridad).")
