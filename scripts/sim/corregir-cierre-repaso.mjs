// CORRECCIÓN DEL CIERRE DE REPASO (defecto de MI script, no del sistema).
//
// `cuotas-pendientes.mjs` asentó su dinero bajo la clave "dia-7" del libro.
// Como el Día 7 ya estaba cerrado, el cierre de repaso volvió a declarar el
// dinero del domingo: los 16 cierres sumaban $757 de más. El sistema guardó
// exactamente lo que se le mandó — el error es del guion.
//
// Esto: (1) separa el día de repaso en su propia clave del libro, con el
// delta real; (2) rehace los 2 cierres de repaso con las cifras correctas.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders } from "./lib/auth.mjs"
import { post } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"
import { loadLedger, saveLedger, expectedCloseFor, round } from "./lib/expected-ledger.mjs"

await guardLive({ requireMarker: true })
openDayLog("repaso-cuotas", "Corrección del cierre de repaso")

const st = loadState()
const ledger = loadLedger()
const P = st.ids.principal
const SD = st.ids.sanDiego

// 1 · Cifras del Día 7 tal como quedaron en SUS cierres (la verdad del domingo).
const { data: closes } = await supabase.from("day_closes").select("id, branch_id, data")
const cierreD7 = (b) => (closes || []).find((c) => c.branch_id === b && String(c.data?.dateLabel || "").includes("dia-7"))
const cierreRepaso = (b) => (closes || []).find((c) => c.branch_id === b && String(c.data?.dateLabel || "").includes("REPASO DE CUOTAS"))

for (const [branchId, label] of [[P, "Principal"], [SD, "San Diego"]]) {
  const d7 = cierreD7(branchId)?.data
  if (!d7) { check(`FIX-${label}`, `existe el cierre del Día 7 de ${label}`, false, "no encontrado"); continue }

  const bookDia7 = ledger.days["dia-7"][branchId]
  const cobradoD7 = round(Number(d7.realCollectedUSD || 0))
  const cobradoTotal = bookDia7.collectedUSD
  const deltaRepaso = round(cobradoTotal - cobradoD7)

  // 2 · El libro se separa en dos días distintos.
  ledger.days["repaso-cuotas"] ||= {}
  const efectivoD7 = round(Number(d7.realCashUSD || 0))
  const vesD7 = round(Number(d7.realVES || 0))

  const restarMetodos = (actual, cerrado, campo) => {
    const out = {}
    for (const [metodo, v] of Object.entries(actual)) {
      const enCierre = (cerrado || []).find((m) => m.label === metodo)
      const restado = {
        count: Math.max(0, v.count - Number(enCierre?.count || 0)),
        totalUSD: round(v.totalUSD - Number(enCierre?.totalUSD || 0)),
      }
      if (campo === "ves") restado.totalVES = round((v.totalVES || 0) - Number(enCierre?.totalVES || 0))
      if (restado.totalUSD > 0.001 || (restado.totalVES || 0) > 0.001) out[metodo] = restado
    }
    return out
  }

  ledger.days["repaso-cuotas"][branchId] = {
    ordersCreated: Math.max(0, bookDia7.ordersCreated - Number(d7.ordersRegistered || 0)),
    equivalentCustomers: 0,
    grossSalesUSD: round(bookDia7.grossSalesUSD - Number(d7.totalSoldUSD || 0)),
    collectedUSD: deltaRepaso,
    collectedByMethodUSD: restarMetodos(bookDia7.collectedByMethodUSD, d7.paymentByUSDMethod, "usd"),
    collectedByMethodVES: restarMetodos(bookDia7.collectedByMethodVES, d7.paymentByVESMethod, "ves"),
    cashUSD: round(bookDia7.cashUSD - efectivoD7),
    changeGivenUSD: 0,
    pendingUSD: round(bookDia7.pendingUSD),
    cancellations: 0,
    cancelledUSD: 0,
    expensesUSD: 0,
    purchasesPaidUSD: 0,
    bySeller: {},
    byChannel: {},
  }

  // El Día 7 vuelve a ser SOLO lo que declaró su cierre.
  ledger.days["dia-7"][branchId] = {
    ...bookDia7,
    ordersCreated: Number(d7.ordersRegistered || 0),
    grossSalesUSD: round(Number(d7.totalSoldUSD || 0)),
    collectedUSD: cobradoD7,
    cashUSD: efectivoD7,
    pendingUSD: 0,
    collectedByMethodUSD: Object.fromEntries((d7.paymentByUSDMethod || []).map((m) => [m.label, { count: m.count, totalUSD: m.totalUSD }])),
    collectedByMethodVES: Object.fromEntries((d7.paymentByVESMethod || []).map((m) => [m.label, { count: m.count, totalUSD: m.totalUSD, totalVES: m.totalVES }])),
  }

  logLine(`${label}: día 7 = $${cobradoD7} · repaso = $${deltaRepaso} (antes el repaso declaraba $${cobradoTotal})`)
}
saveLedger(ledger)

// 3 · Se rehacen los cierres de repaso con las cifras correctas.
await loginStaff("genesis", "Sim-genesis-2026!")
await loginStaff("luis", "Sim-luis-2026!")

for (const [branchId, label, closer] of [[P, "Principal", "genesis"], [SD, "San Diego", "luis"]]) {
  const viejo = cierreRepaso(branchId)
  const esperado = expectedCloseFor(ledger, "repaso-cuotas", branchId)
  const book = ledger.days["repaso-cuotas"][branchId]

  const res = await post("/api/day-close", {
    dayClose: {
      dateLabel: `REPASO DE CUOTAS — ${label}`,
      summaryText: `sim:${st.seed} · cierre del día de repaso (rehecho: el anterior repetía el dinero del domingo por un defecto del guion, no del sistema)`,
      ordersRegistered: esperado.orders,
      totalSoldUSD: book.grossSalesUSD,
      realCollectedUSD: esperado.collectedUSD,
      realCashUSD: esperado.cashUSD,
      realVES: esperado.vesTotal,
      realVESEquivalentUSD: esperado.vesEquivalentUSD,
      realPendingUSD: 0,
      totalConfirmedUSD: esperado.collectedUSD,
      paymentByUSDMethod: Object.entries(esperado.byMethodUSD).map(([l, v]) => ({ label: l, count: v.count, totalUSD: v.totalUSD, totalVES: 0 })),
      paymentByVESMethod: Object.entries(esperado.byMethodVES).map(([l, v]) => ({ label: l, count: v.count, totalUSD: v.totalUSD, totalVES: v.totalVES })),
      expenses: [],
    },
  }, actorHeaders({ username: closer, ip: "10.95.1.1", branchId }))

  const nuevoId = res.json?.dayClose?.id
  const { data: row } = await supabase.from("day_closes").select("data").eq("id", nuevoId || "").maybeSingle()
  check(
    `FIX-CIERRE-${label}`,
    `el cierre de repaso de ${label} se rehace con el dinero NUEVO solamente`,
    res.status === 200 && Math.abs(Number(row?.data?.realCollectedUSD || 0) - esperado.collectedUSD) < 0.01,
    `nuevo=$${row?.data?.realCollectedUSD} (el anterior declaraba $${viejo?.data?.realCollectedUSD})`,
  )

  // El cierre viejo sale del historial: declaraba dinero que ya estaba en el
  // cierre del domingo y dejarlo falsearía el arqueo semanal.
  if (nuevoId && viejo?.id) {
    await supabase.from("day_closes").delete().eq("id", viejo.id)
    logLine(`cierre de repaso anterior de ${label} eliminado del historial (declaraba $${viejo.data?.realCollectedUSD}, duplicando el domingo)`)
  }
}

const result = summary("Corrección del cierre de repaso")
process.exit(result.fail > 0 ? 1 : 0)
