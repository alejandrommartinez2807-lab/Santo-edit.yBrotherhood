// QA ronda 2026-07-28 · Métodos de cobro + cuenta abierta completa + cierre.
//
// Lo que el dueño preguntó: "los métodos de cobro están como raros, no sé si
// se están guardando de verdad y si queda el registro en el cierre de caja y
// en el historial de cierres". Este script lo comprueba con dinero real:
//
//  M1 · un pedido por CADA método del catálogo (paymentOptions.ts), cobrado en
//       caja, verificando la columna exacta que queda en la BD — incluidas
//       variantes mal escritas ("zelle ", "PAGOMOVIL", inventadas).
//  M2 · ciclo completo de cuenta abierta: abrir → asociar pedidos → cocina
//       (Preparando/kitchen_started_at → Listo) → marcar productos entregados
//       uno a uno (setItemDelivered) → Entregado → cobro FIFO por método →
//       cierre automático de la cuenta.
//  M3 · cierre del día con el desglose por método (paymentByUSDMethod /
//       paymentByVESMethod) y verificación de que ese desglose SOBREVIVE en
//       day_closes.data y en GET /api/day-closes (el historial). Si llega
//       vacío, el culpable es la compuerta canIncludeCashierAudit del plan.
//
// Fotografía y restauración calcadas de qa-day-close.mjs: el cierre borra los
// comprobantes de la sede, así que se restauran; el cierre de prueba se borra
// del historial; 0 filas ZZTEST al salir.
//
// Uso:  npm run qa:metodos-cobro      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  get,
  patch,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const RATE = 40
const round = (n) => Math.round(n * 100) / 100
const near = (a, b, tol = 0.02) => Math.abs(Number(a || 0) - Number(b || 0)) <= tol

await assertBrotherhood()
console.log(`QA métodos de cobro + cuenta abierta + cierre · run=${RUN}\n`)

// ── fotografía previa (para restaurar al final)
const { data: proofsBeforeA } = await supabase.from("payment_proofs").select("*").eq("branch_id", A)
const { data: closesBefore } = await supabase.from("day_closes").select("id")
const closeIdsBefore = new Set((closesBefore || []).map((r) => r.id))
console.log(`fotografía previa · comprobantes A=${proofsBeforeA?.length ?? 0} · cierres=${closesBefore?.length ?? 0}\n`)

let restored = false
async function restore() {
  if (restored) return
  restored = true
  console.log("\n── restaurando el estado previo")

  const { data: closesNow } = await supabase.from("day_closes").select("id")
  const mine = (closesNow || []).map((r) => r.id).filter((id) => !closeIdsBefore.has(id))
  if (mine.length) await supabase.from("day_closes").delete().in("id", mine)

  const { data: proofsNow } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const surviving = new Set((proofsNow || []).map((r) => r.id))
  const toRestore = (proofsBeforeA || []).filter((r) => !surviving.has(r.id))
  if (toRestore.length) {
    const { error } = await supabase.from("payment_proofs").insert(toRestore)
    console.log(`   · comprobantes restaurados: ${error ? error.message : toRestore.length}`)
  }

  const { data: accounts } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`)
  const accountIds = (accounts || []).map((r) => r.id)
  if (accountIds.length) {
    await supabase.from("orders").update({ open_account_id: null }).in("open_account_id", accountIds)
    const { error } = await supabase.from("open_accounts").delete().in("id", accountIds)
    console.log(`   · cuentas de prueba borradas: ${error ? error.message : accountIds.length}`)
  }

  const { deleted, leftovers } = await cleanupRunOrders(RUN)

  const { data: proofsFinal } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const { data: closesFinal } = await supabase.from("day_closes").select("id")
  const { data: accountsFinal } = await supabase.from("open_accounts").select("id").ilike("customer_name", "ZZTEST%")
  check(
    "restauración · comprobantes e historial vuelven a su número original",
    (proofsFinal?.length ?? 0) === (proofsBeforeA?.length ?? 0) && (closesFinal?.length ?? 0) === (closesBefore?.length ?? 0),
    `proofs ${proofsBeforeA?.length ?? 0}→${proofsFinal?.length ?? 0} · cierres ${closesBefore?.length ?? 0}→${closesFinal?.length ?? 0}`,
  )
  check(
    "restauración · 0 pedidos y 0 cuentas de prueba",
    leftovers === 0 && (accountsFinal?.length ?? 0) === 0,
    `pedidos borrados=${deleted} cuentas=${accountsFinal?.length ?? 0}`,
  )
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

const mkOrder = async (tag, price, extra = {}) => {
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-${tag}`,
      customerPhone: "04140000031",
      tableNumber: "Mesa 3",
      orderType: "Comer aquí",
      exchangeRate: RATE,
      items: [{ id: 999031, name: `${RUN}-ITEM-${tag}`, price, quantity: 1 }],
      ...extra,
    },
    { "x-branch-id": A },
  )
  if (!json?.order?.id) console.log(`   ⚠ mkOrder ${tag}: status=${status} ${JSON.stringify(json).slice(0, 140)}`)
  return json?.order
}

const orderRow = async (id) =>
  (
    await supabase
      .from("orders")
      .select("id, payment_status, amount_received_usd, amount_received_ves, payment_method_usd, payment_method_ves, payment_received_equiv_usd, payment_pending_usd, delivery_payment_in, status, kitchen_started_at, open_account_id, open_account_status")
      .eq("id", id)
      .maybeSingle()
  ).data

// Libro mayor de lo que cobramos, para cuadrarlo con el cierre en M3.
const ledgerUSD = new Map() // método → {count, totalUSD}
const ledgerVES = new Map() // método → {count, totalUSD(equiv), totalVES}
const addUSD = (method, usd) => {
  const cur = ledgerUSD.get(method) || { count: 0, totalUSD: 0 }
  ledgerUSD.set(method, { count: cur.count + 1, totalUSD: round(cur.totalUSD + usd) })
}
const addVES = (method, ves) => {
  const cur = ledgerVES.get(method) || { count: 0, totalUSD: 0, totalVES: 0 }
  ledgerVES.set(method, { count: cur.count + 1, totalUSD: round(cur.totalUSD + ves / RATE), totalVES: round(cur.totalVES + ves) })
}

try {
  // ─────────────────────────────────────────────────────────────────────────
  // M1 · UN COBRO POR CADA MÉTODO DEL CATÁLOGO
  // ─────────────────────────────────────────────────────────────────────────
  console.log("── M1 · el catálogo completo de métodos, uno por uno")

  const USD_METHODS = ["Efectivo divisas", "Zelle", "Binance", "USDT", "Transferencia internacional"]
  for (const method of USD_METHODS) {
    const order = await mkOrder(`USD-${method.slice(0, 8)}`, 10)
    if (!order) { check(`M1 · ${method}: pedido creado`, false); continue }
    const pay = await patch(
      `/api/orders/${order.id}/payment`,
      { amountReceivedUSD: 10, paymentMethodUSD: method, deliveryPaymentIn: "Divisas" },
      { "x-branch-id": A },
    )
    const row = await orderRow(order.id)
    check(
      `M1 · ${method} → cobrado y guardado con SU etiqueta`,
      pay.status === 200 && row?.payment_method_usd === method && row?.payment_status === "Pagado" && near(row?.payment_received_equiv_usd, 10),
      `status=${pay.status} guardado="${row?.payment_method_usd}" estado=${row?.payment_status} equiv=$${row?.payment_received_equiv_usd}`,
    )
    if (pay.status === 200) addUSD(method, 10)
  }

  const VES_METHODS = ["Pago móvil", "Punto", "Transferencia", "Efectivo Bs", "Biopago"]
  for (const method of VES_METHODS) {
    const order = await mkOrder(`VES-${method.slice(0, 8)}`, 5)
    if (!order) { check(`M1 · ${method}: pedido creado`, false); continue }
    const pay = await patch(
      `/api/orders/${order.id}/payment`,
      { amountReceivedVES: 5 * RATE, paymentMethodVES: method, deliveryPaymentIn: "Bolívares" },
      { "x-branch-id": A },
    )
    const row = await orderRow(order.id)
    check(
      `M1 · ${method} (Bs) → cobrado y guardado con SU etiqueta`,
      pay.status === 200 && row?.payment_method_ves === method && row?.payment_status === "Pagado" && near(row?.payment_received_equiv_usd, 5),
      `status=${pay.status} guardado="${row?.payment_method_ves}" estado=${row?.payment_status} equiv=$${row?.payment_received_equiv_usd}`,
    )
    if (pay.status === 200) addVES(method, 5 * RATE)
  }

  // Mixto en caja: las dos monedas en el mismo cobro.
  const mixto = await mkOrder("MIXTO", 20)
  if (mixto) {
    const pay = await patch(
      `/api/orders/${mixto.id}/payment`,
      {
        amountReceivedUSD: 12,
        paymentMethodUSD: "Zelle",
        amountReceivedVES: 8 * RATE,
        paymentMethodVES: "Pago móvil",
        deliveryPaymentIn: "Mixto",
      },
      { "x-branch-id": A },
    )
    const row = await orderRow(mixto.id)
    check(
      "M1 · MIXTO en caja ($12 Zelle + Bs de $8 Pago móvil) → las dos columnas, Pagado",
      pay.status === 200 &&
        row?.payment_method_usd === "Zelle" &&
        row?.payment_method_ves === "Pago móvil" &&
        row?.delivery_payment_in === "Mixto" &&
        near(row?.payment_received_equiv_usd, 20) &&
        row?.payment_status === "Pagado",
      `usd="${row?.payment_method_usd}" ves="${row?.payment_method_ves}" in=${row?.delivery_payment_in} equiv=$${row?.payment_received_equiv_usd} estado=${row?.payment_status}`,
    )
    if (pay.status === 200) { addUSD("Zelle", 12); addVES("Pago móvil", 8 * RATE) }
  } else check("M1 · MIXTO: pedido creado", false)

  // Variantes mal escritas: tienen que caer en la etiqueta canónica, no crear
  // "métodos raros" nuevos en el cierre.
  console.log("\n── M1b · variantes mal escritas (lo 'raro' no debe crear métodos nuevos)")
  const weird = [
    { tag: "RARO-zelle", side: "usd", send: "  zelle  ", expect: "Zelle" },
    { tag: "RARO-pmovil", side: "ves", send: "PAGOMOVIL", expect: "Pago móvil" },
    { tag: "RARO-crypto", side: "usd", send: "CryptoInventado X", expect: "Otro" },
  ]
  for (const variant of weird) {
    const order = await mkOrder(variant.tag, 4)
    if (!order) { check(`M1b · variante "${variant.send}": pedido creado`, false); continue }
    const body =
      variant.side === "usd"
        ? { amountReceivedUSD: 4, paymentMethodUSD: variant.send, deliveryPaymentIn: "Divisas" }
        : { amountReceivedVES: 4 * RATE, paymentMethodVES: variant.send, deliveryPaymentIn: "Bolívares" }
    const pay = await patch(`/api/orders/${order.id}/payment`, body, { "x-branch-id": A })
    const row = await orderRow(order.id)
    const stored = variant.side === "usd" ? row?.payment_method_usd : row?.payment_method_ves
    check(
      `M1b · "${variant.send}" se normaliza a "${variant.expect}"`,
      pay.status === 200 && stored === variant.expect,
      `guardado="${stored}"`,
    )
    if (pay.status === 200) {
      if (variant.side === "usd") addUSD(variant.expect, 4)
      else addVES(variant.expect, 4 * RATE)
    }
  }

  // Pago parcial: método guardado aunque el pedido no quede pagado.
  const parcial = await mkOrder("PARCIAL", 15)
  if (parcial) {
    const pay = await patch(
      `/api/orders/${parcial.id}/payment`,
      { amountReceivedUSD: 5, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" },
      { "x-branch-id": A },
    )
    const row = await orderRow(parcial.id)
    check(
      "M1 · pago PARCIAL ($5 de $15) → 'Pago parcial', método guardado, pendiente $10",
      pay.status === 200 && row?.payment_status === "Pago parcial" && row?.payment_method_usd === "Efectivo divisas" && near(row?.payment_pending_usd, 10),
      `estado=${row?.payment_status} método="${row?.payment_method_usd}" pendiente=$${row?.payment_pending_usd}`,
    )
    if (pay.status === 200) addUSD("Efectivo divisas", 5)
  } else check("M1 · PARCIAL: pedido creado", false)

  // ─────────────────────────────────────────────────────────────────────────
  // M2 · CUENTA ABIERTA: cocina → entregado por producto → cobro FIFO → cierre
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── M2 · ciclo completo de la cuenta abierta")

  const cta = await post(
    "/api/open-accounts",
    { tableNumber: "Afuera", customerName: `${RUN}-CTA` },
    { "x-branch-id": A },
  )
  const accountId = cta.json?.openAccount?.id || cta.json?.account?.id
  check("M2 · cuenta abierta creada (mesa Afuera)", cta.status === 200 || cta.status === 201, `status=${cta.status} id=${accountId}`)

  const po1 = await mkOrder("CTA-P1", 18, {
    openAccountId: accountId,
    items: [
      { id: 999031, name: `${RUN}-BURGER`, price: 10, quantity: 1 },
      { id: 999032, name: `${RUN}-REFRESCO`, price: 4, quantity: 2 },
    ],
  })
  const po2 = await mkOrder("CTA-P2", 12, { attachToTableOpenAccount: true, tableNumber: "Afuera" })
  check("M2 · dos pedidos nacen ASOCIADOS a la cuenta", Boolean(po1?.id && po2?.id), `p1=${po1?.id} p2=${po2?.id}`)

  const rowsAttached = await Promise.all([orderRow(po1?.id || ""), orderRow(po2?.id || "")])
  check(
    "M2 · los dos pedidos llevan el open_account_id correcto en la BD",
    rowsAttached.every((r) => r?.open_account_id === accountId),
    `p1=${rowsAttached[0]?.open_account_id === accountId} p2=${rowsAttached[1]?.open_account_id === accountId}`,
  )

  const acct1 = (await supabase.from("open_accounts").select("*").eq("id", accountId || "").maybeSingle()).data
  check(
    "M2 · los totales de la cuenta se recalculan solos ($18 + $12 = $30)",
    near(acct1?.total_estimated_usd, 30) && near(acct1?.pending_usd, 30),
    `estimado=$${acct1?.total_estimated_usd} pendiente=$${acct1?.pending_usd}`,
  )

  // Cocina: Preparando arranca el cronómetro, Listo lo respeta.
  const prep = await patch(`/api/orders/${po1?.id}`, { status: "Preparando" }, { "x-branch-id": A })
  const rowPrep = await orderRow(po1?.id || "")
  check(
    "M2 · COCINA · 'Preparando' estampa kitchen_started_at (cronómetro)",
    prep.status === 200 && Boolean(rowPrep?.kitchen_started_at),
    `status=${prep.status} kitchen_started_at=${rowPrep?.kitchen_started_at}`,
  )
  const listo = await patch(`/api/orders/${po1?.id}`, { status: "Listo" }, { "x-branch-id": A })
  check("M2 · COCINA · 'Listo' aplica", listo.status === 200, `status=${listo.status}`)

  // Entregar producto por producto DENTRO de la cuenta (setItemDelivered).
  const itemsP1 = (await supabase.from("orders").select("id, order_items(line_id, name, delivered_at, delivered_by)").eq("id", po1?.id || "").maybeSingle()).data?.order_items || []
  const burger = itemsP1.find((i) => String(i.name).includes("BURGER"))
  const refresco = itemsP1.find((i) => String(i.name).includes("REFRESCO"))

  // El panel real (OpenAccountsPanel.tsx:524-530) manda la cadena completa
  // lineId + productId + itemName; los pedidos viejos pueden traer line_id
  // null y el fallback los identifica igual. El script calca ese payload.
  const mark = await patch(
    `/api/orders/${po1?.id}`,
    {
      action: "setItemDelivered",
      lineId: burger?.line_id || "",
      productId: 999031,
      itemName: burger?.name,
      delivered: true,
      deliveredBy: "QA",
    },
    { "x-branch-id": A },
  )
  let itemsNow = (await supabase.from("order_items").select("line_id, name, delivered_at, delivered_by").eq("order_id", po1?.id || "")).data || []
  const burgerNow = itemsNow.find((i) => i.name === burger?.name)
  const refrescoNow = itemsNow.find((i) => i.name === refresco?.name)
  check(
    "M2 · ENTREGA POR PRODUCTO · la burger queda marcada (delivered_at + quién) y el refresco NO",
    mark.status === 200 && Boolean(burgerNow?.delivered_at) && burgerNow?.delivered_by === "QA" && !refrescoNow?.delivered_at,
    `status=${mark.status} burger=${burgerNow?.delivered_at ? "entregada por " + burgerNow?.delivered_by : "NO"} refresco=${refrescoNow?.delivered_at ? "entregado" : "pendiente"}`,
  )

  const unmark = await patch(
    `/api/orders/${po1?.id}`,
    {
      action: "setItemDelivered",
      lineId: burger?.line_id || "",
      productId: 999031,
      itemName: burger?.name,
      delivered: false,
    },
    { "x-branch-id": A },
  )
  itemsNow = (await supabase.from("order_items").select("line_id, name, delivered_at").eq("order_id", po1?.id || "")).data || []
  check(
    "M2 · ENTREGA POR PRODUCTO · desmarcar la limpia (error del dedo)",
    unmark.status === 200 && !itemsNow.find((i) => i.name === burger?.name)?.delivered_at,
    `status=${unmark.status}`,
  )

  // Estado por pedido DESDE la cuenta: solo Listo/Entregado.
  const badStatus = await patch(
    `/api/open-accounts/${accountId}`,
    { action: "updateOrderStatus", orderId: po1?.id, status: "Preparando" },
    { "x-branch-id": A },
  )
  check(
    "M2 · desde la cuenta NO se puede mandar a 'Preparando' (solo Listo/Entregado)",
    badStatus.status >= 400,
    `status=${badStatus.status}`,
  )

  const entregado = await patch(
    `/api/open-accounts/${accountId}`,
    { action: "updateOrderStatus", orderId: po1?.id, status: "Entregado" },
    { "x-branch-id": A },
  )
  itemsNow = (await supabase.from("order_items").select("line_id, delivered_at").eq("order_id", po1?.id || "")).data || []
  check(
    "M2 · 'Entregado' desde la cuenta estampa TODOS los productos como entregados",
    entregado.status === 200 && itemsNow.length > 0 && itemsNow.every((i) => Boolean(i.delivered_at)),
    `status=${entregado.status} items=${itemsNow.length} entregados=${itemsNow.filter((i) => i.delivered_at).length}`,
  )

  // Cobro FIFO: primero $18 en efectivo (cubre P1), luego el resto en Punto Bs.
  const pago1 = await patch(
    `/api/open-accounts/${accountId}`,
    { action: "payAccount", amountReceivedUSD: 18, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" },
    { "x-branch-id": A },
  )
  const rowP1 = await orderRow(po1?.id || "")
  const acct2 = (await supabase.from("open_accounts").select("*").eq("id", accountId || "").maybeSingle()).data
  check(
    "M2 · COBRO FIFO · los $18 caen en el pedido MÁS VIEJO, con su método ('Efectivo divisas')",
    pago1.status === 200 && rowP1?.payment_status === "Pagado" && rowP1?.payment_method_usd === "Efectivo divisas" && !rowP1?.payment_method_ves,
    `status=${pago1.status} p1=${rowP1?.payment_status} usd="${rowP1?.payment_method_usd}" ves="${rowP1?.payment_method_ves || ""}"`,
  )
  check(
    "M2 · la cuenta refleja el abono ($30 → pendiente $12)",
    near(acct2?.total_collected_usd, 18) && near(acct2?.pending_usd, 12),
    `cobrado=$${acct2?.total_collected_usd} pendiente=$${acct2?.pending_usd}`,
  )
  if (pago1.status === 200) addUSD("Efectivo divisas", 18)

  const pago2 = await patch(
    `/api/open-accounts/${accountId}`,
    { action: "payAccount", amountReceivedVES: 12 * RATE, paymentMethodVES: "Punto", deliveryPaymentIn: "Bolívares", closeIfPaid: true, closedBy: "QA" },
    { "x-branch-id": A },
  )
  const rowP2 = await orderRow(po2?.id || "")
  const acct3 = (await supabase.from("open_accounts").select("*").eq("id", accountId || "").maybeSingle()).data
  check(
    "M2 · COBRO FIFO 2ª tanda · el resto (Bs por Punto) cae en el 2º pedido",
    pago2.status === 200 && rowP2?.payment_status === "Pagado" && rowP2?.payment_method_ves === "Punto",
    `status=${pago2.status} p2=${rowP2?.payment_status} ves="${rowP2?.payment_method_ves}"`,
  )
  check(
    "M2 · con pendiente $0 y closeIfPaid la cuenta se CIERRA sola",
    acct3?.status === "Cerrada" && near(acct3?.pending_usd, 0),
    `status=${acct3?.status} pendiente=$${acct3?.pending_usd}`,
  )
  const rowsClosed = await Promise.all([orderRow(po1?.id || ""), orderRow(po2?.id || "")])
  check(
    "M2 · el cierre de la cuenta se propaga a los pedidos (open_account_status)",
    rowsClosed.every((r) => r?.open_account_status === "Cerrada"),
    `p1=${rowsClosed[0]?.open_account_status} p2=${rowsClosed[1]?.open_account_status}`,
  )
  if (pago2.status === 200) addVES("Punto", 12 * RATE)

  // ─────────────────────────────────────────────────────────────────────────
  // M3 · EL CIERRE DEL DÍA GUARDA EL DESGLOSE POR MÉTODO — Y EL HISTORIAL LO DEVUELVE
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── M3 · cierre del día con desglose por método")

  const reportA = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  const paymentByUSDMethod = [...ledgerUSD.entries()].map(([label, v]) => ({ label, count: v.count, totalUSD: v.totalUSD, totalVES: 0 }))
  const paymentByVESMethod = [...ledgerVES.entries()].map(([label, v]) => ({ label, count: v.count, totalUSD: v.totalUSD, totalVES: v.totalVES }))
  const cashUSD = ledgerUSD.get("Efectivo divisas")?.totalUSD || 0
  const vesTotal = [...ledgerVES.values()].reduce((s, v) => s + v.totalVES, 0)
  const vesEquiv = [...ledgerVES.values()].reduce((s, v) => s + v.totalUSD, 0)
  const usdTotal = [...ledgerUSD.values()].reduce((s, v) => s + v.totalUSD, 0)

  console.log(`   · libro mayor USD: ${paymentByUSDMethod.map((m) => `${m.label}=$${m.totalUSD}`).join(" · ")}`)
  console.log(`   · libro mayor VES: ${paymentByVESMethod.map((m) => `${m.label}=Bs${m.totalVES}`).join(" · ")}`)

  const cierre = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: new Date().toLocaleDateString("es-VE"),
        summaryText: `${RUN} · cierre de prueba con desglose por método`,
        ordersRegistered: Number(reportA.orders || 0),
        totalSoldUSD: Number(reportA.totalUSD || 0),
        realCollectedUSD: round(usdTotal + vesEquiv),
        realCashUSD: cashUSD,
        realVES: round(vesTotal),
        realVESEquivalentUSD: round(vesEquiv),
        realPendingUSD: Number(reportA.pendingUSD || 0),
        totalConfirmedUSD: round(usdTotal + vesEquiv),
        paymentByUSDMethod,
        paymentByVESMethod,
        paymentByStatus: [
          { label: "Pagado", count: paymentByUSDMethod.length + paymentByVESMethod.length, totalUSD: round(usdTotal + vesEquiv), totalVES: round(vesTotal) },
        ],
      },
    },
    { "x-branch-id": A },
  )
  check("M3 · el cierre responde 200", cierre.status === 200, `status=${cierre.status} ${JSON.stringify(cierre.json).slice(0, 160)}`)
  const closeId = cierre.json?.dayClose?.id

  const { data: closeRow } = await supabase.from("day_closes").select("id, branch_id, data").eq("id", closeId || "").maybeSingle()
  const savedUSD = closeRow?.data?.paymentByUSDMethod || []
  const savedVES = closeRow?.data?.paymentByVESMethod || []

  check(
    "M3 · day_closes.data CONSERVA el desglose por método (la compuerta 'cashier' está abierta)",
    savedUSD.length === paymentByUSDMethod.length && savedVES.length === paymentByVESMethod.length,
    `USD ${savedUSD.length}/${paymentByUSDMethod.length} · VES ${savedVES.length}/${paymentByVESMethod.length}` +
      (savedUSD.length === 0 ? " ⚠ si llega 0, canIncludeCashierAudit está filtrando (módulo caja apagado en el plan)" : ""),
  )

  for (const expected of paymentByUSDMethod) {
    const found = savedUSD.find((m) => m.label === expected.label)
    check(
      `M3 · el cierre guarda "${expected.label}" con $${expected.totalUSD}`,
      Boolean(found) && near(found?.totalUSD, expected.totalUSD),
      `guardado=$${found?.totalUSD ?? "AUSENTE"}`,
    )
  }
  for (const expected of paymentByVESMethod) {
    const found = savedVES.find((m) => m.label === expected.label)
    check(
      `M3 · el cierre guarda "${expected.label}" con Bs ${expected.totalVES} ($${expected.totalUSD})`,
      Boolean(found) && near(found?.totalVES, expected.totalVES, 1) && near(found?.totalUSD, expected.totalUSD),
      `guardado=Bs${found?.totalVES ?? "AUSENTE"}/$${found?.totalUSD ?? "—"}`,
    )
  }

  // El HISTORIAL (lo que ve el dueño en /local-santo/cierres) devuelve lo mismo.
  const historial = (await get("/api/day-closes", { "x-branch-id": A })).json?.dayCloses || []
  const inHistory = historial.find((c) => c.id === closeId)
  check("M3 · el cierre aparece en el HISTORIAL de la sede", Boolean(inHistory))
  check(
    "M3 · el historial devuelve el desglose por método COMPLETO (no se pierde al releer)",
    (inHistory?.paymentByUSDMethod?.length ?? 0) === paymentByUSDMethod.length &&
      (inHistory?.paymentByVESMethod?.length ?? 0) === paymentByVESMethod.length,
    `USD=${inHistory?.paymentByUSDMethod?.length ?? 0} VES=${inHistory?.paymentByVESMethod?.length ?? 0}`,
  )
  const zelleHist = inHistory?.paymentByUSDMethod?.find((m) => m.label === "Zelle")
  check(
    "M3 · muestra: el Zelle del historial cuadra al centavo con lo cobrado",
    near(zelleHist?.totalUSD, ledgerUSD.get("Zelle")?.totalUSD || 0),
    `historial=$${zelleHist?.totalUSD} cobrado=$${ledgerUSD.get("Zelle")?.totalUSD}`,
  )
  check(
    "M3 · la suma del desglose == lo cobrado total (ni un método se pierde)",
    near(
      (inHistory?.paymentByUSDMethod || []).reduce((s, m) => s + Number(m.totalUSD || 0), 0) +
        (inHistory?.paymentByVESMethod || []).reduce((s, m) => s + Number(m.totalUSD || 0), 0),
      usdTotal + vesEquiv,
    ),
    `desglose=$${round(
      (inHistory?.paymentByUSDMethod || []).reduce((s, m) => s + Number(m.totalUSD || 0), 0) +
        (inHistory?.paymentByVESMethod || []).reduce((s, m) => s + Number(m.totalUSD || 0), 0),
    )} cobrado=$${round(usdTotal + vesEquiv)}`,
  )
} finally {
  await restore()
}

process.exit(summary("Métodos de cobro + cuenta + cierre") > 0 ? 1 : 0)
