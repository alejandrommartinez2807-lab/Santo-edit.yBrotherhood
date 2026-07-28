// Plantilla ARMABLE v2 para TODAS las hamburguesas (pedido del dueño 2026-07-28).
//
// Orden del personalizador que pidió el dueño:
//   1) Tipo de hamburguesa  ← NUEVO: los 5 estilos de la casa (la lista que él
//      mismo armó a mano en BOMBASTYC: Americanas, Sweeties, Uncle haze,
//      Champie's, Parrilleras), opcional, delta $0 (él ajusta).
//   2) Escoge tu proteína
//   3) Adicionales con costo
//   4) Custom fries (para acompañar) — de ÚLTIMO (lo pinta así ProductCard).
//
// Alcance: hamburguesas ACTIVAS de ambas sedes.
//   - Categorías con "burger/hamburgues" + BROTHERHOOD BASIC, NUEVAS SMASH,
//     SOLO BIGGIES, VEGGIES, MENU KIDS y LA FAVORITA DE LA SEMANA.
//   - EXCLUIDOS: ANTOJOS (papas/snacks), REFRESCOS, EPA BRO (promos de varias
//     burgers: un armador de UNA burger no les aplica) y los 5 borradores.
//
// SEGURO, ADITIVO E IDEMPOTENTE:
//   - No toca `price` base ni pisa precios/valores que el dueño ya editó.
//   - Solo AGREGA los grupos/extras que falten y reordena los grupos.
//   - Correr dos veces no duplica nada.
//
// Uso:  node scripts/brotherhood-burger-armable-v2.mjs [--dry]
import { supabase } from "./qa-lib.mjs"

const DRY_RUN = process.argv.includes("--dry")

const TIPO_GROUP_NAME = "Escoge tu tipo de hamburguesa"
const PROTEIN_GROUP_NAME = "Escoge tu proteína"
const CUSTOM_FRIES_GROUP_NAME = "Custom fries (para acompañar)"

const BURGER_TYPES = ["Americanas", "Sweeties", "Uncle haze", "Champie's", "Parrilleras"]
const PROTEINS = ["Smash patty", "Big patty", "Lil chicken", "Chicken crispy", "Veggie patty"]
const CUSTOM_FRIES = ["Cheddar bacon", "Cheddar wurst", "Cheddar jalapeño"]
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
]

const EXTRA_BURGER_CATEGORIES = new Set(
  [
    "BROTHERHOOD BASIC",
    "NUEVAS SMASH",
    "SOLO BIGGIES",
    "VEGGIES",
    "MENU KIDS",
    "LA FAVORITA DE LA SEMANA",
  ].map((c) => normalize(c)),
)

const DRAFT_NAMES = new Set(
  ["AMERICANAS", "SWEETIES", "UNCLE HAZE", "CHAMPIE'S", "PARRILLERAS"].map(normalize),
)

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

function isBurgerCategory(category) {
  const c = normalize(category)
  if (c.includes("hamburgues") || c.includes("burger")) return true
  return EXTRA_BURGER_CATEGORIES.has(c)
}

const asValues = (names) =>
  names.map((name, index) => ({
    name,
    priceDelta: 0,
    isActive: true,
    sortOrder: index + 1,
  }))

// Obligatorio desde el 2026-07-28 (pedido del dueño): el cliente elige el
// estilo antes de nada.
const tipoGroup = () => ({
  name: TIPO_GROUP_NAME,
  type: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  values: asValues(BURGER_TYPES),
})

const proteinGroup = () => ({
  name: PROTEIN_GROUP_NAME,
  type: "single",
  required: true,
  minSelections: 1,
  maxSelections: 1,
  values: asValues(PROTEINS),
})

const customFriesGroup = () => ({
  name: CUSTOM_FRIES_GROUP_NAME,
  type: "single",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  values: asValues(CUSTOM_FRIES),
})

// Rango de orden (espejo de ProductCard.variationGroupRank): tipo 0,
// proteína 1, resto 2, custom fries 3.
function groupRank(name) {
  const key = normalize(name)
  if (/\btipo\b/.test(key)) return 0
  if (key.includes("proteina")) return 1
  if (/custom fries|papas custom|\bfries\b/.test(key)) return 3
  return 2
}

// Fusión aditiva + reorden. Devuelve { config, changes: [] } — changes vacío
// significa "nada que hacer".
function applyTemplate(config) {
  const base = config && typeof config === "object" ? { ...config } : {}
  let variations = Array.isArray(base.variations) ? [...base.variations] : []
  const addons = Array.isArray(base.addons) ? [...base.addons] : []
  const changes = []

  const hasGroup = (rank) => variations.some((group) => groupRank(group?.name) === rank)

  if (!hasGroup(0)) {
    variations.push(tipoGroup())
    changes.push("+tipo")
  } else {
    // El grupo tipo ya existe: asegúrate de que sea OBLIGATORIO (2026-07-28).
    variations = variations.map((group) => {
      if (groupRank(group?.name) !== 0 || group?.required === true) return group
      changes.push("tipo→obligatorio")
      return { ...group, required: true, minSelections: 1, maxSelections: group?.maxSelections || 1 }
    })
  }
  if (!hasGroup(1)) {
    variations.push(proteinGroup())
    changes.push("+proteína")
  }
  if (!hasGroup(3)) {
    variations.push(customFriesGroup())
    changes.push("+custom fries")
  }

  const ordered = variations
    .map((group, index) => ({ group, index }))
    .sort((a, b) => groupRank(a.group?.name) - groupRank(b.group?.name) || a.index - b.index)
    .map((entry, index) => ({ ...entry.group, sortOrder: index + 1 }))
  if (JSON.stringify(ordered.map((g) => g.name)) !== JSON.stringify(variations.map((g) => g.name))) {
    changes.push("reorden")
  }
  variations = ordered

  const existingAddons = new Set(addons.map((addon) => normalize(addon?.name)))
  let added = 0
  let nextSort = addons.length
  for (const extra of EXTRAS) {
    if (existingAddons.has(normalize(extra.name))) continue
    addons.push({ ...extra, isActive: true, sortOrder: (nextSort += 1) })
    added += 1
  }
  if (added) changes.push(`+${added} extras`)

  return {
    config: {
      ...base,
      variations,
      addons,
      includedIngredients: Array.isArray(base.includedIngredients) ? base.includedIngredients : [],
      removableIngredients: Array.isArray(base.removableIngredients) ? base.removableIngredients : [],
      inventoryDiscountEnabled: base.inventoryDiscountEnabled !== false,
    },
    changes,
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
    `Hamburguesas activas detectadas: ${burgers.length} (ambas sedes)${DRY_RUN ? " · DRY RUN" : ""}\n`,
  )

  let updated = 0
  let untouched = 0

  for (const product of burgers) {
    const { config, changes } = applyTemplate(product.config)
    const needsType = product.product_type !== "buildable"
    if (!changes.length && !needsType) {
      untouched += 1
      continue
    }

    const label = `${product.name} [${product.category}] (${String(product.branch_id).slice(0, 8)})`
    if (DRY_RUN) {
      updated += 1
      console.log(`~ ${label} — ${[...changes, needsType ? "buildable" : ""].filter(Boolean).join(", ")}`)
      continue
    }

    const { error: updateError } = await supabase
      .from("menu_products")
      .update({ product_type: "buildable", config })
      .eq("id", product.id)
      .eq("branch_id", product.branch_id)

    if (updateError) {
      console.error(`ERROR en ${label}: ${updateError.message}`)
      continue
    }
    updated += 1
    console.log(`+ ${label} — ${[...changes, needsType ? "buildable" : ""].filter(Boolean).join(", ")} (base $${product.price} intacto)`)
  }

  console.log(
    `\nListo: ${updated} ${DRY_RUN ? "por actualizar" : "actualizadas"} · ${untouched} ya estaban completas.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
