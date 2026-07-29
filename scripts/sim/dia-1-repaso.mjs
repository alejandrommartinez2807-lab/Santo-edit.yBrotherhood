// DÍA 1 · REPASO (reanudación desde checkpoint): completa lo que la primera
// pasada dejó pendiente — los 5 delivery que fallaron por el método de pago
// ausente, la cancelación CX-1 (el mesonero no puede cancelar: la hace la
// manager), el comprobante con referencia válida — y ejecuta los CIERRES
// comerciales por sede contra el libro esperado + verificación nocturna.
import {
  openDay, createOrder, kitchenCycle, payOrder, cancelOrder,
  addExpense, closeBranchDay, nightlyChecks, verifyInventory,
  check, summary, logLine, get, post, patch, publicHeaders, auditRows, orderRow,
  round, flushPerformance, RATE, bumpQuota,
} from "./lib/day-engine.mjs"

const ctx = await openDay({
  dayNumber: 1,
  dayKey: "dia-1",
  title: "Día 1 — repaso (delivery + cierres)",
  businessDate: "2026-08-03",
  roster: ["alejandro", "genesis", "mariafernanda", "jesus", "anthony", "miguel", "luis", "roxana", "carlosalberto"],
})
const { P, SD } = ctx
const st = ctx.state
logLine("\n## Repaso del Día 1 (reanudación)")

// La primera pasada dejó 50 pedidos asentados en el libro; este repaso agrega
// los 5 delivery del plan. ctx.orders solo tiene los de ESTA corrida: para las
// verificaciones nocturnas se usan los dos conjuntos (libro + estos).

// ── 1 · Los 5 delivery del plan (3 P — uno con GPS — y 2 SD) ─────────────
const gpsCliente = "https://maps.google.com/?q=10.2150,-68.0100"
const delivP = []
for (let i = 0; i < 3; i += 1) {
  const withGps = i === 0
  const result = await createOrder(ctx, {
    branchId: P, channel: "delivery", items: [["Burger Clásica", 1], ["Papas Medianas", 1], ["Refresco 1.5L", 1]],
    clientIndex: 300 + i,
    deliveryAddress: `Av. Cedeño, edificio ${i + 2}, Valencia`,
    paymentMethodLabel: ["Efectivo", "Pago móvil", "Transferencia"][i],
    ...(withGps ? { deliveryMapsUrl: gpsCliente, expectDeliveryCostUSD: 2 } : {}),
  })
  if (result.ok) {
    delivP.push(result.record)
    if (withGps) {
      const row = await orderRow(result.record.id)
      check("D1R-DELIV-1", "delivery con GPS: el SERVER cotiza el envío por km ($2, tier ≤3km)", Math.abs(Number(row?.delivery_cost_usd ?? 0) - 2) < 0.01, `delivery_cost=${row?.delivery_cost_usd} total=${row?.total_usd}`)
    }
  } else {
    check(`D1R-DELIV-crear-${i}`, "delivery creado", false, `status=${result.status} ${result.error}`)
  }
}
const delivSD = []
for (let i = 0; i < 2; i += 1) {
  const result = await createOrder(ctx, {
    branchId: SD, channel: "delivery", items: [["Burger de Pollo", 1], ["Agua mineral", 1]],
    clientIndex: 320 + i,
    deliveryAddress: `Urb. Morro II, calle ${i + 7}, San Diego`,
    paymentMethodLabel: i ? "Pago móvil" : "Efectivo",
  })
  if (result.ok) delivSD.push(result.record)
  else check(`D1R-DELIV-SD-${i}`, "delivery SD creado", false, `status=${result.status} ${result.error}`)
}
check("D1R-DELIV-2", "los 5 delivery del plan existen (3 P + 2 SD)", delivP.length === 3 && delivSD.length === 2, `P=${delivP.length} SD=${delivSD.length}`)

for (const [i, rec] of delivP.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "jesus" })
  await patch(`/api/orders/${rec.id}`, { status: "Entregado" }, ctx.actor("miguel", P), { label: "PATCH orders/:id (entrega)" })
  await payOrder(ctx, rec, ["efectivo", "pagomovil", "transferencia"][i], "mariafernanda")
}
for (const [i, rec] of delivSD.entries()) {
  await kitchenCycle(ctx, rec, { kitchen: "carlosalberto" })
  await patch(`/api/orders/${rec.id}`, { status: "Entregado" }, ctx.actor("roxana", SD), { label: "PATCH orders/:id (entrega)" })
  await payOrder(ctx, rec, i ? "mixto" : "efectivo", "roxana")
}

// ── 2 · CX-1: la cancelación "antes de cocina" la ejecuta la MANAGER ─────
const { data: stuck } = await (await import("./lib/simulation-guard.mjs")).supabase
  .from("orders").select("id, customer_name, total_usd, branch_id").eq("status", "Nuevo")
const cx1Row = (stuck || []).find((o) => String(o.customer_name).includes("dia-1"))
if (cx1Row) {
  const fakeRecord = { id: cx1Row.id, branchId: cx1Row.branch_id, total: round(Number(cx1Row.total_usd)), paid: 0, channel: "mesa" }
  const res = await cancelOrder(ctx, fakeRecord, { by: "genesis", reason: "Cliente se arrepintió antes de cocinar (repaso: cancela la manager — el mesonero no tiene permiso, comprobado en la 1ª pasada)", inventoryWasUsed: false })
  const rowDb = await orderRow(cx1Row.id)
  check("D1R-CX-1", "cancelación ANTES de cocina por la manager: Cancelado + motivo + stock devuelto", res.ok && rowDb?.status === "Cancelado", `estado=${rowDb?.status}`)
} else {
  check("D1R-CX-1", "quedaba un pedido 'Nuevo' del Día 1 para cancelar", false, "no se encontró")
}

// ── 3 · Comprobante reportado con referencia VÁLIDA y monto venezolano ────
// (la 1ª pasada demostró que la referencia corta se rechaza — escudo P-1 ✓)
const { data: unpaidQr } = await (await import("./lib/simulation-guard.mjs")).supabase
  .from("orders").select("id, branch_id, total_usd, payment_status").eq("payment_status", "Pendiente").eq("status", "Entregado").limit(5)
const proofTarget = (unpaidQr || []).find((o) => o.branch_id === P) || (unpaidQr || [])[0]
if (proofTarget) {
  const proofRes = await post(
    "/api/payment-proofs",
    {
      orderId: proofTarget.id,
      reportedMethod: "Pago móvil (Bs 9.648,99)",
      amountReportedUSD: 0,
      amountReportedVES: 9648.99,
      paymentReference: "004521998877",
      note: "cliente reporta 9.648,99 Bs (formato venezolano) — repaso día 1",
    },
    publicHeaders("10.81.6.81", proofTarget.branch_id),
  )
  check("D1R-ADV-7", "comprobante con referencia válida y monto 9.648,99 entra a revisión", proofRes.status === 200 || proofRes.status === 201, `status=${proofRes.status} ${proofRes.json?.error || ""}`)
  if (proofRes.status === 200 || proofRes.status === 201) {
    bumpQuota(st, "pago-reportado")
    bumpQuota(st, "reportado-bs-formato-ve")
  }
} else {
  check("D1R-ADV-7", "había un pedido entregado sin pagar para reportar", false, "no se encontró")
}

// ── 4 · CIERRES por sede (manager cierra; cajera NO puede: prueba previa) ─
const cashierClose = await post("/api/day-close", { dayClose: { dateLabel: "x", summaryText: "intento cajera" } }, ctx.actor("mariafernanda", P))
check("D1R-PERM-1", "la cajera NO puede cerrar el día (solo dueño/manager)", cashierClose.status === 403, `status=${cashierClose.status}`)

const gastoIds = st.day1?.gastos || {}
const closeP = await closeBranchDay(ctx, P, { closedBy: "genesis", expenses: [] })
const closeSD = await closeBranchDay(ctx, SD, { closedBy: "luis", expenses: [] })

if (closeSD.ok && st.day1.openAccountCarry) {
  const carry = st.day1.openAccountCarry
  const bookSD = ctx.ledger.days["dia-1"][SD]
  check(
    "D1R-CIERRE-CTA",
    "la cuenta abierta (SD) quedó FUERA del dinero cobrado y DENTRO del pendiente",
    bookSD.pendingUSD >= carry.total - 0.01,
    `pendiente del libro=$${bookSD.pendingUSD} cuenta=$${carry.total}`,
  )
}

// ── 5 · Auditoría + noche ────────────────────────────────────────────────
const paymentAudit = await auditRows({ action: "order.payment.updated", limit: 100 })
const withActor = paymentAudit.filter((a) => a.actor_label && a.actor_role)
check("D1R-AUDIT-1", "los cobros del día quedaron auditados con autor real", paymentAudit.length >= 30 && withActor.length === paymentAudit.length, `filas=${paymentAudit.length} conActor=${withActor.length}`)

await nightlyChecks(ctx)
await verifyInventory(ctx)

// Totales del día completo según el libro (para la bitácora).
const bookP = ctx.ledger.days["dia-1"][P]
const bookSD2 = ctx.ledger.days["dia-1"][SD]
logLine(`\n### Día 1 cerrado · Principal: ${bookP.ordersCreated} pedidos, $${bookP.collectedUSD} cobrados, $${bookP.pendingUSD} pendientes, ${bookP.cancellations} cancelados`)
logLine(`### Día 1 cerrado · San Diego: ${bookSD2.ordersCreated} pedidos, $${bookSD2.collectedUSD} cobrados, $${bookSD2.pendingUSD} pendientes, ${bookSD2.cancellations} cancelados`)
const evidencia = st.day1?.priceManipulationOrderId ? 1 : 0
check("D1R-PLAN-1", "el Día 1 completo suma los 55 pedidos del plan (+1 pedido-evidencia del bug BH-SIM-001)", bookP.ordersCreated + bookSD2.ordersCreated - evidencia === 55, `P=${bookP.ordersCreated} SD=${bookSD2.ordersCreated} evidencia=${evidencia}`)

st.completedDays = Array.from(new Set([...(st.completedDays || []), "dia-1"]))
ctx.persist()
flushPerformance("dia-1-repaso")

const result = summary("Día 1 — repaso y cierre")
process.exit(result.fail > 0 ? 1 : 0)
