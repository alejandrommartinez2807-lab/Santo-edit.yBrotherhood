// REGRESIÓN de precios tras separar los espacios de nombres del guard
// (variaciones vs adicionales). Recorre los CUATRO tipos de producto del
// sistema con pedidos públicos reales y comprueba que el total guardado es el
// que el cliente ve — ni más ni menos.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"
import { orderRow } from "./lib/db-verifier.mjs"

await guardLive({ requireMarker: true })
openDayLog("regresion-precios", "Regresión de precios por tipo de producto")

const st = loadState()
const P = st.ids.principal
await loginStaff("alejandro", "Sim-alejandro-2026!")
const cliente = (n) => publicHeaders(`10.71.1.${n}`, P)

const menu = (await get("/api/public/products", cliente(1))).json
const productos = menu.menuProducts || menu.products
const porNombre = Object.fromEntries(productos.map((p) => [p.name, p]))

const creados = []
async function pedir(tag, item, esperado, ip) {
  const res = await post("/api/orders", {
    customerName: `SIM regresion ${tag}`,
    customerPhone: "04141116666",
    tableNumber: "Mesa 1",
    orderType: "Comer aquí",
    exchangeRate: 40,
    items: [item],
  }, cliente(ip), { label: "POST /api/orders" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  const row = id ? await orderRow(id) : null
  const guardado = row ? Number(row.total_usd) : NaN
  return { status: res.status, guardado, esperado, error: res.json?.error }
}

// 1 · NORMAL (sin opciones)
const clasica = porNombre["Burger Clásica"]
let r = await pedir("normal", { id: clasica.id, name: clasica.name, price: clasica.price, quantity: 2 }, clasica.price * 2, 10)
check("REG-1", `producto NORMAL x2 cobra $${r.esperado}`, r.status === 200 && Math.abs(r.guardado - r.esperado) < 0.01, `guardado=$${r.guardado} ${r.error || ""}`)

// 2 · CON VARIACIONES (una sola sección, el caso clásico)
const doble = porNombre["Burger Doble Brutal"]
const variacion = (doble.variations || [])[0]
const opcionVar = variacion?.values ? variacion.values[0] : variacion
if (opcionVar?.name) {
  const delta = Number(opcionVar.priceDelta || 0)
  r = await pedir("variacion", {
    id: doble.id, name: doble.name, price: doble.price + delta, quantity: 1,
    selectedVariation: { id: opcionVar.id, name: opcionVar.name, priceDelta: delta },
  }, Math.round((doble.price + delta + Number.EPSILON) * 100) / 100, 11)
  check("REG-2", `producto con VARIACIÓN (${opcionVar.name}) cobra $${r.esperado}`, r.status === 200 && Math.abs(r.guardado - r.esperado) < 0.01, `guardado=$${r.guardado} ${r.error || ""}`)
} else {
  check("REG-2", "el producto de variaciones tenía opciones para probar", false, "sin variaciones en el menú")
}

// 3 · CON ADICIONALES (y cantidad > 1 en uno de ellos)
const pollo = porNombre["Burger de Pollo"]
const addons = (pollo.addons || []).slice(0, 2)
if (addons.length === 2) {
  const extra = addons[0].price * 2 + addons[1].price
  r = await pedir("adicionales", {
    id: pollo.id, name: pollo.name, price: pollo.price + extra, quantity: 1,
    selectedAddons: [
      { id: addons[0].id, name: addons[0].name, priceDelta: addons[0].price, quantity: 2 },
      { id: addons[1].id, name: addons[1].name, priceDelta: addons[1].price, quantity: 1 },
    ],
  }, Math.round((pollo.price + extra + Number.EPSILON) * 100) / 100, 12)
  check("REG-3", `producto con ADICIONALES (uno x2) cobra $${r.esperado}`, r.status === 200 && Math.abs(r.guardado - r.esperado) < 0.01, `guardado=$${r.guardado} ${r.error || ""}`)
} else {
  check("REG-3", "el producto de adicionales tenía 2 opciones para probar", false, `adicionales=${addons.length}`)
}

// 4 · COMBO
const combo = porNombre["Combo Brutal"]
r = await pedir("combo", { id: combo.id, name: combo.name, price: combo.price, quantity: 1, category: "Combos" }, combo.price, 13)
check("REG-4", `COMBO cobra su precio de menú $${r.esperado}`, r.status === 200 && Math.abs(r.guardado - r.esperado) < 0.01, `guardado=$${r.guardado} ${r.error || ""}`)

// 5 · Varias líneas en un mismo pedido (la mezcla real de un carrito)
const multi = await post("/api/orders", {
  customerName: "SIM regresion multi", customerPhone: "04141116667", tableNumber: "Mesa 2",
  orderType: "Comer aquí", exchangeRate: 40,
  items: [
    { id: clasica.id, name: clasica.name, price: clasica.price, quantity: 2 },
    { id: combo.id, name: combo.name, price: combo.price, quantity: 1, category: "Combos" },
    { id: porNombre["Refresco 1.5L"].id, name: "Refresco 1.5L", price: porNombre["Refresco 1.5L"].price, quantity: 3 },
  ],
}, cliente(14))
if (multi.json?.order?.id) creados.push(multi.json.order.id)
const esperadoMulti = Math.round((clasica.price * 2 + combo.price + porNombre["Refresco 1.5L"].price * 3 + Number.EPSILON) * 100) / 100
const rowMulti = multi.json?.order?.id ? await orderRow(multi.json.order.id) : null
check("REG-5", `carrito de 3 líneas distintas cobra $${esperadoMulti}`, multi.status === 200 && Math.abs(Number(rowMulti?.total_usd) - esperadoMulti) < 0.01, `guardado=$${rowMulti?.total_usd} ${multi.json?.error || ""}`)

// 6 · El staff conserva su libertad (ítem manual con precio propio)
const staff = await post("/api/orders", {
  customerName: "SIM regresion staff manual", tableNumber: "Mesa 2",
  orderType: "Comer aquí", exchangeRate: 40,
  items: [{ id: 888001, name: "Ajuste manual del dueño", price: 4.44, quantity: 1 }],
}, actorHeaders({ username: "alejandro", ip: "10.71.9.1", branchId: P }))
if (staff.json?.order?.id) creados.push(staff.json.order.id)
const rowStaff = staff.json?.order?.id ? await orderRow(staff.json.order.id) : null
check("REG-6", "el STAFF sigue pudiendo cobrar un ítem manual ($4.44) que no está en el menú", staff.status === 200 && Math.abs(Number(rowStaff?.total_usd) - 4.44) < 0.01, `status=${staff.status} guardado=$${rowStaff?.total_usd}`)

// Limpieza
for (const id of creados) {
  await supabase.from("order_items").delete().eq("order_id", id)
  await supabase.from("orders").delete().eq("id", id)
}
logLine(`\nlimpieza: ${creados.length} pedidos de regresión eliminados`)

const result = summary("Regresión de precios")
process.exit(result.fail > 0 ? 1 : 0)
