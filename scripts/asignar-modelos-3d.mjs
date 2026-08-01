// Engancha los modelos 3D de public/modelos/ a productos reales del menú.
//
//   node scripts/asignar-modelos-3d.mjs            → solo MUESTRA qué haría
//   node scripts/asignar-modelos-3d.mjs --aplicar  → escribe en la base
//   node scripts/asignar-modelos-3d.mjs --quitar   → deshace (deja los campos vacíos)
//
// Escribe SOLO las dos claves del modelo dentro del JSONB `config`, leyendo y
// re-guardando el resto tal cual. Nunca reemplaza `config` entero: ahí viven
// variaciones, combos, IVA y reglas del producto.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const APLICAR = process.argv.includes("--aplicar")
const QUITAR = process.argv.includes("--quitar")

// Qué modelo va con qué producto, por nombre exacto. Nada de expresiones
// amplias: un modelo que no se parece al plato real es peor que no tener 3D
// (a "EL BARCO + REFRESCO", que es un combo, no le va un vaso de gaseosa).
// El nombre agarra las filas de TODAS las sedes, que es lo que se quiere.
const REGLAS = [
  {
    modelo: "hamburguesa",
    nombres: ["BOMBASTYC", "AMERICAN CLASSIC", "THE MONSTERHOOD"],
  },
  {
    modelo: "papas",
    nombres: ["PAPAS AMERICANAS", "FRENCH FRIES PARTY"],
  },
  {
    // Las bebidas del menú son latas y botellas, no vasos de máquina: por eso
    // va el modelo de lata y no el de vaso.
    modelo: "lata",
    nombres: ["Coca-Cola lata 355ml"],
  },
]

function loadEnvFile() {
  const text = readFileSync(".env.local", "utf8")
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=")
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ""),
        ]
      }),
  )
}

const env = loadEnvFile()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: productos, error } = await supabase
  .from("menu_products")
  .select("id, name, category, is_active, config")
  .eq("is_active", true)
  .order("sort_order", { ascending: true })

if (error) {
  console.error("No se pudo leer el menú:", error.message)
  process.exit(1)
}

console.log(`${productos.length} productos activos.\n`)

const cambios = []
const yaUsados = new Set()

for (const regla of REGLAS) {
  const buscados = regla.nombres.map((nombre) => nombre.trim().toLowerCase())
  const elegidos = productos.filter(
    (producto) =>
      !yaUsados.has(producto.id) &&
      buscados.includes(String(producto.name || "").trim().toLowerCase()),
  )

  for (const nombre of regla.nombres) {
    const encontrados = elegidos.filter(
      (producto) => producto.name.trim().toLowerCase() === nombre.trim().toLowerCase(),
    ).length
    if (!encontrados) console.log(`  ⚠ "${nombre}" no está en el menú activo — se salta.`)
  }

  for (const producto of elegidos) {
    yaUsados.add(producto.id)
    cambios.push({
      producto,
      glb: QUITAR ? "" : `/modelos/${regla.modelo}.glb`,
      usdz: QUITAR ? "" : `/modelos/${regla.modelo}.usdz`,
      modelo: regla.modelo,
    })
  }
}

if (!cambios.length) {
  console.log("Ningún producto coincidió con las reglas. No hay nada que hacer.")
  process.exit(0)
}

for (const cambio of cambios) {
  const actual = cambio.producto.config?.model3dUrl || "—"
  console.log(
    `  #${String(cambio.producto.id).padEnd(14)} ${cambio.producto.name.padEnd(34)} ` +
      `[${cambio.producto.category}]  ${actual} → ${cambio.glb || "(sin modelo)"}`,
  )
}

if (!APLICAR && !QUITAR) {
  console.log("\nEsto es solo una vista previa. Para escribirlo: --aplicar")
  process.exit(0)
}

console.log(`\n${QUITAR ? "Quitando" : "Aplicando"}...`)

let escritos = 0

for (const cambio of cambios) {
  const configActual =
    cambio.producto.config && typeof cambio.producto.config === "object"
      ? cambio.producto.config
      : {}

  const { error: updateError } = await supabase
    .from("menu_products")
    .update({
      config: { ...configActual, model3dUrl: cambio.glb, model3dIosUrl: cambio.usdz },
    })
    .eq("id", cambio.producto.id)

  if (updateError) {
    console.log(`  ✗ #${cambio.producto.id} ${cambio.producto.name}: ${updateError.message}`)
    continue
  }

  escritos += 1
  console.log(`  ✓ #${cambio.producto.id} ${cambio.producto.name}`)
}

// Relectura: que lo guardado sea de verdad lo que queríamos.
const { data: verificacion } = await supabase
  .from("menu_products")
  .select("id, name, config")
  .in(
    "id",
    cambios.map((cambio) => cambio.producto.id),
  )

let correctos = 0
for (const fila of verificacion || []) {
  const esperado = cambios.find((cambio) => cambio.producto.id === fila.id)
  if ((fila.config?.model3dUrl || "") === esperado.glb) correctos += 1
}

console.log(`\n${escritos} escritos · ${correctos}/${cambios.length} verificados en la base.`)
