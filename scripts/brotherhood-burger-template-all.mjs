// Aplica la ESTRUCTURA de la plantilla (grupo "Escoge tu proteína" + extras +
// custom fries) a TODAS las hamburguesas ACTIVAS del menú, en ambas sedes, SIN
// tocar el precio base de ninguna (pedido del dueño 2026-07-22, lote v3).
//
// Objetivo: que el dueño solo tenga que editar precios/deltas en Menú avanzado.
// Los deltas de proteína arrancan en 0 (no hay dato mejor); las custom fries en
// 0; los extras traen un precio sugerido de arranque que el dueño puede ajustar.
//
// SEGURO Y ADITIVO (no destruye lo que ya exista):
//  - Si la hamburguesa YA tiene el grupo "Escoge tu proteína", se salta (idempotente).
//  - Conserva variations/addons/ingredientes existentes; solo AGREGA lo que falte.
//  - No cambia `price` (precio base). Marca product_type "buildable" para que se
//    vean las opciones.
//  - Los 5 modelos borrador (AMERICANAS, SWEETIES, UNCLE HAZE, CHAMPIE'S,
//    PARRILLERAS) se dejan como están (además suelen estar inactivos).
//
// Uso:  node --env-file=.env.local scripts/brotherhood-burger-template-all.mjs
//   Añade  --dry  para solo listar qué tocaría, sin escribir nada.

import { createClient } from "@supabase/supabase-js"

const DRY_RUN = process.argv.includes("--dry")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const PROTEIN_GROUP_NAME = "Escoge tu proteína"
const CUSTOM_FRIES_GROUP_NAME = "Custom fries (para acompañar)"

// Nombres de los 5 borradores: se dejan intactos aunque estuvieran activos.
const DRAFT_NAMES = new Set(
  ["AMERICANAS", "SWEETIES", "UNCLE HAZE", "CHAMPIE'S", "PARRILLERAS"].map((n) =>
    normalize(n),
  ),
)

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

// ¿La categoría es de hamburguesas? (HAMBURGUESAS, "Smash burgers", etc.)
function isBurgerCategory(category) {
  const c = normalize(category)
  return c.includes("hamburgues") || c.includes("burger")
}

const PROTEINS = [
  { name: "Smash patty", description: "Carne smash fina y dorada a la plancha" },
  { name: "Big patty", description: "Carne de res 220 g jugosa" },
  { name: "Lil chicken", description: "Pollo a la plancha 180 g" },
  { name: "Chicken crispy", description: "Pollo crujiente empanizado" },
  { name: "Veggie patty", description: "Medallón de vegetales" },
].map((protein, index) => ({
  ...protein,
  priceDelta: 0, // sin dato mejor: el dueño ajusta en Menú avanzado
  isActive: true,
  sortOrder: index + 1,
}))

const CUSTOM_FRIES = ["Cheddar bacon", "Cheddar wurst", "Cheddar jalapeño"].map(
  (name, index) => ({
    name,
    description: "Papas custom para acompañar",
    priceDelta: 0, // el dueño le pone el precio si aplica
    isActive: true,
    sortOrder: index + 1,
  }),
)

const EXTRAS = [
  { name: "Tocineta", price: 1.5, maxQuantity: 2 },
  { name: "Chorizo", price: 1.5, maxQuantity: 2 },
  { name: "Queso americano", price: 1, maxQuantity: 2 },
  { name: "Ensalada clásica", price: 1, maxQuantity: 1 },
  { name: "Champiñón", price: 1.5, maxQuantity: 2 },
  { name: "Pepinillos", price: 0.5, maxQuantity: 1 },
  { name: "Cebolla caramelizada", price: 1, maxQuantity: 1 },
  { name: "Cebolla asada", price: 1, maxQuantity: 1 },
  { name: "Salsa SPAY (picante medio)", price: 1, maxQuantity: 1 },
  { name: "Cheddar crema", price: 1.5, maxQuantity: 2 },
  { name: "Papas fritas", price: 3, maxQuantity: 1 },
].map((extra, index) => ({ ...extra, isActive: true, sortOrder: index + 1 }))

function proteinGroup() {
  return {
    name: PROTEIN_GROUP_NAME,
    type: "single",
    required: true,
    minSelections: 1,
    maxSelections: 1,
    values: PROTEINS,
  }
}

function customFriesGroup() {
  return {
    name: CUSTOM_FRIES_GROUP_NAME,
    type: "single",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    values: CUSTOM_FRIES,
  }
}

// Fusiona la plantilla en el config existente sin pisar lo que ya haya.
function applyTemplate(config) {
  const base = config && typeof config === "object" ? { ...config } : {}
  const variations = Array.isArray(base.variations) ? [...base.variations] : []
  const addons = Array.isArray(base.addons) ? [...base.addons] : []

  const hasGroup = (name) =>
    variations.some((group) => normalize(group?.name) === normalize(name))

  // Proteína primero (grupo obligatorio), luego custom fries.
  if (!hasGroup(PROTEIN_GROUP_NAME)) variations.unshift(proteinGroup())
  if (!hasGroup(CUSTOM_FRIES_GROUP_NAME)) variations.push(customFriesGroup())

  // Extras: agrega solo los que falten por nombre (no duplica ni pisa precios
  // que el dueño ya haya puesto).
  const existingAddonNames = new Set(addons.map((addon) => normalize(addon?.name)))
  let nextSort = addons.length
  for (const extra of EXTRAS) {
    if (existingAddonNames.has(normalize(extra.name))) continue
    addons.push({
      name: extra.name,
      price: extra.price,
      isActive: true,
      sortOrder: (nextSort += 1),
      maxQuantity: extra.maxQuantity,
    })
  }

  return {
    ...base,
    variations,
    addons,
    includedIngredients: Array.isArray(base.includedIngredients)
      ? base.includedIngredients
      : [],
    removableIngredients: Array.isArray(base.removableIngredients)
      ? base.removableIngredients
      : [],
    inventoryDiscountEnabled: base.inventoryDiscountEnabled !== false,
  }
}

async function main() {
  const { data: products, error } = await supabase
    .from("menu_products")
    .select("id,name,category,price,product_type,is_active,branch_id,config")
    .eq("is_active", true)

  if (error) throw new Error(error.message)

  const burgers = (products || []).filter(
    (p) => isBurgerCategory(p.category) && !DRAFT_NAMES.has(normalize(p.name)),
  )

  console.log(
    `Hamburguesas activas detectadas: ${burgers.length}${DRY_RUN ? " (DRY RUN, sin escribir)" : ""}`,
  )

  let updated = 0
  let skipped = 0

  for (const product of burgers) {
    const config = product.config && typeof product.config === "object" ? product.config : {}
    const alreadyTemplated = (config.variations || []).some(
      (group) => normalize(group?.name) === normalize(PROTEIN_GROUP_NAME),
    )

    if (alreadyTemplated) {
      skipped += 1
      console.log(`= ${product.name} (${product.category}) ya tiene proteína, sin cambios`)
      continue
    }

    const nextConfig = applyTemplate(config)

    if (DRY_RUN) {
      updated += 1
      console.log(`~ ${product.name} (${product.category}) — se aplicaría plantilla (base $${product.price} intacto)`)
      continue
    }

    const { error: updateError } = await supabase
      .from("menu_products")
      .update({ product_type: "buildable", config: nextConfig })
      .eq("id", product.id)

    if (updateError) {
      console.error(`ERROR en ${product.name}:`, updateError.message)
      continue
    }

    updated += 1
    console.log(`+ ${product.name} (${product.category}) — plantilla aplicada (base $${product.price} intacto)`)
  }

  console.log(
    `Listo: ${updated} hamburguesa(s) ${DRY_RUN ? "a actualizar" : "actualizadas"}, ${skipped} ya tenían la estructura.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
