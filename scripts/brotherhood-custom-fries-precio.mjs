// Pone precio a las CUSTOM FRIES de todas las hamburguesas (pedido del dueño
// 2026-07-24: $3 cada una). SEGURO Y DIRIGIDO:
//  - Solo toca los `values` del grupo "Custom fries (para acompañar)".
//  - No cambia proteínas, extras, precio base ni ningún otro grupo.
//  - Idempotente: si ya están en el precio objetivo, no reescribe.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-custom-fries-precio.mjs
//   Añade  --dry  para solo listar qué cambiaría, sin escribir.

import { createClient } from "@supabase/supabase-js"

const DRY_RUN = process.argv.includes("--dry")
const PRICE = 3 // USD por cada custom fries (mismo precio las 3)
const CUSTOM_FRIES_GROUP = "Custom fries (para acompañar)"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}
const isBurger = (c) => norm(c).includes("hamburgues") || norm(c).includes("burger")

const { data: products, error } = await supabase
  .from("menu_products")
  .select("id,name,category,config")
if (error) throw error

const burgers = (products || []).filter((p) => isBurger(p.category))
let updated = 0
let skipped = 0
let noGroup = 0

for (const product of burgers) {
  const config =
    product.config && typeof product.config === "object" ? product.config : {}
  const variations = Array.isArray(config.variations) ? config.variations : []

  const groupIndex = variations.findIndex(
    (g) => norm(g?.name) === norm(CUSTOM_FRIES_GROUP),
  )
  if (groupIndex === -1) {
    noGroup += 1
    continue
  }

  const group = variations[groupIndex]
  const values = Array.isArray(group.values) ? group.values : []
  const alreadySet = values.every((v) => Number(v?.priceDelta || 0) === PRICE)
  if (values.length === 0 || alreadySet) {
    skipped += 1
    continue
  }

  // Reescribe SOLO ese grupo con los mismos valores + priceDelta nuevo.
  const nextValues = values.map((v) => ({ ...v, priceDelta: PRICE }))
  const nextVariations = variations.map((g, i) =>
    i === groupIndex ? { ...g, values: nextValues } : g,
  )
  const nextConfig = { ...config, variations: nextVariations }

  if (DRY_RUN) {
    updated += 1
    console.log(`~ ${product.name} (${product.category}) — custom fries → $${PRICE}`)
    continue
  }

  const { error: upErr } = await supabase
    .from("menu_products")
    .update({ config: nextConfig })
    .eq("id", product.id)
  if (upErr) {
    console.error(`ERROR en ${product.name}:`, upErr.message)
    continue
  }
  updated += 1
  console.log(`+ ${product.name} (${product.category}) — custom fries → $${PRICE}`)
}

console.log(
  `\nListo${DRY_RUN ? " (DRY)" : ""}: ${updated} con precio ${DRY_RUN ? "a poner" : "aplicado"}, ${skipped} ya estaban, ${noGroup} sin grupo custom fries.`,
)
