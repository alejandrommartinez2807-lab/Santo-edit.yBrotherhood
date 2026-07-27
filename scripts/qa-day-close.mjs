// QA ronda 2026-07-27 · F8: el CIERRE DEL DÍA de verdad, end-to-end.
//
// Este cierre tiene efectos destructivos por diseño: borra todas las filas de
// payment_proofs de la sede y escribe una fila en el historial del dueño. Por
// eso el script hace fotografía de los comprobantes ANTES y los restaura al
// terminar, y borra su propio cierre del historial. Aun así: corre
// `npm run backup` antes.
//
// Uso:  npm run qa:day-close      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
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
const B = BRANCH_VINEDO
const RATE = 40

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

await assertBrotherhood()
console.log(`F8 · cierre del día real · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// FOTOGRAFÍA PREVIA (para poder devolverlo todo como estaba)
// ───────────────────────────────────────────────────────────────────────────
const { data: proofsBeforeA } = await supabase.from("payment_proofs").select("*").eq("branch_id", A)
const { data: proofsBeforeB } = await supabase.from("payment_proofs").select("*").eq("branch_id", B)
const { data: closesBefore } = await supabase.from("day_closes").select("id")
const closeIdsBefore = new Set((closesBefore || []).map((row) => row.id))
console.log(
  `fotografía previa · comprobantes A=${proofsBeforeA?.length ?? 0} B=${proofsBeforeB?.length ?? 0} · cierres guardados=${closesBefore?.length ?? 0}\n`,
)

let restored = false
async function restore() {
  if (restored) return
  restored = true
  console.log("\n── restaurando el estado previo")

  // 1) El cierre que creó esta prueba sale del historial.
  const { data: closesNow } = await supabase.from("day_closes").select("id")
  const mine = (closesNow || []).map((row) => row.id).filter((id) => !closeIdsBefore.has(id))
  if (mine.length) {
    const { error } = await supabase.from("day_closes").delete().in("id", mine)
    console.log(`   · cierres de prueba borrados: ${error ? error.message : mine.length}`)
  }

  // 2) Los comprobantes que el cierre borró vuelven tal cual estaban.
  const { data: proofsNow } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const survivingIds = new Set((proofsNow || []).map((row) => row.id))
  const toRestore = (proofsBeforeA || []).filter((row) => !survivingIds.has(row.id))
  if (toRestore.length) {
    const { error } = await supabase.from("payment_proofs").insert(toRestore)
    console.log(`   · comprobantes restaurados: ${error ? error.message : toRestore.length}`)
  } else {
    console.log("   · comprobantes: nada que restaurar")
  }

  // 3) Gastos y pedidos de la prueba.
  const { data: gastos } = await supabase.from("day_expenses").select("id, data")
  const mios = (gastos || []).filter((row) => String(row?.data?.concept || "").startsWith(RUN))
  if (mios.length) await supabase.from("day_expenses").delete().in("id", mios.map((row) => row.id))

  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const ids = (orders || []).map((row) => row.id)
  if (ids.length) await supabase.from("payment_proofs").delete().in("order_id", ids)
  const { deleted, leftovers } = await cleanupRunOrders(RUN)

  const { data: proofsFinalA } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const { data: proofsFinalB } = await supabase.from("payment_proofs").select("id").eq("branch_id", B)
  const { data: closesFinal } = await supabase.from("day_closes").select("id")

  check(
    "restauración · los comprobantes de las dos sedes vuelven a su número original",
    (proofsFinalA?.length ?? 0) === (proofsBeforeA?.length ?? 0) &&
      (proofsFinalB?.length ?? 0) === (proofsBeforeB?.length ?? 0),
    `A ${proofsBeforeA?.length ?? 0}→${proofsFinalA?.length ?? 0} · B ${proofsBeforeB?.length ?? 0}→${proofsFinalB?.length ?? 0}`,
  )
  check(
    "restauración · el historial de cierres queda como estaba",
    (closesFinal?.length ?? 0) === (closesBefore?.length ?? 0),
    `${closesBefore?.length ?? 0}→${closesFinal?.length ?? 0}`,
  )
  check("restauración · 0 pedidos y 0 gastos de prueba", leftovers === 0, `pedidos borrados=${deleted} gastos=${mios.length}`)
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

try {
  // ─────────────────────────────────────────────────────────────────────────
  // D1 · MONTAR EL DÍA: pedidos cobrados, uno pendiente, un gasto
  // ─────────────────────────────────────────────────────────────────────────
  console.log("── D1 · montar el día en San Diego")

  const mkOrder = async (total, tag) => {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-${tag}`,
        customerPhone: "04140000020",
        tableNumber: "Mesa 2",
        orderType: "Para llevar",
        exchangeRate: RATE,
        paymentMethod: "Pago móvil",
        items: [{ id: 999020, name: `${RUN}-ITEM`, price: total, quantity: 1 }],
      },
      { "x-branch-id": A },
    )
    return json?.order
  }

  const cobrado1 = await mkOrder(50, "COBRADO-1")
  const cobrado2 = await mkOrder(30, "COBRADO-2")
  const pendiente = await mkOrder(20, "PENDIENTE")
  check("D1 · 3 pedidos del día creados", Boolean(cobrado1?.id && cobrado2?.id && pendiente?.id))

  // Cobro en caja de los dos primeros: $50 en efectivo, $30 en Bs.
  await patch(
    `/api/orders/${cobrado1.id}/payment`,
    { amountReceivedUSD: 50, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" },
    { "x-branch-id": A },
  )
  await patch(
    `/api/orders/${cobrado2.id}/payment`,
    { amountReceivedVES: 30 * RATE, paymentMethodVES: "Pago móvil", deliveryPaymentIn: "Bolívares" },
    { "x-branch-id": A },
  )

  // Un comprobante nuevo del día, para ver qué le hace el cierre.
  await fetch(`${process.env.BASE || "http://localhost:3177"}/api/payment-proofs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-branch-id": A },
    body: JSON.stringify({
      orderId: pendiente.id,
      reportedMethod: "Pago móvil (Bs 800,00)",
      amountReportedUSD: 0,
      amountReportedVES: 800,
      paymentReference: "556677889",
      dataUrl: PNG_1x1,
      fileName: "cierre.png",
      mimeType: "image/png",
    }),
  })

  const gasto = await post(
    "/api/day-expenses",
    { concept: `${RUN}-GASTO`, amountUSD: 12, category: "Otros", method: "Efectivo" },
    { "x-branch-id": A },
  )
  const gastoId = gasto.json?.dayExpense?.id || gasto.json?.expense?.id
  check("D1 · gasto del día de $12 registrado", gasto.status === 200 && Boolean(gastoId), `status=${gasto.status}`)

  const reportA = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  console.log(
    `   · reporte del día en A: ${reportA.orders} pedidos · vendido $${reportA.totalUSD} · cobrado $${reportA.collectedUSD} · pendiente $${reportA.pendingUSD}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // D2 · CERRAR EL DÍA DE VERDAD
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── D2 · cerrar el día en San Diego")

  const proofsAntesA = (await supabase.from("payment_proofs").select("id").eq("branch_id", A)).data || []
  const proofsAntesB = (await supabase.from("payment_proofs").select("id").eq("branch_id", B)).data || []

  const cierre = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: new Date().toLocaleDateString("es-VE"),
        summaryText: `${RUN} · cierre de prueba de la ronda QA`,
        ordersRegistered: Number(reportA.orders || 0),
        totalSoldUSD: Number(reportA.totalUSD || 0),
        realCollectedUSD: Number(reportA.collectedUSD || 0),
        realCashUSD: 50,
        realVES: 30 * RATE,
        realVESEquivalentUSD: 30,
        realPendingUSD: Number(reportA.pendingUSD || 0),
        totalConfirmedUSD: Number(reportA.collectedUSD || 0),
        expenses: gastoId ? [{ id: gastoId, concept: `${RUN}-GASTO`, amountUSD: 12 }] : [],
      },
    },
    { "x-branch-id": A },
  )

  check("D2 · el cierre responde 200", cierre.status === 200, `status=${cierre.status} ${JSON.stringify(cierre.json).slice(0, 160)}`)
  const closeId = cierre.json?.dayClose?.id
  check("D2 · el cierre queda guardado con id", Boolean(closeId), `id=${closeId}`)

  // ─────────────────────────────────────────────────────────────────────────
  // D3 · QUÉ HIZO EL CIERRE
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── D3 · efectos del cierre")

  const { data: closeRow } = await supabase.from("day_closes").select("id, branch_id, data").eq("id", closeId || "").maybeSingle()
  check("D3 · el cierre lleva la etiqueta de SU sede", closeRow?.branch_id === A, `branch_id=${closeRow?.branch_id}`)

  const histA = (await get("/api/day-closes", { "x-branch-id": A })).json?.dayCloses || []
  const histB = (await get("/api/day-closes", { "x-branch-id": B })).json?.dayCloses || []
  check("D3 · aparece en el historial de A", histA.some((c) => c.id === closeId))
  check("D3 · NO aparece en el historial de B (cerrar A no cierra B)", !histB.some((c) => c.id === closeId), `cierres en B=${histB.length}`)

  const consolidado = (await get("/api/day-closes?scope=all", { "x-branch-id": A })).json?.dayCloses || []
  check("D3 · el consolidado del dueño sí lo trae", consolidado.some((c) => c.id === closeId), `consolidado=${consolidado.length}`)

  // Fotografía dentro del cierre.
  const snapshot = closeRow?.data || {}
  check(
    "D3 · el cierre archiva la fotografía de pedidos y comprobantes del día",
    Array.isArray(snapshot.orders) && Array.isArray(snapshot.paymentProofs),
    `pedidos archivados=${snapshot.orders?.length ?? "—"} comprobantes archivados=${snapshot.paymentProofs?.length ?? "—"}`,
  )

  // Comprobantes: los de A se limpian, los de B NO se tocan.
  const proofsDespuesA = (await supabase.from("payment_proofs").select("id").eq("branch_id", A)).data || []
  const proofsDespuesB = (await supabase.from("payment_proofs").select("id").eq("branch_id", B)).data || []
  check(
    "D3 · el cierre limpia los comprobantes de SU sede",
    proofsDespuesA.length === 0 && proofsAntesA.length > 0,
    `A ${proofsAntesA.length} → ${proofsDespuesA.length}`,
  )
  check(
    "D3 · [AISLAMIENTO] cerrar A NO borra los comprobantes de B",
    proofsDespuesB.length === proofsAntesB.length,
    `B ${proofsAntesB.length} → ${proofsDespuesB.length}`,
  )

  // Gasto marcado como Cerrado (para que un segundo cierre no lo reste otra vez).
  const { data: gastoRow } = await supabase.from("day_expenses").select("id, close_status, data").eq("id", gastoId || "").maybeSingle()
  check(
    "D3 · el gasto incluido queda marcado Cerrado (no se resta dos veces)",
    gastoRow?.close_status === "Cerrado",
    `close_status="${gastoRow?.close_status}" closeId=${gastoRow?.data?.closeId}`,
  )

  const { data: auditoria } = await supabase
    .from("audit_logs")
    .select("id, action, branch_id")
    .eq("action", "day_close.saved")
    .eq("entity_id", closeId || "")
  check("D3 · el cierre queda en auditoría con su sede", (auditoria?.length ?? 0) > 0 && auditoria[0].branch_id === A, `filas=${auditoria?.length ?? 0}`)

  // ─────────────────────────────────────────────────────────────────────────
  // D4 · EL DINERO CUADRA CON LO QUE VE EL DUEÑO
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── D4 · el dinero del cierre vs el reporte")

  const guardado = closeRow?.data || {}
  check(
    "D4 · lo cobrado en el cierre coincide con el reporte del día",
    Math.abs(Number(guardado.realCollectedUSD || 0) - Number(reportA.collectedUSD || 0)) < 0.02,
    `cierre=$${guardado.realCollectedUSD} reporte=$${reportA.collectedUSD}`,
  )
  check(
    "D4 · efectivo + equivalente en Bs == lo cobrado ($50 + $30 = $80)",
    Math.abs(Number(guardado.realCashUSD || 0) + Number(guardado.realVESEquivalentUSD || 0) - Number(guardado.realCollectedUSD || 0)) < 0.02,
    `efectivo=$${guardado.realCashUSD} + Bs=$${guardado.realVESEquivalentUSD} vs cobrado=$${guardado.realCollectedUSD}`,
  )
  check(
    "D4 · el pendiente del cierre es el pedido sin cobrar ($20)",
    Math.abs(Number(guardado.realPendingUSD || 0) - 20) < 0.02,
    `pendiente=$${guardado.realPendingUSD}`,
  )

  // El reporte NO se toca al cerrar: el cierre es una fotografía, no un borrado.
  const reportDespues = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  check(
    "D4 · cerrar el día no borra ni altera el reporte",
    Math.abs(Number(reportDespues.totalUSD || 0) - Number(reportA.totalUSD || 0)) < 0.02,
    `antes=$${reportA.totalUSD} después=$${reportDespues.totalUSD}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // D5 · SEGUNDO CIERRE: el gasto ya cerrado no se vuelve a restar
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── D5 · cerrar dos veces el mismo día")
  const segundo = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: new Date().toLocaleDateString("es-VE"),
        summaryText: `${RUN} · segundo cierre`,
        expenses: gastoId ? [{ id: gastoId, concept: `${RUN}-GASTO`, amountUSD: 12 }] : [],
      },
    },
    { "x-branch-id": A },
  )
  const { data: gastoTrasSegundo } = await supabase.from("day_expenses").select("close_status, data").eq("id", gastoId || "").maybeSingle()
  check(
    "D5 · un segundo cierre no re-abre ni duplica el gasto ya cerrado",
    gastoTrasSegundo?.close_status === "Cerrado",
    `status=${segundo.status} · gasto sigue "${gastoTrasSegundo?.close_status}" del cierre ${gastoTrasSegundo?.data?.closeId}`,
  )
} finally {
  await restore()
}

process.exit(summary("F8 cierre del día") > 0 ? 1 : 0)
