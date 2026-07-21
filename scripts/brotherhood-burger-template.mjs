// Plantilla nueva de hamburguesas de Brotherhood (pedido del dueño 2026-07-21):
// 5 modelos (Americanas, Sweeties, Uncle Haze, Champie's, Parrilleras) en la
// categoría HAMBURGUESAS, cada uno con proteína a elegir + extras + custom fries.
//
// Se crean INACTIVOS (borrador): el dueño revisa precios/textos en
// Menú avanzado y los activa; ahí mismo puede desactivar las categorías viejas.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-burger-template.mjs

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const CATEGORY = "HAMBURGUESAS"

// Proteínas del template (los deltas se calculan por familia).
function proteinValues(deltas) {
  const details = {
    "Smash patty": "Carne smash fina y dorada a la plancha",
    "Big patty": "Carne de res 220 g jugosa",
    "Lil chicken": "Pollo a la plancha 180 g",
    "Chicken crispy": "Pollo crujiente empanizado",
    "Veggie patty": "Medallón de vegetales",
  }

  return Object.entries(details).map(([name, description], index) => ({
    name,
    description,
    priceDelta: deltas[name] ?? 0,
    isActive: true,
    sortOrder: index + 1,
  }))
}

const CUSTOM_FRIES = ["Cheddar bacon", "Cheddar wurst", "Cheddar jalapeño"].map(
  (name, index) => ({
    name,
    description: "Papas custom para acompañar",
    priceDelta: 6,
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

// Familias: precio base = versión smash actual del menú; deltas derivados de
// los precios reales de las líneas res 220gr / pollo 180gr / veggie.
const FAMILIES = [
  {
    name: "AMERICANAS",
    imageFrom: "AMERICAN CLASSIC",
    description:
      "La línea clásica americana: queso americano, pepinillos y salsa de la casa. Escoge tu proteína y ármala a tu manera.",
    basePrice: 7,
    deltas: { "Big patty": 2.5, "Lil chicken": 2.5, "Chicken crispy": 3, "Veggie patty": 4 },
    sortOrder: 10,
  },
  {
    name: "SWEETIES",
    imageFrom: "SWEET BACON",
    description:
      "El toque dulce-salado de la casa: tocineta, cebolla caramelizada y salsa sweet.",
    basePrice: 7,
    deltas: { "Big patty": 2.5, "Lil chicken": 2.5, "Chicken crispy": 3, "Veggie patty": 4 },
    sortOrder: 20,
  },
  {
    name: "UNCLE HAZE",
    imageFrom: "CHICKEN HAZE",
    description:
      "La receta insignia Haze: cheddar crema y sabor ahumado que enamora.",
    basePrice: 7,
    deltas: { "Big patty": 2.5, "Lil chicken": 2.5, "Chicken crispy": 3, "Veggie patty": 4 },
    sortOrder: 30,
  },
  {
    name: "CHAMPIE'S",
    imageFrom: "THE CHAMPI",
    description:
      "Para los fanáticos del champiñón salteado con queso fundente al estilo Champi.",
    basePrice: 9.5,
    deltas: { "Big patty": 1.5, "Lil chicken": 1.5, "Chicken crispy": 2, "Veggie patty": 1.5 },
    sortOrder: 40,
  },
  {
    name: "PARRILLERAS",
    imageFrom: "CHEDDAR X PARRILLERA",
    description:
      "Sabor a parrilla: chorizo, queso y salsa BBQ ahumada, directo del grill.",
    basePrice: 10,
    deltas: { "Big patty": 2.5, "Lil chicken": 2.5, "Chicken crispy": 3, "Veggie patty": 2.5 },
    sortOrder: 50,
  },
]

function buildConfig(family) {
  return {
    variations: [
      {
        name: "Escoge tu proteína",
        type: "single",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        values: proteinValues(family.deltas),
      },
      {
        name: "Custom fries (para acompañar)",
        type: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: CUSTOM_FRIES,
      },
    ],
    addons: EXTRAS.map((extra) => ({
      name: extra.name,
      price: extra.price,
      isActive: extra.isActive,
      sortOrder: extra.sortOrder,
      maxQuantity: extra.maxQuantity,
    })),
    includedIngredients: [],
    removableIngredients: [],
    comboItems: [],
    selectionRules: {},
    preparationMinutes: 0,
    requiresWaiterConfirmation: false,
    inventoryDiscountEnabled: true,
    isFeatured: false,
    premiumSummary: "",
    ivaRate: null,
  }
}

async function main() {
  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id,name")
    .eq("is_active", true)

  if (branchError) throw new Error(branchError.message)

  // Imágenes: se toma la foto del producto actual más representativo de cada
  // familia en esa sede (regla: producto siempre con imagen que concuerde).
  const { data: existing, error: productsError } = await supabase
    .from("menu_products")
    .select("name,image,branch_id")
    .eq("is_active", true)

  if (productsError) throw new Error(productsError.message)

  let createdCount = 0

  for (const branch of branches) {
    for (const family of FAMILIES) {
      const { data: duplicated } = await supabase
        .from("menu_products")
        .select("id")
        .eq("branch_id", branch.id)
        .eq("category", CATEGORY)
        .eq("name", family.name)
        .maybeSingle()

      if (duplicated) {
        console.log(`= Ya existe ${family.name} en ${branch.name}, sin cambios`)
        continue
      }

      const imageSource = existing.find(
        (product) => product.branch_id === branch.id && product.name === family.imageFrom,
      ) || existing.find((product) => product.name === family.imageFrom)

      const row = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        branch_id: branch.id,
        name: family.name,
        category: CATEGORY,
        description: family.description,
        price: family.basePrice,
        image: imageSource?.image || "",
        product_type: "buildable",
        payment_mode: "mixto",
        sales_channels: ["local", "takeaway", "delivery"],
        is_active: false, // BORRADOR: el dueño revisa precios y activa
        sort_order: family.sortOrder,
        config: buildConfig(family),
      }

      const { error: insertError } = await supabase.from("menu_products").insert(row)

      if (insertError) {
        console.error(`ERROR creando ${family.name} en ${branch.name}:`, insertError.message)
        continue
      }

      createdCount += 1
      console.log(`+ ${family.name} creada en ${branch.name} (inactiva, base $${family.basePrice})`)
      // ids basados en Date.now(): separamos para no chocar
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  console.log(`Listo: ${createdCount} productos plantilla creados (borradores).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
