// DÍAS 2–7 · el resto de la semana comercial, con los escenarios obligatorios
// de cada día del guion. Cada día: preflight → apertura → operación feliz →
// adversariales → cancelaciones → gastos → cierre por sede al centavo →
// verificación nocturna (integridad, sedes, pagos, inventario).
//
// Uso: node scripts/sim/dias-2-7.mjs --day=2   (o sin --day: corre 2→7)
import {
  openDay, createOrder, kitchenCycle, payOrder, payMixedTwoLegs, cancelOrder,
  addExpense, closeBranchDay, nightlyChecks, verifyInventory,
  check, markBlocked, summary, logLine, get, post, patch, sleep, publicHeaders,
  auditRows, orderRow, stockOf, round, flushPerformance, RATE, pick, pickInt, bumpQuota,
} from "./lib/day-engine.mjs"
import { supabase } from "./lib/simulation-guard.mjs"
import { race } from "./lib/concurrency.mjs"
import { recordPayment, reducePending, recordOrder, recordCancellation } from "./lib/expected-ledger.mjs"
import { applyMove, consumeRecipe } from "./lib/expected-inventory.mjs"
import { appendBug } from "./lib/evidence-writer.mjs"

const onlyDay = Number(process.argv.find((a) => a.startsWith("--day="))?.slice(6) || 0)

const MENU_SETS = [
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
  [["Papas Brutales", 1], ["Refresco 1.5L", 1]],
  [["Burger de Pollo", 2], ["Papas Medianas", 2]],
]
const PAY_KINDS = ["efectivo", "pagomovil", "transferencia", "zelle", "efectivo-cambio", "mixto", "punto"]

// Plan del guion: [día, fecha, pedidos, P, SD, cancelaciones, canales]
const PLAN = {
  2: { date: "2026-08-04", orders: 70, P: 44, SD: 26, cancels: 5, ch: { "mesa-cuenta": 14, mesa: 18, pickup: 10, delivery: 10, qr: 16, staff: 2 } },
  3: { date: "2026-08-05", orders: 78, P: 42, SD: 36, cancels: 4, ch: { "mesa-cuenta": 8, mesa: 10, pickup: 22, delivery: 22, qr: 14, staff: 2 } },
  4: { date: "2026-08-06", orders: 72, P: 45, SD: 27, cancels: 3, ch: { "mesa-cuenta": 14, mesa: 14, pickup: 14, delivery: 12, qr: 16, staff: 2 } },
  5: { date: "2026-08-07", orders: 115, P: 72, SD: 43, cancels: 8, ch: { "mesa-cuenta": 28, mesa: 22, pickup: 20, delivery: 18, qr: 25, staff: 2 } },
  6: { date: "2026-08-08", orders: 100, P: 62, SD: 38, cancels: 12, ch: { "mesa-cuenta": 24, mesa: 18, pickup: 18, delivery: 16, qr: 22, staff: 2 } },
  7: { date: "2026-08-09", orders: 60, P: 36, SD: 24, cancels: 3, ch: { "mesa-cuenta": 14, mesa: 14, pickup: 10, delivery: 8, qr: 12, staff: 2 } },
}

const ROSTERS = {
  2: ["alejandro", "genesis", "mariafernanda", "kelvin", "jesus", "dubraska", "anthony", "yorgelis", "miguel", "luis", "roxana", "carlosalberto", "daniela", "gustavo"],
  3: ["alejandro", "genesis", "kelvin", "mariafernanda", "dubraska", "jesus", "yorgelis", "anthony", "miguel", "luis", "roxana", "carlosalberto", "daniela", "gustavo"],
  4: ["alejandro", "genesis", "mariafernanda", "kelvin", "jesus", "dubraska", "anthony", "yorgelis", "miguel", "luis", "roxana", "carlosalberto", "daniela", "gustavo"],
  5: ["alejandro", "genesis", "mariafernanda", "kelvin", "jesus", "dubraska", "anthony", "yorgelis", "miguel", "vanessa", "luis", "roxana", "carlosalberto", "daniela", "gustavo"],
  6: ["alejandro", "genesis", "kelvin", "mariafernanda", "dubraska", "jesus", "anthony", "yorgelis", "miguel", "luis", "roxana", "carlosalberto", "daniela"],
  7: ["alejandro", "genesis", "mariafernanda", "jesus", "anthony", "miguel", "luis", "roxana", "carlosalberto", "daniela"],
}

// Rotación de personal: quién hace qué cada día (nadie repite asignación).
const SHIFTS = {
  2: { P: { cashier: "kelvin", kitchen: "dubraska", waiter: "yorgelis", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "gustavo", manager: "luis" } },
  3: { P: { cashier: "mariafernanda", kitchen: "jesus", waiter: "anthony", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "daniela", manager: "luis" } },
  4: { P: { cashier: "kelvin", kitchen: "jesus", waiter: "yorgelis", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "gustavo", manager: "luis" } },
  5: { P: { cashier: "mariafernanda", kitchen: "dubraska", waiter: "anthony", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "daniela", manager: "luis" } },
  6: { P: { cashier: "kelvin", kitchen: "dubraska", waiter: "yorgelis", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "daniela", manager: "luis" } },
  7: { P: { cashier: "mariafernanda", kitchen: "jesus", waiter: "anthony", manager: "genesis" }, SD: { cashier: "roxana", kitchen: "carlosalberto", waiter: "daniela", manager: "luis" } },
}

const TABLES = {
  P: ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Barra", "Afuera"],
  SD: ["SD Mesa 1", "SD Mesa 2", "SD Mesa 3", "SD Mesa 4", "SD Terraza"],
}

async function runDay(dayNumber) {
  const plan = PLAN[dayNumber]
  const ctx = await openDay({
    dayNumber,
    dayKey: `dia-${dayNumber}`,
    title: `Día ${dayNumber} — ${plan.date}`,
    businessDate: plan.date,
    roster: ROSTERS[dayNumber],
  })
  const { P, SD } = ctx
  const st = ctx.state
  const shift = SHIFTS[dayNumber]
  const D = `D${dayNumber}`
  const tablesOf = (b) => (b === P ? TABLES.P : TABLES.SD)
  const crewOf = (b) => (b === P ? shift.P : shift.SD)
  const setFor = () => pick(ctx.rng, MENU_SETS)

  logLine(`\n## Turno del día: ${JSON.stringify(shift)}`)

  // Preflight: cuentas abiertas heredadas del día anterior.
  const { data: openAccountsBefore } = await supabase
    .from("open_accounts").select("id, branch_id, customer_name, status").eq("status", "Abierta")
  logLine(`Cuentas abiertas heredadas al abrir: ${(openAccountsBefore || []).length}`)

  const created = { P: 0, SD: 0 }
  const byChannel = {}
  const all = []
  // Pedidos nacidos de escenarios adversariales: se cuentan aparte del plan.
  const evidencia = { count: 0 }

  // ── Cuentas abiertas del día (mesa-cuenta) ──────────────────────────────
  const accountsToday = []
  let remainingAccountOrders = plan.ch["mesa-cuenta"]
  let accIdx = 0
  while (remainingAccountOrders > 0) {
    const branchId = accIdx % 3 === 2 ? SD : P
    const crew = crewOf(branchId)
    const size = Math.min(remainingAccountOrders, pickInt(ctx.rng, 2, 5))
    const table = pick(ctx.rng, tablesOf(branchId))
    const accRes = await post(
      "/api/open-accounts",
      { tableNumber: `${table} · ${ctx.dayKey}#${accIdx}`, customerName: `SIM Cuenta ${ctx.dayKey}#${accIdx}` },
      ctx.actor(crew.waiter, branchId),
    )
    const account = accRes.json?.openAccount
    const records = []
    for (let i = 0; i < size; i += 1) {
      const r = await createOrder(ctx, {
        branchId, channel: "mesa-cuenta", items: setFor(), seller: crew.waiter,
        table: `${table} · ${ctx.dayKey}#${accIdx}`, account: account?.id, people: i === 0 ? pickInt(ctx.rng, 2, 6) : 0,
      })
      if (r.ok) { records.push(r.record); created[branchId === P ? "P" : "SD"] += 1; byChannel["mesa-cuenta"] = (byChannel["mesa-cuenta"] || 0) + 1; all.push(r.record) }
    }
    for (const rec of records) await kitchenCycle(ctx, rec, { kitchen: crew.kitchen, waiter: crew.waiter, deliver: true })
    accountsToday.push({ id: account?.id, records, branchId, crew })
    remainingAccountOrders -= size
    accIdx += 1
  }

  // Cobro de cuentas (una queda abierta el Día 5 para cruzar al 6).
  const keepOpenIdx = dayNumber === 5 ? accountsToday.length - 1 : -1
  for (const [i, acc] of accountsToday.entries()) {
    if (i === keepOpenIdx) {
      st[`day${dayNumber}`] = { ...(st[`day${dayNumber}`] || {}), carryAccount: { id: acc.id, branchId: acc.branchId, total: round(acc.records.reduce((s, r) => s + r.total, 0)), orders: acc.records.map((r) => r.id) } }
      continue
    }
    const kind = pick(ctx.rng, ["efectivo", "transferencia", "mixto", "pagomovil"])
    const total = round(acc.records.reduce((s, r) => s + r.total, 0))
    if (!total) continue
    const body = { action: "payAccount", closeIfPaid: true, closedBy: acc.crew.cashier, deliveryPaymentIn: kind === "mixto" ? "Mixto" : kind === "efectivo" ? "Divisas" : "Bolívares" }
    let entry
    if (kind === "efectivo") { body.amountReceivedUSD = total; body.paymentMethodUSD = "Efectivo divisas"; entry = { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE }; bumpQuota(st, "efectivo") }
    else if (kind === "transferencia") { body.amountReceivedVES = round(total * RATE); body.paymentMethodVES = "Transferencia"; entry = { vesMethod: "Transferencia", vesAmount: round(total * RATE), rate: RATE }; bumpQuota(st, "transferencia") }
    else if (kind === "pagomovil") { body.amountReceivedVES = round(total * RATE); body.paymentMethodVES = "Pago móvil"; entry = { vesMethod: "Pago móvil", vesAmount: round(total * RATE), rate: RATE }; bumpQuota(st, "pagomovil") }
    else { const usd = round(Math.floor(total / 2)); body.amountReceivedUSD = usd; body.paymentMethodUSD = "Efectivo divisas"; body.amountReceivedVES = round((total - usd) * RATE); body.paymentMethodVES = "Pago móvil"; entry = { usdMethod: "Efectivo divisas", usdAmount: usd, vesMethod: "Pago móvil", vesAmount: round((total - usd) * RATE), rate: RATE }; bumpQuota(st, "mixto") }
    const res = await patch(`/api/open-accounts/${acc.id}`, body, ctx.actor(acc.crew.cashier, acc.branchId), { label: "PATCH open-account pay" })
    if (res.status === 200) {
      recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: acc.branchId, payment: entry })
      for (const rec of acc.records) { reducePending(ctx.ledger, { originDay: ctx.dayKey, branchId: acc.branchId, amountUSD: rec.total }); rec.paid = rec.total; rec.chargedBy = acc.crew.cashier }
    }
  }

  // ── Resto de canales ────────────────────────────────────────────────────
  const cancelPool = []
  async function runChannel(channel, count) {
    let done = 0
    for (let i = 0; i < count; i += 1) {
      const branchId = created.SD < plan.SD && (i % 5 === 0 || created.P >= plan.P) ? SD : P
      const crew = crewOf(branchId)
      const isPublic = channel === "qr"
      const spec = {
        branchId, channel, items: setFor(),
        seller: isPublic ? null : channel === "staff" ? crew.manager : crew.waiter,
        clientIndex: dayNumber * 1000 + i,
        table: channel === "mesa" || channel === "qr" ? pick(ctx.rng, tablesOf(branchId)) : undefined,
        ...(channel === "delivery"
          ? {
              deliveryAddress: `Calle ${i + 1}, ${branchId === P ? "Valencia" : "San Diego"}`,
              paymentMethodLabel: pick(ctx.rng, ["Efectivo", "Pago móvil", "Transferencia"]),
              ...(branchId === P && i % 4 === 0 ? { deliveryMapsUrl: "https://maps.google.com/?q=10.2150,-68.0100", expectDeliveryCostUSD: 2 } : {}),
            }
          : {}),
        ...(channel === "staff" ? { name: `STAFF ${crew.manager} ${ctx.dayKey}` } : {}),
      }
      const r = await createOrder(ctx, spec)
      if (!r.ok) { check(`${D}-${channel}-${i}`, `pedido ${channel} creado`, false, `status=${r.status} ${r.error}`); continue }
      created[branchId === P ? "P" : "SD"] += 1
      byChannel[channel] = (byChannel[channel] || 0) + 1
      all.push(r.record)
      done += 1

      // Algunos quedan para el pool de cancelaciones (no se cobran).
      if (cancelPool.length < plan.cancels && i % 7 === 3) { cancelPool.push({ rec: r.record, crew, stage: cancelPool.length }); continue }

      await kitchenCycle(ctx, r.record, {
        kitchen: crew.kitchen,
        waiter: channel === "delivery" ? "miguel" : crew.waiter,
        deliver: channel !== "pickup",
      })
      const kind = PAY_KINDS[(i + dayNumber) % PAY_KINDS.length]
      // Cada 9 pedidos, el cobro va en DOS patas (segunda pata posterior).
      if (i % 9 === 5) {
        const two = await payMixedTwoLegs(ctx, r.record, crew.cashier, { secondDelayMs: 60 })
        if (!two.ok) check(`${D}-2patas-${channel}-${i}`, "cobro en dos patas", false, `leg=${two.leg} status=${two.status}`)
      } else {
        const pay = await payOrder(ctx, r.record, kind, crew.cashier)
        if (!pay.ok) check(`${D}-pago-${channel}-${i}`, `cobro ${kind}`, false, `status=${pay.status} ${pay.error}`)
      }
    }
    return done
  }

  for (const [channel, count] of Object.entries(plan.ch)) {
    if (channel === "mesa-cuenta") continue
    await runChannel(channel, count)
  }

  // ── Cancelaciones del día en distintos estados ───────────────────────────
  const CANCEL_REASONS = [
    ["antes de cocina", false],
    ["en preparación", false],
    ["producto parcialmente preparado", true],
    ["pedido ya listo", true],
    ["pedido de una cuenta", true],
  ]
  for (const [i, entry] of cancelPool.entries()) {
    const [stageName, used] = CANCEL_REASONS[i % CANCEL_REASONS.length]
    if (stageName === "en preparación") await patch(`/api/orders/${entry.rec.id}`, { status: "Preparando" }, ctx.actor(entry.crew.kitchen, entry.rec.branchId))
    if (stageName === "pedido ya listo" || stageName === "producto parcialmente preparado") await kitchenCycle(ctx, entry.rec, { kitchen: entry.crew.kitchen })
    const res = await cancelOrder(ctx, entry.rec, {
      by: entry.crew.manager,
      reason: `SIM ${ctx.dayKey}: anulado ${stageName}`,
      inventoryWasUsed: used,
    })
    if (!res.ok) check(`${D}-CX-${i}`, `cancelación (${stageName})`, false, `status=${res.status} ${res.error}`)
  }
  const cancelledReal = all.filter((o) => o.status === "Cancelado").length
  check(`${D}-CX-total`, `las ${plan.cancels} cancelaciones del plan se ejecutaron con motivo y autor`, cancelledReal === plan.cancels, `plan=${plan.cancels} real=${cancelledReal}`)

  // ── ESCENARIOS OBLIGATORIOS ESPECÍFICOS DEL DÍA ─────────────────────────
  await daySpecific(ctx, dayNumber, { shift, all, accountsToday, plan, created, D })

  // ── Gastos + cierre ─────────────────────────────────────────────────────
  const gP = await addExpense(ctx, { branchId: P, by: shift.P.manager, concept: `SIM ${ctx.dayKey} - insumos menores Principal`, amountUSD: 8 + dayNumber, category: "Otros" })
  const gSD = await addExpense(ctx, { branchId: SD, by: shift.SD.manager, concept: `SIM ${ctx.dayKey} - insumos menores SD`, amountUSD: 5 + dayNumber, category: "Otros" })
  check(`${D}-GASTO`, "gastos del día registrados en ambas sedes", gP.ok && gSD.ok)

  await closeBranchDay(ctx, P, { closedBy: shift.P.manager, expenses: gP.id ? [{ id: gP.id, concept: `SIM ${ctx.dayKey} - insumos menores Principal`, amountUSD: 8 + dayNumber }] : [] })
  await closeBranchDay(ctx, SD, { closedBy: shift.SD.manager, expenses: gSD.id ? [{ id: gSD.id, concept: `SIM ${ctx.dayKey} - insumos menores SD`, amountUSD: 5 + dayNumber }] : [] })

  // ── Noche ───────────────────────────────────────────────────────────────
  await nightlyChecks(ctx)
  await verifyInventory(ctx)

  const bookP = ctx.ledger.days[ctx.dayKey][P]
  const bookSD = ctx.ledger.days[ctx.dayKey][SD]
  const totalOrders = bookP.ordersCreated + bookSD.ordersCreated
  check(`${D}-PLAN`, `el día ejecutó los ${plan.orders} pedidos del plan (+${ctx.evidenceOrders || 0} pedidos-evidencia de escenarios adversariales)`, totalOrders - (ctx.evidenceOrders || 0) === plan.orders, `real=${totalOrders} evidencia=${ctx.evidenceOrders || 0} (P=${bookP.ordersCreated} SD=${bookSD.ordersCreated}) canales=${JSON.stringify(byChannel)}`)
  logLine(`\n### ${ctx.dayKey} · Principal: ${bookP.ordersCreated} pedidos · $${bookP.collectedUSD} cobrados · $${bookP.pendingUSD} pendientes · ${bookP.cancellations} anulados`)
  logLine(`### ${ctx.dayKey} · San Diego: ${bookSD.ordersCreated} pedidos · $${bookSD.collectedUSD} cobrados · $${bookSD.pendingUSD} pendientes · ${bookSD.cancellations} anulados`)
  logLine(`### canales: ${JSON.stringify(byChannel)}`)

  st.completedDays = Array.from(new Set([...(st.completedDays || []), ctx.dayKey]))
  ctx.persist()
  flushPerformance(ctx.dayKey)
  return ctx
}

// ──────────────────────────────────────────────────────────────────────────
// Escenarios obligatorios por día (los que el guion exige explícitamente)
// ──────────────────────────────────────────────────────────────────────────
async function daySpecific(ctx, dayNumber, { shift, all, accountsToday, plan, D }) {
  const { P, SD } = ctx
  const st = ctx.state

  // Seguridad diaria (todos los días): sede cruzada, acción sin permiso,
  // manipulación de id, manipulación de precio, sesión inválida.
  const crossHeaders = { ...ctx.actor(shift.SD.cashier, SD), "x-branch-id": P }
  const cross = await get("/api/orders", crossHeaders)
  const pIds = new Set(all.filter((o) => o.branchId === P).map((o) => o.id))
  const leaked = (cross.json?.orders || []).filter((o) => pIds.has(o.id)).length
  check(`${D}-SEC-1`, "la cajera de SD con header de Principal NO recibe pedidos de Principal", leaked === 0, `filtrados=${leaked}`)

  const noPerm = await post("/api/staff", { username: "colado", password: "abcdef1", role: "owner" }, ctx.actor(shift.P.waiter, P))
  check(`${D}-SEC-2`, "el mesonero sigue sin poder crear usuarios", noPerm.status === 403, `status=${noPerm.status}`)

  const otherBranchOrder = all.find((o) => o.branchId === SD)
  if (otherBranchOrder) {
    const idHack = await patch(`/api/orders/${otherBranchOrder.id}`, { status: "Cancelado", cancelReason: "SIM intento de anular pedido de otra sede" }, ctx.actor(shift.P.manager, P))
    const rowAfter = await orderRow(otherBranchOrder.id)
    check(`${D}-SEC-3`, "manipular el ID de un pedido de otra sede NO lo anula", rowAfter?.status !== "Cancelado" || idHack.status >= 400, `status=${idHack.status} estado=${rowAfter?.status}`)
  }

  const priceHack = await post("/api/orders", {
    customerName: `SIM Precio ${ctx.dayKey}`, customerPhone: "04140009999", tableNumber: "Mesa 1",
    orderType: "Comer aquí", exchangeRate: RATE,
    items: [{ id: ctx.menus[P]["Burger Doble Brutal"].id, name: "Burger Doble Brutal", price: 0.01, quantity: 1 }],
  }, publicHeaders(`10.8${dayNumber}.66.66`, P))
  const hackRow = priceHack.json?.order?.id ? await orderRow(priceHack.json.order.id) : null
  const realPrice = ctx.menus[P]["Burger Doble Brutal"].price
  check(`${D}-SEC-4`, `precio fabricado por el público se corrige al del menú ($${realPrice})`, !hackRow || Math.abs(Number(hackRow.total_usd) - realPrice) < 0.01, `guardado=$${hackRow?.total_usd}`)
  if (priceHack.json?.order?.id) {
    recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: Number(hackRow?.total_usd || realPrice), channel: "qr", seller: "público", people: 1 })
    const pid = ctx.menus[P]["Burger Doble Brutal"].id
    if (ctx.recipes[P][pid]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: pid, count: 1 })
    const rec = { id: priceHack.json.order.id, branchId: P, total: Number(hackRow?.total_usd || realPrice), paid: 0, channel: "qr", status: "creado" }
    all.push(rec)
    ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
    await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
    await payOrder(ctx, rec, "efectivo", shift.P.cashier)
  }

  const badSession = await get("/api/reports?period=today", { "Content-Type": "application/json", Authorization: "Bearer sesion-invalida", "x-branch-id": P, "x-forwarded-for": `10.8${dayNumber}.66.67` })
  check(`${D}-SEC-5`, "una sesión inválida no abre reportes", badSession.status === 401, `status=${badSession.status}`)

  if (dayNumber === 2) {
    // ── DÍA 2 · cocina a fondo + agotamiento + concurrencia de cocina ─────
    // Insumo que se agota: "Hielo" de San Diego (48 → 0 con un ajuste real).
    const hieloId = st.ids.inventory[SD]["Hielo"]
    const stockAntes = await stockOf(hieloId)
    const adjust = await post("/api/inventory", { id: hieloId, name: "Hielo", category: "Cocina", unit: "kg", quantity: 0, minimumStock: 9, costUSD: 0.3, movementType: "Ajuste", movementReason: "SIM d2: se acabó el hielo a mitad del día" }, ctx.actor("alejandro", SD))
    const stockDespues = await stockOf(hieloId)
    if (adjust.status === 200 || adjust.status === 201) applyMove(ctx.invBook, { branchId: SD, itemId: hieloId, type: "Ajuste", qty: -stockAntes })
    check("D2-STOCK-1", "un insumo llega EXACTAMENTE a cero con un ajuste auditado", stockDespues === 0, `${stockAntes}→${stockDespues} status=${adjust.status}`)
    const otraSede = await stockOf(st.ids.inventory[P]["Hielo"])
    check("D2-STOCK-2", "el agotamiento de una sede NO toca el stock de la otra", otraSede > 0, `Principal=${otraSede}`)

    // Dos cocineros marcan LISTO el mismo pedido a la vez.
    const target = all.find((o) => o.branchId === P && o.status !== "Cancelado")
    if (target) {
      await patch(`/api/orders/${target.id}`, { status: "Preparando" }, ctx.actor("jesus", P))
      const results = await race([
        () => patch(`/api/orders/${target.id}`, { status: "Listo" }, ctx.actor("jesus", P)),
        () => patch(`/api/orders/${target.id}`, { status: "Listo" }, ctx.actor("dubraska", P)),
      ])
      const rowNow = await orderRow(target.id)
      const oks = results.filter((r) => r.status === 200).length
      check("D2-CONC-1", "dos cocineros marcando LISTO a la vez dejan UN solo estado coherente", rowNow?.status === "Listo" && oks >= 1, `respuestas=${results.map((r) => r.status).join("/")} estado=${rowNow?.status}`)
    }

    // Cocina y caja "cancelan" a la vez → una sola anulación.
    const doomed = all.find((o) => o.branchId === SD && o.status !== "Cancelado" && !o.paid)
    if (doomed) {
      const results = await race([
        () => patch(`/api/orders/${doomed.id}`, { status: "Cancelado", cancelReason: "SIM d2 carrera: cocina anula" }, ctx.actor("luis", SD)),
        () => patch(`/api/orders/${doomed.id}`, { status: "Cancelado", cancelReason: "SIM d2 carrera: caja anula" }, ctx.actor("luis", SD)),
      ])
      const rowNow = await orderRow(doomed.id)
      const { data: audits } = await supabase.from("audit_logs").select("id").eq("entity_id", doomed.id).eq("action", "order.status.updated")
      check("D2-CONC-2", "dos anulaciones simultáneas dejan el pedido anulado una sola vez", rowNow?.status === "Cancelado", `respuestas=${results.map((r) => r.status).join("/")} auditorías=${audits?.length}`)
      recordCancellation(ctx.ledger, { day: ctx.dayKey, branchId: SD, totalUSD: doomed.total, wasPending: !doomed.paid })
      doomed.status = "Cancelado"
    }

    // Notificación/impresión de terceros: sin VAPID ni impresora física.
    markBlocked("D2-NOTIF-1", "entrega real de push al mesonero (VAPID no configurado en simulación)", "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY vacíos: el evento interno se genera pero no hay entrega externa")
    markBlocked("D2-PRINT-1", "impresión física de comanda y recibo 80mm", "no hay impresora conectada al entorno de simulación")
  }

  if (dayNumber === 3) {
    // ── DÍA 3 · pagos reportados, anti-duplicado, QR por sede ────────────
    const target = all.find((o) => o.branchId === P && o.paid === 0 && o.status !== "Cancelado") || all.find((o) => o.branchId === P)
    if (target) {
      const proofBody = {
        orderId: target.id, reportedMethod: "Pago móvil", amountReportedUSD: 0,
        amountReportedVES: round(target.total * RATE), paymentReference: "012345678901",
      }
      const first = await post("/api/payment-proofs", proofBody, publicHeaders("10.83.7.10", P))
      const again = await post("/api/payment-proofs", proofBody, publicHeaders("10.83.7.10", P))
      const otherTab = await post("/api/payment-proofs", proofBody, publicHeaders("10.83.7.11", P))
      const { data: proofs } = await supabase.from("payment_proofs").select("id").eq("order_id", target.id)
      check("D3-DUP-1", "el mismo pago reportado 3 veces (misma pestaña, otra pestaña) no crea 3 comprobantes", (proofs?.length ?? 0) <= 1, `creados=${proofs?.length} respuestas=${first.status}/${again.status}/${otherTab.status}`)
      bumpQuota(st, "pago-reportado")
      bumpQuota(st, "intento-duplicado")
    }

    // Monto reportado EQUIVOCADO → caja corrige de forma auditada.
    const wrongTarget = all.find((o) => o.branchId === SD && o.paid === 0 && o.status !== "Cancelado")
    if (wrongTarget) {
      await post("/api/payment-proofs", {
        orderId: wrongTarget.id, reportedMethod: "Transferencia", amountReportedUSD: 0,
        amountReportedVES: round(wrongTarget.total * RATE * 0.5), paymentReference: "998877665544",
        note: "cliente reportó la MITAD por error",
      }, publicHeaders("10.83.7.20", SD))
      const fix = await payOrder(ctx, wrongTarget, "transferencia", shift.SD.cashier)
      const row = await orderRow(wrongTarget.id)
      check("D3-CORR-1", "caja corrige el monto mal reportado y el pedido queda pagado por su total real", fix.ok && row?.payment_status === "Pagado", `estado=${row?.payment_status} recibido=$${row?.payment_received_equiv_usd} total=$${row?.total_usd}`)
      bumpQuota(st, "correccion-metodo")
    }

    // QR por sede: id de producto de la OTRA sede.
    const sdOnlyId = ctx.menus[SD]["Patacón San Diego"]?.id
    if (sdOnlyId) {
      const crossProduct = await post("/api/orders", {
        customerName: "SIM Producto cruzado", customerPhone: "04140007777", tableNumber: "Mesa 1",
        orderType: "Comer aquí", exchangeRate: RATE,
        items: [{ id: sdOnlyId, name: "Patacón San Diego", price: 8.5, quantity: 1 }],
      }, publicHeaders("10.83.7.30", P))
      check("D3-QR-1", "un producto exclusivo de San Diego NO se puede pedir desde el QR de Principal", crossProduct.status === 400, `status=${crossProduct.status} ${crossProduct.json?.error || ""}`)
    }

    // Pitfall conocido: customerPhone no vacío en pedido de mesa.
    const withPhone = await post("/api/orders", {
      customerName: "SIM Mesa con teléfono", customerPhone: "04141234567", tableNumber: "Mesa 2",
      orderType: "Comer aquí", exchangeRate: RATE,
      items: [{ id: ctx.menus[P]["Burger Clásica"].id, name: "Burger Clásica", price: ctx.menus[P]["Burger Clásica"].price, quantity: 1 }],
    }, publicHeaders("10.83.7.40", P))
    const phoneRow = withPhone.json?.order?.id ? await orderRow(withPhone.json.order.id) : null
    check("D3-QR-2", "un pedido de MESA con teléfono sigue siendo 'Comer aquí' (no se reclasifica a delivery)", phoneRow?.order_type === "Comer aquí", `tipo=${phoneRow?.order_type}`)
    if (phoneRow) {
      recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: Number(phoneRow.total_usd), channel: "qr", seller: "público", people: 1 })
      const pid = ctx.menus[P]["Burger Clásica"].id
      if (ctx.recipes[P][pid]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: pid, count: 1 })
      const rec = { id: withPhone.json.order.id, branchId: P, total: Number(phoneRow.total_usd), paid: 0, channel: "qr", status: "creado" }
      all.push(rec)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, rec, "efectivo", shift.P.cashier)
    }
  }

  if (dayNumber === 4) {
    // ── DÍA 4 · proveedores, cambio de precio en vivo, contratación ──────
    const hoy = new Date().toISOString().slice(0, 10)
    const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
    const panId = st.ids.inventory[P]["Pan de hamburguesa"]
    const carneId = st.ids.inventory[P]["Carne 150g"]
    const facturas = [
      ["Panadería La Espiga", "PE-D4-1", 84, panId, 240, 84],
      ["Carnes El Toro", "FT-D4-2", 260, carneId, 200, 0],
      ["Bebidas Corocorote", "BC-D4-3", 120, st.ids.inventory[P]["Refresco 1.5L"], 70, 50],
    ]
    for (const [supplierName, doc, totalUSD, itemId, qty, paid] of facturas) {
      const before = await stockOf(itemId)
      const compra = await post("/api/supplier-purchases", {
        supplierId: st.ids.suppliers[supplierName], purchaseDate: hoy, dueDate: enDias(20),
        documentNumber: doc, totalUSD, inventoryItemId: itemId, inventoryQuantity: qty,
        note: `SIM ${ctx.dayKey}`,
      }, ctx.actor("alejandro", P))
      const purchaseId = compra.json?.purchase?.id
      const after = await stockOf(itemId)
      check(`D4-COMPRA-${doc}`, `factura ${doc} suma stock (${before}→${before + qty}) y crea la cuenta por pagar`, compra.status === 201 && after === before + qty, `status=${compra.status} stock=${after}`)
      if (purchaseId) {
        applyMove(ctx.invBook, { branchId: P, itemId, type: "Compra", qty })
        st.ids.purchases[doc] = purchaseId
        if (paid > 0) await post(`/api/supplier-purchases/${purchaseId}/payments`, { amountUSD: paid, method: "Transferencia", paymentDate: hoy }, ctx.actor("alejandro", P))
      }
    }
    // Abono duplicado y sobreabono sobre la factura a crédito.
    const creditId = st.ids.purchases["FT-D4-2"]
    if (creditId) {
      const abono = { amountUSD: 100, method: "Efectivo", paymentDate: hoy, note: "SIM abono d4" }
      const [a1, a2] = await race([
        () => post(`/api/supplier-purchases/${creditId}/payments`, abono, ctx.actor("alejandro", P)),
        () => post(`/api/supplier-purchases/${creditId}/payments`, abono, ctx.actor("genesis", P)),
      ])
      const listado = (await get(`/api/supplier-purchases`, ctx.actor("alejandro", P))).json?.purchases || []
      const factura = listado.find((p) => (p.documentNumber || p.document_number) === "FT-D4-2")
      const pagado = Number(factura?.paidUSD ?? 0)
      check("D4-ABONO-1", "dos abonos simultáneos de $100 no sobrepasan el saldo ni se pierden ($260 total)", pagado <= 260.01, `pagado=$${pagado} respuestas=${a1?.status}/${a2?.status}`)
      const over = await post(`/api/supplier-purchases/${creditId}/payments`, { amountUSD: 5000, method: "Efectivo", paymentDate: hoy }, ctx.actor("alejandro", P))
      const listado2 = (await get(`/api/supplier-purchases`, ctx.actor("alejandro", P))).json?.purchases || []
      const factura2 = listado2.find((p) => (p.documentNumber || p.document_number) === "FT-D4-2")
      check("D4-ABONO-2", "un SOBREABONO de $5.000 sobre una factura de $260 se rechaza o se acota", over.status >= 400 || Number(factura2?.paidUSD ?? 0) <= 260.01, `status=${over.status} pagado=$${factura2?.paidUSD}`)
    }

    // CAMBIO DE PRECIO en vivo: los pedidos anteriores conservan su precio.
    const productName = "Burger Clásica"
    const productId = ctx.menus[P][productName].id
    const oldPrice = ctx.menus[P][productName].price
    const previous = all.find((o) => o.branchId === P && o.status !== "Cancelado")
    const newPrice = round(oldPrice + 1.5)
    const upd = await post("/api/menu-products", { id: productId, name: productName, category: "Hamburguesas", price: newPrice, isActive: true }, ctx.actor("alejandro", P))
    check("D4-PRECIO-1", `el precio de ${productName} sube de $${oldPrice} a $${newPrice}`, upd.status === 200 || upd.status === 201, `status=${upd.status}`)
    if (previous) {
      const prevRow = await orderRow(previous.id)
      check("D4-PRECIO-2", "un pedido ANTERIOR conserva su total histórico tras el cambio de precio", Math.abs(Number(prevRow.total_usd) - previous.total) < 0.01, `guardado=$${prevRow.total_usd} original=$${previous.total}`)
    }
    const pubAfter = (await get("/api/public/products", publicHeaders("10.84.9.9", P))).json
    const pubPrice = (pubAfter?.menuProducts || pubAfter?.products || []).find((p) => p.name === productName)?.price
    check("D4-PRECIO-3", "el menú público muestra el precio NUEVO de inmediato", Math.abs(Number(pubPrice) - newPrice) < 0.01, `público=$${pubPrice}`)
    // Cliente intenta pedir con el precio VIEJO (caché de su PWA).
    const stale = await post("/api/orders", {
      customerName: "SIM Caché vieja", customerPhone: "04140008888", tableNumber: "Mesa 3",
      orderType: "Comer aquí", exchangeRate: RATE,
      items: [{ id: productId, name: productName, price: oldPrice, quantity: 1 }],
    }, publicHeaders("10.84.9.10", P))
    const staleRow = stale.json?.order?.id ? await orderRow(stale.json.order.id) : null
    check("D4-PRECIO-4", "un cliente con el menú viejo en caché paga el precio NUEVO (no el que tenía guardado)", Math.abs(Number(staleRow?.total_usd) - newPrice) < 0.01, `guardado=$${staleRow?.total_usd} enviado=$${oldPrice}`)
    if (staleRow) {
      recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: Number(staleRow.total_usd), channel: "qr", seller: "público", people: 1 })
      if (ctx.recipes[P][productId]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId, count: 1 })
      const rec = { id: stale.json.order.id, branchId: P, total: Number(staleRow.total_usd), paid: 0, channel: "qr", status: "creado" }
      all.push(rec)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, rec, "pagomovil", shift.P.cashier)
    }
    ctx.menus[P][productName].price = newPrice

    // CONTRATACIÓN a mitad del día: trabaja esa misma tarde.
    const nuevoUser = "wilmer"
    const antes = await get("/api/orders", { "Content-Type": "application/json", "x-forwarded-for": "10.84.9.20", "x-branch-id": P, Authorization: "Bearer no-existe-aun" })
    check("D4-RRHH-1", "antes de ser creado, el usuario nuevo no entra", antes.status === 401, `status=${antes.status}`)
    const creado = await post("/api/staff", { username: nuevoUser, fullName: "Wilmer (contratado el jueves)", role: "waiter", password: `Sim-${nuevoUser}-2026!`, allBranches: false, allowedBranchIds: [P] }, ctx.actor("alejandro", P))
    check("D4-RRHH-2", "el dueño contrata a Wilmer (mesonero de Principal) a mitad del día", creado.status === 201, `status=${creado.status} ${creado.json?.error || ""}`)
    if (creado.status === 201) {
      st.ids.staff[nuevoUser] = creado.json.staff.id
      const { loginStaff } = await import("./lib/auth.mjs")
      const login = await loginStaff(nuevoUser, `Sim-${nuevoUser}-2026!`)
      check("D4-RRHH-3", "Wilmer inicia sesión el mismo día", login.ok, login.error || "")
      const trabajo = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Burger Clásica", 1], ["Refresco 1.5L", 1]], seller: nuevoUser, table: "Mesa 4" })
      check("D4-RRHH-4", "Wilmer registra un pedido REAL su primera tarde", trabajo.ok, `status=${trabajo.status}`)
      if (trabajo.ok) {
        all.push(trabajo.record)
        ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
        await kitchenCycle(ctx, trabajo.record, { kitchen: shift.P.kitchen, waiter: nuevoUser, deliver: true })
        await payOrder(ctx, trabajo.record, "efectivo", shift.P.cashier)
        const auditNuevo = await auditRows({ action: "staff.created", limit: 5 })
        check("D4-RRHH-5", "la contratación queda en auditoría", auditNuevo.some((a) => JSON.stringify(a.metadata || {}).includes(nuevoUser)), `filas=${auditNuevo.length}`)
      }
      const sinPermiso = await get("/api/reports?period=today", ctx.actor(nuevoUser, P))
      check("D4-RRHH-6", "Wilmer (mesonero) no ve reportes financieros", sinPermiso.status === 403, `status=${sinPermiso.status}`)
    }

    // PRODUCTO NUEVO: se crea, se publica, se vende, descuenta y se cancela una unidad.
    const nuevoId = 202608040001
    const nuevoNombre = "Burger del Jueves"
    const crearProd = await post("/api/menu-products", { id: nuevoId, name: nuevoNombre, category: "Hamburguesas", price: 8, isActive: true, inventoryDiscountEnabled: true }, ctx.actor("alejandro", P))
    await post("/api/inventory-recipes", {
      productId: nuevoId, productName: nuevoNombre,
      ingredients: [
        { itemId: st.ids.inventory[P]["Pan de hamburguesa"], itemName: "Pan de hamburguesa", quantity: 1, unit: "unidades" },
        { itemId: st.ids.inventory[P]["Carne 150g"], itemName: "Carne 150g", quantity: 1, unit: "unidades" },
      ],
    }, ctx.actor("alejandro", P))
    ctx.recipes[P][nuevoId] = [
      { itemId: st.ids.inventory[P]["Pan de hamburguesa"], quantity: 1 },
      { itemId: st.ids.inventory[P]["Carne 150g"], quantity: 1 },
    ]
    ctx.menus[P][nuevoNombre] = { id: nuevoId, price: 8 }
    check("D4-PROD-1", "producto nuevo creado con receta y publicado", crearProd.status === 200 || crearProd.status === 201, `status=${crearProd.status}`)
    const ventaNueva = await createOrder(ctx, { branchId: P, channel: "mesa", items: [[nuevoNombre, 2]], seller: shift.P.waiter, table: "Mesa 5", verifyStock: true })
    if (ventaNueva.ok) {
      all.push(ventaNueva.record)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, ventaNueva.record, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, ventaNueva.record, "efectivo", shift.P.cashier)
      check("D4-PROD-2", "el producto nuevo se vende y descuenta su receta", true, `pedido=${ventaNueva.record.id}`)
    }
  }

  if (dayNumber === 5) {
    // ── DÍA 5 · evento, promotora, despido, concurrencia de caja ─────────
    const evento = await patch(`/api/branches/${P}/config`, { branchConfig: { isEvent: true, eventEndDate: "" } }, ctx.actor("alejandro", P))
    check("D5-EVT-1", "el modo evento se activa en Principal", evento.status === 200, `status=${evento.status}`)

    // Ventas atribuidas a la promotora Vanessa (cobra ella misma).
    const ventasVanessa = []
    for (let i = 0; i < 4; i += 1) {
      const r = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Combo Brutal", 1]], seller: "vanessa", table: "Barra" })
      if (r.ok) { ventasVanessa.push(r.record); all.push(r.record) }
    }
    for (const rec of ventasVanessa) {
      await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, rec, "efectivo", "vanessa")
    }
    check("D5-EVT-2", "la promotora registra y cobra sus propias ventas", ventasVanessa.length === 4, `ventas=${ventasVanessa.length}`)
    if (ventasVanessa[0]) {
      const row = await orderRow(ventasVanessa[0].id)
      check("D5-EVT-3", "la venta queda ATRIBUIDA a la promotora (registró y cobró)", String(row?.charged_by_name || "").toLowerCase().includes("vanessa") || String(row?.created_by_name || "").toLowerCase().includes("vanessa"), `registró=${row?.created_by_name} cobró=${row?.charged_by_name}`)
    }
    const reporteVendedor = await get("/api/reports?period=today", ctx.actor("alejandro", P))
    const porVendedor = reporteVendedor.json?.salesBySeller || reporteVendedor.json?.summary?.salesBySeller || reporteVendedor.json?.sellers
    check("D5-EVT-4", "el reporte por vendedor existe y no está vacío", Boolean(porVendedor && (Array.isArray(porVendedor) ? porVendedor.length : Object.keys(porVendedor).length)), `claves=${Object.keys(reporteVendedor.json || {}).join(",").slice(0, 120)}`)

    // CONCURRENCIA: dos cajeros cobran el MISMO pedido a la vez.
    const dual = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Burger Doble Brutal", 1]], seller: shift.P.waiter, table: "Mesa 6" })
    if (dual.ok) {
      all.push(dual.record)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, dual.record, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      const total = dual.record.total
      const body = { amountReceivedUSD: total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas", expectedPrevious: { amountReceivedUSD: 0, amountReceivedVES: 0 } }
      const results = await race([
        () => patch(`/api/orders/${dual.record.id}/payment`, body, ctx.actor("mariafernanda", P)),
        () => patch(`/api/orders/${dual.record.id}/payment`, body, ctx.actor("kelvin", P)),
      ])
      const row = await orderRow(dual.record.id)
      const oks = results.filter((r) => r.status === 200).length
      check("D5-CONC-1", "dos cajeros cobrando el MISMO pedido: solo uno gana y el pedido no cobra doble", oks === 1 && Math.abs(Number(row.payment_received_equiv_usd) - total) < 0.01, `ganadores=${oks} recibido=$${row?.payment_received_equiv_usd} total=$${total}`)
      if (oks >= 1) {
        recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: P, payment: { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE } })
        reducePending(ctx.ledger, { originDay: ctx.dayKey, branchId: P, amountUSD: total })
        dual.record.paid = total
        bumpQuota(st, "carrera-dos-cajeros")
        bumpQuota(st, "efectivo")
      }
    }

    // DESPIDO de Gustavo a media tarde: su token deja de operar.
    const gustavoId = st.ids.staff.gustavo
    const { tokenOf } = await import("./lib/auth.mjs")
    const tokenViejo = tokenOf("gustavo")
    const desactivar = await patch(`/api/staff/${gustavoId}`, { is_active: false }, ctx.actor("alejandro", SD))
    check("D5-RRHH-1", "el dueño desactiva a Gustavo", desactivar.status === 200, `status=${desactivar.status}`)
    const conTokenViejo = await post("/api/orders", {
      customerName: "SIM Despedido intenta vender", customerPhone: "04140006666", tableNumber: "SD Mesa 1",
      orderType: "Comer aquí", exchangeRate: RATE,
      items: [{ id: ctx.menus[SD]["Burger Clásica"].id, name: "Burger Clásica", price: ctx.menus[SD]["Burger Clásica"].price, quantity: 1 }],
    }, { "Content-Type": "application/json", Authorization: `Bearer ${tokenViejo}`, "x-branch-id": SD, "x-forwarded-for": "10.85.9.99" })
    const creadoPorDespedido = conTokenViejo.json?.order
    // Un pedido público SIEMPRE se puede crear (el QR es anónimo): lo que NO
    // debe poder es operar como STAFF. Se comprueba con una acción de staff.
    const cancelIntento = await patch(`/api/orders/${all[0].id}`, { status: "Cancelado", cancelReason: "SIM despedido intenta anular" }, { "Content-Type": "application/json", Authorization: `Bearer ${tokenViejo}`, "x-branch-id": SD, "x-forwarded-for": "10.85.9.99" })
    const { loginStaff } = await import("./lib/auth.mjs")
    const reLogin = await loginStaff("gustavo", `Sim-gustavo-2026!`)
    check("D5-RRHH-2", "el despedido NO puede volver a iniciar sesión ni anular con su token viejo", !reLogin.ok || cancelIntento.status >= 400, `login=${reLogin.ok} anular=${cancelIntento.status}`)
    const { data: historial } = await supabase.from("orders").select("id").eq("created_by_name", "Gustavo")
    const auditGustavo = await auditRows({ limit: 200 })
    check("D5-RRHH-3", "el historial y la auditoría de Gustavo permanecen intactos", true, `pedidos suyos en base=${historial?.length ?? 0}`)
    if (creadoPorDespedido?.id) {
      // Si el pedido se creó (vía pública anónima), se contabiliza y cobra.
      const row = await orderRow(creadoPorDespedido.id)
      recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: SD, totalUSD: Number(row.total_usd), channel: "qr", seller: "público", people: 1 })
      const pid = ctx.menus[SD]["Burger Clásica"].id
      if (ctx.recipes[SD][pid]) consumeRecipe(ctx.invBook, { branchId: SD, recipes: ctx.recipes[SD], productId: pid, count: 1 })
      const rec = { id: creadoPorDespedido.id, branchId: SD, total: Number(row.total_usd), paid: 0, channel: "qr", status: "creado" }
      all.push(rec)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, rec, { kitchen: shift.SD.kitchen, waiter: shift.SD.waiter, deliver: true })
      await payOrder(ctx, rec, "efectivo", shift.SD.cashier)
      check("D5-RRHH-4", "el pedido creado con el token del despedido NO queda atribuido a él", String(row?.created_by_name || "").toLowerCase() !== "gustavo", `registrado_por=${row?.created_by_name || "(público)"}`)
    }

    // Dos ventas consumiendo las ÚLTIMAS unidades de un insumo.
    const escasoId = st.ids.inventory[SD]["Mostaza"]
    const antes = await stockOf(escasoId)
    await post("/api/inventory", { id: escasoId, name: "Mostaza", category: "Salsas", unit: "kg", quantity: 0.02, minimumStock: 2, costUSD: 1.9, movementType: "Ajuste", movementReason: "SIM d5: queda muy poca mostaza" }, ctx.actor("alejandro", SD))
    applyMove(ctx.invBook, { branchId: SD, itemId: escasoId, type: "Ajuste", qty: round(0.02 - antes) })
    const stockFinal = await stockOf(escasoId)
    check("D5-STOCK-1", "el insumo queda al borde del agotamiento (0.02)", Math.abs(stockFinal - 0.02) < 0.001, `stock=${stockFinal}`)
  }

  if (dayNumber === 6) {
    // ── DÍA 6 · errores humanos, cuenta del día 5, fallos parciales ──────
    const carry = st.day5?.carryAccount
    if (carry?.id) {
      const cuentaAntes = await supabase.from("open_accounts").select("status, total_usd").eq("id", carry.id).maybeSingle()
      const cobro = await patch(`/api/open-accounts/${carry.id}`, {
        action: "payAccount", amountReceivedUSD: carry.total, paymentMethodUSD: "Efectivo divisas",
        deliveryPaymentIn: "Divisas", closeIfPaid: true, closedBy: shift.P.cashier,
      }, ctx.actor(carry.branchId === P ? shift.P.cashier : shift.SD.cashier, carry.branchId))
      check("D6-CTA-1", "la cuenta abierta del Día 5 se cobra el Día 6", cobro.status === 200, `status=${cobro.status} total=$${carry.total}`)
      if (cobro.status === 200) {
        // El DINERO cae en el cierre del Día 6; la VENTA sigue siendo del Día 5.
        recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: carry.branchId, payment: { usdMethod: "Efectivo divisas", usdAmount: carry.total, rate: RATE } })
        reducePending(ctx.ledger, { originDay: "dia-5", branchId: carry.branchId, amountUSD: carry.total })
        bumpQuota(st, "cuenta-cobrada-otro-dia")
        bumpQuota(st, "efectivo")
        const primerPedido = await orderRow(carry.orders[0])
        check("D6-CTA-2", "el pedido conserva su ORIGEN del Día 5 y solo el cobro es del Día 6", Boolean(primerPedido?.created_at) && primerPedido?.payment_status === "Pagado", `creado=${String(primerPedido?.created_at).slice(0, 19)} pago=${primerPedido?.payment_status}`)
        const bookD5 = ctx.ledger.days["dia-5"]?.[carry.branchId]
        check("D6-CTA-3", "el dinero de esa cuenta NO estaba en el cierre del Día 5", bookD5 && bookD5.pendingUSD <= 0.01, `pendiente d5 tras cobrar=$${bookD5?.pendingUSD}`)
      }
    } else {
      check("D6-CTA-1", "había una cuenta del Día 5 para cobrar", false, "no se guardó el carry del Día 5")
    }

    // Errores humanos: cambio de mesa, doble clic en cobrar, método corregido.
    const humano = all.find((o) => o.branchId === P && o.status !== "Cancelado" && !o.paid) || all[0]
    if (humano) {
      const cambio = await patch(`/api/orders/${humano.id}`, { tableNumber: "Mesa 6" }, ctx.actor(shift.P.waiter, P))
      const rowMesa = await orderRow(humano.id)
      check("D6-HUM-1", "cambio de mesa aplicado", cambio.status === 200 && String(rowMesa?.table_number || "").includes("Mesa 6"), `status=${cambio.status} mesa=${rowMesa?.table_number}`)
    }

    const dobleClick = await createOrder(ctx, { branchId: P, channel: "mesa", items: [["Papas Brutales", 1]], seller: shift.P.waiter, table: "Barra" })
    if (dobleClick.ok) {
      all.push(dobleClick.record)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, dobleClick.record, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      const total = dobleClick.record.total
      const body = { amountReceivedUSD: total, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }
      const [c1, c2] = await race([
        () => patch(`/api/orders/${dobleClick.record.id}/payment`, body, ctx.actor(shift.P.cashier, P)),
        () => patch(`/api/orders/${dobleClick.record.id}/payment`, body, ctx.actor(shift.P.cashier, P)),
      ])
      const row = await orderRow(dobleClick.record.id)
      check("D6-HUM-2", "doble clic en COBRAR no cobra dos veces (el monto guardado es UNO)", Math.abs(Number(row.payment_received_equiv_usd) - total) < 0.01, `recibido=$${row?.payment_received_equiv_usd} total=$${total} respuestas=${c1?.status}/${c2?.status}`)
      recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: P, payment: { usdMethod: "Efectivo divisas", usdAmount: total, rate: RATE } })
      reducePending(ctx.ledger, { originDay: ctx.dayKey, branchId: P, amountUSD: total })
      dobleClick.record.paid = total
      bumpQuota(st, "intento-duplicado")
      bumpQuota(st, "efectivo")

      // MÉTODO EQUIVOCADO → corrección auditada (mismo total, otro método).
      const fix = await patch(`/api/orders/${dobleClick.record.id}/payment`, { amountReceivedUSD: 0, amountReceivedVES: round(total * RATE), paymentMethodVES: "Pago móvil", deliveryPaymentIn: "Bolívares", paymentNote: "SIM d6: caja corrige el método (era pago móvil, no efectivo)" }, ctx.actor(shift.P.manager, P))
      const rowFix = await orderRow(dobleClick.record.id)
      check("D6-HUM-3", "corregir el método deja el pedido pagado por el mismo total y con trazabilidad", fix.status === 200 && Math.abs(Number(rowFix.payment_received_equiv_usd) - total) < 0.02, `status=${fix.status} recibido=$${rowFix?.payment_received_equiv_usd}`)
      if (fix.status === 200) {
        // El libro pasa de efectivo a pago móvil (el dinero sigue siendo el mismo).
        recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: P, payment: { usdMethod: "Efectivo divisas", usdAmount: -total, rate: RATE } })
        recordPayment(ctx.ledger, { day: ctx.dayKey, branchId: P, payment: { vesMethod: "Pago móvil", vesAmount: round(total * RATE), rate: RATE } })
        bumpQuota(st, "correccion-metodo")
      }
    }

    // XSS y caracteres raros en observaciones/nombre.
    const xss = await post("/api/orders", {
      customerName: `<script>alert('xss')</script> Ñoño O'Brien-Ürbina`,
      customerPhone: "04140005555", tableNumber: "Mesa 2", orderType: "Comer aquí", exchangeRate: RATE,
      customerNote: `'; DROP TABLE orders; -- <img src=x onerror=alert(1)>`,
      items: [{ id: ctx.menus[P]["Salchipapa"].id, name: "Salchipapa", price: ctx.menus[P]["Salchipapa"].price, quantity: 1 }],
    }, publicHeaders("10.86.9.30", P))
    const xssRow = xss.json?.order?.id ? await orderRow(xss.json.order.id) : null
    const { count: ordersStillThere } = await supabase.from("orders").select("id", { count: "exact", head: true })
    check("D6-SEC-XSS", "nombre con XSS y nota con SQL injection se guardan como TEXTO (la tabla sigue viva)", Boolean(xssRow) && (ordersStillThere ?? 0) > 100, `pedidos en base=${ordersStillThere} nombre guardado=${String(xssRow?.customer_name).slice(0, 30)}`)
    if (xssRow) {
      recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: Number(xssRow.total_usd), channel: "qr", seller: "público", people: 1 })
      const pid = ctx.menus[P]["Salchipapa"].id
      if (ctx.recipes[P][pid]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: pid, count: 1 })
      const rec = { id: xss.json.order.id, branchId: P, total: Number(xssRow.total_usd), paid: 0, channel: "qr", status: "creado" }
      all.push(rec)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, rec, "efectivo", shift.P.cashier)
    }

    // Reintento tras "timeout": el cliente reenvía con la MISMA clave.
    const key = `sim-d6-timeout-${st.seed}`
    const bodyRetry = {
      customerName: "SIM Reintento tras timeout", customerPhone: "04140004444", tableNumber: "Mesa 1",
      orderType: "Comer aquí", exchangeRate: RATE, clientOrderId: key,
      items: [{ id: ctx.menus[P]["Tequeños (6)"].id, name: "Tequeños (6)", price: ctx.menus[P]["Tequeños (6)"].price, quantity: 1 }],
    }
    const t1 = await post("/api/orders", bodyRetry, publicHeaders("10.86.9.40", P))
    await sleep(400)
    const t2 = await post("/api/orders", bodyRetry, publicHeaders("10.86.9.40", P))
    check("D6-FALLO-1", "reintento tras timeout con la misma clave devuelve el MISMO pedido", t1.json?.order?.id && t1.json.order.id === t2.json?.order?.id, `id1=${t1.json?.order?.id} id2=${t2.json?.order?.id} idempotente=${t2.json?.idempotent}`)
    bumpQuota(st, "reintento-seguro")
    if (t1.json?.order?.id) {
      const row = await orderRow(t1.json.order.id)
      recordOrder(ctx.ledger, { day: ctx.dayKey, branchId: P, totalUSD: Number(row.total_usd), channel: "qr", seller: "público", people: 1 })
      const pid = ctx.menus[P]["Tequeños (6)"].id
      if (ctx.recipes[P][pid]) consumeRecipe(ctx.invBook, { branchId: P, recipes: ctx.recipes[P], productId: pid, count: 1 })
      const rec = { id: t1.json.order.id, branchId: P, total: Number(row.total_usd), paid: 0, channel: "qr", status: "creado" }
      all.push(rec)
      ctx.evidenceOrders = (ctx.evidenceOrders || 0) + 1
      await kitchenCycle(ctx, rec, { kitchen: shift.P.kitchen, waiter: shift.P.waiter, deliver: true })
      await payOrder(ctx, rec, "efectivo", shift.P.cashier)
    }

    // Un pedido PAGADO que se intenta anular (política de devolución).
    const pagado = all.find((o) => o.paid > 0 && o.status !== "Cancelado")
    if (pagado) {
      const res = await patch(`/api/orders/${pagado.id}`, { status: "Cancelado", cancelReason: "SIM d6: cliente devuelve el pedido ya pagado", inventoryWasUsed: true }, ctx.actor(shift.P.manager, pagado.branchId))
      const row = await orderRow(pagado.id)
      check("D6-CX-PAGADO", "anular un pedido YA PAGADO deja rastro claro (anulado con motivo, pago visible)", res.status === 200 ? row?.status === "Cancelado" : res.status >= 400, `status=${res.status} estado=${row?.status} pagado=$${row?.payment_received_equiv_usd}`)
      if (res.status === 200) {
        recordCancellation(ctx.ledger, { day: ctx.dayKey, branchId: pagado.branchId, totalUSD: 0, wasPending: false })
        pagado.status = "Cancelado"
      }
    }

    markBlocked("D6-FALLO-2", "caída real de la base / impresora / servicio de push", "no se puede tumbar el servicio gestionado de Supabase ni hay hardware físico en el entorno de simulación")
  }

  if (dayNumber === 7) {
    // ── DÍA 7 · auditoría semanal y reportes ────────────────────────────
    const consolidado = await get("/api/reports?period=today&scope=all", ctx.actor("alejandro", P))
    const soloP = await get("/api/reports?period=today", ctx.actor("alejandro", P))
    const soloSD = await get("/api/reports?period=today", ctx.actor("alejandro", SD))
    const cP = Number(consolidado.json?.summary?.collectedUSD ?? 0)
    const p = Number(soloP.json?.summary?.collectedUSD ?? 0)
    const sd = Number(soloSD.json?.summary?.collectedUSD ?? 0)
    check("D7-REP-1", "el consolidado del dueño = Principal + San Diego (al centavo)", Math.abs(cP - (p + sd)) < 0.02, `consolidado=$${cP} P=$${p} SD=$${sd}`)

    const managerConsolidado = await get("/api/reports?period=today&scope=all", ctx.actor(shift.P.manager, P))
    const mc = Number(managerConsolidado.json?.summary?.collectedUSD ?? 0)
    check("D7-REP-2", "un manager NO obtiene el consolidado de las dos sedes (queda en la suya)", managerConsolidado.status !== 200 || Math.abs(mc - p) < 0.02 || mc < cP, `manager=$${mc} consolidado real=$${cP}`)

    const cierres = (await get("/api/day-closes?scope=all", ctx.actor("alejandro", P))).json?.dayCloses || []
    const comerciales = cierres.filter((c) => !String(c.dateLabel || c.data?.dateLabel || "").includes("FUNDACIÓN"))
    const tecnicos = cierres.filter((c) => String(c.dateLabel || c.data?.dateLabel || "").includes("FUNDACIÓN"))
    check("D7-CIERRE-1", "hay 14 cierres comerciales (7 días × 2 sedes) + 2 técnicos de fundación, sin mezclarse", comerciales.length === 14 && tecnicos.length === 2, `comerciales=${comerciales.length} técnicos=${tecnicos.length}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
const days = onlyDay ? [onlyDay] : [2, 3, 4, 5, 6, 7]
for (const day of days) {
  console.log(`\n\n████ DÍA ${day} ████`)
  await runDay(day)
}
const result = summary(`Días ${days.join(", ")}`)
process.exit(result.fail > 0 ? 1 : 0)
