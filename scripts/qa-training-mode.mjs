// QA ronda 2026-07-27 · MODO ENTRENAMIENTO, con el módulo encendido de verdad.
//
// El módulo vive apagado (trainingModeModuleEnabled=false), así que un pedido
// marcado isTraining NO quedaba marcado y descontaba normal. Este script lo
// enciende, lo prueba junto con el descuento de inventario (que es donde de
// verdad importa que un pedido de práctica no toque nada) y devuelve las
// banderas EXACTAMENTE a como estaban, también si algo revienta a mitad.
//
// Ojo: mientras el modo está activo, CUALQUIER pedido nuevo nace como
// práctica — lo decide el servidor, no el cliente. La ventana es de segundos.
//
// Uso:  npm run qa:training      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  get,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO

async function rawConfig() {
  const { data } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  return data?.config || {}
}

const setFlags = (flags) => post("/api/business-config", { businessConfig: flags }, { "x-branch-id": A })

async function stockOf(itemId) {
  const { data } = await supabase.from("inventory_items").select("quantity").eq("id", itemId).maybeSingle()
  return Number(data?.quantity ?? NaN)
}

async function orderRow(id) {
  const { data } = await supabase
    .from("orders")
    .select("id, is_training, branch_seq, branch_code, total_usd, status")
    .eq("id", id)
    .maybeSingle()
  return data
}

async function mkOrder(productId, tag, cantidad, extra = {}) {
  const { json } = await postOrderThrottled(
    {
      customerName: `${RUN}-${tag}`,
      customerPhone: "04140000040",
      tableNumber: "Mesa 2",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: productId, name: `${RUN}-PROD`, price: 25, quantity: cantidad }],
      ...extra,
    },
    { "x-branch-id": A },
  )
  return json?.order
}

await assertBrotherhood()
console.log(`Modo entrenamiento · run=${RUN}\n`)

const configOriginal = await rawConfig()
const flagsOriginales = {
  trainingModeModuleEnabled: configOriginal.trainingModeModuleEnabled,
  trainingModeActive: configOriginal.trainingModeActive,
  inventoryAutoDeductEnabled: configOriginal.inventoryAutoDeductEnabled,
  inventoryAutoDeductDryRun: configOriginal.inventoryAutoDeductDryRun,
}
console.log(`config original: ${JSON.stringify(flagsOriginales)}\n`)

// T6 ejecuta un cierre real para comprobar que el modo apagado lo desbloquea,
// y el cierre borra los comprobantes de la sede: fotografía previa para poder
// devolverlos.
const { data: proofsAntes } = await supabase.from("payment_proofs").select("*").eq("branch_id", A)
const { data: closesAntes } = await supabase.from("day_closes").select("id")
const closeIdsAntes = new Set((closesAntes || []).map((row) => row.id))
console.log(`fotografía previa · comprobantes en la sede=${proofsAntes?.length ?? 0} · cierres=${closesAntes?.length ?? 0}\n`)

const productIds = []
let restored = false

async function restore() {
  if (restored) return
  restored = true
  console.log("\n── devolviendo la configuración y limpiando")

  const saved = await setFlags(flagsOriginales)
  const ahora = await rawConfig()
  check(
    "restauración · las 4 banderas vuelven EXACTAMENTE a como estaban",
    Object.entries(flagsOriginales).every(([key, value]) => ahora[key] === value),
    `status=${saved.status} · ahora=${JSON.stringify(
      Object.fromEntries(Object.keys(flagsOriginales).map((key) => [key, ahora[key]])),
    )}`,
  )

  const clavesAntes = Object.keys(configOriginal).filter((key) => key !== "updatedAt")
  const perdidas = clavesAntes.filter((key) => !(key in ahora))
  check("restauración · no se perdió ninguna otra clave de la configuración", perdidas.length === 0, `claves=${Object.keys(ahora).length} perdidas=${JSON.stringify(perdidas)}`)

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

  const { data: entrenamientoSuelto } = await supabase.from("orders").select("id").eq("is_training", true)
  check(
    "restauración · 0 pedidos de prueba y 0 pedidos de entrenamiento sueltos",
    leftovers === 0 && (entrenamientoSuelto?.length ?? 0) === 0,
    `borrados=${deleted} · pedidos con is_training=true en la BD: ${entrenamientoSuelto?.length ?? 0}`,
  )

  // Los cierres que creó la prueba salen del historial.
  const { data: closesAhora } = await supabase.from("day_closes").select("id")
  const mios = (closesAhora || []).map((row) => row.id).filter((id) => !closeIdsAntes.has(id))
  if (mios.length) await supabase.from("day_closes").delete().in("id", mios)

  // Y los comprobantes que el cierre de comprobación borró, vuelven.
  const { data: proofsAhora } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const vivos = new Set((proofsAhora || []).map((row) => row.id))
  const aRestaurar = (proofsAntes || []).filter((row) => !vivos.has(row.id))
  if (aRestaurar.length) await supabase.from("payment_proofs").insert(aRestaurar)

  const { data: proofsFinal } = await supabase.from("payment_proofs").select("id").eq("branch_id", A)
  const { data: closesFinal } = await supabase.from("day_closes").select("id")
  check(
    "restauración · comprobantes e historial de cierres vuelven a su número original",
    (proofsFinal?.length ?? 0) === (proofsAntes?.length ?? 0) && (closesFinal?.length ?? 0) === (closesAntes?.length ?? 0),
    `comprobantes ${proofsAntes?.length ?? 0}→${proofsFinal?.length ?? 0} · cierres ${closesAntes?.length ?? 0}→${closesFinal?.length ?? 0} (restaurados ${aRestaurar.length}, borrados ${mios.length})`,
  )
}

process.on("uncaughtException", async (error) => {
  console.error("\n✗ excepción:", error?.message)
  await restore()
  process.exit(1)
})

try {
  // ─────────────────────────────────────────────────────────────────────────
  // T1 · CON EL MÓDULO APAGADO, LA MARCA DEL CLIENTE NO VALE
  // ─────────────────────────────────────────────────────────────────────────
  console.log("── T1 · el módulo apagado: la marca del cliente se ignora")
  await setFlags({ trainingModeModuleEnabled: false, trainingModeActive: false })

  const falso = await mkOrder(999040, "FALSO-TRAINING", 1, { isTraining: true })
  const filaFalso = await orderRow(falso?.id)
  check(
    "T1 · un cliente que manda isTraining:true NO consigue un pedido de práctica",
    filaFalso?.is_training !== true,
    `is_training=${filaFalso?.is_training} · lo decide el servidor por config, no el cliente`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // T2 · ENCENDER EL MÓDULO Y EL MODO
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── T2 · encender el módulo y activar el modo")
  const encendido = await setFlags({
    trainingModeModuleEnabled: true,
    trainingModeActive: true,
    inventoryAutoDeductEnabled: true,
    inventoryAutoDeductDryRun: false,
  })
  const cfg = await rawConfig()
  check(
    "T2 · módulo encendido, modo activo y descuento de inventario encendido",
    cfg.trainingModeModuleEnabled === true && cfg.trainingModeActive === true && cfg.inventoryAutoDeductEnabled === true,
    `status=${encendido.status} módulo=${cfg.trainingModeModuleEnabled} activo=${cfg.trainingModeActive} descuento=${cfg.inventoryAutoDeductEnabled}`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // T3 · MONTAR RECETA Y COMPARAR: PRÁCTICA vs REAL
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── T3 · un pedido de práctica no toca nada")
  const { json: itemJson } = await post(
    "/api/inventory",
    { name: `${RUN}-PAN`, category: "ZZTEST", quantity: 100, unit: "unidades", minimumStock: 5, costUSD: 1 },
    { "x-branch-id": A },
  )
  const pan = itemJson?.inventoryItem
  const productId = Date.now()
  productIds.push(productId)
  await post(
    "/api/menu-products",
    { id: productId, name: `${RUN}-HAMB`, category: "ZZTEST", price: 25, isActive: true, inventoryDiscountEnabled: true },
    { "x-branch-id": A },
  )
  await post(
    "/api/inventory-recipes",
    {
      productId,
      productName: `${RUN}-HAMB`,
      ingredients: [{ itemId: pan.id, itemName: pan.name, quantity: 2, unit: "unidades" }],
    },
    { "x-branch-id": A },
  )
  check("T3 setup · insumo con 100 y receta de 2 por unidad", Number(pan?.quantity) === 100)

  const reporteAntes = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  const stockAntes = await stockOf(pan.id)
  const { data: seqAntes } = await supabase.from("order_branch_counters").select("last_seq").eq("branch_key", A).maybeSingle()

  const practica = await mkOrder(productId, "PRACTICA", 3)
  const filaPractica = await orderRow(practica?.id)
  const stockDespues = await stockOf(pan.id)
  const reporteDespues = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}

  check(
    "T3 · con el modo activo, el pedido nace marcado como práctica",
    filaPractica?.is_training === true,
    `is_training=${filaPractica?.is_training}`,
  )
  check(
    "T3 · el pedido de práctica NO descuenta inventario (con el descuento encendido)",
    Math.abs(stockAntes - stockDespues) < 0.001,
    `pan ${stockAntes} → ${stockDespues} · un pedido real habría descontado 6`,
  )
  check(
    "T3 · no deja movimiento de consumo",
    ((await supabase.from("inventory_movements").select("id").eq("note", `Pedido ${practica?.id}`)).data?.length ?? 0) === 0,
  )
  check(
    "T3 · el pedido de práctica NO suma en los reportes",
    Math.abs(Number(reporteDespues.totalUSD || 0) - Number(reporteAntes.totalUSD || 0)) < 0.02,
    `reporte $${reporteAntes.totalUSD} → $${reporteDespues.totalUSD} · el pedido valía $75`,
  )
  check(
    "T3 · tampoco suma al número de pedidos del reporte",
    Number(reporteDespues.orders || 0) === Number(reporteAntes.orders || 0),
    `pedidos ${reporteAntes.orders} → ${reporteDespues.orders}`,
  )

  const { data: seqDespues } = await supabase.from("order_branch_counters").select("last_seq").eq("branch_key", A).maybeSingle()
  check(
    "T3 · el correlativo de la sede: qué le hace un pedido de práctica",
    true,
    `last_seq ${seqAntes?.last_seq} → ${seqDespues?.last_seq}${
      Number(seqDespues?.last_seq) > Number(seqAntes?.last_seq)
        ? " · SÍ consume número real: practicar adelanta la numeración que ve el dueño"
        : " · no consume número"
    }`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // T4 · EL PANEL ES UN SANDBOX: solo se ven los de práctica
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── T4 · el panel separa práctica de operación real")
  const panelEnPractica = (await get("/api/orders", { "x-branch-id": A })).json?.orders || []
  check(
    "T4 · con el modo activo el panel muestra SOLO los pedidos de práctica",
    panelEnPractica.length > 0 && panelEnPractica.every((order) => order.isTraining === true),
    `${panelEnPractica.length} pedidos, todos de práctica: ${panelEnPractica.every((o) => o.isTraining === true)}`,
  )
  check(
    "T4 · y el de práctica que acabo de crear está ahí",
    panelEnPractica.some((order) => order.id === practica?.id),
  )

  // ─────────────────────────────────────────────────────────────────────────
  // T5 · EL CIERRE DEL DÍA SE BLOQUEA MIENTRAS SE PRACTICA
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── T5 · cerrar el día mientras se practica")
  const cierre = await post(
    "/api/day-close",
    { dayClose: { dateLabel: "27/07/2026", summaryText: `${RUN} · cierre durante entrenamiento` } },
    { "x-branch-id": A },
  )
  check(
    "T5 · el cierre del día se RECHAZA con el modo activo (409)",
    cierre.status === 409,
    `status=${cierre.status} · "${String(cierre.json?.error || "").slice(0, 90)}"`,
  )

  // ─────────────────────────────────────────────────────────────────────────
  // T6 · APAGAR EL MODO: todo vuelve a la operación real
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n── T6 · apagar el modo y volver a la operación real")
  await setFlags({ trainingModeActive: false })

  const panelReal = (await get("/api/orders", { "x-branch-id": A })).json?.orders || []
  check(
    "T6 · el panel deja de ver los de práctica y vuelve a los reales",
    !panelReal.some((order) => order.id === practica?.id),
    `${panelReal.length} pedidos reales · ¿asoma el de práctica? ${panelReal.some((o) => o.id === practica?.id)}`,
  )

  const stockAntesReal = await stockOf(pan.id)
  const real = await mkOrder(productId, "REAL", 3)
  const filaReal = await orderRow(real?.id)
  const stockDespuesReal = await stockOf(pan.id)
  const reporteFinal = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}

  check("T6 · el pedido nuevo ya NO es de práctica", filaReal?.is_training !== true, `is_training=${filaReal?.is_training}`)
  check(
    "T6 · y ahora sí descuenta las 6 unidades",
    Math.abs(stockAntesReal - stockDespuesReal - 6) < 0.001,
    `pan ${stockAntesReal} → ${stockDespuesReal}`,
  )
  check(
    "T6 · y sí suma en el reporte ($75)",
    Math.abs(Number(reporteFinal.totalUSD || 0) - Number(reporteDespues.totalUSD || 0) - 75) < 0.02,
    `reporte $${reporteDespues.totalUSD} → $${reporteFinal.totalUSD}`,
  )

  const cierreLibre = await post(
    "/api/day-close",
    { dayClose: { dateLabel: "27/07/2026", summaryText: `${RUN} · comprobar desbloqueo` } },
    { "x-branch-id": A },
  )
  check(
    "T6 · con el modo apagado el cierre vuelve a estar permitido",
    cierreLibre.status !== 409,
    `status=${cierreLibre.status}`,
  )
  // Ese cierre de comprobación sale del historial en el acto.
  if (cierreLibre.json?.dayClose?.id) {
    await supabase.from("day_closes").delete().eq("id", cierreLibre.json.dayClose.id)
    console.log(`   · cierre de comprobación borrado del historial (${cierreLibre.json.dayClose.id})`)
  }
} finally {
  await restore()
}

process.exit(summary("Modo entrenamiento") > 0 ? 1 : 0)
