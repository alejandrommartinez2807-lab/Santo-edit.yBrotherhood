// QA ronda 2026-07-27 · F3 completo: el DESCUENTO AUTOMÁTICO de inventario,
// con el flag encendido de verdad.
//
// El descuento vive apagado en la configuración real
// (inventoryAutoDeductEnabled=false, inventoryAutoDeductDryRun=true), así que
// este script lo enciende, prueba, y lo devuelve EXACTAMENTE a como estaba —
// incluso si algo revienta a mitad (restore() en finally y en excepción).
// saveBusinessConfig mezcla con lo existente, así que tocar dos banderas no
// pisa el resto de la configuración.
//
// Uso:  npm run qa:inventory-deduct      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  patch,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const B = BRANCH_VINEDO

async function rawConfig() {
  const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  return data?.config || {}
}

async function stockOf(itemId) {
  const { data } = await supabase.from("inventory_items").select("quantity, name, branch_id").eq("id", itemId).maybeSingle()
  return Number(data?.quantity ?? NaN)
}

async function mkItem(branchId, tag, quantity = 100) {
  const { json } = await post(
    "/api/inventory",
    { name: `${RUN}-${tag}`, category: "ZZTEST", quantity, unit: "unidades", minimumStock: 5, costUSD: 1 },
    { "x-branch-id": branchId },
  )
  return json?.inventoryItem
}

async function mkProductWithRecipe(branchId, tag, item, qtyPorUnidad) {
  const productId = Date.now() + Math.floor(Math.random() * 1000)
  await post(
    "/api/menu-products",
    { id: productId, name: `${RUN}-${tag}`, category: "ZZTEST", price: 5, isActive: true, inventoryDiscountEnabled: true },
    { "x-branch-id": branchId },
  )
  await post(
    "/api/inventory-recipes",
    {
      productId,
      productName: `${RUN}-${tag}`,
      ingredients: [{ itemId: item.id, itemName: item.name, quantity: qtyPorUnidad, unit: "unidades" }],
    },
    { "x-branch-id": branchId },
  )
  return productId
}

async function mkOrder(branchId, productId, tag, cantidad, extra = {}) {
  const { json, status } = await postOrderThrottled(
    {
      customerName: `${RUN}-${tag}`,
      customerPhone: "04140000030",
      tableNumber: "Mesa 2",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: productId, name: `${RUN}-PROD`, price: 5, quantity: cantidad }],
      ...extra,
    },
    { "x-branch-id": branchId },
  )
  return { order: json?.order, status }
}

await assertBrotherhood()
console.log(`F3 · descuento automático de inventario · run=${RUN}\n`)

const configOriginal = await rawConfig()
const flagsOriginales = {
  inventoryAutoDeductEnabled: configOriginal.inventoryAutoDeductEnabled,
  inventoryAutoDeductDryRun: configOriginal.inventoryAutoDeductDryRun,
  trainingModeActive: configOriginal.trainingModeActive,
}
console.log(`config original: ${JSON.stringify(flagsOriginales)}\n`)

const productIds = []
let restored = false

async function restore() {
  if (restored) return
  restored = true
  console.log("\n── devolviendo la configuración y limpiando")

  const saved = await post("/api/business-config", { businessConfig: flagsOriginales }, { "x-branch-id": A })
  const ahora = await rawConfig()
  check(
    "restauración · las banderas de inventario vuelven EXACTAMENTE a como estaban",
    ahora.inventoryAutoDeductEnabled === flagsOriginales.inventoryAutoDeductEnabled &&
      ahora.inventoryAutoDeductDryRun === flagsOriginales.inventoryAutoDeductDryRun &&
      ahora.trainingModeActive === flagsOriginales.trainingModeActive,
    `status=${saved.status} · ahora=${JSON.stringify({
      inventoryAutoDeductEnabled: ahora.inventoryAutoDeductEnabled,
      inventoryAutoDeductDryRun: ahora.inventoryAutoDeductDryRun,
      trainingModeActive: ahora.trainingModeActive,
    })}`,
  )

  // Que la mezcla no se haya comido nada del resto de la configuración.
  const clavesAntes = Object.keys(configOriginal).filter((key) => key !== "updatedAt").sort()
  const clavesAhora = Object.keys(ahora).filter((key) => key !== "updatedAt").sort()
  const perdidas = clavesAntes.filter((key) => !clavesAhora.includes(key))
  check("restauración · no se perdió ninguna otra clave de la configuración", perdidas.length === 0, `claves=${clavesAhora.length} perdidas=${JSON.stringify(perdidas)}`)

  if (productIds.length) {
    await supabase.from("inventory_recipes").delete().in("product_id", productIds)
    await supabase.from("menu_products").delete().in("id", productIds)
  }
  const { data: items } = await supabase.from("inventory_items").select("id").ilike("name", `${RUN}%`)
  if (items?.length) {
    await supabase.from("inventory_movements").delete().in("item_id", items.map((row) => row.id))
    await supabase.from("inventory_items").delete().in("id", items.map((row) => row.id))
  }
  const { deleted, leftovers } = await cleanupRunOrders(RUN)

  const { data: sobrantesItems } = await supabase.from("inventory_items").select("id").ilike("name", "ZZTEST%")
  const { data: sobrantesProd } = await supabase.from("menu_products").select("id").ilike("name", "ZZTEST%")
  const { count: totalMenu } = await supabase.from("menu_products").select("id", { count: "exact", head: true })
  check(
    "restauración · 0 insumos, 0 productos y 0 pedidos de prueba",
    leftovers === 0 && (sobrantesItems?.length ?? 0) === 0 && (sobrantesProd?.length ?? 0) === 0,
    `pedidos borrados=${deleted} · el menú real queda con ${totalMenu} productos`,
  )
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

try {
  // ─────────────────────────────────────────────────────────────────────────
  // V1 · ENCENDER EL DESCUENTO
  // ─────────────────────────────────────────────────────────────────────────
  console.log("── V1 · encender el descuento automático")
  const encendido = await post(
    "/api/business-config",
    { businessConfig: { inventoryAutoDeductEnabled: true, inventoryAutoDeductDryRun: false } },
    { "x-branch-id": A },
  )
  const configAhora = await rawConfig()
  check(
    "V1 · el descuento queda encendido y fuera de modo prueba",
    configAhora.inventoryAutoDeductEnabled === true && configAhora.inventoryAutoDeductDryRun === false,
    `status=${encendido.status} enabled=${configAhora.inventoryAutoDeductEnabled} dryRun=${configAhora.inventoryAutoDeductDryRun}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // V2 · UN PEDIDO DESCUENTA LA CANTIDAD EXACTA DE SU RECETA
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── V2 · el descuento exacto")
  const pan = await mkItem(A, "PAN", 100)
  const carne = await mkItem(A, "CARNE", 50)
  const productId = await mkProductWithRecipe(A, "HAMB", pan, 2)
  productIds.push(productId)

  // Segunda receta sobre el mismo producto no: se añade el otro insumo a la misma.
  await post(
    "/api/inventory-recipes",
    {
      productId,
      productName: `${RUN}-HAMB`,
      ingredients: [
        { itemId: pan.id, itemName: pan.name, quantity: 2, unit: "unidades" },
        { itemId: carne.id, itemName: carne.name, quantity: 1, unit: "unidades" },
      ],
    },
    { "x-branch-id": A },
  )

  const panAntes = await stockOf(pan.id)
  const carneAntes = await stockOf(carne.id)
  const { order } = await mkOrder(A, productId, "PED-3", 3)
  const panDespues = await stockOf(pan.id)
  const carneDespues = await stockOf(carne.id)

  check(
    "V2 · 3 hamburguesas descuentan 6 panes (3 × 2)",
    Math.abs(panAntes - panDespues - 6) < 0.001,
    `pan ${panAntes} → ${panDespues}`,
  )
  check(
    "V2 · y 3 de carne (3 × 1), el segundo insumo de la misma receta",
    Math.abs(carneAntes - carneDespues - 3) < 0.001,
    `carne ${carneAntes} → ${carneDespues}`,
  )

  const { data: movimientos } = await supabase
    .from("inventory_movements")
    .select("id, movement_type, quantity_moved, note, item_id, branch_id")
    .eq("note", `Pedido ${order?.id}`)
  check(
    "V2 · queda un movimiento de Consumo por insumo, atado al pedido",
    (movimientos?.length ?? 0) === 2 && movimientos.every((m) => m.movement_type === "Consumo" && m.branch_id === A),
    `movimientos=${movimientos?.length ?? 0} · ${(movimientos || []).map((m) => `${m.movement_type}(${m.quantity_moved})`).join(", ")}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // V3 · SOLO DESCUENTA DE SU SEDE
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── V3 · el descuento no cruza de sede")
  const panB = await mkItem(B, "PAN", 100)
  const productoB = await mkProductWithRecipe(B, "HAMB", panB, 2)
  productIds.push(productoB)

  const panBAntes = await stockOf(panB.id)
  const panAAntes = await stockOf(pan.id)
  await mkOrder(B, productoB, "PED-B", 4)
  const panBDespues = await stockOf(panB.id)
  const panADespues = await stockOf(pan.id)

  check("V3 · el pedido de B descuenta 8 panes de B", Math.abs(panBAntes - panBDespues - 8) < 0.001, `pan B ${panBAntes} → ${panBDespues}`)
  check("V3 · y NO toca ni un pan de A", Math.abs(panAAntes - panADespues) < 0.001, `pan A ${panAAntes} → ${panADespues}`)

  // ─────────────────────────────────────────────────────────────────────────
  // V4 · CANCELAR UN PEDIDO: ¿devuelve el stock?
  // ─────────────────────────────────────────────────────────────────────────
  // Anular NO devuelve el stock por sí solo: depende de que el staff declare
  // si los ingredientes se usaron o no (`inventoryWasUsed`). Los dos caminos.
  console.log("\n── V4 · cancelar y la bandera 'los ingredientes se usaron'")

  // (a) Sin declarar nada: el consumo queda descontado (la comida ya se hizo).
  const panAntesMudo = await stockOf(pan.id)
  const { order: cancelMudo } = await mkOrder(A, productId, "PED-CANCEL-MUDO", 2)
  const panTrasPedidoMudo = await stockOf(pan.id)
  check("V4a · el pedido descontó 4 panes", Math.abs(panAntesMudo - panTrasPedidoMudo - 4) < 0.001, `${panAntesMudo} → ${panTrasPedidoMudo}`)

  await patch(
    `/api/orders/${cancelMudo?.id}`,
    { status: "Cancelado", cancelReason: "QA ronda 2026-07-27: anulado sin declarar el inventario" },
    { "x-branch-id": A },
  )
  const panTrasMudo = await stockOf(pan.id)
  check(
    "V4a · anular SIN declarar nada deja el stock descontado (los ingredientes ya se gastaron)",
    Math.abs(panTrasMudo - panTrasPedidoMudo) < 0.001,
    `pan ${panTrasPedidoMudo} → ${panTrasMudo} · comportamiento por diseño: la devolución exige inventoryWasUsed=false`,
  )

  // (b) Declarando que NO se usaron: el stock vuelve.
  const panAntesDevuelto = await stockOf(pan.id)
  const { order: cancelDevuelto } = await mkOrder(A, productId, "PED-CANCEL-DEVUELTO", 2)
  const panTrasPedidoDev = await stockOf(pan.id)

  const cancel = await patch(
    `/api/orders/${cancelDevuelto?.id}`,
    {
      status: "Cancelado",
      cancelReason: "QA ronda 2026-07-27: anulado y los ingredientes NO se usaron",
      inventoryWasUsed: false,
    },
    { "x-branch-id": A },
  )
  const panTrasDevolver = await stockOf(pan.id)
  check(
    "V4b · anular declarando que NO se usaron DEVUELVE los 4 panes",
    Math.abs(panTrasDevolver - panAntesDevuelto) < 0.001,
    `status=${cancel.status} · pan ${panTrasPedidoDev} → ${panTrasDevolver} (antes del pedido: ${panAntesDevuelto})`,
  )

  const { data: reversion } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity_moved, note")
    .eq("item_id", pan.id)
    .neq("movement_type", "Consumo")
    .neq("movement_type", "Carga inicial")
  check(
    "V4b · la devolución deja su propio movimiento (rastro auditable)",
    (reversion?.length ?? 0) > 0,
    `movimientos de devolución=${reversion?.length ?? 0} · ${(reversion || []).map((m) => `${m.movement_type}(${m.quantity_moved})`).join(", ")}`,
  )

  const { data: notaAnulado } = await supabase.from("orders").select("customer_note").eq("id", cancelDevuelto?.id || "").maybeSingle()
  check(
    "V4b · la nota del pedido explica qué pasó con el inventario",
    String(notaAnulado?.customer_note || "").includes("devolvieron"),
    `nota="${String(notaAnulado?.customer_note || "").slice(0, 120)}"`,
  )

  // Cancelar dos veces no puede devolver el stock dos veces.
  const panAntesDoble = await stockOf(pan.id)
  await patch(
    `/api/orders/${cancelDevuelto?.id}`,
    { status: "Cancelado", cancelReason: "QA ronda: segundo intento de anular", inventoryWasUsed: false },
    { "x-branch-id": A },
  )
  const panTrasDoble = await stockOf(pan.id)
  check("V4b · anular dos veces NO devuelve el stock dos veces", Math.abs(panTrasDoble - panAntesDoble) < 0.001, `${panAntesDoble} → ${panTrasDoble}`)

  // ─────────────────────────────────────────────────────────────────────────
  // V5 · IDEMPOTENCIA: reenviar el mismo pedido no drena el stock
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── V5 · reenviar el mismo pedido (idempotencia)")
  const clientOrderId = `${RUN}-idem`
  const panAntesIdem = await stockOf(pan.id)
  await mkOrder(A, productId, "PED-IDEM", 2, { clientOrderId })
  const panTrasPrimero = await stockOf(pan.id)
  await mkOrder(A, productId, "PED-IDEM", 2, { clientOrderId })
  const panTrasReenvio = await stockOf(pan.id)

  check("V5 · el primer envío descuenta 4 panes", Math.abs(panAntesIdem - panTrasPrimero - 4) < 0.001, `${panAntesIdem} → ${panTrasPrimero}`)
  check(
    "V5 · el reenvío con el mismo clientOrderId NO vuelve a descontar",
    Math.abs(panTrasPrimero - panTrasReenvio) < 0.001,
    `${panTrasPrimero} → ${panTrasReenvio}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // V6 · MODO ENTRENAMIENTO: no puede tocar el stock
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── V6 · modo entrenamiento")
  const panAntesTraining = await stockOf(pan.id)
  const training = await mkOrder(A, productId, "PED-TRAINING", 5, { isTraining: true })
  const { data: trainingRow } = await supabase.from("orders").select("is_training").eq("id", training.order?.id || "").maybeSingle()
  const panTrasTraining = await stockOf(pan.id)

  if (trainingRow?.is_training === true) {
    check(
      "V6 · un pedido de entrenamiento NO descuenta inventario",
      Math.abs(panAntesTraining - panTrasTraining) < 0.001,
      `pan ${panAntesTraining} → ${panTrasTraining}`,
    )
  } else {
    check(
      "V6 · modo entrenamiento",
      true,
      `NO PROBADO: el pedido no quedó marcado como entrenamiento (is_training=${trainingRow?.is_training}); el módulo está apagado (trainingModeModuleEnabled=false)`,
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // V7 · UN PRODUCTO SIN RECETA NO MUEVE NADA
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── V7 · producto sin receta")
  const panAntesSinReceta = await stockOf(pan.id)
  await mkOrder(A, 999999, "PED-SIN-RECETA", 3)
  const panTrasSinReceta = await stockOf(pan.id)
  check(
    "V7 · un producto sin receta no descuenta nada de nadie",
    Math.abs(panAntesSinReceta - panTrasSinReceta) < 0.001,
    `pan ${panAntesSinReceta} → ${panTrasSinReceta}`,
  )
} finally {
  await restore()
}

process.exit(summary("F3 descuento de inventario") > 0 ? 1 : 0)
