#!/usr/bin/env node
// ============================================================
// MENÚ CARACAS BURGUER — carga de productos
// ------------------------------------------------------------
// Carga el menú completo de Caracas Burguer en el Supabase del cliente
// (tabla `menu_products`). Lee las claves de .env.local. Es idempotente
// (upsert por id): puedes correrlo varias veces sin duplicar.
//
// Precios en USD (las "Ref" del menú se toman como dólares).
//
// Uso:  node scripts/seed-caracas-burger.mjs
//       node scripts/seed-caracas-burger.mjs --reset   (borra estos productos primero)
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

const emptyConfig = {
  variations: [], addons: [], includedIngredients: [], removableIngredients: [],
  selectionRules: {}, preparationMinutes: 0, requiresWaiterConfirmation: false,
  inventoryDiscountEnabled: true, isFeatured: false, premiumSummary: "",
}

// Cada producto: { id, name, category, description, price }
// Los ids se asignan por rango de categoría (1000+) para no chocar con el demo (9000+).
const RAW_PRODUCTS = [
  // ---------- LÍNEA GOURMET ----------
  { id: 1001, category: "Línea Gourmet", name: "City Burger", price: 8.99,
    description: "Pan brioche, carne premium seleccionada coronada con queso fundido tipo Kraft, vegetales frescos (lechuga, alfalfa, tomate) con nuestro triple toque de salsas ketchup, mayonesa y nuestra crema especial de la casa." },
  { id: 1002, category: "Línea Gourmet", name: "Chicken Burger", price: 8.99,
    description: "Pan brioche, milanesa de pollo coronada con queso fundido, vegetales frescos (lechuga, alfalfa, tomate) acompañada de salsas ketchup, mayonesa y nuestra crema especial de la casa." },
  { id: 1003, category: "Línea Gourmet", name: "Grill Burger", price: 10.99,
    description: "Pan brioche, filetes de carne al grill, tocineta ahumada especial, vegetales frescos (lechuga, alfalfa, tomate) combinados con ketchup, mayonesa y nuestra crema especial de la casa." },
  { id: 1004, category: "Línea Gourmet", name: "Bacon Cheese Burger", price: 10.99,
    description: "Pan brioche, hamburguesa de carne premium seleccionada con doble queso fundido, tocineta especial, cebolla caramelizada, acompañada de vegetales frescos (lechuga, alfalfa, tomate), salsas ketchup y nuestra crema especial de la casa." },
  { id: 1005, category: "Línea Gourmet", name: "Pizza Burger", price: 9.99,
    description: "Pan brioche, carne premium seleccionada, topping de champiñones salteados, maíz dulce, tocineta, aceitunas negras, queso mozzarella fundido y nuestra salsa exclusiva napolitana." },
  { id: 1006, category: "Línea Gourmet", name: "Crispy Chicken", price: 10.99,
    description: "Pan brioche, 200 gr de pollo crispy dorado al punto, pepinillos, vegetales frescos (lechuga, alfalfa, tomate) con la combinación del trío de salsas ketchup, mayonesa y nuestra crema especial de la casa." },
  { id: 1007, category: "Línea Gourmet", name: "Crispy Chicken BBQ", price: 10.99,
    description: "Pan brioche, 200 gr de pollo crispy glaseado en nuestra salsa BBQ especial de la casa, queso fundido, pepinillos, vegetales frescos (lechuga, alfalfa, tomate) con nuestra combinación de salsas: ketchup, mayonesa y salsa BBQ especial de la casa." },
  { id: 1008, category: "Línea Gourmet", name: "Chicken Beef Burger", price: 11.99,
    description: "Carne premium seleccionada con queso fundido, milanesa de pollo con queso derretido, tocineta ahumada especial, vegetales frescos (lechuga, alfalfa, tomate) acompañada de ketchup, mayonesa y nuestra salsa especial de la casa." },

  // ---------- LAS MAMÁS DE LAS HAMBURGUESAS ----------
  { id: 1101, category: "Hamburguesas Especiales", name: "Caracas Burguer 1.3k", price: 18.99,
    description: "Carne de hamburguesa premium seleccionada, filetes de carne a la parrilla, milanesa de pollo, chorizo ahumado especial, tocineta ahumada, huevo, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate, cebolla, repollo), salsa de tomate abundante, queso amarillo, un toque de nuestra salsa especial BBQ y crema especial de la casa." },
  { id: 1102, category: "Hamburguesas Especiales", name: "La Mamá de Caracas 1.4k", price: 19.99,
    description: "Carne de hamburguesa premium seleccionada, filetes de carne a la parrilla, milanesa de pollo, chorizo ahumado especial, tocineta, huevo, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate, cebolla, repollo), salsa de tomate abundante, queso amarillo y crema especial de la casa. Extra de chuleta ahumada." },
  { id: 1103, category: "Hamburguesas Especiales", name: "La Mamá de la Mamá 1.5k", price: 20.99,
    description: "Carne de hamburguesa premium seleccionada, filetes de carne a la parrilla, milanesa de pollo, chuleta, chorizo ahumado especial, queso fundido, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate, cebolla, repollo), salsa de tomate, mayonesa, salsa cheddar, salsa BBQ especial, abundante queso amarillo y crema especial de la casa. Extra de chuleta, doble queso fundido y pepinillo." },
  { id: 1104, category: "Hamburguesas Especiales", name: "Pollo Crispy Xtreme", price: 19.99,
    description: "200 gr de pollo crispy crujiente, tocineta ahumada especial, doble queso fundido, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate, pepinillos), salsa de tomate, mayonesa y nuestra crema especial de la casa." },
  { id: 1105, category: "Hamburguesas Especiales", name: "La Gran Caracas", price: 18.99,
    description: "Chuleta ahumada combinada con abundante tocineta ahumada, acompañada de vegetales frescos (alfalfa, lechuga, tomate, cebolla, repollo, aguacate), papas al hilo, salsa de tomate, mayonesa, queso amarillo y crema especial de la casa." },
  { id: 1106, category: "Hamburguesas Especiales", name: "Megaburguer", price: 16.99,
    description: "Carne de hamburguesa premium seleccionada, milanesa de pollo, chorizo ahumado especial, tocineta, acompañada de vegetales frescos (lechuga, alfalfa, tomate, cebolla, repollo, maíz, aguacate), papas al hilo, abundante queso amarillo, salsa de tomate, mayonesa, salsa cheddar y crema especial de la casa." },
  { id: 1107, category: "Hamburguesas Especiales", name: "Carne Deluxe 200", price: 15.99,
    description: "200 gr de carne premium seleccionada, tocineta, vegetales frescos (lechuga, alfalfa, tomate, cebolla, repollo, maíz, aguacate), papas al hilo, abundante queso amarillo, salsa de tomate, mayonesa, salsa cheddar y crema especial de la casa." },
  { id: 1108, category: "Hamburguesas Especiales", name: "La Mente Maestra", price: 19.99,
    description: "200 gr de pollo crispy, 200 gr de carne a la BBQ, tocineta especial, papas fritas crujientes, queso fundido, pepinillos, huevo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate), salsa de tomate, mayonesa, abundante queso amarillo y coronamos con salsa cheddar y BBQ." },
  { id: 1109, category: "Hamburguesas Especiales", name: "Big Monster", price: 19.99,
    description: "200 gr de lomo de cerdo, exquisitos filetes de carne a la parrilla, milanesa de pollo, doble ración de queso telita, tocineta, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate), salsa de tomate, mayonesa, cheddar y crema especial de la casa." },
  { id: 1110, category: "Hamburguesas Especiales", name: "La Modelo de Caracas", price: 19.99,
    description: "Chistorra jugosa, filetes de carne a la parrilla, carne de hamburguesa premium seleccionada, tocineta ahumada, doble queso fundido, papas fritas crujientes, vegetales frescos (lechuga, alfalfa, tomate, cebolla, repollo, aguacate), salsa de tomate, mayonesa, cheddar y crema especial de la casa." },
  { id: 1111, category: "Hamburguesas Especiales", name: "Parriburguer", price: 18.99,
    description: "300 gr de filetes de carne a la parrilla acompañada de nuestro chorizo ahumado especial, tocineta, queso telita, vegetales frescos (lechuga, alfalfa, tomate, cebolla, repollo, maíz, aguacate), papas al hilo y coronamos con salsa de tomate, un toque de mostaza y crema especial de la casa." },
  { id: 1112, category: "Hamburguesas Especiales", name: "Caracas City", price: 16.99,
    description: "Doble queso fundido derretido sobre 400 gr de carne de hamburguesa premium seleccionada, cebolla caramelizada, pepinillos, vegetales frescos (lechuga, alfalfa, tomate, maíz) coronada con salsa cheddar." },
  { id: 1113, category: "Hamburguesas Especiales", name: "Milanesa Deluxe XL", price: 15.99,
    description: "400 gr de milanesa de pollo, aguacate, tocineta, maíz, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, aguacate), salsa de tomate, mayonesa y crema especial de la casa." },
  { id: 1114, category: "Hamburguesas Especiales", name: "Chorizo King 200", price: 14.99,
    description: "200 gramos de chorizo ahumado especial, maíz, aguacate, abundante queso amarillo, papas al hilo, vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate), salsa de tomate, mayonesa y crema especial de la casa." },

  // ---------- MENÚ INFANTIL ----------
  { id: 1201, category: "Menú Infantil", name: "Perrikids", price: 3.5,
    description: "Pan tierno y suave, salchicha plumrose, salsa de tomate." },
  { id: 1202, category: "Menú Infantil", name: "Perrikids con Quesito", price: 3.99,
    description: "Pan suave y tierno, salchicha plumrose, salsa de tomate, queso amarillo." },
  { id: 1203, category: "Menú Infantil", name: "Baby Burger", price: 5.99,
    description: "Carne de hamburguesa seleccionada o milanesa de pollo, queso kraft, salsa de tomate." },
  { id: 1204, category: "Menú Infantil", name: "Tequeñitos", price: 5.99,
    description: "Ración de tequeños cremosos." },
  { id: 1205, category: "Menú Infantil", name: "Salchikids", price: 7.99,
    description: "Rueditas de salchicha plumrose + papas fritas + vasito de salsa de tomate." },
  { id: 1206, category: "Menú Infantil", name: "Cajita Caracas Kids", price: 9,
    description: "Cajita infantil Caracas Kids." },

  // ---------- PEPITOS ----------
  { id: 1301, category: "Pepitos", name: "Pepito Caracas (1 persona)", price: 17.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, combinada con pollo jugoso y chorizo ahumado especial, tocineta, papas al hilo, salsa de tomate, mayonesa, crema especial de la casa, vegetales frescos (lechuga, alfalfa, tomate, cebolla, repollo, maíz, aguacate) y coronamos con abundante queso amarillo." },
  { id: 1302, category: "Pepitos", name: "Caracas Xtreme (2 personas)", price: 29.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, combinada con pollo jugoso y chorizo ahumado especial, tocineta, papas al hilo, salsa de tomate, mayonesa, crema especial de la casa, vegetales frescos (lechuga, alfalfa, tomate, repollo, maíz, aguacate) y coronamos con abundante queso amarillo." },
  { id: 1303, category: "Pepitos", name: "Gratinado 4 Quesos (1 persona)", price: 16.99,
    description: "Queso mozzarella, queso pachusta kraft, tocineta, queso fundido, queso de año, carne a la parrilla, pollo, chorizo, maíz, aceitunas negras y champiñones. (2 personas: Ref 29,99)" },
  { id: 1304, category: "Pepitos", name: "Deluxe (2 personas)", price: 29.99,
    description: "Lomo de cerdo jugoso, carne a la parrilla fileteada con nuestro toque secreto de la casa, chorizo ahumado especial, papas fritas crujientes bañadas con queso fundido coronada con tocineta, queso telita derretido, salsa de tomate, mayonesa, crema especial de la casa, todo sobre una base de vegetales frescos (lechuga, alfalfa, tomate, aguacate). Una experiencia deluxe." },
  { id: 1305, category: "Pepitos", name: "Parrillero (2 personas)", price: 27.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, acompañada de abundante chorizo ahumado especial, papas al hilo sobre una cama de vegetales frescos (lechuga, alfalfa, tomate, aguacate, maíz, cebolla, repollo), salsa de tomate, mayonesa, crema especial de la casa y coronados con abundante queso amarillo." },
  { id: 1306, category: "Pepitos", name: "Pollo (2 personas)", price: 24.99,
    description: "Pepito de abundante pollo a la parrilla sobre una cama de vegetales frescos (lechuga, alfalfa, tomate, maíz, aguacate, cebolla, repollo), papas al hilo, salsa de tomate, mayonesa, crema especial de la casa y coronados con abundante queso amarillo." },
  { id: 1307, category: "Pepitos", name: "Mundial 3K (4 a 5 personas)", price: 49.99,
    description: "Salchichas polacas originales doradas a la parrilla, coronada con queso fundido derretido, jugosa carne a la parrilla fileteada, chorizo ahumado especial, pollo, tocineta especial, sobre una base de vegetales (lechuga, alfalfa, tomate) combinadas con nuestra crema especial de la casa, salsa de tomate, mayonesa y abundante queso amarillo." },
  { id: 1308, category: "Pepitos", name: "Mundial 6K (8 a 9 personas)", price: 84,
    description: "Pepito Mundial 6K para 8 a 9 personas." },
  { id: 1309, category: "Pepitos", name: "Mundial 12K (16 personas)", price: 150,
    description: "Pepito Mundial 12K para 16 personas." },

  // ---------- PERROS ----------
  { id: 1401, category: "Perros", name: "Caracas Burguer (Perro)", price: 4.99,
    description: "Salchicha artesanal especial hecha en casa, pan de batata, cebolla, repollo, papas al hilo, salsa de tomate, mayonesa y abundante queso amarillo." },
  { id: 1402, category: "Perros", name: "Choriperro", price: 6.99,
    description: "Chorizo ahumado especial, pan de batata, cebolla, repollo, papas al hilo, salsa de tomate, mayonesa y abundante queso amarillo." },
  { id: 1403, category: "Perros", name: "Especial", price: 6.99,
    description: "Salchicha especial hecha en casa, pan de batata, huevo, papas al hilo, tocineta, maíz, vegetales frescos, cebolla, repollo, alfalfa, tomate, mayonesa, salsa de tomate, crema especial de la casa y abundante queso amarillo." },
  { id: 1404, category: "Perros", name: "Perro Gratinado 4 Quesos", price: 7,
    description: "Salchicha plumrose max, aguacate, queso kraft, queso fundido, queso pecorino, maíz y crema especial de la casa." },
  { id: 1405, category: "Perros", name: "Jumbo", price: 8.99,
    description: "Salchicha plumrose max, aguacate, maíz, papas al hilo, vegetales frescos (cebolla, repollo, maíz, aguacate), salsa de tomate, mayonesa, crema especial de la casa y abundante queso amarillo." },
  { id: 1406, category: "Perros", name: "Perro Parrillero", price: 9.99,
    description: "Carne a la parrilla fileteada combinada con chorizo ahumado especial, tocineta, vegetales frescos (cebolla, repollo, maíz, aguacate), papas al hilo, salsa de tomate, mayonesa, crema especial de la casa y abundante queso amarillo." },
  { id: 1407, category: "Perros", name: "Polaco", price: 10,
    description: "Salchicha polaca plumrose bordeada de queso derretido, tocineta, vegetales frescos (cebolla, repollo, maíz, aguacate), papas al hilo, crema especial de la casa y abundante queso amarillo." },

  // ---------- PARRILLAS ----------
  { id: 1501, category: "Parrillas", name: "Parrilla Especial (1 persona)", price: 19.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, pollo jugoso fileteado, chorizo ahumado especial a la parrilla, morcilla especial a la parrilla, acompañada de bollitos aliñados y las mejores cremas de tomate, ajo y guasacaca." },
  { id: 1502, category: "Parrillas", name: "Parrilla Caracas (2 a 3 personas)", price: 37.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, pollo, chorizo ahumado especial a la parrilla, morcilla especial a la parrilla, acompañada de bollitos aliñados y las mejores cremas de tomate, ajo y guasacaca. Extra de papas fritas." },
  { id: 1503, category: "Parrillas", name: "La Mamá de las Parrillas (4 a 5 personas)", price: 64.99,
    description: "Carne a la parrilla fileteada hecha en casa con nuestro toque secreto, pollo jugoso fileteado, chorizo ahumado especial a la parrilla, morcilla especial a la parrilla, acompañada de bollitos aliñados y las mejores cremas de tomate, ajo y guasacaca. Extra de papas fritas, chistorra y queso telita." },

  // ---------- ESPECIALIDADES PARRILLERAS ----------
  { id: 1601, category: "Especialidades Parrilleras", name: "Rack de Costillas de Cerdo a la BBQ", price: 25,
    description: "Rack de costillas de cerdo (tipo chinas) cocinadas al tambor bañadas en nuestra salsa BBQ especial, acompañadas de papas fritas con queso fundido coronadas con tocineta." },
  { id: 1602, category: "Especialidades Parrilleras", name: "Combo Alitas a la BBQ (1 persona)", price: 15,
    description: "15 piezas bañadas en salsa BBQ + papas fritas con queso fundido y tocineta + 1 refresco." },
  { id: 1603, category: "Especialidades Parrilleras", name: "Combo Alitas a la BBQ (2 personas)", price: 25,
    description: "25 piezas bañadas en salsa BBQ + papas fritas + 2 refrescos." },
  { id: 1604, category: "Especialidades Parrilleras", name: "Pork Belly", price: 30,
    description: "Acompañado de papas fritas con salsa cheddar y tocineta trozada, queso telita y bollitos." },
  { id: 1605, category: "Especialidades Parrilleras", name: "Crispy Chicken Tenders", price: 11,
    description: "Acompañado con papas fritas y refresco." },
  { id: 1606, category: "Especialidades Parrilleras", name: "Lomito Parrillero a la BBQ (2 personas)", price: 34,
    description: "Lomito jugoso cocinado a la parrilla, glaseado en nuestra salsa especial de la casa BBQ, acompañado de papas fritas, queso fundido y tocineta." },
  { id: 1607, category: "Especialidades Parrilleras", name: "Festival Parrillero (5 a 6 personas)", price: 74.99,
    description: "Carne a la parrilla, pork belly, chorizo ahumado a la parrilla, morcilla especial a la parrilla, costillas de cerdo a la BBQ, papas fritas, queso telita, bollitos aliñados, pan con ajo y piña asada." },

  // ---------- RACIONES ----------
  { id: 1701, category: "Raciones", name: "Pan con Ajo", price: 3, description: "Ración de pan con ajo." },
  { id: 1702, category: "Raciones", name: "Ración de Tocineta", price: 4, description: "Ración de tocineta." },
  { id: 1703, category: "Raciones", name: "Ración de Papas Fritas", price: 8, description: "Ración de papas fritas." },
  { id: 1704, category: "Raciones", name: "Ración de Queso Telita (2 unid)", price: 4, description: "Ración de queso telita, 2 unidades." },
  { id: 1705, category: "Raciones", name: "Ración de Chistorra", price: 5, description: "Ración de chistorra." },
  { id: 1706, category: "Raciones", name: "Ración de Morcilla (2 unid)", price: 5, description: "Ración de morcilla, 2 unidades." },
  { id: 1707, category: "Raciones", name: "Ración de Chorizo (2 unid)", price: 6, description: "Ración de chorizo, 2 unidades." },
  { id: 1708, category: "Raciones", name: "Extra de Huevo", price: 1, description: "Extra de huevo." },
  { id: 1709, category: "Raciones", name: "Ración de Tequeño", price: 5, description: "Ración de tequeños." },
  { id: 1710, category: "Raciones", name: "Ración de Tequeño Familiar", price: 15, description: "Ración de tequeños familiar." },

  // ---------- BEBIDAS ----------
  { id: 1801, category: "Bebidas", name: "Refresco", price: 2, description: "Refresco." },
  { id: 1802, category: "Bebidas", name: "Jugo del Valle", price: 2, description: "Jugo del Valle." },
  { id: 1803, category: "Bebidas", name: "Powerade", price: 3, description: "Powerade." },
  { id: 1804, category: "Bebidas", name: "Agua 300 ml", price: 1, description: "Agua mineral 300 ml." },
  { id: 1805, category: "Bebidas", name: "Agua 600 ml", price: 2, description: "Agua mineral 600 ml." },
]

const PRODUCTS = RAW_PRODUCTS.map((p, i) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  description: p.description,
  price: p.price,
  sort_order: i + 1,
  image: "",
  product_type: "normal",
  payment_mode: "mixto",
  sales_channels: ["local", "takeaway", "delivery"],
  is_active: true,
  config: emptyConfig,
}))

async function main() {
  const ids = PRODUCTS.map((p) => p.id)

  if (RESET) {
    const { error } = await sb.from("menu_products").delete().in("id", ids)
    console.log(error ? "Reset ERROR: " + error.message : `Reset: borrados productos ${ids[0]}-${ids[ids.length - 1]}.`)
  }

  const { error } = await sb.from("menu_products").upsert(PRODUCTS)
  if (error) {
    console.error("Error al cargar productos:", error.message)
    process.exit(1)
  }

  const byCat = PRODUCTS.reduce((acc, p) => ((acc[p.category] = (acc[p.category] || 0) + 1), acc), {})
  console.log(`\nMenú Caracas Burguer cargado: ${PRODUCTS.length} productos.`)
  for (const [cat, n] of Object.entries(byCat)) console.log(`  · ${cat}: ${n}`)
  console.log("\nRevisa con: npm run dev")
}

main().catch((e) => {
  console.error("Falló la carga:", e.message)
  process.exit(1)
})
