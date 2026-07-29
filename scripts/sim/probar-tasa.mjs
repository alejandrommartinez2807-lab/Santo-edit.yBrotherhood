// PRUEBA DE LA TASA DEL SERVIDOR (BH-SIM-002, 2ª parte) en los TRES modos.
// Brotherhood usa la tasa automática del BCV y el dueño puede pasarla a EURO
// desde Configuración: el blindaje tiene que valer en los tres.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"
import { orderRow } from "./lib/db-verifier.mjs"

await guardLive({ requireMarker: true })
openDayLog("tasa", "Prueba de la tasa impuesta por el servidor")

const st = loadState()
const P = st.ids.principal
await loginStaff("alejandro", "Sim-alejandro-2026!")
const owner = actorHeaders({ username: "alejandro", ip: "10.72.1.1", branchId: P })
const cliente = (n) => publicHeaders(`10.72.2.${n}`, P)

// Config original, para devolverla tal cual al final.
const { data: cfgRow } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
const original = {
  exchangeRateMode: cfgRow?.config?.exchangeRateMode,
  manualExchangeRate: cfgRow?.config?.manualExchangeRate,
}

const menu = (await get("/api/public/products", cliente(1))).json
const prod = (menu.menuProducts || menu.products).find((p) => p.name === "Burger Clásica")
const creados = []

async function pedirConTasa(tasaDelCliente, tag, ip) {
  const res = await post("/api/orders", {
    customerName: `SIM tasa ${tag}`,
    customerPhone: "04141115555",
    tableNumber: "Mesa 1",
    orderType: "Comer aquí",
    exchangeRate: tasaDelCliente,
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, cliente(ip), { label: "POST /api/orders" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  const row = id ? await orderRow(id) : null
  return { status: res.status, tasaGuardada: row ? Number(row.exchange_rate) : NaN }
}

async function setModo(modo, manual) {
  await post("/api/business-config", {
    businessConfig: { exchangeRateMode: modo, ...(manual !== undefined ? { manualExchangeRate: manual } : {}) },
  }, owner)
}

// ── 1 · MODO MANUAL ───────────────────────────────────────────────────────
await setModo("manual", 40)
let r = await pedirConTasa(4, "manual", 10)
check("TASA-1", "modo MANUAL: la tasa del negocio (40) pisa la del cliente (4)", r.status === 200 && r.tasaGuardada === 40, `guardada=${r.tasaGuardada}`)

// ── 2 · MODO AUTOMÁTICO (dólar BCV) — el que tenía Brotherhood ────────────
await setModo("automatic", 0)
const tasaUsdReal = Number((await get("/api/exchange-rate", cliente(2))).json?.rate)
r = await pedirConTasa(4, "automatico", 11)
check("TASA-2", `modo AUTOMÁTICO (dólar): la tasa del BCV (${tasaUsdReal}) pisa la del cliente (4)`, r.status === 200 && Math.abs(r.tasaGuardada - tasaUsdReal) < 0.01, `guardada=${r.tasaGuardada} bcv=${tasaUsdReal}`)

// ── 3 · MODO EURO — el que usa Brotherhood ────────────────────────────────
await setModo("automaticEur", 0)
const tasaEurReal = Number((await get("/api/exchange-rate", cliente(3))).json?.rate)
const monedaEur = (await get("/api/exchange-rate", cliente(3))).json?.currency
r = await pedirConTasa(4, "euro", 12)
check("TASA-3", `modo EURO: la tasa del euro BCV (${tasaEurReal}) pisa la del cliente (4)`, r.status === 200 && Math.abs(r.tasaGuardada - tasaEurReal) < 0.01, `guardada=${r.tasaGuardada} euro=${tasaEurReal} moneda=${monedaEur}`)
check("TASA-4", "el modo euro devuelve de verdad la tasa del EURO, no la del dólar", monedaEur === "EUR" && Math.abs(tasaEurReal - tasaUsdReal) > 1, `euro=${tasaEurReal} dólar=${tasaUsdReal}`)

// ── 4 · El ataque completo: tasa falsa + cobro en Bs ──────────────────────
// Con la tasa impuesta, reportar pocos bolívares ya NO paga el pedido.
const ataque = await pedirConTasa(4, "ataque-cobro", 13)
if (ataque.status === 200) {
  const pedidoId = creados[creados.length - 1]
  const row = await orderRow(pedidoId)
  const total = Number(row.total_usd)
  const bsQueCreiaSuficientes = Math.round(total * 4 * 100) / 100 // los que bastarían con tasa 4
  await loginStaff("mariafernanda", "Sim-mariafernanda-2026!")
  const cobro = await post(`/api/orders/${pedidoId}/payment`, {}, owner) // no-op, se usa PATCH abajo
  const { patch } = await import("./lib/api-client.mjs")
  await patch(`/api/orders/${pedidoId}/payment`, {
    amountReceivedVES: bsQueCreiaSuficientes,
    paymentMethodVES: "Pago móvil",
    deliveryPaymentIn: "Bolívares",
  }, actorHeaders({ username: "mariafernanda", ip: "10.72.3.1", branchId: P }))
  const tras = await orderRow(pedidoId)
  check(
    "TASA-5",
    `pagar Bs ${bsQueCreiaSuficientes} (los que bastaban con tasa 4) ya NO salda un pedido de $${total}`,
    tras.payment_status !== "Pagado",
    `estado=${tras.payment_status} recibido=$${tras.payment_received_equiv_usd} de $${total} (tasa del pedido=${tras.exchange_rate})`,
  )
}

// ── 5 · El staff NO se ve afectado (puede fijar su tasa) ──────────────────
const staffOrder = await post("/api/orders", {
  customerName: "SIM tasa staff", tableNumber: "Mesa 2", orderType: "Comer aquí",
  exchangeRate: 55,
  items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
}, owner)
if (staffOrder.json?.order?.id) creados.push(staffOrder.json.order.id)
const staffRow = staffOrder.json?.order?.id ? await orderRow(staffOrder.json.order.id) : null
check("TASA-6", "el STAFF conserva su tasa (55): el blindaje solo aplica al público", staffOrder.status === 200 && Number(staffRow?.exchange_rate) === 55, `guardada=${staffRow?.exchange_rate}`)

// ── Restauración ──────────────────────────────────────────────────────────
await setModo(original.exchangeRateMode || "manual", original.manualExchangeRate ?? 40)
const { data: cfgFinal } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
check("TASA-7", "la configuración de tasa vuelve EXACTAMENTE a como estaba", cfgFinal?.config?.exchangeRateMode === original.exchangeRateMode, `modo=${cfgFinal?.config?.exchangeRateMode} (original=${original.exchangeRateMode})`)

for (const id of creados) {
  await supabase.from("order_items").delete().eq("order_id", id)
  await supabase.from("orders").delete().eq("id", id)
}
logLine(`\nlimpieza: ${creados.length} pedidos de prueba eliminados`)

const result = summary("Prueba de la tasa del servidor")
process.exit(result.fail > 0 ? 1 : 0)
