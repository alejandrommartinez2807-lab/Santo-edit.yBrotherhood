// QA ronda 2026-07-28 · UN DÍA COMPLETO DE OPERACIÓN, end-to-end y con todo encendido.
//
// La historia que simula (todo en San Diego, con el descuento de inventario REAL):
//   J0 · Apertura: proveedor + 3 insumos nuevos (pan, carne, papas) + 2 productos
//        del menú con receta (hamburguesa y papas fritas).
//   J1 · Mañana: pedido de mesa (con ciclo de cocina completo) y un para llevar;
//        cada uno descuenta su receta del stock y se cobra por un método distinto.
//   J2 · Mediodía: un pedido grande deja el pan POR DEBAJO del mínimo → llega la
//        compra al proveedor (insumos nuevos a mitad del día): stock sube con
//        movimiento "Compra", cuenta por pagar con abono parcial.
//   J3 · Tarde: una anulación declarando que los ingredientes NO se usaron (el
//        stock vuelve) y un pedido que queda SIN cobrar, con comprobante reportado.
//   J4 · Gasto del día en efectivo.
//   J5 · CIERRE REAL con desglose por método, al centavo contra el libro mayor.
//   J6 · Historial: el cierre aparece en la sede y en el consolidado con el
//        desglose intacto; auditoría; el gasto queda Cerrado.
//   J7 · Restauración total: banderas, comprobantes, historial, 0 filas ZZTEST.
//
// Requisitos: dev server FRESCO en :3177 (un next dev viejo fabrica 500 vacíos)
// y `npm run backup` corrido antes.
//
// Uso:  npm run qa:dia-completo
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
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100

const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

await assertBrotherhood()
console.log(`Día completo de operación · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// FOTOGRAFÍA PREVIA (todo lo que el día va a tocar y hay que devolver)
// ───────────────────────────────────────────────────────────────────────────
async function rawConfig() {
  const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  return data?.config || {}
}

const configOriginal = await rawConfig()
const flagsOriginales = {
  inventoryAutoDeductEnabled: configOriginal.inventoryAutoDeductEnabled,
  inventoryAutoDeductDryRun: configOriginal.inventoryAutoDeductDryRun,
}
const { data: proofsBeforeA } = await supabase.from("payment_proofs").select("*").eq("branch_id", A)
const { data: closesBefore } = await supabase.from("day_closes").select("id")
const closeIdsBefore = new Set((closesBefore || []).map((row) => row.id))
const { count: menuBefore } = await supabase.from("menu_products").select("id", { count: "exact", head: true })
console.log(
  `fotografía previa · flags=${JSON.stringify(flagsOriginales)} · comprobantes A=${proofsBeforeA?.length ?? 0} · cierres=${closesBefore?.length ?? 0} · menú=${menuBefore} filas\n`,
)

async function stockOf(itemId) {
  const { data } = await supabase.from("inventory_items").select("quantity").eq("id", itemId).maybeSingle()
  return Number(data?.quantity ?? NaN)
}

const productIds = []
let restored = false

async function restore() {
  if (restored) return
  restored = true
  console.log("\n── J7 · restauración total")

  // 1) Banderas de inventario exactamente como estaban.
  const saved = await post("/api/business-config", { businessConfig: flagsOriginales }, { "x-branch-id": A })
  const ahora = await rawConfig()
  check(
    "J7 · las banderas de inventario vuelven EXACTAMENTE a como estaban",
    ahora.inventoryAutoDeductEnabled === flagsOriginales.inventoryAutoDeductEnabled &&
      ahora.inventoryAutoDeductDryRun === flagsOriginales.inventoryAutoDeductDryRun,
    `status=${saved.status} ahora=${JSON.stringify({
      inventoryAutoDeductEnabled: ahora.inventoryAutoDeductEnabled,
      inventoryAutoDeductDryRun: ahora.inventoryAutoDeductDryRun,
    })}`,
  )

  // 2) El cierre del día de prueba sale del historial.
  const { data: closesNow } = await supabase.from("day_closes").select("id")
  const mine = (closesNow || []).map((row) => row.id).filter((id) => !closeIdsBefore.has(id))
  if (mine.length) await supabase.from("day_closes").delete().in("id", mine)

  // 3) Los comprobantes que el cierre borró vuelven tal cual (los ZZTEST no).
  const { data: proofsNow } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const surviving = new Set((proofsNow || []).map((row) => row.id))
  const toRestore = (proofsBeforeA || []).filter((row) => !surviving.has(row.id))
  if (toRestore.length) await supabase.from("payment_proofs").insert(toRestore)

  // 4) Gastos del día de la prueba.
  const { data: gastos } = await supabase.from("day_expenses").select("id, data")
  const misGastos = (gastos || []).filter((row) => String(row?.data?.concept || "").startsWith("ZZTEST"))
  if (misGastos.length) await supabase.from("day_expenses").delete().in("id", misGastos.map((row) => row.id))

  // 5) Compras, abonos y proveedor.
  const { data: compras } = await supabase.from("supplier_purchases").select("id").ilike("supplier_name", "ZZTEST%")
  const compraIds = (compras || []).map((row) => row.id)
  if (compraIds.length) {
    await supabase.from("supplier_purchase_payments").delete().in("purchase_id", compraIds)
    await supabase.from("supplier_purchases").delete().in("id", compraIds)
  }
  await supabase.from("suppliers").delete().ilike("name", "ZZTEST%")

  // 6) Recetas, productos, movimientos e insumos.
  if (productIds.length) {
    await supabase.from("inventory_recipes").delete().in("product_id", productIds)
    await supabase.from("menu_products").delete().in("id", productIds)
  }
  const { data: items } = await supabase.from("inventory_items").select("id").ilike("name", "ZZTEST%")
  if (items?.length) {
    await supabase.from("inventory_movements").delete().in("item_id", items.map((row) => row.id))
    await supabase.from("inventory_items").delete().in("id", items.map((row) => row.id))
  }

  // 7) Comprobantes y pedidos de la prueba.
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const orderIds = (orders || []).map((row) => row.id)
  if (orderIds.length) await supabase.from("payment_proofs").delete().in("order_id", orderIds)
  const { deleted, leftovers } = await cleanupRunOrders("ZZTEST")

  // 8) Verificación de la limpieza, tabla por tabla.
  const { data: proofsFinal } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const { data: closesFinal } = await supabase.from("day_closes").select("id")
  const { count: menuFinal } = await supabase.from("menu_products").select("id", { count: "exact", head: true })
  const sobras = {}
  for (const [tabla, columna] of [
    ["inventory_items", "name"],
    ["menu_products", "name"],
    ["suppliers", "name"],
    ["supplier_purchases", "supplier_name"],
  ]) {
    const { data } = await supabase.from(tabla).select("id").ilike(columna, "ZZTEST%")
    sobras[tabla] = data?.length ?? 0
  }

  check(
    "J7 · los comprobantes de la sede vuelven a su número original",
    (proofsFinal?.length ?? 0) === (proofsBeforeA?.length ?? 0),
    `A ${proofsBeforeA?.length ?? 0}→${proofsFinal?.length ?? 0}`,
  )
  check(
    "J7 · el historial de cierres queda como estaba",
    (closesFinal?.length ?? 0) === (closesBefore?.length ?? 0),
    `${closesBefore?.length ?? 0}→${closesFinal?.length ?? 0}`,
  )
  check(
    "J7 · el menú real queda intacto y 0 filas ZZTEST en todas las tablas",
    menuFinal === menuBefore && leftovers === 0 && Object.values(sobras).every((n) => n === 0),
    `menú ${menuBefore}→${menuFinal} · pedidos borrados=${deleted} · sobras=${JSON.stringify(sobras)} · gastos=${misGastos.length}`,
  )
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

async function mkOrder(tag, items, extra = {}) {
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-${tag}`,
      customerPhone: "04140000041",
      tableNumber: "Mesa 4",
      orderType: "Comer aquí",
      exchangeRate: RATE,
      items,
      ...extra,
    },
    { "x-branch-id": A },
  )
  return { order: json?.order, status }
}

try {
  // ─────────────────────────────────────────────────────────────────────────
  // J0 · APERTURA: encender el descuento, proveedor, insumos y menú con receta
  // ─────────────────────────────────────────────────────────────────────────
  console.log("── J0 · apertura del día")

  await post(
    "/api/business-config",
    { businessConfig: { inventoryAutoDeductEnabled: true, inventoryAutoDeductDryRun: false } },
    { "x-branch-id": A },
  )
  const configAhora = await rawConfig()
  check(
    "J0 · descuento de inventario encendido y fuera de modo prueba",
    configAhora.inventoryAutoDeductEnabled === true && configAhora.inventoryAutoDeductDryRun === false,
  )

  const proveedor = (
    await post("/api/suppliers", { name: `${RUN}-PROVEEDOR`, contactName: "Panadería QA", phone: "04120000000" }, { "x-branch-id": A })
  ).json?.supplier
  check("J0 · proveedor creado", Boolean(proveedor?.id), `id=${proveedor?.id}`)

  const mkItem = async (tag, quantity, minimumStock, unit = "unidades") =>
    (
      await post(
        "/api/inventory",
        { name: `${RUN}-${tag}`, category: "ZZTEST", quantity, unit, minimumStock, costUSD: 1 },
        { "x-branch-id": A },
      )
    ).json?.inventoryItem

  const pan = await mkItem("PAN", 40, 12)
  const carne = await mkItem("CARNE", 25, 5)
  const papas = await mkItem("PAPAS", 30, 8, "kg")
  check("J0 · 3 insumos nuevos cargados", Boolean(pan?.id && carne?.id && papas?.id))

  const { data: cargas } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity_moved")
    .in("item_id", [pan?.id, carne?.id, papas?.id].filter(Boolean))
  check(
    "J0 · cada insumo deja su movimiento de Carga inicial",
    (cargas?.length ?? 0) === 3 && cargas.every((m) => m.movement_type === "Carga inicial"),
    `${(cargas || []).map((m) => `${m.movement_type}(${m.quantity_moved})`).join(", ")}`,
  )

  const mkProduct = async (tag, price, ingredients) => {
    const productId = Date.now() + Math.floor(Math.random() * 1000)
    await post(
      "/api/menu-products",
      { id: productId, name: `${RUN}-${tag}`, category: "ZZTEST", price, isActive: true, inventoryDiscountEnabled: true },
      { "x-branch-id": A },
    )
    await post(
      "/api/inventory-recipes",
      { productId, productName: `${RUN}-${tag}`, ingredients },
      { "x-branch-id": A },
    )
    productIds.push(productId)
    return productId
  }

  const HAMB = await mkProduct("HAMBURGUESA", 8, [
    { itemId: pan.id, itemName: pan.name, quantity: 2, unit: "unidades" },
    { itemId: carne.id, itemName: carne.name, quantity: 1, unit: "unidades" },
  ])
  const FRITAS = await mkProduct("PAPAS-FRITAS", 4, [
    { itemId: papas.id, itemName: papas.name, quantity: 1.5, unit: "kg" },
  ])
  check("J0 · 2 productos del menú con receta", Boolean(HAMB && FRITAS))

  // Libro mayor del día: lo que la caja cobra, método por método.
  const ledgerUSD = new Map()
  const ledgerVES = new Map()
  const addUSD = (label, usd) => {
    const prev = ledgerUSD.get(label) || { count: 0, totalUSD: 0 }
    ledgerUSD.set(label, { count: prev.count + 1, totalUSD: round(prev.totalUSD + usd) })
  }
  const addVES = (label, ves) => {
    const prev = ledgerVES.get(label) || { count: 0, totalUSD: 0, totalVES: 0 }
    ledgerVES.set(label, {
      count: prev.count + 1,
      totalUSD: round(prev.totalUSD + ves / RATE),
      totalVES: round(prev.totalVES + ves),
    })
  }

  const reportBefore = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}

  // ─────────────────────────────────────────────────────────────────────────
  // J1 · MAÑANA: mesa con ciclo de cocina completo + un para llevar
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J1 · la mañana")

  const { order: mesa } = await mkOrder("MESA", [{ id: HAMB, name: `${RUN}-HAMBURGUESA`, price: 8, quantity: 2 }])
  check("J1 · pedido de mesa creado (2 hamburguesas, $16)", Boolean(mesa?.id), `id=${mesa?.id}`)
  check("J1 · la mesa descuenta su receta: pan 40→36, carne 25→23", (await stockOf(pan.id)) === 36 && (await stockOf(carne.id)) === 23, `pan=${await stockOf(pan.id)} carne=${await stockOf(carne.id)}`)

  // Ciclo de cocina de verdad: Preparando (estampa kitchen_started_at) → Listo → Entregado.
  await patch(`/api/orders/${mesa.id}`, { status: "Preparando" }, { "x-branch-id": A })
  const { data: enCocina } = await supabase.from("orders").select("status, kitchen_started_at").eq("id", mesa.id).maybeSingle()
  await patch(`/api/orders/${mesa.id}`, { status: "Listo" }, { "x-branch-id": A })
  await patch(`/api/orders/${mesa.id}`, { status: "Entregado" }, { "x-branch-id": A })
  const { data: entregado } = await supabase.from("orders").select("status").eq("id", mesa.id).maybeSingle()
  check(
    "J1 · ciclo de cocina completo (Preparando estampa la hora → Listo → Entregado)",
    Boolean(enCocina?.kitchen_started_at) && entregado?.status === "Entregado",
    `kitchen_started_at=${enCocina?.kitchen_started_at} status final=${entregado?.status}`,
  )

  const cobroMesa = await patch(
    `/api/orders/${mesa.id}/payment`,
    { amountReceivedUSD: 16, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" },
    { "x-branch-id": A },
  )
  check("J1 · la mesa paga $16 en efectivo divisas", cobroMesa.status === 200, `status=${cobroMesa.status}`)
  addUSD("Efectivo divisas", 16)

  const { order: llevar } = await mkOrder(
    "LLEVAR",
    [
      { id: HAMB, name: `${RUN}-HAMBURGUESA`, price: 8, quantity: 1 },
      { id: FRITAS, name: `${RUN}-PAPAS-FRITAS`, price: 4, quantity: 2 },
    ],
    { orderType: "Para llevar", tableNumber: "Para llevar" },
  )
  check("J1 · para llevar creado (1 hamburguesa + 2 papas, $16)", Boolean(llevar?.id))
  check(
    "J1 · descuenta ambas recetas: pan 36→34, carne 23→22, papas 30→27 (receta con decimales 2×1.5)",
    (await stockOf(pan.id)) === 34 && (await stockOf(carne.id)) === 22 && (await stockOf(papas.id)) === 27,
    `pan=${await stockOf(pan.id)} carne=${await stockOf(carne.id)} papas=${await stockOf(papas.id)}`,
  )
  const cobroLlevar = await patch(
    `/api/orders/${llevar.id}/payment`,
    { amountReceivedVES: 16 * RATE, paymentMethodVES: "Pago móvil", deliveryPaymentIn: "Bolívares" },
    { "x-branch-id": A },
  )
  check("J1 · el para llevar paga Bs 640 por pago móvil", cobroLlevar.status === 200, `status=${cobroLlevar.status}`)
  addVES("Pago móvil", 16 * RATE)

  // ─────────────────────────────────────────────────────────────────────────
  // J2 · MEDIODÍA: el rush agota el pan → llega la compra del proveedor
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J2 · el mediodía y los insumos nuevos")

  const { order: rush } = await mkOrder("RUSH", [{ id: HAMB, name: `${RUN}-HAMBURGUESA`, price: 8, quantity: 12 }])
  check("J2 · pedido grande creado (12 hamburguesas, $96)", Boolean(rush?.id))
  const panTrasRush = await stockOf(pan.id)
  const { data: panRow } = await supabase.from("inventory_items").select("quantity, minimum_stock").eq("id", pan.id).maybeSingle()
  check(
    "J2 · el rush deja el pan POR DEBAJO del mínimo (34−24=10 < 12)",
    panTrasRush === 10 && Number(panRow?.quantity) < Number(panRow?.minimum_stock),
    `pan=${panTrasRush} mínimo=${panRow?.minimum_stock}`,
  )
  const cobroRush = await patch(
    `/api/orders/${rush.id}/payment`,
    { amountReceivedUSD: 96, paymentMethodUSD: "Zelle", deliveryPaymentIn: "Divisas" },
    { "x-branch-id": A },
  )
  check("J2 · el rush paga $96 por Zelle", cobroRush.status === 200, `status=${cobroRush.status}`)
  addUSD("Zelle", 96)

  // La compra al proveedor: 60 panes por $30, con vencimiento en una semana.
  const hoy = new Date().toISOString().slice(0, 10)
  const enUnaSemana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const compra = await post(
    "/api/supplier-purchases",
    {
      supplierId: proveedor.id,
      purchaseDate: hoy,
      dueDate: enUnaSemana,
      documentNumber: "FACT-QA-001",
      totalUSD: 30,
      inventoryItemId: pan.id,
      inventoryQuantity: 60,
      note: `${RUN} reposición de pan a mitad del día`,
    },
    { "x-branch-id": A },
  )
  const compraId = compra.json?.purchase?.id
  check("J2 · compra registrada (60 panes, $30, vence en una semana)", compra.status === 201 && Boolean(compraId), `status=${compra.status}`)
  check("J2 · el stock sube con la compra: pan 10→70", (await stockOf(pan.id)) === 70, `pan=${await stockOf(pan.id)}`)

  const { data: movCompra } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity_moved, final_quantity, reason")
    .eq("item_id", pan.id)
    .eq("movement_type", "Compra")
  check(
    "J2 · queda el movimiento 'Compra' con el proveedor en la razón",
    (movCompra?.length ?? 0) === 1 && movCompra[0].quantity_moved === 60 && String(movCompra[0].reason).includes("PROVEEDOR"),
    `${JSON.stringify(movCompra?.[0] || {})}`,
  )

  // Abono parcial: $10 de los $30.
  const abono = await post(
    `/api/supplier-purchases/${compraId}/payments`,
    { amountUSD: 10, method: "Efectivo", paymentDate: hoy, note: "abono QA" },
    { "x-branch-id": A },
  )
  const compraTrasAbono = (await get(`/api/supplier-purchases?supplierId=${proveedor.id}`, { "x-branch-id": A })).json?.purchases?.find(
    (p) => p.id === compraId,
  )
  check(
    "J2 · el abono de $10 deja la cuenta por pagar en $20 (estado Abonada)",
    abono.status === 201 || abono.status === 200
      ? compraTrasAbono?.pendingUSD === 20 && compraTrasAbono?.paidUSD === 10
      : false,
    `status=${abono.status} pagado=$${compraTrasAbono?.paidUSD} pendiente=$${compraTrasAbono?.pendingUSD} estado=${compraTrasAbono?.paymentStatus}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // J3 · TARDE: una anulación que devuelve stock y un pedido sin cobrar
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J3 · la tarde")

  const { order: cancelado } = await mkOrder("CANCEL", [{ id: HAMB, name: `${RUN}-HAMBURGUESA`, price: 8, quantity: 2 }])
  check("J3 · pedido a anular creado (descuenta: pan 70→66)", (await stockOf(pan.id)) === 66, `pan=${await stockOf(pan.id)}`)
  await patch(
    `/api/orders/${cancelado?.id}`,
    { status: "Cancelado", cancelReason: "QA día completo: el cliente se fue", inventoryWasUsed: false },
    { "x-branch-id": A },
  )
  check(
    "J3 · anular declarando que NO se usaron ingredientes devuelve el stock (pan 66→70)",
    (await stockOf(pan.id)) === 70 && (await stockOf(carne.id)) === 10,
    `pan=${await stockOf(pan.id)} carne=${await stockOf(carne.id)}`,
  )

  const { order: pendiente } = await mkOrder("PENDIENTE", [{ id: HAMB, name: `${RUN}-HAMBURGUESA`, price: 8, quantity: 1 }])
  check("J3 · pedido pendiente creado ($8 sin cobrar; pan 70→68)", Boolean(pendiente?.id) && (await stockOf(pan.id)) === 68, `pan=${await stockOf(pan.id)}`)

  const proof = await post(
    "/api/payment-proofs",
    {
      orderId: pendiente.id,
      reportedMethod: "Pago móvil (Bs 320,00)",
      amountReportedUSD: 0,
      amountReportedVES: 320,
      paymentReference: "998877665",
      dataUrl: PNG_1x1,
      fileName: "dia-completo.png",
      mimeType: "image/png",
    },
    { "x-branch-id": A },
  )
  check("J3 · el cliente reporta su comprobante (queda por confirmar)", proof.status === 200 || proof.status === 201, `status=${proof.status}`)

  // ─────────────────────────────────────────────────────────────────────────
  // J4 · GASTO DEL DÍA
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J4 · gasto del día")
  const gasto = await post(
    "/api/day-expenses",
    { concept: `${RUN}-HIELO-Y-LIMPIEZA`, amountUSD: 15, category: "Otros", method: "Efectivo" },
    { "x-branch-id": A },
  )
  const gastoId = gasto.json?.dayExpense?.id || gasto.json?.expense?.id
  check("J4 · gasto de $15 registrado", gasto.status === 200 && Boolean(gastoId), `status=${gasto.status}`)

  // ─────────────────────────────────────────────────────────────────────────
  // J5 · EL CIERRE REAL, al centavo contra el libro mayor
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J5 · el cierre del día")

  const reportAfter = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  const usdTotal = [...ledgerUSD.values()].reduce((s, v) => s + v.totalUSD, 0)
  const vesEquiv = [...ledgerVES.values()].reduce((s, v) => s + v.totalUSD, 0)
  const vesTotal = [...ledgerVES.values()].reduce((s, v) => s + v.totalVES, 0)
  const cobradoDia = round(usdTotal + vesEquiv)

  check(
    "J5 · el reporte del dueño refleja el día: +$128 cobrados, +$8 pendientes",
    Math.abs(Number(reportAfter.collectedUSD || 0) - Number(reportBefore.collectedUSD || 0) - cobradoDia) < 0.02 &&
      Math.abs(Number(reportAfter.pendingUSD || 0) - Number(reportBefore.pendingUSD || 0) - 8) < 0.02,
    `cobrado ${reportBefore.collectedUSD}→${reportAfter.collectedUSD} · pendiente ${reportBefore.pendingUSD}→${reportAfter.pendingUSD}`,
  )

  const paymentByUSDMethod = [...ledgerUSD.entries()].map(([label, v]) => ({ label, count: v.count, totalUSD: v.totalUSD, totalVES: 0 }))
  const paymentByVESMethod = [...ledgerVES.entries()].map(([label, v]) => ({ label, count: v.count, totalUSD: v.totalUSD, totalVES: v.totalVES }))
  console.log(`   · libro mayor USD: ${paymentByUSDMethod.map((m) => `${m.label}=$${m.totalUSD}`).join(" · ")}`)
  console.log(`   · libro mayor VES: ${paymentByVESMethod.map((m) => `${m.label}=Bs${m.totalVES}`).join(" · ")}`)

  const cierre = await post(
    "/api/day-close",
    {
      dayClose: {
        dateLabel: new Date().toLocaleDateString("es-VE"),
        summaryText: `${RUN} · cierre del día completo simulado`,
        ordersRegistered: 5,
        totalSoldUSD: 136,
        realCollectedUSD: cobradoDia,
        realCashUSD: ledgerUSD.get("Efectivo divisas")?.totalUSD || 0,
        realVES: round(vesTotal),
        realVESEquivalentUSD: round(vesEquiv),
        realPendingUSD: 8,
        totalConfirmedUSD: cobradoDia,
        paymentByUSDMethod,
        paymentByVESMethod,
        expenses: [{ id: gastoId, concept: `${RUN}-HIELO-Y-LIMPIEZA`, amountUSD: 15 }],
      },
    },
    { "x-branch-id": A },
  )
  check("J5 · el cierre responde 200 y queda con id", cierre.status === 200 && Boolean(cierre.json?.dayClose?.id), `status=${cierre.status}`)
  const closeId = cierre.json?.dayClose?.id

  const { data: closeRow } = await supabase.from("day_closes").select("id, branch_id, data").eq("id", closeId || "").maybeSingle()
  const snapshot = closeRow?.data || {}
  check("J5 · el cierre es de SU sede y archiva la fotografía del día", closeRow?.branch_id === A && Array.isArray(snapshot.orders) && Array.isArray(snapshot.paymentProofs), `branch=${closeRow?.branch_id} pedidos=${snapshot.orders?.length} comprobantes=${snapshot.paymentProofs?.length}`)
  check(
    "J5 · el dinero del cierre cuadra al centavo: $16 efectivo + $96 Zelle + Bs 640 (=$16) = $128",
    Math.abs(Number(snapshot.realCollectedUSD || 0) - 128) < 0.01 &&
      Math.abs(Number(snapshot.realCashUSD || 0) - 16) < 0.01 &&
      Math.abs(Number(snapshot.realVES || 0) - 640) < 0.01,
    `cobrado=$${snapshot.realCollectedUSD} efectivo=$${snapshot.realCashUSD} Bs=${snapshot.realVES}`,
  )
  const savedUSD = snapshot.paymentByUSDMethod || []
  const savedVES = snapshot.paymentByVESMethod || []
  check(
    "J5 · el desglose por método sobrevive dentro del cierre",
    savedUSD.length === 2 && savedVES.length === 1 &&
      savedUSD.find((m) => m.label === "Zelle")?.totalUSD === 96 &&
      savedVES.find((m) => m.label === "Pago móvil")?.totalVES === 640,
    `USD=${JSON.stringify(savedUSD)} VES=${JSON.stringify(savedVES)}`,
  )

  const { data: gastoRow } = await supabase.from("day_expenses").select("close_status").eq("id", gastoId || "").maybeSingle()
  check("J5 · el gasto del día queda marcado Cerrado", gastoRow?.close_status === "Cerrado", `close_status=${gastoRow?.close_status}`)

  const proofsTrasCierre = (await supabase.from("payment_proofs").select("id").eq("branch_id", A)).data || []
  check("J5 · el cierre limpia los comprobantes de la sede (archivados en la fotografía)", proofsTrasCierre.length === 0, `quedan=${proofsTrasCierre.length}`)

  // ─────────────────────────────────────────────────────────────────────────
  // J6 · EL HISTORIAL DEL DUEÑO
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── J6 · el historial de cierres")

  const histA = (await get("/api/day-closes", { "x-branch-id": A })).json?.dayCloses || []
  const enHistorial = histA.find((c) => c.id === closeId)
  check("J6 · el cierre aparece en el historial de la sede", Boolean(enHistorial))
  const histUSD = enHistorial?.paymentByUSDMethod || enHistorial?.data?.paymentByUSDMethod || []
  check(
    "J6 · el historial devuelve el desglose por método INTACTO",
    histUSD.length === 2 && histUSD.find((m) => m.label === "Zelle")?.totalUSD === 96,
    `USD en historial=${JSON.stringify(histUSD)}`,
  )
  const consolidado = (await get("/api/day-closes?scope=all", { "x-branch-id": A })).json?.dayCloses || []
  check("J6 · el consolidado del dueño también lo trae", consolidado.some((c) => c.id === closeId), `consolidado=${consolidado.length}`)

  const { data: auditoria } = await supabase
    .from("audit_logs")
    .select("id, branch_id")
    .eq("action", "day_close.saved")
    .eq("entity_id", closeId || "")
  check("J6 · el cierre queda en auditoría con su sede", (auditoria?.length ?? 0) > 0 && auditoria[0].branch_id === A, `filas=${auditoria?.length ?? 0}`)

  // Los movimientos de inventario del día completo, como los vería el dueño.
  const { data: todosMov } = await supabase
    .from("inventory_movements")
    .select("movement_type")
    .eq("item_id", pan.id)
  const tipos = (todosMov || []).map((m) => m.movement_type)
  check(
    "J6 · la vida del pan quedó completa en movimientos: carga, consumos, compra y devolución",
    tipos.includes("Carga inicial") && tipos.includes("Compra") && tipos.filter((t) => t === "Consumo").length >= 4,
    `tipos=${tipos.join(", ")}`,
  )
} finally {
  await restore()
}

process.exit(summary("Día completo de operación") > 0 ? 1 : 0)
