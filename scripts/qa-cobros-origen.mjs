// QA 2026-07-28 · COBROS POR ORIGEN: cuenta de mesa (cobro de cuenta completa)
// vs cobro directo, diferenciados en el cierre, el historial y los reportes.
//
// Verifica el lote del 2026-07-28:
//  O1 · /api/reports trae el bloque collectionByOrigin y separa los dos mundos.
//  O2 · el cierre guarda collectionByOrigin (lo calcula el SERVIDOR) y la
//       fotografía pedido-por-pedido marca openAccountId en los de cuenta.
//  O3 · GET /api/day-closes (el historial) devuelve el desglose intacto.
//
// Fotografía y restauración calcadas de qa-day-close.mjs (el cierre borra los
// comprobantes de la sede). 0 filas ZZTEST al salir.
//
// Uso:  npm run qa:cobros-origen      (dev server en :3177)
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

await assertBrotherhood()
console.log(`Cobros por origen · run=${RUN}\n`)

const { data: proofsBefore } = await supabase.from("payment_proofs").select("*").eq("branch_id", A)
const { data: closesBefore } = await supabase.from("day_closes").select("id")
const closeIdsBefore = new Set((closesBefore || []).map((row) => row.id))

let restored = false
async function restore() {
  if (restored) return
  restored = true
  console.log("\n── restauración")

  const { data: closesNow } = await supabase.from("day_closes").select("id")
  const mine = (closesNow || []).map((row) => row.id).filter((id) => !closeIdsBefore.has(id))
  if (mine.length) await supabase.from("day_closes").delete().in("id", mine)

  const { data: proofsNow } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const surviving = new Set((proofsNow || []).map((row) => row.id))
  const toRestore = (proofsBefore || []).filter((row) => !surviving.has(row.id))
  if (toRestore.length) await supabase.from("payment_proofs").insert(toRestore)

  await supabase.from("open_accounts").delete().ilike("customer_name", "ZZTEST%")
  const { deleted, leftovers } = await cleanupRunOrders("ZZTEST")

  const { data: proofsFinal } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const { data: closesFinal } = await supabase.from("day_closes").select("id")
  check(
    "restauración · comprobantes y cierres como estaban, 0 ZZTEST",
    (proofsFinal?.length ?? 0) === (proofsBefore?.length ?? 0) &&
      (closesFinal?.length ?? 0) === (closesBefore?.length ?? 0) &&
      leftovers === 0,
    `proofs ${proofsBefore?.length ?? 0}→${proofsFinal?.length ?? 0} · cierres ${closesBefore?.length ?? 0}→${closesFinal?.length ?? 0} · pedidos borrados=${deleted}`,
  )
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

try {
  // ── Montaje: una cuenta con un pedido de $20 y un pedido directo de $10.
  const reportBefore = (await get("/api/reports?period=today", { "x-branch-id": A })).json || {}
  const originBefore = reportBefore.collectionByOrigin || {
    openAccounts: { collectedUSD: 0, orders: 0 },
    direct: { collectedUSD: 0, orders: 0 },
  }

  const cuenta = (
    await post(
      "/api/open-accounts",
      // Mesa de texto libre (staff la acepta): las mesas reales pueden tener
      // una cuenta abierta de verdad y el índice único rechazaría la nuestra.
      { tableNumber: `${RUN}-MESA`, customerName: `${RUN}-CUENTA` },
      { "x-branch-id": A },
    )
  ).json?.openAccount
  check("setup · cuenta abierta", Boolean(cuenta?.id), `id=${cuenta?.id}`)

  const { json: pedidoCuentaJson } = await postOrderThrottled(
    {
      customerName: `${RUN}-EN-CUENTA`,
      customerPhone: "04140000050",
      tableNumber: `${RUN}-MESA`,
      orderType: "Comer aquí",
      exchangeRate: RATE,
      openAccountId: cuenta.id,
      items: [{ id: 999050, name: `${RUN}-ITEM`, price: 20, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  const pedidoCuenta = pedidoCuentaJson?.order
  check("setup · pedido de $20 atado a la cuenta", Boolean(pedidoCuenta?.id))

  const { json: pedidoDirectoJson } = await postOrderThrottled(
    {
      customerName: `${RUN}-DIRECTO`,
      customerPhone: "04140000051",
      tableNumber: "Mesa 2",
      orderType: "Para llevar",
      exchangeRate: RATE,
      items: [{ id: 999051, name: `${RUN}-ITEM`, price: 10, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  const pedidoDirecto = pedidoDirectoJson?.order
  check("setup · pedido directo de $10", Boolean(pedidoDirecto?.id))

  // Cobro de la CUENTA COMPLETA ($20, se reparte FIFO) y cobro directo ($10).
  const cobroCuenta = await patch(
    `/api/open-accounts/${cuenta.id}`,
    {
      action: "payAccount",
      amountReceivedUSD: 20,
      paymentMethodUSD: "Efectivo divisas",
      deliveryPaymentIn: "Divisas",
      closeIfPaid: true,
      closedBy: "QA origen",
    },
    { "x-branch-id": A },
  )
  check("setup · la cuenta completa se cobra ($20)", cobroCuenta.status === 200, `status=${cobroCuenta.status}`)

  const cobroDirecto = await patch(
    `/api/orders/${pedidoDirecto.id}/payment`,
    { amountReceivedUSD: 10, paymentMethodUSD: "Zelle", deliveryPaymentIn: "Divisas" },
    { "x-branch-id": A },
  )
  check("setup · el pedido directo se cobra ($10)", cobroDirecto.status === 200, `status=${cobroDirecto.status}`)

  // ── O1 · /api/reports separa los dos orígenes
  console.log("\n── O1 · el reporte del dueño")
  const reportAfter = (await get("/api/reports?period=today", { "x-branch-id": A })).json || {}
  const origin = reportAfter.collectionByOrigin
  check("O1 · el reporte trae el bloque collectionByOrigin", Boolean(origin?.openAccounts && origin?.direct))
  check(
    "O1 · lo cobrado por CUENTAS sube exactamente $20",
    Math.abs((origin?.openAccounts?.collectedUSD || 0) - (originBefore.openAccounts?.collectedUSD || 0) - 20) < 0.02,
    `cuentas ${originBefore.openAccounts?.collectedUSD || 0}→${origin?.openAccounts?.collectedUSD}`,
  )
  check(
    "O1 · lo cobrado DIRECTO sube exactamente $10",
    Math.abs((origin?.direct?.collectedUSD || 0) - (originBefore.direct?.collectedUSD || 0) - 10) < 0.02,
    `directo ${originBefore.direct?.collectedUSD || 0}→${origin?.direct?.collectedUSD}`,
  )

  // ── O2 · el cierre guarda el desglose y marca los pedidos de cuenta
  console.log("\n── O2 · el cierre del día")
  const cierre = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: new Date().toLocaleDateString("es-VE"),
        summaryText: `${RUN} · cierre de la prueba de origen`,
      },
    },
    { "x-branch-id": A },
  )
  const closeId = cierre.json?.dayClose?.id
  check("O2 · el cierre responde 200 con id", cierre.status === 200 && Boolean(closeId), `status=${cierre.status}`)

  const { data: closeRow } = await supabase.from("day_closes").select("data").eq("id", closeId || "").maybeSingle()
  const savedOrigin = closeRow?.data?.collectionByOrigin || []
  const cuentaItem = savedOrigin.find((item) => /cuentas/i.test(item.label))
  const directoItem = savedOrigin.find((item) => /directos/i.test(item.label))
  check(
    "O2 · el SERVIDOR guardó collectionByOrigin con los dos renglones",
    savedOrigin.length === 2 && Boolean(cuentaItem) && Boolean(directoItem),
    JSON.stringify(savedOrigin),
  )
  check(
    "O2 · cuentas de mesa registra el pedido de la cuenta ($20)",
    (cuentaItem?.totalUSD || 0) >= 20 && (cuentaItem?.count || 0) >= 1,
    `cuenta=${JSON.stringify(cuentaItem)}`,
  )
  check(
    "O2 · directos registra el cobro suelto ($10)",
    (directoItem?.totalUSD || 0) >= 10 && (directoItem?.count || 0) >= 1,
    `directo=${JSON.stringify(directoItem)}`,
  )

  const snapshotOrders = closeRow?.data?.orders || []
  const snapCuenta = snapshotOrders.find((order) => order.id === pedidoCuenta.id)
  const snapDirecto = snapshotOrders.find((order) => order.id === pedidoDirecto.id)
  check(
    "O2 · la fotografía marca el pedido de cuenta con su openAccountId",
    snapCuenta?.openAccountId === cuenta.id,
    `openAccountId=${snapCuenta?.openAccountId}`,
  )
  check(
    "O2 · y el pedido directo queda SIN marca de cuenta",
    Boolean(snapDirecto) && !snapDirecto.openAccountId,
    `openAccountId=${snapDirecto?.openAccountId}`,
  )

  // ── O3 · el historial devuelve el desglose intacto
  console.log("\n── O3 · el historial de cierres")
  const hist = (await get("/api/day-closes", { "x-branch-id": A })).json?.dayCloses || []
  const enHistorial = hist.find((c) => c.id === closeId)
  const histOrigin = enHistorial?.collectionByOrigin || []
  check(
    "O3 · el historial trae collectionByOrigin intacto",
    histOrigin.length === 2 &&
      Math.abs((histOrigin.find((i) => /cuentas/i.test(i.label))?.totalUSD || 0) - (cuentaItem?.totalUSD || 0)) < 0.01,
    JSON.stringify(histOrigin),
  )
} finally {
  await restore()
}

process.exit(summary("Cobros por origen") > 0 ? 1 : 0)
