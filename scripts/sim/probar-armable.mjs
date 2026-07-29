// PRUEBA DEL PEDIDO ARMABLE (buildable) — el riesgo que quedó marcado antes
// de fusionar BH-SIM-001 a producción.
//
// Reproduce la ESTRUCTURA REAL de las 68 burgers de Brotherhood
// (scripts/brotherhood-burger-armable-v2.mjs): variaciones en GRUPOS anidados
// (Tipo / Proteína / Custom Fries) + adicionales con maxQuantity + ingredientes
// removibles. Y pide como pide el carrito REAL (src/components/ProductCard.tsx):
// cuando hay varias secciones elegidas, las colapsa en UNA variación con el
// nombre unido por " · " y el priceDelta sumado.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"
import { orderRow } from "./lib/db-verifier.mjs"

await guardLive({ requireMarker: true })
openDayLog("armable", "Prueba del pedido armable (plantilla v2 real)")

const st = loadState()
const P = st.ids.principal
await loginStaff("alejandro", "Sim-alejandro-2026!")
await loginStaff("anthony", "Sim-anthony-2026!")
const owner = actorHeaders({ username: "alejandro", ip: "10.70.1.1", branchId: P })
const waiter = actorHeaders({ username: "anthony", ip: "10.70.1.2", branchId: P })
const cliente = (n) => publicHeaders(`10.70.2.${n}`, P)

const PRODUCT_ID = 707070001
const BASE_PRICE = 8

// ── Estructura IDÉNTICA a la plantilla real de Brotherhood ────────────────
const asValues = (names) => names.map((name, i) => ({ name, priceDelta: 0, isActive: true, sortOrder: i + 1 }))

const VARIATIONS = [
  {
    name: "Tipo de preparación",
    type: "single", required: true, minSelections: 1, maxSelections: 1,
    values: asValues(["Smash", "Clásica", "A la parrilla"]),
  },
  {
    name: "Proteína",
    type: "single", required: true, minSelections: 1, maxSelections: 1,
    // Una con recargo, como pasa en el menú real cuando el dueño lo edita.
    values: [
      { name: "Carne", priceDelta: 0, isActive: true, sortOrder: 1 },
      { name: "Pollo", priceDelta: 0, isActive: true, sortOrder: 2 },
      { name: "Mixta", priceDelta: 1.5, isActive: true, sortOrder: 3 },
    ],
  },
  {
    name: "Custom Fries",
    type: "single", required: false, minSelections: 0, maxSelections: 1,
    values: [
      { name: "Cheddar", priceDelta: 2, isActive: true, sortOrder: 1 },
      { name: "Tocineta", priceDelta: 2.5, isActive: true, sortOrder: 2 },
    ],
  },
]
const ADDONS = [
  { name: "Tocineta", price: 1.5, maxQuantity: 2, isActive: true, sortOrder: 1 },
  { name: "Queso americano", price: 1, maxQuantity: 2, isActive: true, sortOrder: 2 },
  { name: "Pepinillos", price: 0.5, maxQuantity: 1, isActive: true, sortOrder: 3 },
]
const REMOVABLE = [
  { name: "Cebolla", included: true, removable: true, extraPrice: 0 },
  { name: "Tomate", included: true, removable: true, extraPrice: 0 },
]

const creado = await post("/api/menu-products", {
  id: PRODUCT_ID,
  name: "SIM Burger Armable v2",
  category: "Hamburguesas",
  price: BASE_PRICE,
  productType: "buildable",
  isActive: true,
  inventoryDiscountEnabled: false,
  variations: VARIATIONS,
  addons: ADDONS,
  includedIngredients: REMOVABLE,
  removableIngredients: REMOVABLE,
}, owner)
check("ARM-0", "producto armable creado con la estructura real (3 grupos + 3 adicionales)", creado.status === 200 || creado.status === 201, `status=${creado.status}`)

// El menú público lo devuelve con su config completa
const menu = (await get("/api/public/products", cliente(9))).json
const pub = (menu.menuProducts || menu.products).find((p) => p.id === PRODUCT_ID)
check("ARM-1", "el menú público devuelve el armable con sus 3 grupos de variación", (pub?.variations || []).length === 3 && (pub?.addons || []).length === 3, `grupos=${pub?.variations?.length} adicionales=${pub?.addons?.length}`)

// ── Cómo pide el carrito REAL ─────────────────────────────────────────────
// ProductCard.tsx: varias secciones → UNA variación con nombre "A · B · C"
// y priceDelta = suma. Los adicionales van sueltos con su quantity.
function pedirComoElCarrito(seleccion, adicionales, tag, ip) {
  const deltaTotal = seleccion.reduce((s, o) => s + o.priceDelta, 0)
  const variacion = seleccion.length === 1
    ? { name: seleccion[0].name, priceDelta: seleccion[0].priceDelta }
    : { name: seleccion.map((o) => o.name).join(" · "), priceDelta: deltaTotal }
  const addonsPrice = adicionales.reduce((s, a) => s + a.price * a.quantity, 0)
  const unitPrice = Math.round((BASE_PRICE + deltaTotal + addonsPrice + Number.EPSILON) * 100) / 100
  return {
    esperado: unitPrice,
    body: {
      customerName: `SIM armable ${tag}`,
      customerPhone: "04141117777",
      tableNumber: "Mesa 1",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{
        id: PRODUCT_ID,
        name: "SIM Burger Armable v2",
        price: unitPrice,
        basePrice: BASE_PRICE,
        quantity: 1,
        productType: "buildable",
        selectedVariation: variacion,
        selectedAddons: adicionales.map((a) => ({ name: a.name, priceDelta: a.price, quantity: a.quantity })),
        removedIngredients: [{ name: "Cebolla" }],
      }],
    },
    ip,
  }
}

const CASOS = [
  {
    tag: "solo-tipo",
    desc: "una sola sección (Tipo: Smash) — el caso simple",
    seleccion: [{ name: "Smash", priceDelta: 0 }],
    adicionales: [],
  },
  {
    tag: "tipo-proteina",
    desc: "dos secciones (Smash · Carne) — nombre COMPUESTO",
    seleccion: [{ name: "Smash", priceDelta: 0 }, { name: "Carne", priceDelta: 0 }],
    adicionales: [],
  },
  {
    tag: "completo",
    desc: "las 3 secciones con recargos (Clásica · Mixta · Cheddar) = +$3.50",
    seleccion: [{ name: "Clásica", priceDelta: 0 }, { name: "Mixta", priceDelta: 1.5 }, { name: "Cheddar", priceDelta: 2 }],
    adicionales: [],
  },
  {
    tag: "completo-adicionales",
    desc: "3 secciones + 2 tocinetas + 1 queso = el pedido más cargado",
    seleccion: [{ name: "A la parrilla", priceDelta: 0 }, { name: "Mixta", priceDelta: 1.5 }, { name: "Tocineta", priceDelta: 2.5 }],
    adicionales: [{ name: "Tocineta", price: 1.5, quantity: 2 }, { name: "Queso americano", price: 1, quantity: 1 }],
  },
]

const creados = []
for (const [i, caso] of CASOS.entries()) {
  const { esperado, body, ip } = pedirComoElCarrito(caso.seleccion, caso.adicionales, caso.tag, 20 + i)
  const res = await post("/api/orders", body, cliente(20 + i), { label: "POST /api/orders (armable)" })
  const order = res.json?.order
  const row = order?.id ? await orderRow(order.id) : null
  const guardado = row ? Number(row.total_usd) : NaN
  check(
    `ARM-${i + 2}`,
    `armable — ${caso.desc}: el cliente honesto pasa y paga $${esperado}`,
    res.status === 200 && Math.abs(guardado - esperado) < 0.01,
    `status=${res.status} esperado=$${esperado} guardado=$${guardado} ${res.json?.error || ""}`,
  )
  if (order?.id) creados.push(order.id)
}

// ── Y el atacante NO puede abaratar un armable ────────────────────────────
const hack = await post("/api/orders", {
  customerName: "SIM armable manipulado",
  customerPhone: "04141118888",
  tableNumber: "Mesa 1",
  orderType: "Comer aquí",
  exchangeRate: 40,
  items: [{
    id: PRODUCT_ID, name: "SIM Burger Armable v2", price: 0.5, basePrice: 0.5, quantity: 1,
    productType: "buildable",
    // Miente en el delta de la variación compuesta y en el de los adicionales
    selectedVariation: { name: "Clásica · Mixta · Cheddar", priceDelta: -7 },
    selectedAddons: [{ name: "Tocineta", priceDelta: -1, quantity: 2 }],
  }],
}, cliente(40))
const hackRow = hack.json?.order?.id ? await orderRow(hack.json.order.id) : null
const hackTotal = hackRow ? Number(hackRow.total_usd) : NaN
// Precio honesto de ese armado: 8 + 0 + 1.5 + 2 + (1.5×2) = $14.50
check(
  "ARM-HACK",
  "un armable con deltas mentirosos se guarda al precio REAL ($14.50), no a $0.50",
  !hackRow || Math.abs(hackTotal - 14.5) < 0.01,
  `status=${hack.status} guardado=$${hackTotal}`,
)
if (hack.json?.order?.id) creados.push(hack.json.order.id)

// Una opción que NO existe en el armado sigue rechazándose
const fantasma = await post("/api/orders", {
  customerName: "SIM armable fantasma", customerPhone: "04141119999", tableNumber: "Mesa 1",
  orderType: "Comer aquí", exchangeRate: 40,
  items: [{
    id: PRODUCT_ID, name: "SIM Burger Armable v2", price: 8, quantity: 1, productType: "buildable",
    selectedVariation: { name: "Smash · Caviar de beluga", priceDelta: 0 },
  }],
}, cliente(41))
check("ARM-FANTASMA", "una opción inventada dentro del armado se rechaza (400)", fantasma.status === 400, `status=${fantasma.status} ${fantasma.json?.error || ""}`)
if (fantasma.json?.order?.id) creados.push(fantasma.json.order.id)

// ── Limpieza: nada de esta prueba queda en los libros ──────────────────────
for (const id of creados) {
  await supabase.from("order_items").delete().eq("order_id", id)
  await supabase.from("orders").delete().eq("id", id)
}
await supabase.from("menu_products").delete().eq("id", PRODUCT_ID)
logLine(`\nlimpieza: ${creados.length} pedidos de prueba y el producto armable eliminados`)

const result = summary("Prueba del pedido armable")
process.exit(result.fail > 0 ? 1 : 0)
