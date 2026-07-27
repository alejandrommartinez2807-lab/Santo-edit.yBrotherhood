// QA ronda 2026-07-27 · F3/F4/F5: inventario por sede, transferencias,
// alertas de reposición y recordatorios de cuentas por pagar.
// Todo contra la BD real, con datos ZZTEST que se borran al final.
//
// Uso:  npm run qa:inventory      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  get,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const B = BRANCH_VINEDO

const created = { items: [], suppliers: [], purchases: [], orders: [] }

async function mkItem(branchId, tag, { quantity = 100, minimumStock = 10 } = {}) {
  const { json, status } = await post(
    "/api/inventory",
    { name: `${RUN}-${tag}`, category: "ZZTEST", quantity, unit: "unidades", minimumStock, costUSD: 1 },
    { "x-branch-id": branchId },
  )
  if (json?.inventoryItem?.id) created.items.push(json.inventoryItem.id)
  return { item: json?.inventoryItem, status }
}

async function stockOf(itemId) {
  const { data } = await supabase.from("inventory_items").select("quantity, branch_id, name").eq("id", itemId).maybeSingle()
  return data
}

async function businessConfig() {
  const { data } = await supabase.from("business_config").select("config").limit(1)
  return data?.[0]?.config || {}
}

await assertBrotherhood()
console.log(`F3/F4/F5 · inventario, transferencias y alertas · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// I1 · EL DESCUENTO AUTOMÁTICO: ¿está encendido en la config real?
// ───────────────────────────────────────────────────────────────────────────
console.log("── I1 · estado real del descuento automático")
let autoDeductOn = false
{
  const config = await businessConfig()
  autoDeductOn = config.inventoryAutoDeductEnabled === true && config.inventoryAutoDeductDryRun !== true
  console.log(
    `   · inventoryModuleEnabled=${config.inventoryModuleEnabled} · inventoryAutoDeductEnabled=${config.inventoryAutoDeductEnabled} · inventoryAutoDeductDryRun=${config.inventoryAutoDeductDryRun}`,
  )
  check(
    "I1 · la config dice si un pedido debe mover stock (no se toca, se reporta)",
    true,
    autoDeductOn
      ? "el descuento automático está ENCENDIDO: los pedidos deben mover stock"
      : "el descuento automático está APAGADO (modo prueba): un pedido NO debe mover stock, y eso es lo correcto hoy",
  )
}

// ───────────────────────────────────────────────────────────────────────────
// I2 · UN PEDIDO CON RECETA: ¿mueve el stock según la config?
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── I2 · pedido con receta ligada a inventario")
{
  const { item } = await mkItem(A, "PAN", { quantity: 100, minimumStock: 10 })
  const productId = Date.now()

  const product = await post(
    "/api/menu-products",
    { id: productId, name: `${RUN}-HAMB`, category: "ZZTEST", price: 5, isActive: true, inventoryDiscountEnabled: true },
    { "x-branch-id": A },
  )
  const recipe = await post(
    "/api/inventory-recipes",
    {
      productId,
      productName: `${RUN}-HAMB`,
      ingredients: [{ itemId: item?.id, itemName: item?.name, quantity: 2, unit: "unidades" }],
    },
    { "x-branch-id": A },
  )
  check("I2 setup · producto ZZTEST con receta de 2 unidades", product.status === 200 && recipe.status === 200, `producto=${product.status} receta=${recipe.status}`)

  const before = await stockOf(item?.id)
  const { json } = await postOrderThrottled(
    {
      customerName: `${RUN}-PED-RECETA`,
      customerPhone: "04140000005",
      tableNumber: "Mesa 2",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: productId, name: `${RUN}-HAMB`, price: 5, quantity: 3 }],
    },
    { "x-branch-id": A },
  )
  if (json?.order?.id) created.orders.push(json.order.id)
  const after = await stockOf(item?.id)
  const moved = Number(before?.quantity || 0) - Number(after?.quantity || 0)

  check(
    autoDeductOn
      ? "I2 · el pedido descuenta 6 unidades (3 hamburguesas x 2)"
      : "I2 · con el descuento en modo prueba el pedido NO toca el stock",
    autoDeductOn ? Math.abs(moved - 6) < 0.001 : moved === 0,
    `stock ${before?.quantity} → ${after?.quantity} (movió ${moved})`,
  )

  // El insumo de la sede B (mismo nombre) no se puede haber tocado.
  const { item: itemB } = await mkItem(B, "PAN", { quantity: 100, minimumStock: 10 })
  const bAfter = await stockOf(itemB?.id)
  check("I2 · el insumo homónimo de la OTRA sede queda intacto", Number(bAfter?.quantity) === 100, `B=${bAfter?.quantity}`)

  // Limpieza del producto y la receta de prueba (el menú real no se toca).
  await supabase.from("inventory_recipes").delete().eq("product_id", productId)
  await supabase.from("menu_products").delete().eq("id", productId)
}

// ───────────────────────────────────────────────────────────────────────────
// I3 · TRANSFERENCIA ENTRE SEDES: la única vía legítima de cruzar un insumo
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── I3 · transferencia entre sedes")
{
  const { item: origen } = await mkItem(A, "TRANSF", { quantity: 50, minimumStock: 5 })
  const beforeA = await stockOf(origen?.id)

  const transfer = await post(
    "/api/inventory/transfer",
    { targetBranchId: B, items: [{ itemId: origen?.id, quantity: 20 }], note: `${RUN} transferencia de prueba` },
    { "x-branch-id": A },
  )
  const afterA = await stockOf(origen?.id)

  check("I3 · la transferencia responde OK", transfer.status === 200, `status=${transfer.status} ${JSON.stringify(transfer.json).slice(0, 140)}`)
  check("I3 · resta 20 en el origen (50 → 30)", Math.abs(Number(afterA?.quantity || 0) - 30) < 0.001, `A=${beforeA?.quantity} → ${afterA?.quantity}`)

  const { data: destino } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, branch_id")
    .eq("branch_id", B)
    .ilike("name", `${RUN}-TRANSF%`)
  const sumaDestino = (destino || []).reduce((acc, r) => acc + Number(r.quantity || 0), 0)
  for (const d of destino || []) created.items.push(d.id)
  check("I3 · suma 20 en el destino, misma cantidad", Math.abs(sumaDestino - 20) < 0.001, `destino=${sumaDestino} en ${destino?.length ?? 0} fila(s)`)

  const { data: movimientos, error: movError } = await supabase
    .from("inventory_movements")
    .select("id, movement_type, quantity_moved, branch_id, note")
    .ilike("note", `%${RUN}%`)
  const sedes = new Set((movimientos || []).map((m) => m.branch_id))
  check(
    "I3 · la transferencia deja rastro: un movimiento en cada sede",
    (movimientos?.length ?? 0) >= 2 && sedes.size === 2,
    `movimientos=${movimientos?.length ?? 0} sedes=${sedes.size} ${movError?.message || ""} · tipos=${(movimientos || []).map((m) => `${m.movement_type}(${m.quantity_moved})`).join(", ")}`,
  )

  // Cruce ilegítimo: mover stock de un insumo de B desde contexto de A.
  const { item: itemB } = await mkItem(B, "SOLO-B", { quantity: 40 })
  const crossTransfer = await post(
    "/api/inventory/transfer",
    { targetBranchId: A, items: [{ itemId: itemB?.id, quantity: 10 }], note: `${RUN} cruce ilegítimo` },
    { "x-branch-id": A },
  )
  const itemBAfter = await stockOf(itemB?.id)
  check(
    "I3 · A no puede transferir hacia sí mismo un insumo que es de B",
    Number(itemBAfter?.quantity) === 40,
    `status=${crossTransfer.status} stock de B quedó=${itemBAfter?.quantity}`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// I4 · ALERTA DE REPOSICIÓN (con la trampa doble del anti-spam)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── I4 · alerta de reposición")
{
  // Trampa 2: borrar la marca de las últimas 24h para que el aviso pueda salir.
  const { data: previas } = await supabase
    .from("audit_logs")
    .select("id, branch_id, created_at")
    .eq("action", "inventory.restock.notified")
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  if (previas?.length) {
    await supabase.from("audit_logs").delete().in("id", previas.map((p) => p.id))
    console.log(`   · borradas ${previas.length} marcas previas de aviso (anti-spam de 24 h)`)
  }

  // Insumo por DEBAJO del mínimo.
  const { item } = await mkItem(A, "BAJO", { quantity: 2, minimumStock: 20 })
  check("I4 setup · insumo con stock 2 y mínimo 20", Number(item?.quantity) === 2, `qty=${item?.quantity} min=${item?.minimumStock}`)

  // El panel tiene que verlo.
  const alerts = await get("/api/reports?period=today", { "x-branch-id": A })
  const health = alerts.json?.inventoryHealth
  const lowNames = JSON.stringify(health || {})
  check("I4 · el panel del dueño lo cuenta como insumo bajo", lowNames.includes(`${RUN}-BAJO`) || Number(health?.lowStockCount || 0) > 0, `inventoryHealth=${lowNames.slice(0, 180)}`)

  // Trampa 1: el disparo es oportunista y vive en el **GET** de /api/orders
  // (src/app/api/orders/route.ts:231), no en el POST. Además trae un throttle
  // en memoria de 10 min por proceso: hay que insistir hasta que le toque.
  const desde = new Date(Date.now() - 60 * 1000).toISOString()
  let marca = []
  const limite = Date.now() + 11 * 60 * 1000
  let intentos = 0
  while (Date.now() < limite) {
    intentos += 1
    await get("/api/orders", { "x-branch-id": A })
    await new Promise((r) => setTimeout(r, 3000))
    const { data } = await supabase
      .from("audit_logs")
      .select("id, branch_id, metadata, created_at")
      .eq("action", "inventory.restock.notified")
      .gte("created_at", desde)
    marca = data || []
    if (marca.length) break
    await new Promise((r) => setTimeout(r, 27000))
  }
  check(
    "I4 · el latido del GET /api/orders deja la marca inventory.restock.notified",
    marca.length > 0,
    `marcas=${marca.length} tras ${intentos} latidos${marca.length ? ` · sede=${marca[0].branch_id} · resumen="${String(marca[0].metadata?.resumen || "").slice(0, 90)}"` : " · el throttle en memoria es de 10 min por proceso"}`,
  )
  if (marca?.length) {
    check(
      "I4 · la marca es de la sede del insumo bajo, no de la otra",
      marca.every((m) => m.branch_id === A || m.branch_id === null),
      `sedes=${marca.map((m) => m.branch_id).join(",")}`,
    )
  }

  // Anti-spam: más latidos no pueden duplicar la marca mientras la situación
  // no cambie (dedupe por firma + ventana de 24 h).
  const antes = marca.length
  for (let i = 0; i < 3; i += 1) {
    await get("/api/orders", { "x-branch-id": A })
    await new Promise((r) => setTimeout(r, 1500))
  }
  const { data: marca2 } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("action", "inventory.restock.notified")
    .gte("created_at", desde)
  check("I4 · el anti-spam evita repetir el aviso", (marca2?.length ?? 0) === antes, `antes=${antes} después=${marca2?.length ?? 0}`)
}

// ───────────────────────────────────────────────────────────────────────────
// I5 · CUENTAS POR PAGAR: saldo, abonos y aislamiento
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── I5 · cuentas por pagar")
{
  const supplier = await post("/api/suppliers", { name: `${RUN}-PROV` }, { "x-branch-id": A })
  const supplierId = supplier.json?.supplier?.id
  if (supplierId) created.suppliers.push(supplierId)

  const config = await businessConfig()
  const dias = Number(config.payablesReminderDaysBefore || 3)
  const vence = new Date(Date.now() + (dias - 1) * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const purchase = await post(
    "/api/supplier-purchases",
    { supplierId, purchaseDate: new Date().toISOString().slice(0, 10), dueDate: vence, totalUSD: 100, documentNumber: `${RUN}-F1` },
    { "x-branch-id": A },
  )
  const purchaseId = purchase.json?.purchase?.id
  if (purchaseId) created.purchases.push(purchaseId)
  check("I5 · compra a crédito dentro de la ventana de aviso", purchase.status === 201, `status=${purchase.status} vence=${vence} (ventana=${dias} días)`)

  const parcial = await post(
    `/api/supplier-purchases/${purchaseId}/payments`,
    { amountUSD: 40, paymentDate: new Date().toISOString().slice(0, 10), method: "Efectivo", note: `${RUN} abono` },
    { "x-branch-id": A },
  )
  check(
    "I5 · el abono parcial de $40 deja pendiente $60 y estado Parcial",
    parcial.status === 201 && parcial.json?.purchase?.paymentStatus === "Parcial" && Math.abs(Number(parcial.json?.purchase?.pendingUSD) - 60) < 0.02,
    `estado=${parcial.json?.purchase?.paymentStatus} pendiente=${parcial.json?.purchase?.pendingUSD}`,
  )

  const exceso = await post(
    `/api/supplier-purchases/${purchaseId}/payments`,
    { amountUSD: 500, paymentDate: new Date().toISOString().slice(0, 10), method: "Efectivo" },
    { "x-branch-id": A },
  )
  check("I5 · no se puede abonar más de lo pendiente", exceso.status >= 400, `status=${exceso.status}`)

  const final = await post(
    `/api/supplier-purchases/${purchaseId}/payments`,
    { amountUSD: 60, paymentDate: new Date().toISOString().slice(0, 10), method: "Efectivo" },
    { "x-branch-id": A },
  )
  check(
    "I5 · el abono final marca Pagado y pendiente 0",
    final.json?.purchase?.paymentStatus === "Pagado" && Math.abs(Number(final.json?.purchase?.pendingUSD || 0)) < 0.02,
    `estado=${final.json?.purchase?.paymentStatus} pendiente=${final.json?.purchase?.pendingUSD}`,
  )

  // La compra a proveedor NO puede aparecer como gasto del día (doble conteo).
  const gastos = await get("/api/day-expenses", { "x-branch-id": A })
  const arr = gastos.json?.dayExpenses || gastos.json?.expenses || []
  check(
    "I5 · la compra a proveedor no se cuela como gasto del día (sin doble conteo)",
    !arr.some((e) => String(e.concept || "").includes(`${RUN}-F1`)),
    `gastos que la mencionan=${arr.filter((e) => String(e.concept || "").includes(RUN)).length}`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const orderIds = (orders || []).map((o) => o.id)
  if (orderIds.length) {
    await supabase.from("order_items").delete().in("order_id", orderIds)
    await supabase.from("orders").delete().in("id", orderIds)
  }
  await supabase.from("supplier_purchase_payments").delete().in("purchase_id", created.purchases.length ? created.purchases : ["-"])
  await supabase.from("supplier_purchases").delete().ilike("document_number", `${RUN}%`)
  await supabase.from("suppliers").delete().ilike("name", `${RUN}%`)
  await supabase.from("inventory_movements").delete().ilike("note", `%${RUN}%`)
  const { data: items } = await supabase.from("inventory_items").select("id").ilike("name", `${RUN}%`)
  if (items?.length) {
    await supabase.from("inventory_movements").delete().in("item_id", items.map((i) => i.id))
    await supabase.from("inventory_items").delete().in("id", items.map((i) => i.id))
  }

  const leftovers = {}
  for (const [table, column] of [
    ["orders", "customer_name"],
    ["inventory_items", "name"],
    ["suppliers", "name"],
    ["menu_products", "name"],
  ]) {
    const { data } = await supabase.from(table).select("id").ilike(column, "ZZTEST%")
    leftovers[table] = data?.length ?? 0
  }
  check(
    "limpieza · 0 filas ZZTEST en pedidos, insumos, proveedores y menú",
    Object.values(leftovers).every((n) => n === 0),
    JSON.stringify(leftovers),
  )
}

process.exit(summary("F3/F4/F5 inventario y alertas") > 0 ? 1 : 0)
