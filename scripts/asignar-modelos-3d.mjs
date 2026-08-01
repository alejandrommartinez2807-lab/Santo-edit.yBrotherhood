// Engancha los modelos 3D de public/modelos/ a los productos reales del menú.
//
//   node scripts/asignar-modelos-3d.mjs            → solo MUESTRA qué haría
//   node scripts/asignar-modelos-3d.mjs --aplicar  → escribe en la base
//   node scripts/asignar-modelos-3d.mjs --quitar   → deshace (deja los campos vacíos)
//
// Escribe SOLO las dos claves del modelo dentro del JSONB `config`, leyendo y
// re-guardando el resto tal cual. Nunca reemplaza `config` entero: ahí viven
// variaciones, combos, IVA y reglas del producto.
//
// El mapa va por NOMBRE EXACTO y sale de la descripción real de cada plato
// (tocineta, chorizo, champiñones, jalapeños, cuántas carnes…), no de una
// expresión amplia: un modelo que no se parece al plato es peor que no tener
// 3D. Si aparece un producto nuevo sin modelo, el script lo AVISA en vez de
// inventarle uno.
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const HERE = dirname(fileURLToPath(import.meta.url))
const MODELOS_DIR = resolve(HERE, "..", "public", "modelos")

const APLICAR = process.argv.includes("--aplicar")
const QUITAR = process.argv.includes("--quitar")

// Los marcados con ★ tienen modelo PROPIO: son los 7 más vendidos según
// order_items de producción (77% de las unidades). El resto comparte modelo
// de familia.
const MAPA = {
  // ── ANTOJOS ───────────────────────────────────────────────────────────
  "PAPAS SENCILLAS": "papas",
  "FRENCH FRIES PARTY": "fries-party", // ★ propio · ración de 1 kg
  "PAPAS AMERICANAS": "papas-americanas", // ★ propio
  "HOT-CHEESEFRIES": "papas-cheddar",
  "WURST (cheddar+chorizo)": "papas-cheddar",
  "CHEDDAR BOWL": "cheddar-bowl", // ★ propio · el más vendido
  "HOLY BITES": "bites",
  "HOLY DRAGON´S": "holy-dragons", // ★ propio · bites en reducción de sriracha

  // ── BROTHERHOOD BASIC (smash de 75 g) ─────────────────────────────────
  "AMERICAN O.G SMASH": "burger-smash",
  "AMERICAN BASIC": "american-basic", // ★ propio · pan de batata
  "TIA BASIC": "burger-smash",
  "HOT-SWEET SMASH": "burger-smash-picante", // jalapeños + cebolla caramelizada
  "LIL HAZE !NUEVO¡": "burger-pollo", // pollo mini crispy

  // ── BURGERS DE POLLO 180 GR ───────────────────────────────────────────
  SPAY: "burger-pollo-picante", // reducción de sriracha
  "CHICKEN PARRILLERA": "burger-pollo-chorizo",
  "CHICKEN HAZE": "burger-pollo",
  "CRISPY KILLER": "burger-pollo-clasica",
  "CHICKEN CHAMPI": "burger-pollo-champi",
  "SWEET CHICKEN": "burger-pollo",
  "AMERICAN CHICKEN": "burger-pollo-clasica",
  "POLLO DOJO By Willie Deville": "burger-pollo-picante", // chilli oil

  // ── BURGERS DE RES 220 GR ─────────────────────────────────────────────
  "TIA MAC": "burger-res",
  "SANTØ PECADØ": "burger-res-chorizo",
  "THE CHAMPI": "burger-res-champi",
  "CHEDDAR X PARRILLERA": "burger-res-chorizo",
  "AMERICAN CLASSIC": "burger-res-pepinillo",
  "SWEET BACON": "burger-res-dulce",

  // ── NUEVAS SMASH (doble carne) ────────────────────────────────────────
  "DOBLE SHOOTER": "burger-doble",
  "DOBLE CHAMPI": "burger-doble-champi",
  "SPICY YODA": "burger-doble-picante",
  "SEXY SWEET": "burger-doble-chorizo", // chorizo caramelizado en maple
  "DOBLE SWEETIE": "burger-doble-dulce",
  "TIO BORRACHO By Willie Deville": "burger-doble-gouda",

  // ── SOLO BIGGIES ──────────────────────────────────────────────────────
  "THE MONSTERHOOD": "burger-monster", // 5 carnes, 5 quesos
  "CHAMPTASTYC TRIPLE": "burger-triple",
  "DOUBLE TASTY": "burger-res-doble",
  "DOUBLE CHICKEN BACON": "burger-pollo-doble",
  "DOUBLE TROUBLE": "burger-mixta", // pollo + res en el mismo pan

  // ── VEGGIES · KIDS · FAVORITA ─────────────────────────────────────────
  "TIA VEGGIE !NUEVO¡": "burger-veggie",
  "CHAMPI VEGGIE !NUEVO¡": "burger-veggie",
  "AMERICAN KID": "burger-kids",
  BOMBASTYC: "bombastyc", // ★ propio · burger + holy

  // ── EPA BRO (promos: van con la bandeja completa) ──────────────────────
  "¡PROMO! 2PAC The G.O.A.T": "combo",
  "BIG BANG": "combo",
  "EL BARCO + REFRESCO": "barco", // ★ propio
  "PROMO BIG FAMILY + (Delivery Gratis)": "combo",
  "PROMO PARA DOS PREMIUM + COCA-COLA": "combo",

  // ── REFRESCOS Y TÉ FRÍO ───────────────────────────────────────────────
  "Coca-Cola lata 355ml": "lata",
  "Coca-Cola light": "lata",
  "Chinotto lata 355ml": "lata",
  "Fanta naranja lata 355ml": "lata",
  "Fanta toronja lata 355ml": "lata",
  "Fanta uva lata 355ml": "lata",
  "Frescolita lata 355ml": "lata",
  "Agua gasificada de manzana Nevada 355ml": "lata",
  "COCA COLA 1L": "botella",
  "CHINOTTO 1LT": "botella",
  "Fanta naranja 1LT": "botella",
  "Fanta toronja 1LT": "botella",
  "Fanta uva 1LT": "botella",
  "FRESCOLITA 1LT": "botella",
  "Agua Pura vida 600ml": "botella-agua",
}

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

// Antes de tocar la base: que cada modelo del mapa exista en disco. Guardar la
// URL de un archivo que no está deja al plato con un visor roto en la carta.
const modelosUsados = [...new Set(Object.values(MAPA))]
const faltantes = modelosUsados.filter(
  (modelo) =>
    !existsSync(resolve(MODELOS_DIR, `${modelo}.glb`)) ||
    !existsSync(resolve(MODELOS_DIR, `${modelo}.usdz`)),
)

if (faltantes.length) {
  console.error(`Faltan archivos en public/modelos/: ${faltantes.join(", ")}`)
  console.error("Corre primero: npm run modelos:generar")
  process.exit(1)
}

const env = loadEnvFile()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: productos, error } = await supabase
  .from("menu_products")
  .select("id, name, category, is_active, config")
  .eq("is_active", true)
  .order("category", { ascending: true })

if (error) {
  console.error("No se pudo leer el menú:", error.message)
  process.exit(1)
}

const claves = new Map(
  Object.entries(MAPA).map(([nombre, modelo]) => [nombre.trim().toLowerCase(), modelo]),
)

const cambios = []
const sinModelo = new Set()

for (const producto of productos) {
  const modelo = claves.get(String(producto.name || "").trim().toLowerCase())

  if (!modelo) {
    sinModelo.add(`${producto.name}  [${producto.category}]`)
    continue
  }

  cambios.push({
    producto,
    modelo,
    glb: QUITAR ? "" : `/modelos/${modelo}.glb`,
    usdz: QUITAR ? "" : `/modelos/${modelo}.usdz`,
  })
}

const nombresDistintos = new Set(productos.map((p) => p.name))
console.log(
  `${productos.length} filas activas · ${nombresDistintos.size} productos distintos · ` +
    `${cambios.length} filas con modelo · ${modelosUsados.length} modelos en juego\n`,
)

// Resumen por modelo, que es más legible que 124 líneas sueltas.
const porModelo = new Map()
for (const cambio of cambios) {
  if (!porModelo.has(cambio.modelo)) porModelo.set(cambio.modelo, new Set())
  porModelo.get(cambio.modelo).add(cambio.producto.name)
}

for (const [modelo, nombres] of [...porModelo].sort()) {
  console.log(`  ${modelo.padEnd(24)} ${[...nombres].join(" · ")}`)
}

if (sinModelo.size) {
  console.log(`\n⚠ ${sinModelo.size} producto(s) SIN modelo (no están en el mapa):`)
  for (const nombre of sinModelo) console.log(`   · ${nombre}`)
  console.log("   Agrégalos a MAPA en este archivo si quieren 3D.")
} else {
  console.log("\n✓ Todos los productos activos tienen modelo.")
}

if (!APLICAR && !QUITAR) {
  console.log("\nEsto es solo una vista previa. Para escribirlo: --aplicar")
  process.exit(0)
}

console.log(`\n${QUITAR ? "Quitando" : "Aplicando"} en ${cambios.length} filas...`)

let escritos = 0
let fallidos = 0

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
    fallidos += 1
    console.log(`  ✗ #${cambio.producto.id} ${cambio.producto.name}: ${updateError.message}`)
    continue
  }

  escritos += 1
}

// Relectura: que lo guardado sea de verdad lo que queríamos.
let correctos = 0
const LOTE = 60

for (let i = 0; i < cambios.length; i += LOTE) {
  const lote = cambios.slice(i, i + LOTE)
  const { data: verificacion } = await supabase
    .from("menu_products")
    .select("id, config")
    .in(
      "id",
      lote.map((cambio) => cambio.producto.id),
    )

  for (const fila of verificacion || []) {
    const esperado = lote.find((cambio) => cambio.producto.id === fila.id)
    if ((fila.config?.model3dUrl || "") === esperado.glb) correctos += 1
  }
}

console.log(
  `\n${escritos} escritos${fallidos ? ` · ${fallidos} fallidos` : ""} · ` +
    `${correctos}/${cambios.length} verificados leyendo la base de vuelta.`,
)

process.exit(correctos === cambios.length && !fallidos ? 0 : 1)
