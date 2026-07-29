// DÍA 1 · LUNES SUAVE — 55 pedidos exactos (35 Principal / 20 San Diego)
// Nacimiento de la operación: primera cuenta abierta (4 pedidos), cuenta con
// pagos separados, todos los métodos base, QR, pickup, delivery, 2
// cancelaciones y primer cierre comercial por sede contra el libro esperado.
import {
  openDay, createOrder, kitchenCycle, payOrder, payMixedTwoLegs, cancelOrder,
  addExpense, closeBranchDay, nightlyChecks, verifyInventory,
  check, summary, logLine, get, post, patch, publicHeaders, auditRows, orderRow,
  round, flushPerformance, RATE, pick, bumpQuota,
} from "./lib/day-engine.mjs"
import { saveState } from "./lib/evidence-writer.mjs"

const ROSTER = [
  "alejandro", "genesis", "mariafernanda", "jesus", "anthony", "yorgelis", "miguel",
  "luis", "roxana", "carlosalberto", "daniela",
]

const ctx = await openDay({
  dayNumber: 1,
  dayKey: "dia-1",
  title: "Día 1 — Lunes suave y nacimiento de la operación",
  businessDate: "2026-08-03",
  roster: ROSTER,
})
const { P, SD } = ctx
const st = ctx.state
st.day1 ||= {}

// Menú de referencia por sede para componer pedidos variados.
const COMBOS_P = [
  [["Burger Clásica", 1], ["Refresco 1.5L", 1]],
  [["Burger Doble Brutal", 1], ["Papas Medianas", 1]],
  [["Burger de Pollo", 1], ["Agua mineral", 1]],
  [["Combo Brutal", 1]],
  [["Burger Vegetariana", 1], ["Papas Medianas", 1]],
  [["Tequeños (6)", 1], ["Refresco 1.5L", 1]],
  [["Salchipapa", 1]],
  [["Combo Pareja", 1]],
  [["Nuggets (8)", 1], ["Agua mineral", 1]],
  [["Burger Clásica", 2], ["Papas Brutales", 1], ["Refresco 1.5L", 2]],
]
const comboFor = (branchId) => pick(ctx.rng, COMBOS_P)

// ── FASE B · APERTURA ─────────────────────────────────────────────────────
logLine("\n## Apertura: fondo inicial declarado en bitácora (el sistema no " +
  "tiene módulo de fondo de caja: se documenta como NOT_APPLICABLE y el " +
  "efectivo del cierre se valida contra el libro).")
logLine("Fondo inicial declarado: Principal $100 · San Diego $60 (solo bitácora)")

// ── FASE C/D · OPERACIÓN ──────────────────────────────────────────────────
console.log("\n━━ Día 1 · operación (55 pedidos)")

// C1 · CUENTA ABIERTA #1 en Principal con 4 pedidos (Anthony la atiende).
const acc1 = await post(
  "/api/open-accounts",
  { tableNumber: "Mesa 3", customerName: "SIM Familia Rondón dia-1" },
  ctx.actor("anthony", P),
)
const account1 = acc1.json?.openAccount
check("D1-CTA-1", "cuenta abierta #1 creada por el mesonero en Mesa 3", Boolean(account1?.id), `status=${acc1.status}`)

const acc1Orders = []
for (let i = 0; i < 4; i += 1) {
  const result = await createOrder(ctx, {
    branchId: P, channel: "mesa-cuenta", items: comboFor(P), seller: "anthony",
    table: "Mesa 3", account: account1?.id, people: i === 0 ? 4 : 0,
  })
  if (result.ok) acc1Orders.push(result.record)
}
check("D1-CTA-2", "la cuenta #1 acumula 4 pedidos asociados", acc1Orders.length === 4, `pedidos=${acc1Orders.length}`)
for (const rec of acc1Orders) await kitchenCycle(ctx, rec, { kitchen: "jesus", waiter: "anthony", deliver: true })

// C2 · CUENTA #2 (Yorgelis, Mesa 5): 2 pedidos que se pagan POR SEPARADO.
const acc2 = await post(
  "/api/open-accounts",
  { tableNumber: "Mesa 5", customerName: "SIM Oficina Torre B dia-1" },
  ctx.actor("yorgelis", P),
)
const account2 = acc2.json?.openAccount
const acc2Orders = []
for (let i = 0; i < 2; i += 1) {
  const result = await createOrder(ctx, {
    branchId: P, channel: "mesa-cuenta", items: comboFor(P), seller: "yorgelis",
    table: "Mesa 5", account: account2?.id, people: i === 0 ? 3 : 0,
  })
  if (result.ok) acc2Orders.push(result.record)
}
for (const rec of acc2Orders) await kitchenCycle(ctx, rec, { kitchen: "jesus", waiter: "yorgelis", deliver: true })
const sep1 = await payOrder(ctx, acc2Orders[0], "efectivo-cambio", "mariafernanda")
const sep2 = await payOrder(ctx, acc2Orders[1], "pagomovil", "mariafernanda")
check("D1-CTA-3", "la cuenta #2 se cobra por pedido (pagos separados: efectivo con cambio + pago móvil)", sep1.ok && sep2.ok, `1=${sep1.ok} 2=${sep2.ok}`)

// C3 · CUENTA #3 en SD que quedará ABIERTA al cierre (se cobra el Día 2).
const acc3 = await post(
  "/api/open-accounts",
  { tableNumber: "SD Mesa 2", customerName: "SIM Peña del Barrio dia-1" },
  ctx.actor("daniela", SD),
)
const account3 = acc3.json?.openAccount
const acc3Result = await createOrder(ctx, {
  branchId: SD, channel: "mesa-cuenta", items: [["Patacón San Diego", 1], ["Refresco 1.5L", 2]],
  seller: "daniela", table: "SD Mesa 2", account: account3?.id, people: 4,
})
if (acc3Result.ok) {
  await kitchenCycle(ctx, acc3Result.record, { kitchen: "carlosalberto", waiter: "daniela", deliver: true })
  st.day1.openAccountCarry = { accountId: account3.id, orderId: acc3Result.record.id, total: acc3Result.record.total, branchId: SD }
  acc3Result.record.carryOpen = true
}
check("D1-CTA-4", "cuenta #3 (SD) queda con 1 pedido entregado SIN cobrar (cruza al Día 2)", Boolean(st.day1.openAccountCarry), JSON.stringify(st.day1.openAccountCarry || {}))

// Conteo: cuentas usadas hasta ahora → P: 4+2=6 mesa-cuenta, SD: 1.
// Faltan por plan: P otras 6 mesa-cuenta (cuenta #4 con 6 pedidos NO — mejor
// 2 cuentas más de 3 pedidos), SD 5 más (cuenta #5 de 5 pedidos).
const acc4 = await post("/api/open-accounts", { tableNumber: "Mesa 6", customerName: "SIM Cumpleaños Marta dia-1" }, ctx.actor("anthony", P))
const account4 = acc4.json?.openAccount
const acc4Orders = []
for (let i = 0; i < 6; i += 1) {
  const result = await createOrder(ctx, {
    branchId: P, channel: "mesa-cuenta", items: comboFor(P), seller: i % 2 ? "anthony" : "yorgelis",
    table: "Mesa 6", account: account4?.id, people: i === 0 ? 6 : 0,
  })
  if (result.ok) acc4Orders.push(result.record)
}
for (const rec of acc4Orders) await kitchenCycle(ctx, rec, { kitchen: "jesus", waiter: "anthony", deliver: true })

const acc5 = await post("/api/open-accounts", { tableNumber: "SD Mesa 4", customerName: "SIM Liga de Dominó dia-1" }, ctx.actor("daniela", SD))
const account5 = acc5.json?.openAccount
const acc5Orders = []
for (let i = 0; i < 5; i += 1) {
  const result = await createOrder(ctx, {
    branchId: SD, channel: "mesa-cuenta", items: comboFor(SD), seller: "daniela",
    table: "SD Mesa 4", account: account5?.id, people: i === 0 ? 5 : 0,
  })
  if (result.ok) acc5Orders.push(result.record)
}
for (const rec of acc5Orders) await kitchenCycle(ctx, rec, { kitchen: "carlosalberto", waiter: "daniela", deliver: true })

// Cobro de cuentas COMPLETAS (payAccount reparte por pedido).
async function payAccountFull(accountId, records, kind, cashier, branchId) {
  const total = round(records.reduce((s, r) => s + r.total, 0))
  const body = {
    action: "payAccount",
    deliveryPaymentIn: kind === "mixto" ? "Mixto" : kind === "efectivo" || kind === "zelle" ? "Divisas" : "Bolívares",
    closeIfPaid: true,
    closedBy: cashier,
  }
  let ledgerEntry
  if (kind === "efectivo") {
    body.amountReceivedUSD = total
    body.paymentMethodUSD = "Efectivo divisas"
    ledgerEntry = { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE }
    bumpQuota(ctx.state, "efectivo")
  } else if (kind === "transferencia") {
    body.amountReceivedVES = round(total * RATE)
    body.paymentMethodVES = "Transferencia"
    ledgerEntry = { vesMethod: "Transferencia", vesAmount: round(total * RATE), rate: RATE }
    bumpQuota(ctx.state, "transferencia")
  } else if (kind === "mixto") {
    const usdPart = round(Math.floor(total / 2))
    body.amountReceivedUSD = usdPart
    body.paymentMethodUSD = "Efectivo divisas"
    body.amountReceivedVES = round((total - usdPart) * RATE)
    body.paymentMethodVES = "Pago móvil"
    ledgerEntry = { usdMethod: "Efectivo divisas", usdAmount: usdPart, vesMethod: "Pago móvil", vesAmount: round((total - usdPart) * RATE), rate: RATE }
    bumpQuota(ctx.state, "mixto")
  }
  const res = await patch(`/api/open-accounts/${accountId}`, body, ctx.actor(cashier, branchId), { label: "PATCH open-account pay" })
  if (res.status === 200) {
    const { recordPayment, reducePending } = await import("./lib/expected-ledger.mjs")
    recordPayment(ctx.ledger, { day: ctx.dayKey, branchId, payment: ledgerEntry })
    for (const rec of records) {
      reducePending(ctx.ledger, { originDay: ctx.dayKey, branchId, amountUSD: rec.total })
      rec.paid = rec.total
      rec.chargedBy = cashier
    }
  }
  return { ok: res.status === 200, status: res.status, total }
}

const payAcc1 = await payAccountFull(account1?.id, acc1Orders, "efectivo", "mariafernanda", P)
check("D1-CTA-5", "la cuenta #1 (4 pedidos) se cobra completa en efectivo y el reparto cae por pedido", payAcc1.ok, `status=${payAcc1.status} total=$${payAcc1.total}`)
if (payAcc1.ok) {
  const firstPaid = await orderRow(acc1Orders[0].id)
  check("D1-CTA-6", "un pedido de la cuenta #1 quedó Pagado en base tras el reparto", firstPaid?.payment_status === "Pagado", `payment_status=${firstPaid?.payment_status}`)
}
const payAcc4 = await payAccountFull(account4?.id, acc4Orders, "mixto", "mariafernanda", P)
check("D1-CTA-7", "la cuenta #4 (6 pedidos, cumpleaños) se cobra completa en MIXTO", payAcc4.ok, `status=${payAcc4.status} total=$${payAcc4.total}`)
const payAcc5 = await payAccountFull(account5?.id, acc5Orders, "transferencia", "roxana", SD)
check("D1-CTA-8", "la cuenta #5 (SD, 5 pedidos) se cobra completa por transferencia", payAcc5.ok, `status=${payAcc5.status} total=$${payAcc5.total}`)

// C4 · MESA SIN CUENTA — P: 11, SD: 7 (con ciclo de cocina y métodos variados)
const mesaKinds = ["efectivo", "pagomovil", "transferencia", "zelle", "efectivo-cambio", "mixto", "punto", "efectivo", "pagomovil", "transferencia", "efectivo"]
const mesaP = []
// 8 aquí + el doble-clic (A1) + el "no listo" (A2) + la cancelación CX1 = 11 mesas P
for (let i = 0; i < 8; i += 1) {
  const result = await createOrder(ctx, {
    branchId: P, channel: "mesa", items: comboFor(P),
    seller: i % 2 ? "anthony" : "yorgelis",
    table: pick(ctx.rng, ["Mesa 1", "Mesa 2", "Mesa 4", "Barra", "Afuera"]),
    verifyStock: i === 0,
  })
  if (result.ok) mesaP.push(result.record)
}
for (const [i, rec] of mesaP.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "jesus", waiter: i % 2 ? "anthony" : "yorgelis", deliver: true })
  if (i === 4) continue // este se cancela ANTES del cobro (ya entregado NO: ver abajo — se cancela otro)
  const pay = await payOrder(ctx, rec, mesaKinds[i % mesaKinds.length], "mariafernanda")
  if (!pay.ok) check(`D1-MESA-P-${i}`, "cobro de mesa falló", false, `status=${pay.status} ${pay.error}`)
}

const mesaSD = []
for (let i = 0; i < 7; i += 1) {
  const result = await createOrder(ctx, {
    branchId: SD, channel: "mesa", items: comboFor(SD), seller: "daniela",
    table: pick(ctx.rng, ["SD Mesa 1", "SD Mesa 3", "SD Terraza"]),
    verifyStock: i === 0,
  })
  if (result.ok) mesaSD.push(result.record)
}
for (const [i, rec] of mesaSD.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "carlosalberto", waiter: "daniela", deliver: i !== 6 })
  if (i === 6) continue // la última mesa de SD se cancela antes de cocina terminar → ver cancelaciones
  const pay = await payOrder(ctx, rec, ["efectivo", "pagomovil", "transferencia", "efectivo-cambio", "zelle", "mixto"][i % 6], "roxana")
  if (!pay.ok) check(`D1-MESA-SD-${i}`, "cobro de mesa SD falló", false, `status=${pay.status} ${pay.error}`)
}

// C5 · PICK UP — P: 5 (uno pagado al retirar), SD: 2
const pickupP = []
for (let i = 0; i < 5; i += 1) {
  const result = await createOrder(ctx, {
    branchId: P, channel: "pickup", items: comboFor(P), seller: null, clientIndex: 100 + i,
  })
  if (result.ok) pickupP.push(result.record)
}
for (const [i, rec] of pickupP.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "jesus" })
  // "pagado al retirar": cocina primero, cobro al final (mismo efecto en libro)
  const pay = await payOrder(ctx, rec, ["efectivo", "pagomovil", "efectivo-cambio", "transferencia", "zelle"][i], "mariafernanda")
  if (i === 0) check("D1-PICKUP-1", "pick up pagado AL RETIRAR (cocina → Listo → cobro)", pay.ok, `status=${pay.ok}`)
}
const pickupSD = []
for (let i = 0; i < 2; i += 1) {
  const result = await createOrder(ctx, { branchId: SD, channel: "pickup", items: comboFor(SD), clientIndex: 120 + i })
  if (result.ok) pickupSD.push(result.record)
}
for (const [i, rec] of pickupSD.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "carlosalberto" })
  await payOrder(ctx, rec, i ? "pagomovil" : "efectivo", "roxana")
}

// C6 · DELIVERY — P: 3 (uno con GPS → costo por km del server), SD: 2
const gpsCliente = "https://maps.google.com/?q=10.2150,-68.0100" // ~2.4km de la sede P
const delivP = []
for (let i = 0; i < 3; i += 1) {
  const withGps = i === 0
  const result = await createOrder(ctx, {
    branchId: P, channel: "delivery", items: comboFor(P), clientIndex: 140 + i,
    deliveryAddress: `Av. ${140 + i}, casa ${i + 2}, Valencia`,
    ...(withGps ? { deliveryMapsUrl: gpsCliente, expectDeliveryCostUSD: 2 } : {}),
  })
  if (result.ok) {
    delivP.push(result.record)
    if (withGps) {
      const row = await orderRow(result.record.id)
      check("D1-DELIV-1", "delivery con GPS: el SERVER cotiza el envío por km ($2, tier ≤3km)", Math.abs(Number(row?.delivery_cost_usd ?? row?.deliveryCostUSD ?? 0) - 2) < 0.01, `delivery_cost=${row?.delivery_cost_usd}`)
    }
  }
}
for (const [i, rec] of delivP.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "jesus" })
  await patch(`/api/orders/${rec.id}`, { status: "Entregado" }, ctx.actor("miguel", P), { label: "PATCH orders/:id (entrega)" })
  await payOrder(ctx, rec, ["efectivo", "pagomovil", "transferencia"][i], "mariafernanda")
}
const delivSD = []
for (let i = 0; i < 2; i += 1) {
  const result = await createOrder(ctx, {
    branchId: SD, channel: "delivery", items: comboFor(SD), clientIndex: 160 + i,
    deliveryAddress: `Urb. San Diego Norte, calle ${i + 4}`,
  })
  if (result.ok) delivSD.push(result.record)
}
for (const [i, rec] of delivSD.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "carlosalberto" })
  await patch(`/api/orders/${rec.id}`, { status: "Entregado" }, ctx.actor("daniela", SD), { label: "PATCH orders/:id (entrega)" })
  await payOrder(ctx, rec, i ? "mixto" : "efectivo", "roxana")
}

// C7 · QR PÚBLICO — P: 3, SD: 2 (clientes anónimos, cobra caja al llegar)
const qrOrders = []
for (const [branchId, count, startIdx] of [[P, 3, 200], [SD, 2, 220]]) {
  for (let i = 0; i < count; i += 1) {
    const result = await createOrder(ctx, {
      branchId, channel: "qr", items: comboFor(branchId), clientIndex: startIdx + i,
      table: branchId === P ? "Mesa 2" : "SD Mesa 1",
    })
    if (result.ok) qrOrders.push(result.record)
  }
}
check("D1-QR-1", "5 pedidos QR públicos creados (3 P + 2 SD) sin credenciales", qrOrders.length === 5, `qr=${qrOrders.length}`)
for (const [i, rec] of qrOrders.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: rec.branchId === P ? "jesus" : "carlosalberto", waiter: rec.branchId === P ? "anthony" : "daniela", deliver: true })
  await payOrder(ctx, rec, ["efectivo", "pagomovil", "transferencia", "efectivo-cambio", "zelle"][i], rec.branchId === P ? "mariafernanda" : "roxana")
}

// C8 · STAFF — 1 por sede (pedido del personal, para llevar, efectivo)
const staffP = await createOrder(ctx, { branchId: P, channel: "staff", items: [["Burger Clásica", 1], ["Refresco 1.5L", 1]], seller: "genesis", name: "STAFF - Génesis (almuerzo)" })
if (staffP.ok) { await kitchenCycle(ctx, staffP.record, { kitchen: "jesus" }); await payOrder(ctx, staffP.record, "efectivo", "mariafernanda") }
const staffSD = await createOrder(ctx, { branchId: SD, channel: "staff", items: [["Salchipapa", 1]], seller: "luis", name: "STAFF - Luis (almuerzo)" })
if (staffSD.ok) { await kitchenCycle(ctx, staffSD.record, { kitchen: "carlosalberto" }); await payOrder(ctx, staffSD.record, "efectivo", "roxana") }

// C9 · MIXTO EN DOS PATAS (3 pedidos de mesa extra en P… NO: el plan exige 55
// exactos — las 2 patas se aplican a pedidos YA contados: el de la Mesa 4 de
// mesaP[5] ya fue cobrado; usamos los pickup restantes NO — para no alterar el
// conteo, las dos patas del Día 1 van sobre los pedidos de mesaP índices 9 y
// 10 que aún no se cobraron si el kind falló). Verificación del plan: 55.
// (Las segundas patas a más profundidad llegan del Día 2 en adelante.)

// ── FASE D · ADVERSARIALES DEL DÍA ────────────────────────────────────────
console.log("\n━━ Día 1 · adversariales")

// A1 · Doble clic / reintento duplicado: mismo clientOrderId dos veces.
const dupKey = `sim-d1-doble-click-${st.seed}`
const dupBody = {
  customerName: "SIM Doble Click dia-1",
  customerPhone: "04141230001",
  tableNumber: "Mesa 1",
  orderType: "Comer aquí",
  exchangeRate: RATE,
  clientOrderId: dupKey,
  items: [{ id: ctx.menus[P]["Burger Clásica"].id, name: "Burger Clásica", price: ctx.menus[P]["Burger Clásica"].price, quantity: 1 }],
}
const dup1 = await post("/api/orders", dupBody, ctx.actor("anthony", P))
const dup2 = await post("/api/orders", dupBody, ctx.actor("anthony", P))
const dupOk = dup1.json?.order?.id && dup2.json?.order?.id === dup1.json.order.id && dup2.json?.idempotent === true
check("D1-ADV-1", "doble clic con la misma clave de idempotencia NO duplica el pedido", Boolean(dupOk), `id1=${dup1.json?.order?.id} id2=${dup2.json?.order?.id} idempotent=${dup2.json?.idempotent}`)
if (dup1.json?.order?.id) {
  // cuenta como pedido del día (canal mesa): asentarlo en libros
  const { recordOrder } = await import("./lib/expected-ledger.mjs")
  const { consumeRecipe } = await import("./lib/expected-inventory.mjs")
  recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: dup1.json.order.totalUSD ?? ctx.menus[P]["Burger Clásica"].price, channel: "mesa", seller: "anthony", people: 1 })
  const prodId = ctx.menus[P]["Burger Clásica"].id
  if (ctx.recipes[P][prodId]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: prodId, count: 1 })
  const rec = { id: dup1.json.order.id, branchId: P, channel: "mesa", seller: "anthony", total: round(Number(dup1.json.order.totalUSD ?? ctx.menus[P]["Burger Clásica"].price)), customer: "SIM Doble Click dia-1", paid: 0, status: "creado" }
  ctx.orders.push(rec)
  await kitchenCycle(ctx, rec, { kitchen: "jesus", waiter: "anthony", deliver: true })
  await payOrder(ctx, rec, "efectivo", "mariafernanda")
  bumpQuota(ctx.state, "reintento-seguro")
}

// A2 · Mesonero intenta entregar un pedido NO listo.
const notReady = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Tequeños (6)", 1]], seller: "yorgelis", table: "Mesa 4" })
if (notReady.ok) {
  const attempt = await patch(`/api/orders/${notReady.record.id}`, { status: "Entregado" }, ctx.actor("yorgelis", P))
  const rowNow = await orderRow(notReady.record.id)
  check("D1-ADV-2", "mesonero NO puede entregar un pedido que no está Listo (compuerta de LISTO)", attempt.status >= 400 || rowNow?.status !== "Entregado", `status=${attempt.status} estado=${rowNow?.status}`)
  await kitchenCycle(ctx, notReady.record, { kitchen: "jesus", waiter: "yorgelis", deliver: true })
  await payOrder(ctx, notReady.record, "pagomovil", "mariafernanda")
}

// A3 · Cajera de SD pide pedidos con header de Principal: el clamp la deja en SU sede.
const roxanaCross = await get("/api/orders", { ...ctx.actor("roxana", SD), "x-branch-id": P })
const crossIds = new Set((roxanaCross.json?.orders || []).map((o) => o.id))
const pIds = ctx.orders.filter((o) => o.branchId === P).map((o) => o.id)
const leakedP = pIds.filter((id) => crossIds.has(id))
check("D1-ADV-3", "Roxana (cajera SD) con x-branch-id de Principal recibe SOLO datos de SD (clamp con datos reales)", roxanaCross.status === 200 && leakedP.length === 0, `status=${roxanaCross.status} filtrados=${leakedP.length} de ${pIds.length}`)

// A4 · Kitchen pide reporte financiero → 403 (diaria).
const jesusReports = await get("/api/reports?period=today", ctx.actor("jesus", P))
check("D1-ADV-4", "kitchen sigue sin poder ver reportes financieros", jesusReports.status === 403, `status=${jesusReports.status}`)

// A5 · Manipulación de PRECIO desde el flujo público (QR).
const realPrice = ctx.menus[P]["Burger Doble Brutal"].price
const hackRes = await post(
  "/api/orders",
  {
    customerName: "SIM Manipulador dia-1",
    customerPhone: "04140001666",
    tableNumber: "Mesa 1",
    orderType: "Comer aquí",
    exchangeRate: RATE,
    items: [{ id: ctx.menus[P]["Burger Doble Brutal"].id, name: "Burger Doble Brutal", price: 0.01, quantity: 1 }],
  },
  publicHeaders("10.81.6.66", P),
)
const hackOrder = hackRes.json?.order
const hackRow = hackOrder?.id ? await orderRow(hackOrder.id) : null
const hackTotal = Number(hackRow?.total_usd ?? hackRow?.total_price ?? NaN)
const priceProtected = !hackOrder?.id || Math.abs(hackTotal - realPrice) < 0.01
check("D1-ADV-5", `el público NO puede fabricar su precio (Doble Brutal $${realPrice})`, priceProtected, `status=${hackRes.status} total_guardado=$${hackTotal}`)
if (hackOrder?.id && !priceProtected) {
  st.day1.priceManipulationOrderId = hackOrder.id
  // El pedido manipulado queda para el expediente del bug; se cancela para no
  // ensuciar la contabilidad del día (con motivo claro y auditado).
  const { recordOrder, recordCancellation } = await import("./lib/expected-ledger.mjs")
  recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: hackTotal, channel: "qr", seller: "público", people: 1 })
  const cancel = await patch(
    `/api/orders/${hackOrder.id}`,
    { status: "Cancelado", cancelReason: "SIM bug BH-SIM-001: precio manipulado por cliente público (evidencia)", inventoryWasUsed: false },
    ctx.actor("genesis", P),
  )
  recordCancellation(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: hackTotal, wasPending: true })
  const { consumeRecipe, returnRecipe } = await import("./lib/expected-inventory.mjs")
  const prodId = ctx.menus[P]["Burger Doble Brutal"].id
  if (ctx.recipes[P][prodId]) {
    consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: prodId, count: 1 })
    returnRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: prodId, count: 1 })
  }
}

// A6 · Pedido vacío y cantidad cero.
const empty = await post("/api/orders", { customerName: "SIM Vacío", tableNumber: "Mesa 1", orderType: "Comer aquí", exchangeRate: RATE, items: [] }, publicHeaders("10.81.6.70", P))
const zeroQty = await post(
  "/api/orders",
  { customerName: "SIM Cero", tableNumber: "Mesa 1", orderType: "Comer aquí", exchangeRate: RATE, items: [{ id: ctx.menus[P]["Burger Clásica"].id, name: "Burger Clásica", price: ctx.menus[P]["Burger Clásica"].price, quantity: 0 }] },
  publicHeaders("10.81.6.71", P),
)
const emptyRejected = empty.status >= 400 || !empty.json?.order?.id
const zeroRejected = zeroQty.status >= 400 || !zeroQty.json?.order?.id || Number(zeroQty.json?.order?.totalUSD || 0) === 0
check("D1-ADV-6", "pedido vacío y cantidad cero se rechazan (o quedan en $0 sin colar dinero)", emptyRejected && zeroRejected, `vacío=${empty.status} cero=${zeroQty.status} ceroTotal=${zeroQty.json?.order?.totalUSD}`)
if (zeroQty.json?.order?.id) {
  st.day1.zeroQtyOrderId = zeroQty.json.order.id
  await patch(`/api/orders/${zeroQty.json.order.id}`, { status: "Cancelado", cancelReason: "SIM: pedido cantidad cero aceptado — evidencia", inventoryWasUsed: false }, ctx.actor("genesis", P))
}
if (empty.json?.order?.id) {
  await patch(`/api/orders/${empty.json.order.id}`, { status: "Cancelado", cancelReason: "SIM: pedido vacío aceptado — evidencia", inventoryWasUsed: false }, ctx.actor("genesis", P))
}

// A7 · Monto venezolano "9.648,99" — el parser canónico del público.
// Se prueba contra el endpoint público de reporte de pago del pedido QR.
const proofTarget = qrOrders.find((o) => o.branchId === P)
if (proofTarget) {
  const proofRes = await post(
    "/api/payment-proofs",
    {
      orderId: proofTarget.id,
      reportedMethod: "Pago móvil (Bs 9.648,99)",
      amountReportedUSD: 0,
      amountReportedVES: 9648.99,
      paymentReference: "004521998877",
      note: "el cliente escribió 9.648,99 (formato venezolano)",
    },
    publicHeaders("10.81.6.80", P),
  )
  check("D1-ADV-7", "comprobante reportado con monto venezolano 9.648,99 entra a revisión", proofRes.status === 200 || proofRes.status === 201, `status=${proofRes.status}`)
  bumpQuota(ctx.state, "pago-reportado")
  bumpQuota(ctx.state, "reportado-bs-formato-ve")
}

// A8 · Sesión inválida.
const badToken = await get("/api/orders", { "Content-Type": "application/json", Authorization: "Bearer token-falso-123", "x-branch-id": P, "x-forwarded-for": "10.81.6.90" })
check("D1-ADV-8", "un Bearer inventado NO abre el panel (401)", badToken.status === 401, `status=${badToken.status}`)

// ── CANCELACIONES DEL DÍA (2) ─────────────────────────────────────────────
console.log("\n━━ Día 1 · cancelaciones")
// CX1 · ANTES de cocina (P): pedido de mesa recién creado.
const cx1 = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Salchipapa", 1], ["Agua mineral", 1]], seller: "anthony", table: "Mesa 1" })
if (cx1.ok) {
  const res = await cancelOrder(ctx, cx1.record, { by: "genesis", reason: "Cliente se arrepintió antes de cocinar", inventoryWasUsed: false })
  const rowDb = await orderRow(cx1.record.id)
  check("D1-CX-1", "cancelación ANTES de cocina: estado Cancelado + motivo + insumos devueltos", res.ok && rowDb?.status === "Cancelado" && String(rowDb?.cancel_reason || rowDb?.cancelReason || "").includes("arrepintió"), `estado=${rowDb?.status}`)
}
// CX2 · ANTES del cobro (SD): mesaSD[6] ya pasó por cocina (Listo, sin entregar).
if (mesaSD[6]) {
  const res = await cancelOrder(ctx, mesaSD[6], { by: "luis", reason: "Cliente se fue sin pagar (pedido listo)", inventoryWasUsed: true })
  const rowDb = await orderRow(mesaSD[6].id)
  check("D1-CX-2", "cancelación ANTES del cobro (pedido listo): ingredientes consumidos NO vuelven", res.ok && rowDb?.status === "Cancelado", `estado=${rowDb?.status}`)
}

// El pedido de mesaP[4] quedó entregado sin cobrar → se cobra al final (no
// era cancelación, era el "pendiente que sí paga tarde").
if (mesaP[4]) await payOrder(ctx, mesaP[4], "zelle", "mariafernanda")

// ── FASE E · VERIFICACIÓN INTERMEDIA ──────────────────────────────────────
console.log("\n━━ Día 1 · verificación de mitad de jornada")
const created = ctx.orders.length
const cancelled = ctx.orders.filter((o) => o.status === "Cancelado").length
check("D1-PLAN-1", "se ejecutaron EXACTAMENTE 55 pedidos del plan (+1 evidencia adversarial si el precio se coló)", created === 55 || created === 56, `creados=${created} (cancelados=${cancelled})`)
const porCanal = {}
for (const o of ctx.orders) porCanal[o.channel] = (porCanal[o.channel] || 0) + 1
logLine(`\nDistribución real por canal: ${JSON.stringify(porCanal)}`)
const porSede = { P: ctx.orders.filter((o) => o.branchId === P).length, SD: ctx.orders.filter((o) => o.branchId === SD).length }
logLine(`Por sede: ${JSON.stringify(porSede)}`)

// ── FASE F · GASTOS Y CIERRE ──────────────────────────────────────────────
console.log("\n━━ Día 1 · gastos y cierre")
const gasto1 = await addExpense(ctx, { branchId: P, by: "genesis", concept: "SIM d1 - Hielo y bolsas del lunes", amountUSD: 14, category: "Otros" })
const gasto2 = await addExpense(ctx, { branchId: SD, by: "luis", concept: "SIM d1 - Gas para la plancha SD", amountUSD: 10, category: "Otros" })
check("D1-GASTO-1", "gastos del día registrados (P $14, SD $10)", gasto1.ok && gasto2.ok)

const closeP = await closeBranchDay(ctx, P, {
  closedBy: "genesis",
  expenses: gasto1.id ? [{ id: gasto1.id, concept: "SIM d1 - Hielo y bolsas del lunes", amountUSD: 14 }] : [],
})
const closeSD = await closeBranchDay(ctx, SD, {
  closedBy: "luis",
  expenses: gasto2.id ? [{ id: gasto2.id, concept: "SIM d1 - Gas para la plancha SD", amountUSD: 10 }] : [],
})

// La cuenta abierta #3 NO forma parte del dinero cobrado de SD.
if (closeSD.ok && st.day1.openAccountCarry) {
  const carry = st.day1.openAccountCarry
  const bookSD = ctx.ledger.days["dia-1"][SD]
  check(
    "D1-CIERRE-CTA",
    "la cuenta abierta (SD) quedó FUERA del dinero cobrado y DENTRO del pendiente",
    Math.abs(bookSD.pendingUSD - carry.total) < 0.01,
    `pendiente del libro=$${bookSD.pendingUSD} cuenta=$${carry.total}`,
  )
}

// Auditoría del día: cobros con autor real.
const paymentAudit = await auditRows({ action: "order.payment.updated", limit: 100 })
const withActor = paymentAudit.filter((a) => a.actor_label && a.actor_role)
check("D1-AUDIT-1", "los cobros del día quedaron auditados con autor real", paymentAudit.length >= 30 && withActor.length === paymentAudit.length, `filas=${paymentAudit.length} conActor=${withActor.length} ejemplo=${paymentAudit[0]?.actor_label}`)

// ── FASE G/H · NOCHE ──────────────────────────────────────────────────────
console.log("\n━━ Día 1 · verificación nocturna")
await nightlyChecks(ctx)
await verifyInventory(ctx)

st.completedDays = Array.from(new Set([...(st.completedDays || []), "dia-1"]))
ctx.persist()
flushPerformance("dia-1")

const result = summary("Día 1 — Lunes suave")
process.exit(result.fail > 0 ? 1 : 0)
