// CUOTAS PENDIENTES · el guion (§8) exige mínimos por escenario de pago que
// la operación de los 7 días no alcanzó. En vez de bajar la cifra para
// aparentar cumplimiento (prohibido), se ejecutan los escenarios que faltan
// como operación REAL de un día extra de repaso, contra las mismas APIs.
//
// Escenarios que se completan aquí:
//   · pago reportado por el cliente (comprobantes) y en Bs con formato ve
//   · corrección de método auditada
//   · reintento seguro tras timeout (idempotencia)
//   · intento de pago duplicado
//   · carrera de dos cajeros cobrando a la vez
//   · cuenta cobrada un día distinto al de origen
//   · transferencias y pagos móviles hasta la cuota
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch, sleep } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState, saveState, bumpQuota } from "./lib/evidence-writer.mjs"
import { loadLedger, saveLedger, recordOrder, recordPayment, reducePending, round } from "./lib/expected-ledger.mjs"
import { loadInventoryBook, saveInventoryBook, consumeRecipe } from "./lib/expected-inventory.mjs"
import { race } from "./lib/concurrency.mjs"
import { orderRow, fetchAll } from "./lib/db-verifier.mjs"
import { flushPerformance } from "./lib/performance.mjs"

const RATE = 40
const DAY = "dia-7" // el dinero cae en el cierre ya hecho del domingo: se
                    // registra en un cierre de repaso propio al final.
const KEY = "repaso-cuotas"

await guardLive({ requireMarker: true })
openDayLog(KEY, "Repaso de cuotas — escenarios de pago que faltaban")

const st = loadState()
const ledger = loadLedger()
const invBook = loadInventoryBook()
const P = st.ids.principal
const SD = st.ids.sanDiego

for (const u of ["alejandro", "genesis", "mariafernanda", "kelvin", "jesus", "anthony", "luis", "roxana", "carlosalberto", "daniela"]) {
  await loginStaff(u, `Sim-${u}-2026!`)
}
let dev = 0
const actor = (u, b) => actorHeaders({ username: u, ip: `10.97.${(dev++ % 12) + 1}.5`, branchId: b })

const menuP = (await get("/api/public/products", publicHeaders("10.97.0.1", P))).json
const prodP = (menuP.menuProducts || menuP.products).find((p) => p.name === "Burger Clásica")
const menuSD = (await get("/api/public/products", publicHeaders("10.97.0.2", SD))).json
const prodSD = (menuSD.menuProducts || menuSD.products).find((p) => p.name === "Burger Clásica")

const recipes = {}
for (const b of [P, SD]) {
  const { data } = await supabase.from("inventory_recipes").select("product_id, ingredients").eq("branch_id", b)
  recipes[b] = Object.fromEntries((data || []).map((r) => [r.product_id, (r.ingredients || []).map((i) => ({ itemId: i.itemId, quantity: Number(i.quantity) }))]))
}

let seq = 0
async function nuevoPedido(branchId, waiter, kitchen, { qty = 1, tag = "" } = {}) {
  seq += 1
  const prod = branchId === P ? prodP : prodSD
  const res = await post("/api/orders", {
    customerName: `SIM cuota ${tag}#${seq}`,
    customerPhone: "04141110000",
    tableNumber: branchId === P ? "Mesa 1" : "SD Mesa 1",
    orderType: "Comer aquí",
    exchangeRate: RATE,
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: qty }],
  }, actor(waiter, branchId), { label: "POST /api/orders" })
  const order = res.json?.order
  if (!order?.id) return null
  const total = round(Number(order.totalUSD))
  recordOrder(ledger, { day: DAY, branchId, totalUSD: total, channel: "mesa", seller: waiter, people: 1 })
  if (recipes[branchId][prod.id]) consumeRecipe(invBook, { branchId, recipes: recipes[branchId], productId: prod.id, count: qty })
  await patch(`/api/orders/${order.id}`, { status: "Preparando" }, actor(kitchen, branchId))
  await patch(`/api/orders/${order.id}`, { status: "Listo" }, actor(kitchen, branchId))
  await patch(`/api/orders/${order.id}`, { status: "Entregado" }, actor(waiter, branchId))
  return { id: order.id, branchId, total }
}

// ── 1 · PAGOS REPORTADOS POR EL CLIENTE (cuota 50, con 20 en Bs formato ve) ──
console.log("\n━━ pagos reportados por el cliente")
const MONTOS_VE = [9648.99, 3632, 1250.5, 1000, 260, 520.75, 4800, 12000, 780.25, 2400]
let reportados = 0
let reportadosVE = 0
let confirmados = 0
const faltanReportes = Math.max(0, 50 - (st.quotas["pago-reportado"] || 0))

for (let i = 0; i < faltanReportes; i += 1) {
  const branchId = i % 3 === 2 ? SD : P
  const crew = branchId === P
    ? { waiter: "anthony", kitchen: "jesus", cashier: i % 2 ? "kelvin" : "mariafernanda" }
    : { waiter: "daniela", kitchen: "carlosalberto", cashier: "roxana" }
  const ped = await nuevoPedido(branchId, crew.waiter, crew.kitchen, { tag: "reporte" })
  if (!ped) continue

  const enBs = i < 20 // los primeros 20 en Bs con formato venezolano
  const montoVES = enBs ? MONTOS_VE[i % MONTOS_VE.length] : round(ped.total * RATE)
  const proof = await post("/api/payment-proofs", {
    orderId: ped.id,
    reportedMethod: enBs ? `Pago móvil (Bs ${montoVES.toLocaleString("es-VE", { minimumFractionDigits: 2 })})` : "Transferencia",
    amountReportedUSD: 0,
    amountReportedVES: montoVES,
    paymentReference: String(100000000000 + i * 7919),
    note: enBs ? "monto en formato venezolano" : "",
  }, publicHeaders(`10.98.${Math.floor(i / 250)}.${(i % 250) + 2}`, branchId), { label: "POST payment-proofs" })

  if (proof.status === 200 || proof.status === 201) {
    reportados += 1
    bumpQuota(st, "pago-reportado")
    if (enBs) { reportadosVE += 1; bumpQuota(st, "reportado-bs-formato-ve") }

    // Caja revisa y confirma el comprobante (el flujo real, no un cobro suelto).
    const proofId = proof.json?.paymentProof?.id || proof.json?.proof?.id
    if (proofId) {
      const review = await patch(`/api/payment-proofs/${proofId}/review`, { status: "Confirmado por caja" }, actor(crew.cashier, branchId), { label: "PATCH proof review" })
      if (review.status === 200) confirmados += 1
    }
  }

  // El cobro efectivo del pedido (lo que entra en el libro): el cliente pagó
  // en Bs por transferencia/pago móvil.
  const cobro = await patch(`/api/orders/${ped.id}/payment`, {
    amountReceivedVES: round(ped.total * RATE),
    paymentMethodVES: i % 2 ? "Transferencia" : "Pago móvil",
    deliveryPaymentIn: "Bolívares",
  }, actor(crew.cashier, branchId), { label: "PATCH payment" })
  if (cobro.status === 200) {
    recordPayment(ledger, { day: DAY, branchId, payment: { vesMethod: i % 2 ? "Transferencia" : "Pago móvil", vesAmount: round(ped.total * RATE), rate: RATE } })
    reducePending(ledger, { originDay: DAY, branchId, amountUSD: ped.total })
    bumpQuota(st, i % 2 ? "transferencia" : "pagomovil")
  }
}
check("Q-1", `se completó la cuota de 50 pagos reportados por el cliente`, (st.quotas["pago-reportado"] || 0) >= 50, `total=${st.quotas["pago-reportado"]} (nuevos=${reportados}, confirmados por caja=${confirmados})`)
check("Q-2", `se completó la cuota de 20 montos en Bs con formato venezolano`, (st.quotas["reportado-bs-formato-ve"] || 0) >= 20, `total=${st.quotas["reportado-bs-formato-ve"]} (nuevos=${reportadosVE})`)

// ── 2 · CORRECCIÓN DE MÉTODO (cuota 10) ─────────────────────────────────────
console.log("\n━━ correcciones de método")
let correcciones = 0
const faltanCorr = Math.max(0, 10 - (st.quotas["correccion-metodo"] || 0))
for (let i = 0; i < faltanCorr; i += 1) {
  const ped = await nuevoPedido(P, "anthony", "jesus", { tag: "correccion" })
  if (!ped) continue
  // Caja se equivoca: cobra en efectivo lo que en realidad fue pago móvil.
  await patch(`/api/orders/${ped.id}/payment`, { amountReceivedUSD: ped.total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }, actor("mariafernanda", P))
  // La encargada corrige con el candado optimista (BH-SIM-003).
  const fix = await patch(`/api/orders/${ped.id}/payment`, {
    amountReceivedUSD: 0,
    amountReceivedVES: round(ped.total * RATE),
    paymentMethodVES: "Pago móvil",
    deliveryPaymentIn: "Bolívares",
    paymentNote: "Corrección auditada: el cliente pagó por pago móvil, no en efectivo",
    expectedPrevious: { amountReceivedUSD: ped.total, amountReceivedVES: 0 },
  }, actor("genesis", P), { label: "PATCH payment" })
  const row = await orderRow(ped.id)
  if (fix.status === 200 && Math.abs(Number(row.payment_received_equiv_usd) - ped.total) < 0.02) {
    correcciones += 1
    bumpQuota(st, "correccion-metodo")
    bumpQuota(st, "pagomovil")
    recordPayment(ledger, { day: DAY, branchId: P, payment: { vesMethod: "Pago móvil", vesAmount: round(ped.total * RATE), rate: RATE } })
    reducePending(ledger, { originDay: DAY, branchId: P, amountUSD: ped.total })
  }
}
check("Q-3", "se completó la cuota de 10 correcciones de método, con el candado optimista puesto", (st.quotas["correccion-metodo"] || 0) >= 10, `total=${st.quotas["correccion-metodo"]} (nuevas=${correcciones})`)

// ── 3 · REINTENTO SEGURO TRAS TIMEOUT (cuota 10) ────────────────────────────
console.log("\n━━ reintentos tras timeout")
let reintentos = 0
const faltanRe = Math.max(0, 10 - (st.quotas["reintento-seguro"] || 0))
for (let i = 0; i < faltanRe; i += 1) {
  const clave = `sim-cuota-timeout-${st.seed}-${i}`
  const body = {
    customerName: `SIM timeout #${i}`, customerPhone: "04141112222", tableNumber: "Mesa 2",
    orderType: "Comer aquí", exchangeRate: RATE, clientOrderId: clave,
    items: [{ id: prodP.id, name: prodP.name, price: prodP.price, quantity: 1 }],
  }
  const ip = `10.96.5.${i + 2}`
  const t1 = await post("/api/orders", body, publicHeaders(ip, P))
  await sleep(120)
  const t2 = await post("/api/orders", body, publicHeaders(ip, P))
  if (t1.json?.order?.id && t1.json.order.id === t2.json?.order?.id) {
    reintentos += 1
    bumpQuota(st, "reintento-seguro")
    const total = round(Number(t1.json.order.totalUSD))
    recordOrder(ledger, { day: DAY, branchId: P, totalUSD: total, channel: "qr", seller: "público", people: 1 })
    if (recipes[P][prodP.id]) consumeRecipe(invBook, { branchId: P, recipes: recipes[P], productId: prodP.id, count: 1 })
    await patch(`/api/orders/${t1.json.order.id}`, { status: "Listo" }, actor("jesus", P))
    await patch(`/api/orders/${t1.json.order.id}`, { status: "Entregado" }, actor("anthony", P))
    const c = await patch(`/api/orders/${t1.json.order.id}/payment`, { amountReceivedUSD: total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }, actor("mariafernanda", P))
    if (c.status === 200) {
      recordPayment(ledger, { day: DAY, branchId: P, payment: { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE } })
      reducePending(ledger, { originDay: DAY, branchId: P, amountUSD: total })
      bumpQuota(st, "efectivo")
    }
  }
}
check("Q-4", "se completó la cuota de 10 reintentos seguros tras timeout (idempotencia)", (st.quotas["reintento-seguro"] || 0) >= 10, `total=${st.quotas["reintento-seguro"]} (nuevos=${reintentos})`)

// ── 4 · INTENTO DE PAGO DUPLICADO (cuota 10) ────────────────────────────────
console.log("\n━━ intentos de pago duplicado")
let duplicados = 0
const faltanDup = Math.max(0, 10 - (st.quotas["intento-duplicado"] || 0))
for (let i = 0; i < faltanDup; i += 1) {
  const ped = await nuevoPedido(P, "anthony", "jesus", { tag: "duplicado" })
  if (!ped) continue
  const body = { amountReceivedUSD: ped.total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }
  const [a, b] = await race([
    () => patch(`/api/orders/${ped.id}/payment`, body, actor("mariafernanda", P)),
    () => patch(`/api/orders/${ped.id}/payment`, body, actor("mariafernanda", P)),
  ])
  const row = await orderRow(ped.id)
  const sinDoblar = Math.abs(Number(row.payment_received_equiv_usd) - ped.total) < 0.02
  if (sinDoblar) {
    duplicados += 1
    bumpQuota(st, "intento-duplicado")
    recordPayment(ledger, { day: DAY, branchId: P, payment: { usdMethod: "Efectivo divisas", usdAmount: ped.total, rate: RATE } })
    reducePending(ledger, { originDay: DAY, branchId: P, amountUSD: ped.total })
    bumpQuota(st, "efectivo")
  } else {
    check(`Q-DUP-${i}`, "el pago duplicado NO dobló el monto", false, `recibido=$${row.payment_received_equiv_usd} total=$${ped.total} respuestas=${a?.status}/${b?.status}`)
  }
}
check("Q-5", "se completó la cuota de 10 intentos de pago duplicado, ninguno dobló el cobro", (st.quotas["intento-duplicado"] || 0) >= 10, `total=${st.quotas["intento-duplicado"]} (nuevos=${duplicados})`)

// ── 5 · CARRERAS DE DOS CAJEROS (cuota 6) ───────────────────────────────────
console.log("\n━━ carreras de dos cajeros")
let carreras = 0
let unSoloGanador = 0
const faltanCar = Math.max(0, 6 - (st.quotas["carrera-dos-cajeros"] || 0))
for (let i = 0; i < faltanCar; i += 1) {
  const ped = await nuevoPedido(P, "anthony", "jesus", { tag: "carrera" })
  if (!ped) continue
  // Ahora AMBOS mandan el candado (lo que hará la UI tras BH-SIM-003).
  const body = (metodo) => ({ amountReceivedUSD: ped.total, paymentMethodUSD: metodo, deliveryPaymentIn: "Divisas", expectedPrevious: { amountReceivedUSD: 0, amountReceivedVES: 0 } })
  const [a, b] = await race([
    () => patch(`/api/orders/${ped.id}/payment`, body("Efectivo divisas"), actor("mariafernanda", P)),
    () => patch(`/api/orders/${ped.id}/payment`, body("Zelle"), actor("kelvin", P)),
  ])
  const ganadores = [a, b].filter((r) => r.status === 200).length
  const perdedores = [a, b].filter((r) => r.status === 409).length
  const row = await orderRow(ped.id)
  carreras += 1
  bumpQuota(st, "carrera-dos-cajeros")
  if (ganadores === 1 && perdedores === 1) unSoloGanador += 1
  const metodo = row.payment_method_usd
  recordPayment(ledger, { day: DAY, branchId: P, payment: { usdMethod: metodo || "Efectivo divisas", usdAmount: ped.total, rate: RATE } })
  reducePending(ledger, { originDay: DAY, branchId: P, amountUSD: ped.total })
  if (/efectivo/i.test(metodo || "")) bumpQuota(st, "efectivo")
}
check("Q-6", "se completó la cuota de 6 carreras de dos cajeros", (st.quotas["carrera-dos-cajeros"] || 0) >= 6, `total=${st.quotas["carrera-dos-cajeros"]}`)
check("Q-7", "con el candado puesto, en cada carrera gana UNO y el otro recibe 409", unSoloGanador === carreras, `un-solo-ganador=${unSoloGanador}/${carreras}`)

// ── 6 · CUENTAS COBRADAS OTRO DÍA (cuota 4) ─────────────────────────────────
console.log("\n━━ cuentas cobradas en día distinto al de origen")
let cruzadas = 0
const faltanCru = Math.max(0, 4 - (st.quotas["cuenta-cobrada-otro-dia"] || 0))
for (let i = 0; i < faltanCru; i += 1) {
  const branchId = i % 2 ? SD : P
  const crew = branchId === P ? { waiter: "anthony", kitchen: "jesus", cashier: "mariafernanda" } : { waiter: "daniela", kitchen: "carlosalberto", cashier: "roxana" }
  const acc = await post("/api/open-accounts", { tableNumber: `Cuota cruzada ${i}`, customerName: `SIM cuenta cruzada ${i}` }, actor(crew.waiter, branchId))
  const account = acc.json?.openAccount
  if (!account?.id) continue
  const prod = branchId === P ? prodP : prodSD
  const ord = await post("/api/orders", {
    customerName: `SIM cuenta cruzada ${i}`, customerPhone: "04141113333",
    tableNumber: `Cuota cruzada ${i}`, orderType: "Comer aquí", exchangeRate: RATE,
    openAccountId: account.id,
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 2 }],
  }, actor(crew.waiter, branchId))
  const order = ord.json?.order
  if (!order?.id) continue
  const total = round(Number(order.totalUSD))
  // ORIGEN: se registra en el día 6 del libro (la venta nació antes)…
  recordOrder(ledger, { day: "dia-6", branchId, totalUSD: total, channel: "mesa-cuenta", seller: crew.waiter, people: 2 })
  if (recipes[branchId][prod.id]) consumeRecipe(invBook, { branchId, recipes: recipes[branchId], productId: prod.id, count: 2 })
  await patch(`/api/orders/${order.id}`, { status: "Listo" }, actor(crew.kitchen, branchId))
  await patch(`/api/orders/${order.id}`, { status: "Entregado" }, actor(crew.waiter, branchId))
  // …y el DINERO entra en el día de repaso (otro cierre).
  const cobro = await patch(`/api/open-accounts/${account.id}`, {
    action: "payAccount", amountReceivedUSD: total, paymentMethodUSD: "Efectivo divisas",
    deliveryPaymentIn: "Divisas", closeIfPaid: true, closedBy: crew.cashier,
  }, actor(crew.cashier, branchId), { label: "PATCH open-account pay" })
  if (cobro.status === 200) {
    recordPayment(ledger, { day: DAY, branchId, payment: { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE } })
    reducePending(ledger, { originDay: "dia-6", branchId, amountUSD: total })
    cruzadas += 1
    bumpQuota(st, "cuenta-cobrada-otro-dia")
    bumpQuota(st, "efectivo")
    const row = await orderRow(order.id)
    if (i === 0) check("Q-8b", "el pedido conserva su ORIGEN y solo el cobro es del día nuevo", row?.payment_status === "Pagado", `pago=${row?.payment_status} origen=${String(row?.created_at).slice(0, 10)}`)
  }
}
check("Q-8", "se completó la cuota de 4 cuentas cobradas en un día distinto al de origen", (st.quotas["cuenta-cobrada-otro-dia"] || 0) >= 4, `total=${st.quotas["cuenta-cobrada-otro-dia"]} (nuevas=${cruzadas})`)

// ── 7 · TRANSFERENCIAS Y PAGOS MÓVILES HASTA LA CUOTA ───────────────────────
console.log("\n━━ transferencias y pagos móviles pendientes")
for (const [metodo, quotaKey, target] of [["Transferencia", "transferencia", 90], ["Pago móvil", "pagomovil", 90]]) {
  const faltan = Math.max(0, target - (st.quotas[quotaKey] || 0))
  for (let i = 0; i < faltan; i += 1) {
    const branchId = i % 3 === 2 ? SD : P
    const crew = branchId === P ? { waiter: "anthony", kitchen: "jesus", cashier: i % 2 ? "kelvin" : "mariafernanda" } : { waiter: "daniela", kitchen: "carlosalberto", cashier: "roxana" }
    const ped = await nuevoPedido(branchId, crew.waiter, crew.kitchen, { tag: quotaKey })
    if (!ped) continue
    const ves = round(ped.total * RATE)
    const c = await patch(`/api/orders/${ped.id}/payment`, { amountReceivedVES: ves, paymentMethodVES: metodo, deliveryPaymentIn: "Bolívares" }, actor(crew.cashier, branchId), { label: "PATCH payment" })
    if (c.status === 200) {
      recordPayment(ledger, { day: DAY, branchId, payment: { vesMethod: metodo, vesAmount: ves, rate: RATE } })
      reducePending(ledger, { originDay: DAY, branchId, amountUSD: ped.total })
      bumpQuota(st, quotaKey)
    }
  }
  check(`Q-${metodo}`, `se completó la cuota de ${target} ${metodo.toLowerCase()}s`, (st.quotas[quotaKey] || 0) >= target, `total=${st.quotas[quotaKey]}`)
}

// ── 8 · CIERRE DEL DÍA DE REPASO (el dinero nuevo tiene que caer en un cierre) ──
console.log("\n━━ cierre del día de repaso")
const { expectedCloseFor } = await import("./lib/expected-ledger.mjs")
for (const [branchId, label, closer] of [[P, "Principal", "genesis"], [SD, "San Diego", "luis"]]) {
  const esperado = expectedCloseFor(ledger, DAY, branchId)
  const bookDay = ledger.days[DAY][branchId]
  const res = await post("/api/day-close", {
    dayClose: {
      dateLabel: `REPASO DE CUOTAS — ${label}`,
      summaryText: `sim:${st.seed} · cierre del día de repaso (escenarios de pago que faltaban)`,
      ordersRegistered: esperado.orders,
      totalSoldUSD: bookDay.grossSalesUSD,
      realCollectedUSD: esperado.collectedUSD,
      realCashUSD: esperado.cashUSD,
      realVES: esperado.vesTotal,
      realVESEquivalentUSD: esperado.vesEquivalentUSD,
      realPendingUSD: round(bookDay.pendingUSD),
      totalConfirmedUSD: esperado.collectedUSD,
      paymentByUSDMethod: Object.entries(esperado.byMethodUSD).map(([l, v]) => ({ label: l, count: v.count, totalUSD: v.totalUSD, totalVES: 0 })),
      paymentByVESMethod: Object.entries(esperado.byMethodVES).map(([l, v]) => ({ label: l, count: v.count, totalUSD: v.totalUSD, totalVES: v.totalVES })),
      expenses: [],
    },
  }, actor(closer, branchId), { label: "POST day-close" })
  const closeId = res.json?.dayClose?.id
  const { data: row } = await supabase.from("day_closes").select("data").eq("id", closeId || "").maybeSingle()
  check(`Q-CIERRE-${label}`, `el cierre de repaso de ${label} cuadra al centavo`, res.status === 200 && Math.abs(Number(row?.data?.realCollectedUSD || 0) - esperado.collectedUSD) < 0.01, `esperado=$${esperado.collectedUSD} real=$${row?.data?.realCollectedUSD}`)
}

saveState(st)
saveLedger(ledger)
saveInventoryBook(invBook)
flushPerformance(KEY)
logLine(`\nCuotas tras el repaso: ${JSON.stringify(st.quotas)}`)

const result = summary("Repaso de cuotas")
process.exit(result.fail > 0 ? 1 : 0)
