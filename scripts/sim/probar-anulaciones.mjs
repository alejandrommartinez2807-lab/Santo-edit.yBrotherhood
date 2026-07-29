// PRUEBA DE LA POLÍTICA DE ANULACIONES (decisión del dueño 2026-07-29,
// cierra BH-SIM-005) contra el server vivo y la base de PRUEBA:
// - los TRES orígenes escriben el detalle estructurado (0036): origen,
//   motivo, quién, cuándo, insumos y destino del dinero;
// - el default del dinero sin respuesta es DEVUELTO (supuesto sin confirmar);
// - "no dejó motivo" queda como NULL y jamás se inventa un texto en la base.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"
import { orderRow } from "./lib/db-verifier.mjs"

await guardLive({ requireMarker: true })
openDayLog("anulaciones", "Prueba de la política de anulaciones (BH-SIM-005)")

const st = loadState()
const P = st.ids.principal
await loginStaff("alejandro", "Sim-alejandro-2026!")
const owner = actorHeaders({ username: "alejandro", ip: "10.73.1.1", branchId: P })
const cliente = (n) => publicHeaders(`10.73.2.${n}`, P)

// Config original (minutos de anulación automática) para restaurar al final.
const { data: cfgRow } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
const originalMinutes = cfgRow?.config?.publicUnpaidAutoCancelMinutes

const menu = (await get("/api/public/products", cliente(1))).json
const prod = (menu.menuProducts || menu.products).find((p) => p.name === "Burger Clásica")
const creados = []

const RATE = Number(st.rate || 40)

async function pedidoStaff(tag) {
  const res = await post("/api/orders", {
    customerName: `SIM anulacion ${tag}`,
    tableNumber: "Mesa 3",
    orderType: "Comer aquí",
    exchangeRate: RATE,
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, owner, { label: "POST /api/orders (staff)" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  return { id, total: Number(res.json?.order?.totalUSD || prod.price) }
}

async function cobrar(id, montoUSD) {
  return patch(`/api/orders/${id}/payment`, {
    amountReceivedUSD: montoUSD,
    paymentMethodUSD: "Efectivo",
  }, owner, { label: "PATCH payment" })
}

async function anular(id, body) {
  return patch(`/api/orders/${id}`, { status: "Cancelado", ...body }, owner, {
    label: "PATCH cancel",
  })
}

// ── A1 · Personal + dinero cobrado + "NO devolví el dinero" ────────────────
{
  const { id, total } = await pedidoStaff("A1-se-quedo")
  await cobrar(id, total)
  const res = await anular(id, {
    cancelReason: "cliente se fue sin esperar",
    inventoryWasUsed: true,
    moneyReturned: false,
  })
  const row = (await orderRow(id)) || {}
  check("ANU-1", "anulación personal con dinero que SE QUEDÓ: origen/quién/insumos/dinero estructurados",
    res.status === 200 &&
    row.cancel_origin === "personal" &&
    row.cancel_reason === "cliente se fue sin esperar" &&
    String(row.cancelled_by_role) === "owner" &&
    Boolean(row.cancelled_at) &&
    row.cancel_inventory_used === true &&
    row.cancel_refund === "se_quedo" &&
    Math.abs(Number(row.cancel_refund_usd) - total) < 0.01,
    `origen=${row.cancel_origin} motivo=${row.cancel_reason} por=${row.cancelled_by_name}(${row.cancelled_by_role}) insumos=${row.cancel_inventory_used} dinero=${row.cancel_refund} $${row.cancel_refund_usd}`)
  check("ANU-2", "la nota del pedido explica que el dinero se quedó en caja (visible sin migración)",
    /se quedó en caja/i.test(String(row.customer_note)),
    `nota=${String(row.customer_note).slice(-120)}`)
  check("ANU-3", "el dinero cobrado NO se borró del pedido (jamás se pierde información)",
    Number(row.payment_received_equiv_usd) === total && row.payment_status === "Pagado",
    `recibido=$${row.payment_received_equiv_usd} estado=${row.payment_status}`)
}

// ── A2 · Personal + dinero cobrado + SIN respuesta → default DEVUELTO ──────
{
  const { id, total } = await pedidoStaff("A2-default")
  await cobrar(id, total)
  const res = await anular(id, {
    cancelReason: "prueba default sin respuesta",
    inventoryWasUsed: false,
    // moneyReturned ausente a propósito (API vieja / script)
  })
  const row = (await orderRow(id)) || {}
  check("ANU-4", "sin respuesta sobre el dinero: aplica el DEFAULT devuelto (supuesto 2026-07-29)",
    res.status === 200 && row.cancel_refund === "devuelto" &&
    Math.abs(Number(row.cancel_refund_usd) - total) < 0.01,
    `dinero=${row.cancel_refund} $${row.cancel_refund_usd}`)
  check("ANU-5", "insumos sin usar quedan estructurados (false = devueltos al stock)",
    row.cancel_inventory_used === false,
    `insumos=${row.cancel_inventory_used}`)
}

// ── A3 · Personal SIN dinero cobrado → cancel_refund NULL ──────────────────
{
  const { id } = await pedidoStaff("A3-sin-dinero")
  const res = await anular(id, {
    cancelReason: "error al cargar el pedido",
    inventoryWasUsed: false,
  })
  const row = (await orderRow(id)) || {}
  check("ANU-6", "pedido sin cobro: el destino del dinero queda NULL (no aplica), no un valor inventado",
    res.status === 200 && row.cancel_refund === null && row.cancel_refund_usd === null,
    `dinero=${row.cancel_refund} monto=${row.cancel_refund_usd}`)
}

// ── A4 · Cliente CON motivo ────────────────────────────────────────────────
{
  const res = await post("/api/orders", {
    customerName: "SIM anulacion A4-cliente",
    customerPhone: "04141116666",
    tableNumber: "Pick up",
    orderType: "Para llevar",
    exchangeRate: RATE,
    paymentMethod: "Pago móvil",
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, cliente(4), { label: "POST /api/orders (público)" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  const cancelRes = await post("/api/public/order-cancel", {
    orderId: id,
    reason: "me equivoqué de sede",
  }, cliente(4), { label: "POST order-cancel" })
  const row = (await orderRow(id)) || {}
  check("ANU-7", "cancelación del CLIENTE con motivo: origen cliente + motivo tal cual",
    cancelRes.status === 200 &&
    row.cancel_origin === "cliente" &&
    row.cancel_reason === "me equivoqué de sede" &&
    row.cancelled_by_role === "public" &&
    row.cancel_inventory_used === false,
    `origen=${row.cancel_origin} motivo=${row.cancel_reason} por=${row.cancelled_by_name}`)
}

// ── A5 · Cliente SIN motivo → cancel_reason NULL ("no dejó motivo") ────────
{
  const res = await post("/api/orders", {
    customerName: "SIM anulacion A5-sin-motivo",
    customerPhone: "04141117777",
    tableNumber: "Pick up",
    orderType: "Para llevar",
    exchangeRate: RATE,
    paymentMethod: "Pago móvil",
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, cliente(5), { label: "POST /api/orders (público)" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  const cancelRes = await post("/api/public/order-cancel", { orderId: id }, cliente(5))
  const row = (await orderRow(id)) || {}
  check("ANU-8", "cliente sin motivo: cancel_reason NULL en la base (la UI dice 'no dejó motivo', la base no inventa)",
    cancelRes.status === 200 && row.cancel_origin === "cliente" && row.cancel_reason === null,
    `origen=${row.cancel_origin} motivo=${JSON.stringify(row.cancel_reason)}`)
}

// ── A6 · Anulación AUTOMÁTICA (sin pago reportado) ─────────────────────────
{
  await post("/api/business-config", {
    businessConfig: { publicUnpaidAutoCancelMinutes: 30 },
  }, owner)
  const res = await post("/api/orders", {
    customerName: "SIM anulacion A6-automatica",
    customerPhone: "04141118888",
    tableNumber: "Pick up",
    orderType: "Para llevar",
    exchangeRate: RATE,
    paymentMethod: "Pago móvil",
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, cliente(6), { label: "POST /api/orders (público)" })
  const id = res.json?.order?.id
  if (id) creados.push(id)
  // El pedido "envejece" 45 min (solo en la base de PRUEBA) y el sondeo del
  // cliente dispara la anulación en caliente, como en la vida real.
  await supabase
    .from("orders")
    .update({ created_at: new Date(Date.now() - 45 * 60_000).toISOString() })
    .eq("id", id)
  await get(`/api/public/order-status?pedido=${id}`, cliente(6), { label: "GET order-status" })
  const row = (await orderRow(id)) || {}
  check("ANU-9", "anulación AUTOMÁTICA: origen automatico + Sistema + motivo del sistema + insumos devueltos",
    row.status === "Cancelado" &&
    row.cancel_origin === "automatico" &&
    /Sin pago reportado en 30 min/.test(String(row.cancel_reason)) &&
    row.cancelled_by_name === "Sistema" &&
    row.cancelled_by_role === "system" &&
    row.cancel_inventory_used === false &&
    row.cancel_refund === null,
    `estado=${row.status} origen=${row.cancel_origin} motivo=${row.cancel_reason} por=${row.cancelled_by_name}`)
}

// ── Restauración y limpieza ────────────────────────────────────────────────
await post("/api/business-config", {
  businessConfig: { publicUnpaidAutoCancelMinutes: originalMinutes ?? 0 },
}, owner)
const { data: cfgFinal } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
check("ANU-10", "la configuración de anulación automática vuelve a como estaba",
  (cfgFinal?.config?.publicUnpaidAutoCancelMinutes ?? null) === (originalMinutes ?? 0) ||
  (originalMinutes === undefined && Number(cfgFinal?.config?.publicUnpaidAutoCancelMinutes || 0) === 0),
  `quedó=${cfgFinal?.config?.publicUnpaidAutoCancelMinutes} (original=${originalMinutes})`)

for (const id of creados) {
  await supabase.from("order_items").delete().eq("order_id", id)
  await supabase.from("orders").delete().eq("id", id)
}
logLine(`\nlimpieza: ${creados.length} pedidos de prueba eliminados`)
logLine("nota: el pedido A1 (insumos usados) dejó su consumo descontado a propósito; el resto revirtió su inventario al anularse")

const result = summary("Prueba de la política de anulaciones")
process.exit(result.fail > 0 ? 1 : 0)
