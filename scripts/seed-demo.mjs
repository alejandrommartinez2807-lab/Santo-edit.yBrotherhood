#!/usr/bin/env node
// ============================================================
// DATOS DEMO — Santo Edit (plantilla llave en mano)
// ------------------------------------------------------------
// Carga un menú y mesas de ejemplo en el Supabase del cliente, para
// mostrar el sistema funcionando o arrancar rápido. Lee las claves de
// .env.local. Es idempotente (upsert): puedes correrlo varias veces.
//
// Uso:  node scripts/seed-demo.mjs
//       node scripts/seed-demo.mjs --reset   (borra demo previo primero)
// ============================================================

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })
const RESET = process.argv.includes("--reset")

const DEMO_TABLES = [
  { id: "mesa-1", name: "Mesa 1", area: "Principal", sort_order: 1, is_active: true },
  { id: "mesa-2", name: "Mesa 2", area: "Principal", sort_order: 2, is_active: true },
  { id: "mesa-3", name: "Mesa 3", area: "Terraza", sort_order: 3, is_active: true },
  { id: "barra", name: "Barra", area: "Barra", sort_order: 4, is_active: true },
]

const emptyConfig = {
  variations: [], addons: [], includedIngredients: [], removableIngredients: [],
  selectionRules: {}, preparationMinutes: 0, requiresWaiterConfirmation: false,
  inventoryDiscountEnabled: true, isFeatured: false, premiumSummary: "",
}

const DEMO_PRODUCTS = [
  { id: 9001, name: "Plato del día", category: "Platos", description: "Ejemplo de plato principal.", price: 6, sort_order: 1 },
  { id: 9002, name: "Entrada para compartir", category: "Entradas", description: "Ejemplo de entrada.", price: 4, sort_order: 2 },
  { id: 9003, name: "Bebida natural", category: "Bebidas", description: "Ejemplo de bebida.", price: 2, sort_order: 3 },
  { id: 9004, name: "Postre de la casa", category: "Postres", description: "Ejemplo de postre.", price: 3, sort_order: 4 },
].map((p) => ({
  ...p, image: "", product_type: "normal", payment_mode: "mixto",
  sales_channels: ["local", "takeaway", "delivery"], is_active: true, config: emptyConfig,
}))

async function main() {
  if (RESET) {
    await sb.from("menu_products").delete().in("id", DEMO_PRODUCTS.map((p) => p.id))
    console.log("Demo previo borrado (productos 9001-9004).")
  }

  const t = await sb.from("tables").upsert(DEMO_TABLES)
  console.log("Mesas:", t.error ? "ERROR " + t.error.message : DEMO_TABLES.length + " ok")

  const m = await sb.from("menu_products").upsert(DEMO_PRODUCTS)
  console.log("Productos demo:", m.error ? "ERROR " + m.error.message : DEMO_PRODUCTS.length + " ok")

  // Config mínima si está vacía
  const { data: cfg } = await sb.from("business_config").select("config").eq("id", 1).maybeSingle()
  if (!cfg || !cfg.config || Object.keys(cfg.config).length === 0) {
    await sb.from("business_config").upsert({ id: 1, config: { businessName: "Negocio Demo" } })
    console.log("Config: sembrada (Negocio Demo)")
  } else {
    console.log("Config: ya existe, no se toca")
  }

  console.log("\nListo. Datos demo cargados. Revisa con: npm run dev")
}

main().catch((e) => {
  console.error("Falló el seed:", e.message)
  process.exit(1)
})
