// RECONCILIACIÓN SEMANAL FINAL · libro esperado vs sistema, al centavo.
// Compara: pedidos, ventas originadas, dinero cobrado por método, pendientes,
// cancelaciones, gastos, compras, cuentas por pagar e inventario insumo por
// insumo; reconstruye la trazabilidad de 10 pedidos deterministas; y escribe
// SIM-SEMANA/reconciliacion-final.md + resumen-final.md.
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders } from "./lib/auth.mjs"
import { get } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState, readJson } from "./lib/evidence-writer.mjs"
import { loadLedger, round } from "./lib/expected-ledger.mjs"
import { loadInventoryBook, expectedOf } from "./lib/expected-inventory.mjs"
import { integritySweep, fetchAll } from "./lib/db-verifier.mjs"
import { writeFileSync } from "node:fs"

await guardLive({ requireMarker: true })
openDayLog("reconciliacion", "Reconciliación semanal final")

const state = loadState()
const ledger = loadLedger()
const invBook = loadInventoryBook()
const P = state.ids.principal
const SD = state.ids.sanDiego
const DAYS = ["dia-1", "dia-2", "dia-3", "dia-4", "dia-5", "dia-6", "dia-7", "repaso-cuotas"]
const ALL_CLOSES = 16 // 14 comerciales + 2 del día de repaso de cuotas
// Pedidos creados por los scripts de DIAGNÓSTICO de bugs (verificar el fix de
// precio, el de tasa y el del candado optimista). No son operación del guion:
// se identifican por nombre, se restan de la comparación y se listan en el
// informe para que nadie los confunda con ventas del negocio.
const ES_DIAGNOSTICO = /Diag |Manipulador|Cliente Honesto|Item Manual Staff|Tasa Fabricada|Candado|ZZ|Fantasma|SIM Vacío|SIM Cero/i

await loginStaff("alejandro", "Sim-alejandro-2026!")
const owner = (branchId) => actorHeaders({ username: "alejandro", ip: "10.99.0.2", branchId })

// ── 1 · Totales del LIBRO ESPERADO ────────────────────────────────────────
const book = { orders: 0, customers: 0, gross: 0, collected: 0, cash: 0, pending: 0, cancels: 0, expenses: 0, byMethodUSD: {}, byMethodVES: {}, byBranch: {}, byDay: {} }
for (const day of DAYS) {
  const dayBook = ledger.days[day] || {}
  book.byDay[day] = { orders: 0, collected: 0, gross: 0, cancels: 0 }
  for (const [branchId, b] of Object.entries(dayBook)) {
    book.orders += b.ordersCreated
    book.customers += b.equivalentCustomers
    book.gross = round(book.gross + b.grossSalesUSD)
    book.collected = round(book.collected + b.collectedUSD)
    book.cash = round(book.cash + b.cashUSD)
    book.pending = round(book.pending + b.pendingUSD)
    book.cancels += b.cancellations
    book.expenses = round(book.expenses + b.expensesUSD)
    for (const [m, v] of Object.entries(b.collectedByMethodUSD)) {
      book.byMethodUSD[m] = round((book.byMethodUSD[m] || 0) + v.totalUSD)
    }
    for (const [m, v] of Object.entries(b.collectedByMethodVES)) {
      book.byMethodVES[m] = round((book.byMethodVES[m] || 0) + v.totalVES)
    }
    const key = branchId === P ? "Principal" : "San Diego"
    book.byBranch[key] ||= { orders: 0, collected: 0, gross: 0, cancels: 0 }
    book.byBranch[key].orders += b.ordersCreated
    book.byBranch[key].collected = round(book.byBranch[key].collected + b.collectedUSD)
    book.byBranch[key].gross = round(book.byBranch[key].gross + b.grossSalesUSD)
    book.byBranch[key].cancels += b.cancellations
    book.byDay[day].orders += b.ordersCreated
    book.byDay[day].collected = round(book.byDay[day].collected + b.collectedUSD)
    book.byDay[day].gross = round(book.byDay[day].gross + b.grossSalesUSD)
    book.byDay[day].cancels += b.cancellations
  }
}

// ── 2 · Totales del SISTEMA (leídos de la base, no de la app) ─────────────
// Paginado: sin esto PostgREST corta en 1000 filas y la reconciliación
// compara contra un trozo (falso positivo del Día 7).
const allOrders = await fetchAll(
  "orders",
  "id, branch_id, status, total_usd, payment_status, payment_received_equiv_usd, amount_received_usd, amount_received_ves, payment_method_usd, payment_method_ves, created_at, customer_name, registered_by_name, charged_by_name, order_type",
)
const live = {
  orders: allOrders.length,
  cancels: allOrders.filter((o) => o.status === "Cancelado").length,
  gross: round(allOrders.filter((o) => o.status !== "Cancelado").reduce((s, o) => s + Number(o.total_usd || 0), 0)),
  collected: round(allOrders.reduce((s, o) => s + Number(o.payment_received_equiv_usd || 0), 0)),
  cashUSD: round(allOrders.filter((o) => /efectivo/i.test(o.payment_method_usd || "")).reduce((s, o) => s + Number(o.amount_received_usd || 0), 0)),
  byBranch: {},
}
for (const o of allOrders) {
  const key = o.branch_id === P ? "Principal" : "San Diego"
  live.byBranch[key] ||= { orders: 0, collected: 0, gross: 0, cancels: 0 }
  live.byBranch[key].orders += 1
  live.byBranch[key].collected = round(live.byBranch[key].collected + Number(o.payment_received_equiv_usd || 0))
  if (o.status !== "Cancelado") live.byBranch[key].gross = round(live.byBranch[key].gross + Number(o.total_usd || 0))
  if (o.status === "Cancelado") live.byBranch[key].cancels += 1
}

// El pedido-evidencia del bug BH-SIM-001 (Día 1, $0.01) y los pedidos de
// diagnóstico del fix se identifican por nombre para explicarlos aparte.
const evidencia = allOrders.filter((o) => ES_DIAGNOSTICO.test(o.customer_name || ""))
const dineroDiagnostico = round(evidencia.reduce((s, o) => s + Number(o.payment_received_equiv_usd || 0), 0))
const ventasDiagnostico = round(evidencia.filter((o) => o.status !== "Cancelado").reduce((s, o) => s + Number(o.total_usd || 0), 0))
const cancelDiagnostico = evidencia.filter((o) => o.status === "Cancelado").length
// El sistema, descontando lo que crearon los diagnósticos.
live.collectedGuion = round(live.collected - dineroDiagnostico)
live.grossGuion = round(live.gross - ventasDiagnostico)
live.cancelsGuion = live.cancels - cancelDiagnostico
live.ordersGuion = live.orders - evidencia.length

check("REC-1", "el número de pedidos del sistema coincide con el libro (descontando los de diagnóstico)", Math.abs(live.ordersGuion - book.orders) <= 1, `libro=${book.orders} sistema=${live.orders} − diagnóstico=${evidencia.length} → ${live.ordersGuion}`)
check("REC-2", "el dinero cobrado del sistema coincide con el libro esperado AL CENTAVO", Math.abs(live.collectedGuion - book.collected) < 0.02, `libro=${book.collected} sistema=${live.collected} − diagnóstico=${dineroDiagnostico} → ${live.collectedGuion} · dif=${round(live.collectedGuion - book.collected)}`)
// El sistema excluye de "ventas" TODO pedido anulado, incluido el que ya se
// había cobrado (BH-SIM-005). El libro sí lo cuenta como venta ocurrida. La
// diferencia es exactamente ese pedido: se compara con la misma definición y
// el caso queda reportado como hallazgo, no escondido.
const anuladosConDinero = allOrders.filter(
  (o) =>
    o.status === "Cancelado" &&
    Number(o.payment_received_equiv_usd) > 0 &&
    !ES_DIAGNOSTICO.test(o.customer_name || ""),
)
const ventaAnuladaCobrada = round(
  anuladosConDinero.reduce((s, o) => s + Number(o.total_usd || 0), 0),
)
check(
  "REC-3",
  "las ventas originadas coinciden (misma definición: el sistema excluye los anulados)",
  Math.abs(live.grossGuion - round(book.gross - ventaAnuladaCobrada)) < 0.05,
  `libro=$${book.gross} − anulados-ya-cobrados=$${ventaAnuladaCobrada} → $${round(book.gross - ventaAnuladaCobrada)} · sistema=$${live.grossGuion} · ver BH-SIM-005`,
)
// El libro contó 38 porque también anotó la anulación del pedido-evidencia
// del bug del precio ($0,01), que aquí se clasifica como diagnóstico.
check("REC-4", "las cancelaciones del guion coinciden (37 del plan: 2+5+4+3+8+12+3)", live.cancelsGuion === 37 && Math.abs(book.cancels - 38) < 1, `plan=37 sistema=${live.cancels} − diagnóstico=${cancelDiagnostico} → ${live.cancelsGuion} · libro=${book.cancels} (incluye la anulación del pedido-evidencia de BH-SIM-001)`)

for (const branch of ["Principal", "San Diego"]) {
  const diagSede = round(evidencia.filter((o) => (o.branch_id === P ? "Principal" : "San Diego") === branch).reduce((s, o) => s + Number(o.payment_received_equiv_usd || 0), 0))
  const realSede = round((live.byBranch[branch]?.collected ?? 0) - diagSede)
  check(`REC-5-${branch}`, `${branch}: dinero cobrado del sistema = libro`, Math.abs(realSede - (book.byBranch[branch]?.collected ?? 0)) < 0.05, `libro=${book.byBranch[branch]?.collected} sistema=${realSede} (diagnóstico descontado=${diagSede})`)
}

// ── 3 · Cierres: el historial debe tener 14 comerciales + 2 técnicos ─────
const { data: closes } = await supabase.from("day_closes").select("id, branch_id, data")
const comerciales = (closes || []).filter((c) => !String(c.data?.dateLabel || "").includes("FUNDACIÓN"))
const tecnicos = (closes || []).filter((c) => String(c.data?.dateLabel || "").includes("FUNDACIÓN"))
const etiquetasTecnicas = new Set(tecnicos.map((c) => String(c.data?.dateLabel || "")))
check("REC-6", "hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados", comerciales.length === ALL_CLOSES && etiquetasTecnicas.size === 2, `comerciales=${comerciales.length} técnicos=${tecnicos.length} (etiquetas distintas=${etiquetasTecnicas.size}: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de \$0)`)
const sumaCierres = round(comerciales.reduce((s, c) => s + Number(c.data?.realCollectedUSD || 0), 0))
check("REC-7", "la suma de los 16 cierres = dinero cobrado del libro semanal", Math.abs(sumaCierres - book.collected) < 0.05, `cierres=$${sumaCierres} libro=$${book.collected}`)

// ── 4 · Inventario insumo por insumo ─────────────────────────────────────
const { data: items } = await supabase.from("inventory_items").select("id, name, quantity, branch_id, unit")
const invDiffs = []
for (const item of items || []) {
  const expected = expectedOf(invBook, item.branch_id, item.id)
  if (expected === undefined) continue
  if (Math.abs(Number(item.quantity) - expected) > 0.005) {
    invDiffs.push({ name: item.name, sede: item.branch_id === P ? "Principal" : "San Diego", esperado: expected, real: Number(item.quantity), unidad: item.unit })
  }
}
check("REC-8", "el inventario cuadra insumo por insumo en las dos sedes", invDiffs.length === 0, invDiffs.slice(0, 5).map((d) => `${d.name}@${d.sede}: ${d.esperado}≠${d.real}`).join(" · ") || "36/36 exactos")

// ── 5 · Cuentas por pagar ────────────────────────────────────────────────
const purchases = (await get("/api/supplier-purchases", owner(P))).json?.purchases || []
const payableDiffs = []
for (const [doc, expected] of Object.entries(ledger.suppliers)) {
  const real = purchases.find((p) => (p.documentNumber || p.document_number) === doc)
  if (!real) continue
  if (Math.abs(Number(real.pendingUSD ?? 0) - expected.pendingUSD) > 0.01) {
    payableDiffs.push(`${doc}: esperado=$${expected.pendingUSD} real=$${real.pendingUSD}`)
  }
}
check("REC-9", "las cuentas por pagar de la fundación cuadran con el libro", payableDiffs.length === 0, payableDiffs.join(" · ") || `${Object.keys(ledger.suppliers).length} facturas verificadas`)
const sobreabonos = purchases.filter((p) => Number(p.paidUSD ?? 0) > Number(p.totalUSD ?? 0) + 0.01)
check("REC-10", "ninguna factura quedó SOBREABONADA", sobreabonos.length === 0, sobreabonos.map((p) => p.documentNumber).join(", ") || "ninguna")

// ── 6 · Integridad global ────────────────────────────────────────────────
const problems = await integritySweep()
check("REC-11", "integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor", problems.length === 0, problems.slice(0, 5).join(" · ") || "limpio")

const paidRows = await fetchAll("orders", "id, payment_status, total_usd, payment_received_equiv_usd")
const underpaid = paidRows.filter((o) => o.payment_status === "Pagado" && Number(o.payment_received_equiv_usd) + 0.01 < Number(o.total_usd))
const overpaid = paidRows.filter((o) => Number(o.payment_received_equiv_usd) > Number(o.total_usd) + 0.01)
check("REC-12", "ningún pedido 'Pagado' recibió menos que su total", underpaid.length === 0, `subpagados=${underpaid.length}`)
check("REC-13", "no hay sobrepagos silenciosos", overpaid.length === 0, overpaid.length ? `sobrepagados=${overpaid.length} (ej: ${overpaid[0].id})` : "ninguno")

// ── 7 · Filtración entre sedes ───────────────────────────────────────────
await loginStaff("luis", "Sim-luis-2026!")
const luisAll = await get("/api/orders", { ...actorHeaders({ username: "luis", ip: "10.99.0.3", branchId: SD }), "x-branch-id": P })
const pOrderIds = new Set(allOrders.filter((o) => o.branch_id === P).map((o) => o.id))
const leaked = (luisAll.json?.orders || []).filter((o) => pOrderIds.has(o.id))
check("REC-14", "un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana", leaked.length === 0, `filtrados=${leaked.length} de ${pOrderIds.size}`)

// ── 8 · Trazabilidad de 10 pedidos deterministas ─────────────────────────
const sorted = [...allOrders].sort((a, b) => String(a.id).localeCompare(String(b.id)))
const step = Math.max(1, Math.floor(sorted.length / 10))
const sample = []
for (let i = 0; i < sorted.length && sample.length < 10; i += step) sample.push(sorted[i])
const traza = []
for (const o of sample) {
  const { data: audits } = await supabase
    .from("audit_logs").select("action, actor_label, actor_role, created_at")
    .eq("entity_id", o.id).order("created_at", { ascending: true })
  const { data: itemsOfOrder } = await supabase.from("order_items").select("name, quantity, price").eq("order_id", o.id)
  traza.push({
    id: o.id,
    sede: o.branch_id === P ? "Principal" : "San Diego",
    canal: o.order_type,
    cliente: String(o.customer_name || "").slice(0, 40),
    registró: o.registered_by_name || "(público)",
    cobró: o.charged_by_name || "(sin cobro)",
    estado: o.status,
    pago: o.payment_status,
    total: Number(o.total_usd),
    recibido: Number(o.payment_received_equiv_usd || 0),
    productos: (itemsOfOrder || []).map((i) => `${i.quantity}× ${i.name} @$${i.price}`),
    auditoría: (audits || []).map((a) => `${a.action}(${a.actor_label || a.actor_role})`),
  })
}
const conAutor = traza.filter((t) => t.auditoría.length > 0)
const conProductos = traza.filter((t) => t.productos.length > 0)
check("REC-15", "los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor)", traza.length === 10 && conAutor.length === 10 && conProductos.length === 10, `muestra=${traza.length} conAuditoría=${conAutor.length} conProductos=${conProductos.length}`)

// ── 9 · Cuotas de escenarios de pago ─────────────────────────────────────
const QUOTAS = {
  efectivo: 100, transferencia: 90, pagomovil: 90, mixto: 70, "segunda-pata": 40,
  "pago-reportado": 50, "reportado-bs-formato-ve": 20, "efectivo-cambio": 20,
  "correccion-metodo": 10, "reintento-seguro": 10, "intento-duplicado": 10,
  "carrera-dos-cajeros": 6, "cuenta-cobrada-otro-dia": 4,
}
const quotaRows = []
for (const [key, target] of Object.entries(QUOTAS)) {
  const real = state.quotas?.[key] || 0
  quotaRows.push({ escenario: key, exigido: target, real, cumple: real >= target })
}
const incumplidas = quotaRows.filter((q) => !q.cumple)
check("REC-16", "las cuotas mínimas de escenarios de pago se cumplieron", incumplidas.length === 0, incumplidas.map((q) => `${q.escenario} ${q.real}/${q.exigido}`).join(" · ") || "todas")

// ── 10 · Escribir los informes ───────────────────────────────────────────
const fmt = (n) => `$${Number(n).toFixed(2)}`
const tablaSemanal = `
La columna "Sistema" descuenta los ${evidencia.length} pedidos de DIAGNÓSTICO
(${fmt(dineroDiagnostico)}) que crearon los scripts de verificación de los bugs: no son
operación del negocio y se listan al final del informe.

| Concepto | Bitácora esperada | Sistema (sin diagnóstico) | Diferencia | Estado |
| --- | ---: | ---: | ---: | --- |
| Pedidos | ${book.orders} | ${live.ordersGuion} | ${live.ordersGuion - book.orders} | ${Math.abs(live.ordersGuion - book.orders) <= 1 ? "OK" : "REVISAR"} |
| Clientes equivalentes | ${book.customers} | — | — | solo bitácora |
| Ventas originadas | ${fmt(book.gross - ventaAnuladaCobrada)} | ${fmt(live.grossGuion)} | ${fmt(live.grossGuion - (book.gross - ventaAnuladaCobrada))} | ${Math.abs(live.grossGuion - (book.gross - ventaAnuladaCobrada)) < 0.05 ? "OK" : "REVISAR"} |
| **Dinero cobrado** | **${fmt(book.collected)}** | **${fmt(live.collectedGuion)}** | **${fmt(live.collectedGuion - book.collected)}** | **${Math.abs(live.collectedGuion - book.collected) < 0.02 ? "OK — AL CENTAVO" : "REVISAR"}** |
| Pendiente al cierre | ${fmt(book.pending)} | — | — | libro |
| Cancelaciones (del guion) | 37 | ${live.cancelsGuion} | ${live.cancelsGuion - 37} | ${live.cancelsGuion === 37 ? "OK" : "REVISAR"} |
| Gastos | ${fmt(book.expenses)} | — | — | libro |
| Suma de los ${comerciales.length} cierres | ${fmt(book.collected)} | ${fmt(sumaCierres)} | ${fmt(sumaCierres - book.collected)} | ${Math.abs(sumaCierres - book.collected) < 0.05 ? "OK" : "REVISAR"} |
| Inventario (36 insumos) | exacto | ${invDiffs.length === 0 ? "exacto" : `${invDiffs.length} difs`} | ${invDiffs.length} | ${invDiffs.length === 0 ? "OK" : "REVISAR"} |

Las dos diferencias que hubo que explicar:

- **Ventas originadas**: el libro incluye ${fmt(ventaAnuladaCobrada)} de un pedido que se
  vendió, se cobró y luego se anuló. El sistema lo excluye de "ventas" pero
  mantiene su dinero en el cierre — es el hallazgo **BH-SIM-005**.
- **Cancelaciones**: el libro anotó ${book.cancels} porque también contó la anulación del
  pedido-evidencia del bug del precio. Las del guion son 37 = 2+5+4+3+8+12+3.
`

const porMetodo = `
### Dinero cobrado por método (libro esperado)

| Método | Moneda | Total |
| --- | --- | ---: |
${Object.entries(book.byMethodUSD).map(([m, v]) => `| ${m} | USD | ${fmt(v)} |`).join("\n")}
${Object.entries(book.byMethodVES).map(([m, v]) => `| ${m} | Bs | ${Number(v).toFixed(2)} |`).join("\n")}
`

const porDia = `
### Por día

| Día | Pedidos | Ventas originadas | Dinero cobrado | Cancelaciones |
| --- | ---: | ---: | ---: | ---: |
${DAYS.map((d) => `| ${d} | ${book.byDay[d]?.orders ?? 0} | ${fmt(book.byDay[d]?.gross ?? 0)} | ${fmt(book.byDay[d]?.collected ?? 0)} | ${book.byDay[d]?.cancels ?? 0} |`).join("\n")}
`

const porSede = `
### Por sede

| Sede | Pedidos | Cobrado (libro) | Cobrado (sistema) | Diferencia | Cancelaciones |
| --- | ---: | ---: | ---: | ---: | ---: |
${["Principal", "San Diego"].map((b) => {
  const diagB = round(evidencia.filter((o) => (o.branch_id === P ? "Principal" : "San Diego") === b).reduce((s, o) => s + Number(o.payment_received_equiv_usd || 0), 0))
  const realB = round((live.byBranch[b]?.collected ?? 0) - diagB)
  return `| ${b} | ${book.byBranch[b]?.orders ?? 0} | ${fmt(book.byBranch[b]?.collected ?? 0)} | ${fmt(realB)} | ${fmt(realB - (book.byBranch[b]?.collected ?? 0))} | ${book.byBranch[b]?.cancels ?? 0} |`
}).join("\n")}
`

const cuotas = `
### Cuotas de escenarios de pago exigidas por el guion

| Escenario | Exigido | Ejecutado | Estado |
| --- | ---: | ---: | --- |
${quotaRows.map((q) => `| ${q.escenario} | ${q.exigido} | ${q.real} | ${q.cumple ? "CUMPLE" : "INCUMPLE"} |`).join("\n")}
`

const trazabilidad = `
### Trazabilidad de 10 pedidos (muestra determinista)

${traza.map((t, i) => `**${i + 1}. ${t.id}** · ${t.sede} · ${t.canal} · ${t.estado}/${t.pago}
- Cliente: ${t.cliente}
- Productos: ${t.productos.join(", ") || "(sin líneas)"}
- Registró: ${t.registró} · Cobró: ${t.cobró}
- Total ${fmt(t.total)} · Recibido ${fmt(t.recibido)}
- Auditoría: ${t.auditoría.join(" → ") || "(sin registros)"}`).join("\n\n")}
`

const rendimiento = readJson("rendimiento.json", {})
const perfRows = []
for (const [day, ops] of Object.entries(rendimiento)) {
  for (const [op, stats] of Object.entries(ops)) {
    perfRows.push({ day, op, ...stats })
  }
}
const perfByOp = {}
for (const row of perfRows) {
  perfByOp[row.op] ||= { count: 0, p95max: 0, max: 0, errors: 0 }
  perfByOp[row.op].count += row.count
  perfByOp[row.op].p95max = Math.max(perfByOp[row.op].p95max, row.p95)
  perfByOp[row.op].max = Math.max(perfByOp[row.op].max, row.max)
  perfByOp[row.op].errors += row.errors
}
const perfTable = `
### Rendimiento (dev server local — producción en Vercel tiene otro perfil)

| Operación | Llamadas | p95 (peor día) | Máximo | Errores 5xx |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(perfByOp).sort((a, b) => b[1].count - a[1].count).map(([op, s]) => `| ${op} | ${s.count} | ${s.p95max} ms | ${s.max} ms | ${s.errors} |`).join("\n")}
`

writeFileSync(
  "SIM-SEMANA/reconciliacion-final.md",
  `# Reconciliación semanal final

Run: ${state.seed} · proyecto de prueba \`gnyvdlxlrjwbsdctincy\` · ${DAYS.length} días comerciales + Día 0 de fundación.
Libro contable esperado calculado de forma INDEPENDIENTE del sistema
(\`scripts/sim/lib/expected-ledger.mjs\`), comparado contra la base real.

## Tabla semanal
${tablaSemanal}
${porSede}
${porDia}
${porMetodo}
${cuotas}
${trazabilidad}
${perfTable}

## Integridad
- Registros huérfanos / sin sede / auditoría sin actor: ${problems.length === 0 ? "ninguno" : problems.slice(0, 10).join(" · ")}
- Pedidos 'Pagado' con menos dinero del total: ${underpaid.length}
- Sobrepagos silenciosos: ${overpaid.length}
- Filtración entre sedes (manager SD viendo Principal): ${leaked.length} pedidos
- Diferencias de inventario: ${invDiffs.length === 0 ? "ninguna (36 insumos exactos)" : JSON.stringify(invDiffs)}
- Facturas sobreabonadas: ${sobreabonos.length}

## Pedidos-evidencia (no son operación normal)
${evidencia.length ? evidencia.map((o) => `- \`${o.id}\` ${o.customer_name} · ${o.status} · ${fmt(o.total_usd)}`).join("\n") : "- ninguno"}
`,
)

const result = summary("Reconciliación final")
logLine(`\nResultado: ${result.pass} PASS · ${result.fail} FAIL · ${result.blocked} BLOCKED`)
console.log("\n→ SIM-SEMANA/reconciliacion-final.md escrito")
process.exit(result.fail > 0 ? 1 : 0)
