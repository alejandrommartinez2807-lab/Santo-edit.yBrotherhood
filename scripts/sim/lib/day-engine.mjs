// Motor de un día comercial: pedidos por canal, ciclo de cocina, cobros con
// cuotas de escenarios, libro contable e inventario esperados, y cierre
// nocturno verificado al centavo. Los días 1-7 lo parametrizan.
import { guardLive, supabase, simEnv } from "./simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./auth.mjs"
import { get, post, patch, sleep } from "./api-client.mjs"
import { check, markBlocked, summary } from "./assertions.mjs"
import { openDayLog, logLine, loadState, saveState, bumpQuota, appendBug } from "./evidence-writer.mjs"
import { flushPerformance } from "./performance.mjs"
import {
  loadLedger,
  saveLedger,
  recordOrder,
  recordPayment,
  reducePending,
  recordCancellation,
  recordExpense,
  expectedCloseFor,
  round,
} from "./expected-ledger.mjs"
import {
  loadInventoryBook,
  saveInventoryBook,
  consumeRecipe,
  returnRecipe,
  expectedOf,
  applyMove,
} from "./expected-inventory.mjs"
import { stockOf, orderRow, auditRows, integritySweep } from "./db-verifier.mjs"
import { makeRng, pick, pickInt, customerName, customerPhone, customerIp } from "./scenario-generator.mjs"

export const RATE = 40
export const passwordOf = (username) => `Sim-${username}-2026!`

// Precios y recetas por sede se leen UNA vez al abrir el día (el libro los usa
// como referencia; si el server calculara distinto, el cierre no cuadraría y
// eso ES la prueba).
async function loadMenuMap(branchId, dayNumber) {
  const res = await get("/api/public/products", publicHeaders(`10.${80 + dayNumber}.0.1`, branchId))
  const products = res.json?.menuProducts || res.json?.products || []
  const map = {}
  for (const p of products) map[p.name] = { id: p.id, price: Number(p.price), type: p.productType }
  return map
}

async function loadRecipes(branchId) {
  const { data } = await supabase
    .from("inventory_recipes")
    .select("product_id, ingredients")
    .eq("branch_id", branchId)
  const recipes = {}
  for (const row of data || []) {
    recipes[row.product_id] = (row.ingredients || []).map((ing) => ({
      itemId: ing.itemId,
      quantity: Number(ing.quantity),
    }))
  }
  return recipes
}

export async function openDay({ dayNumber, dayKey, title, businessDate, roster }) {
  await guardLive({ requireMarker: true })
  openDayLog(dayKey, title)
  logLine(`Fecha de negocio simulada: ${businessDate} · run=${simEnv.SIMULATION_RUN_ID}`)

  const state = loadState()
  const ledger = loadLedger()
  const invBook = loadInventoryBook()
  const P = state.ids.principal
  const SD = state.ids.sanDiego
  const rng = makeRng(`${state.seed}:${dayKey}`)

  // Sesión real de cada persona del turno.
  for (const username of roster) {
    const login = await loginStaff(username, passwordOf(username))
    if (!login.ok) throw new Error(`login de ${username} falló: ${login.error}`)
  }

  const menus = { [P]: await loadMenuMap(P, dayNumber), [SD]: await loadMenuMap(SD, dayNumber) }
  const recipes = { [P]: await loadRecipes(P), [SD]: await loadRecipes(SD) }

  const ctx = {
    state,
    ledger,
    invBook,
    P,
    SD,
    rng,
    dayKey,
    dayNumber,
    businessDate,
    menus,
    recipes,
    orderSeq: 0,
    orders: [], // registro local de todos los pedidos del día
    persist() {
      saveState(state)
      saveLedger(ledger)
      saveInventoryBook(invBook)
    },
    deviceSeq: 0,
    // Un local real tiene varias tablets/celulares por persona: la IP rota
    // entre 6 dispositivos por usuario. Además de ser fiel, evita que el
    // freno de 10 pedidos/min por IP (probado aparte) frene la simulación.
    actor(username, branchId, deviceIp) {
      const slot = roster.indexOf(username) + 2
      const device = deviceIp || `10.9${dayNumber}.${slot}.${(ctx.deviceSeq++ % 6) + 2}`
      return actorHeaders({ username, ip: device, branchId })
    },
    publicClient(index, branchId) {
      return publicHeaders(customerIp(dayNumber, index), branchId)
    },
  }
  return ctx
}

// items: [[nombre, cantidad]] → payload de items con precio del menú de la sede
export function buildItems(ctx, branchId, items) {
  return items.map(([name, quantity]) => {
    const product = ctx.menus[branchId][name]
    if (!product) throw new Error(`producto '${name}' no existe en el menú de la sede`)
    return { id: product.id, name, price: product.price, quantity }
  })
}

export function itemsTotal(payloadItems) {
  return round(payloadItems.reduce((s, i) => s + i.price * i.quantity, 0))
}

// Crea un pedido (staff o público), lo asienta en los libros y verifica el
// total y el descuento de inventario contra la base.
export async function createOrder(ctx, spec) {
  const {
    branchId,
    channel, // mesa-cuenta | mesa | pickup | delivery | qr | staff
    items,
    seller = null, // username del staff que registra (null = público)
    table = null,
    account = null, // openAccountId
    people = null,
    phone = null,
    name = null,
    note = "",
    deliveryMapsUrl = null,
    deliveryAddress = null,
    expectDeliveryCostUSD = 0,
    clientIndex = 0,
    verifyStock = false,
  } = spec

  ctx.orderSeq += 1
  const payloadItems = buildItems(ctx, branchId, items)
  const total = round(itemsTotal(payloadItems) + expectDeliveryCostUSD)
  const customer = name || customerName(ctx.rng, `${ctx.dayKey}#${ctx.orderSeq}`)

  const orderTypeOf = {
    "mesa-cuenta": "Comer aquí",
    mesa: "Comer aquí",
    pickup: "Para llevar",
    delivery: "Delivery",
    qr: "Comer aquí",
    staff: "Para llevar",
  }
  const body = {
    customerName: customer,
    customerPhone: phone ?? customerPhone(ctx.rng),
    tableNumber: table || (channel === "pickup" || channel === "staff" ? "Para llevar" : channel === "delivery" ? "Delivery" : "Mesa 1"),
    orderType: orderTypeOf[channel],
    exchangeRate: RATE,
    items: payloadItems,
    ...(note ? { orderNote: note, note } : {}),
    ...(account ? { openAccountId: account } : {}),
    ...(deliveryMapsUrl ? { deliveryMapsUrl } : {}),
    ...(deliveryAddress ? { deliveryAddress } : {}),
    // Delivery exige declarar el método de pago previsto (400 sin él).
    ...(channel === "delivery" ? { paymentMethod: spec.paymentMethodLabel || "Efectivo" } : {}),
  }

  const headers = seller
    ? ctx.actor(seller, branchId)
    : ctx.publicClient(clientIndex || ctx.orderSeq, branchId)
  const res = await post("/api/orders", body, headers, { label: "POST /api/orders" })
  const order = res.json?.order
  if (!order?.id) {
    return { ok: false, status: res.status, error: res.json?.error, total, customer }
  }

  // Libros: venta originada + consumo de receta por ítem.
  recordOrder(ctx.ledger, {
    day: ctx.dayKey,
    branchId,
    totalUSD: round(Number(order.totalUSD ?? total)),
    channel,
    seller: seller || "público",
    people: people ?? (channel.startsWith("mesa") ? pickInt(ctx.rng, 2, 5) : channel === "qr" ? pickInt(ctx.rng, 1, 3) : 1),
  })
  for (const item of payloadItems) {
    if (ctx.recipes[branchId][item.id]) {
      consumeRecipe(ctx.invBook, { branchId, recipes: ctx.recipes[branchId], productId: item.id, count: item.quantity })
    }
  }

  const serverTotal = round(Number(order.totalUSD ?? order.totalPrice ?? NaN))
  const totalOk = Math.abs(serverTotal - total) < 0.01
  if (!totalOk) {
    check(`${ctx.dayKey}-total-${ctx.orderSeq}`, `el server calcula el total esperado ($${total})`, false, `server=$${serverTotal} pedido=${order.id} canal=${channel}`)
  }

  if (verifyStock) {
    // Verificación puntual: el primer insumo de la receta del primer ítem.
    const first = payloadItems.find((i) => ctx.recipes[branchId][i.id]?.length)
    if (first) {
      const ing = ctx.recipes[branchId][first.id][0]
      const real = await stockOf(ing.itemId)
      const expected = expectedOf(ctx.invBook, branchId, ing.itemId)
      check(
        `${ctx.dayKey}-stock-${ctx.orderSeq}`,
        `el pedido descuenta la receta (insumo ${ing.itemId.slice(0, 6)}…)`,
        Math.abs(real - expected) < 0.001,
        `esperado=${expected} real=${real}`,
      )
    }
  }

  const record = { id: order.id, branchId, channel, seller, total: serverTotal || total, customer, account, status: "creado", paid: 0 }
  ctx.orders.push(record)
  return { ok: true, order, record, total: record.total, customer }
}

// Ciclo de cocina: Preparando → Listo (→ Entregado si se pide).
export async function kitchenCycle(ctx, orderRecord, { kitchen, waiter = null, deliver = false } = {}) {
  const headers = ctx.actor(kitchen, orderRecord.branchId)
  await patch(`/api/orders/${orderRecord.id}`, { status: "Preparando" }, headers, { label: "PATCH orders/:id (cocina)" })
  await patch(`/api/orders/${orderRecord.id}`, { status: "Listo" }, headers, { label: "PATCH orders/:id (cocina)" })
  orderRecord.status = "Listo"
  if (deliver && waiter) {
    const waiterHeaders = ctx.actor(waiter, orderRecord.branchId)
    await patch(`/api/orders/${orderRecord.id}`, { status: "Entregado" }, waiterHeaders, { label: "PATCH orders/:id (entrega)" })
    orderRecord.status = "Entregado"
  }
}

// Cobro según especie. kind:
//  efectivo | efectivo-cambio | zelle | transferencia | pagomovil | punto |
//  mixto (una llamada) | mixto-2-patas (segunda pata después)
export async function payOrder(ctx, orderRecord, kind, cashier, opts = {}) {
  const headers = ctx.actor(cashier, orderRecord.branchId, opts.deviceIp)
  const total = round(orderRecord.total - (orderRecord.paid || 0))
  const day = opts.collectDay || ctx.dayKey
  let body
  let ledgerEntry
  switch (kind) {
    case "efectivo":
      body = { amountReceivedUSD: total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }
      ledgerEntry = { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE }
      bumpQuota(ctx.state, "efectivo")
      break
    case "efectivo-cambio": {
      const tendered = round(total + pick(ctx.rng, [1, 2, 5, 0.5]))
      body = {
        amountReceivedUSD: total,
        paymentMethodUSD: "Efectivo divisas",
        deliveryPaymentIn: "Divisas",
        paymentNote: `Recibió $${tendered.toFixed(2)}, cambio $${round(tendered - total).toFixed(2)}`,
      }
      ledgerEntry = { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE }
      bumpQuota(ctx.state, "efectivo")
      bumpQuota(ctx.state, "efectivo-cambio")
      break
    }
    case "zelle":
      body = { amountReceivedUSD: total, paymentMethodUSD: "Zelle", deliveryPaymentIn: "Divisas" }
      ledgerEntry = { usdMethod: "Zelle", usdAmount: total, rate: RATE }
      break
    case "transferencia": {
      const ves = round(total * RATE)
      body = { amountReceivedVES: ves, paymentMethodVES: "Transferencia", deliveryPaymentIn: "Bolívares" }
      ledgerEntry = { vesMethod: "Transferencia", vesAmount: ves, rate: RATE }
      bumpQuota(ctx.state, "transferencia")
      break
    }
    case "pagomovil": {
      const ves = round(total * RATE)
      body = { amountReceivedVES: ves, paymentMethodVES: "Pago móvil", deliveryPaymentIn: "Bolívares" }
      ledgerEntry = { vesMethod: "Pago móvil", vesAmount: ves, rate: RATE }
      bumpQuota(ctx.state, "pagomovil")
      break
    }
    case "punto": {
      const ves = round(total * RATE)
      body = { amountReceivedVES: ves, paymentMethodVES: "Punto", deliveryPaymentIn: "Bolívares" }
      ledgerEntry = { vesMethod: "Punto", vesAmount: ves, rate: RATE }
      break
    }
    case "mixto": {
      const usdPart = round(Math.max(1, Math.floor(total / 2)))
      const vesPart = round((total - usdPart) * RATE)
      body = {
        amountReceivedUSD: usdPart,
        paymentMethodUSD: "Efectivo divisas",
        amountReceivedVES: vesPart,
        paymentMethodVES: "Pago móvil",
        deliveryPaymentIn: "Mixto",
      }
      ledgerEntry = { usdMethod: "Efectivo divisas", usdAmount: usdPart, vesMethod: "Pago móvil", vesAmount: vesPart, rate: RATE }
      bumpQuota(ctx.state, "mixto")
      break
    }
    default:
      throw new Error(`kind de pago desconocido: ${kind}`)
  }

  const res = await patch(`/api/orders/${orderRecord.id}/payment`, body, headers, { label: "PATCH payment" })
  if (res.status !== 200) return { ok: false, status: res.status, error: res.json?.error }

  recordPayment(ctx.ledger, { day, branchId: orderRecord.branchId, payment: ledgerEntry, orderTotalUSD: total })
  reducePending(ctx.ledger, { originDay: orderRecord.originDay || ctx.dayKey, branchId: orderRecord.branchId, amountUSD: total })
  orderRecord.paid = round((orderRecord.paid || 0) + total)
  orderRecord.paymentKind = kind
  orderRecord.chargedBy = cashier
  return { ok: true, order: res.json?.order }
}

// Pago mixto en DOS patas (la segunda llega después, con candado optimista).
export async function payMixedTwoLegs(ctx, orderRecord, cashier, { secondDelayMs = 0, vesMethod = "Pago móvil" } = {}) {
  const headers = ctx.actor(cashier, orderRecord.branchId)
  const total = orderRecord.total
  const usdPart = round(Math.max(1, Math.floor(total * 0.6)))
  const vesRest = round((total - usdPart) * RATE)

  const first = await patch(
    `/api/orders/${orderRecord.id}/payment`,
    { amountReceivedUSD: usdPart, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Mixto" },
    headers,
    { label: "PATCH payment" },
  )
  if (first.status !== 200) return { ok: false, leg: 1, status: first.status }
  const afterFirst = first.json?.order
  if (secondDelayMs) await sleep(secondDelayMs)

  const second = await patch(
    `/api/orders/${orderRecord.id}/payment`,
    {
      amountReceivedUSD: usdPart,
      paymentMethodUSD: "Efectivo divisas",
      amountReceivedVES: vesRest,
      paymentMethodVES: vesMethod,
      deliveryPaymentIn: "Mixto",
      expectedPrevious: { amountReceivedUSD: usdPart, amountReceivedVES: 0 },
    },
    headers,
    { label: "PATCH payment" },
  )
  if (second.status !== 200) return { ok: false, leg: 2, status: second.status, afterFirst }

  recordPayment(ctx.ledger, {
    day: ctx.dayKey,
    branchId: orderRecord.branchId,
    payment: { usdMethod: "Efectivo divisas", usdAmount: usdPart, vesMethod, vesAmount: vesRest, rate: RATE },
  })
  reducePending(ctx.ledger, { originDay: orderRecord.originDay || ctx.dayKey, branchId: orderRecord.branchId, amountUSD: total })
  orderRecord.paid = total
  orderRecord.paymentKind = "mixto-2-patas"
  orderRecord.chargedBy = cashier
  bumpQuota(ctx.state, "mixto")
  bumpQuota(ctx.state, "segunda-pata")
  return { ok: true, order: second.json?.order, partialStatus: afterFirst?.paymentStatus }
}

// Cancela un pedido con motivo y efecto declarado sobre inventario.
export async function cancelOrder(ctx, orderRecord, { by, reason, inventoryWasUsed }) {
  const headers = ctx.actor(by, orderRecord.branchId)
  const res = await patch(
    `/api/orders/${orderRecord.id}`,
    { status: "Cancelado", cancelReason: reason, inventoryWasUsed },
    headers,
    { label: "PATCH orders/:id (cancelar)" },
  )
  if (res.status !== 200) return { ok: false, status: res.status, error: res.json?.error }
  recordCancellation(ctx.ledger, { day: ctx.dayKey, branchId: orderRecord.branchId, totalUSD: orderRecord.total, wasPending: !orderRecord.paid })
  if (!inventoryWasUsed) {
    // los insumos vuelven al libro esperado
    for (const item of await orderItemsOf(orderRecord.id)) {
      if (ctx.recipes[orderRecord.branchId][item.product_id]) {
        returnRecipe(ctx.invBook, {
          branchId: orderRecord.branchId,
          recipes: ctx.recipes[orderRecord.branchId],
          productId: item.product_id,
          count: Number(item.quantity),
        })
      }
    }
  }
  orderRecord.status = "Cancelado"
  return { ok: true }
}

async function orderItemsOf(orderId) {
  const { data } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId)
  return data || []
}

// Gasto del día.
export async function addExpense(ctx, { branchId, by, concept, amountUSD, category = "Otros" }) {
  const res = await post(
    "/api/day-expenses",
    { concept, amountUSD, category, method: "Efectivo" },
    ctx.actor(by, branchId),
    { label: "POST day-expenses" },
  )
  const id = res.json?.dayExpense?.id || res.json?.expense?.id
  if (res.status === 200 || res.status === 201) {
    recordExpense(ctx.ledger, { day: ctx.dayKey, branchId, amountUSD })
  }
  return { ok: res.status === 200 || res.status === 201, id }
}

// CIERRE NOCTURNO por sede: arma el cierre desde el LIBRO ESPERADO, lo
// registra y verifica que la base lo guardó idéntico.
export async function closeBranchDay(ctx, branchId, { closedBy, expenses = [], carryPendingUSD = 0 }) {
  const expected = expectedCloseFor(ctx.ledger, ctx.dayKey, branchId)
  const label = branchId === ctx.P ? "Principal" : "San Diego"
  const paymentByUSDMethod = Object.entries(expected.byMethodUSD).map(([labelKey, v]) => ({
    label: labelKey,
    count: v.count,
    totalUSD: v.totalUSD,
    totalVES: 0,
  }))
  const paymentByVESMethod = Object.entries(expected.byMethodVES).map(([labelKey, v]) => ({
    label: labelKey,
    count: v.count,
    totalUSD: v.totalUSD,
    totalVES: v.totalVES,
  }))

  const book = ctx.ledger.days[ctx.dayKey][branchId]
  const res = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: `${ctx.businessDate} (${ctx.dayKey})`,
        summaryText: `sim:${simEnv.SIMULATION_RUN_ID} · cierre comercial ${ctx.dayKey} · ${label}`,
        ordersRegistered: expected.orders,
        totalSoldUSD: book.grossSalesUSD,
        realCollectedUSD: expected.collectedUSD,
        realCashUSD: expected.cashUSD,
        realVES: expected.vesTotal,
        realVESEquivalentUSD: expected.vesEquivalentUSD,
        realPendingUSD: round(book.pendingUSD + carryPendingUSD),
        totalConfirmedUSD: expected.collectedUSD,
        paymentByUSDMethod,
        paymentByVESMethod,
        expenses,
      },
    },
    ctx.actor(closedBy, branchId),
    { label: "POST day-close" },
  )
  const closeId = res.json?.dayClose?.id
  check(`${ctx.dayKey}-CIERRE-${label}`, `cierre de ${label} registrado`, res.status === 200 && Boolean(closeId), `status=${res.status}`)
  if (!closeId) return { ok: false }

  const { data: closeRowDb } = await supabase.from("day_closes").select("branch_id, data").eq("id", closeId).maybeSingle()
  const snapshot = closeRowDb?.data || {}
  check(
    `${ctx.dayKey}-CIERRE-${label}-centavo`,
    `el cierre de ${label} cuadra AL CENTAVO con el libro esperado`,
    closeRowDb?.branch_id === branchId &&
      Math.abs(Number(snapshot.realCollectedUSD || 0) - expected.collectedUSD) < 0.01 &&
      Math.abs(Number(snapshot.realCashUSD || 0) - expected.cashUSD) < 0.01 &&
      Math.abs(Number(snapshot.realVES || 0) - expected.vesTotal) < 0.01,
    `esperado: $${expected.collectedUSD} efectivo=$${expected.cashUSD} Bs=${expected.vesTotal} · ` +
      `real: $${snapshot.realCollectedUSD} efectivo=$${snapshot.realCashUSD} Bs=${snapshot.realVES}`,
  )
  ;(ctx.state.ids.closes ||= {})[`${ctx.dayKey}:${label}`] = closeId
  return { ok: true, closeId, expected }
}

// Verificación nocturna transversal (sección 21).
export async function nightlyChecks(ctx) {
  const problems = await integritySweep()
  check(`${ctx.dayKey}-NOCHE-integridad`, "sin huérfanos, sin registros sin sede, sin auditoría sin actor", problems.length === 0, problems.slice(0, 5).join(" · ") || "limpio")

  // Sin filtración: cada pedido del día quedó en SU sede.
  const { data: allOrders } = await supabase.from("orders").select("id, branch_id")
  const mine = new Map(ctx.orders.map((o) => [o.id, o.branchId]))
  let crossed = 0
  for (const row of allOrders || []) {
    if (mine.has(row.id) && mine.get(row.id) !== row.branch_id) crossed += 1
  }
  check(`${ctx.dayKey}-NOCHE-sedes`, "ningún pedido del día cruzó de sede", crossed === 0, `cruzados=${crossed}`)

  // Pagos: ningún pedido Pagado con menos dinero del total.
  const ids = ctx.orders.map((o) => o.id)
  const { data: paidRows } = await supabase
    .from("orders")
    .select("id, payment_status, total_usd, payment_received_equiv_usd, status")
    .in("id", ids.slice(0, 200))
  let underpaid = 0
  for (const row of paidRows || []) {
    if (row.payment_status === "Pagado" && Number(row.payment_received_equiv_usd) + 0.009 < Number(row.total_usd)) underpaid += 1
  }
  check(`${ctx.dayKey}-NOCHE-pagos`, "ningún pedido 'Pagado' recibió menos que su total", underpaid === 0, `subpagados=${underpaid}`)
  return { problems }
}

// Verificación de inventario del día: TODOS los insumos de ambas sedes
// contra el libro esperado. Diferencia = bug.
export async function verifyInventory(ctx) {
  const { data: items } = await supabase.from("inventory_items").select("id, name, quantity, branch_id")
  let mismatches = []
  for (const item of items || []) {
    const expected = expectedOf(ctx.invBook, item.branch_id, item.id)
    if (expected === undefined) continue
    if (Math.abs(Number(item.quantity) - expected) > 0.005) {
      mismatches.push(`${item.name}@${item.branch_id === ctx.P ? "P" : "SD"}: esperado=${expected} real=${item.quantity}`)
    }
  }
  check(`${ctx.dayKey}-NOCHE-inventario`, "el inventario REAL cuadra con el libro esperado (36 insumos)", mismatches.length === 0, mismatches.slice(0, 6).join(" · ") || "exacto")
  return mismatches
}

export { check, markBlocked, summary, logLine, bumpQuota, appendBug, get, post, patch, sleep, actorHeaders, publicHeaders, auditRows, orderRow, stockOf, round, flushPerformance, pick, pickInt }
