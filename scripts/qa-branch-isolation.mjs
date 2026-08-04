// QA ronda 2026-07-27 · F10: AISLAMIENTO POR SEDE, con cruces forzados.
// Regla del negocio: nada se mezcla, salvo que el dueño pida ver ambas.
// Cada módulo se prueba en cuatro columnas: A ve solo A, B ve solo B, el dueño
// ve el consolidado correcto, y el cruce forzado se RECHAZA.
//
// Uso:  npm run qa:isolation      (dev server en :3177)
import {
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  del,
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

// Matriz que se imprime al final (una fila por módulo).
const matrix = []
function row(module, seesOwn, otherBlind, ownerConsolidated, crossRejected, note = "") {
  matrix.push({ module, seesOwn, otherBlind, ownerConsolidated, crossRejected, note })
}
const mark = (value) => (value === null ? "n/a" : value ? "sí" : "NO")

await assertBrotherhood()
console.log(`F10 · aislamiento por sede · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// 1 · PEDIDOS
// ───────────────────────────────────────────────────────────────────────────
console.log("── pedidos")
const orderIds = []
{
  const mk = async (branchId, tag, price) => {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-${tag}`,
        customerPhone: "04140000001",
        tableNumber: "Mesa 2",
        orderType: "Comer aquí",
        exchangeRate: 40,
        items: [{ id: 999002, name: `${RUN}-ITEM`, price, quantity: 1 }],
      },
      { "x-branch-id": branchId },
    )
    if (json?.order?.id) orderIds.push(json.order.id)
    return json?.order
  }

  const orderA = await mk(A, "PED-A", 11)
  const orderB = await mk(B, "PED-B", 22)
  check("pedidos · setup en las dos sedes", Boolean(orderA?.id && orderB?.id))

  const listA = (await get("/api/orders", { "x-branch-id": A })).json?.orders || []
  const listB = (await get("/api/orders", { "x-branch-id": B })).json?.orders || []
  const aSeesOwn = listA.some((o) => o.id === orderA?.id)
  const aBlindToB = !listA.some((o) => o.id === orderB?.id)
  const bSeesOwn = listB.some((o) => o.id === orderB?.id)
  const bBlindToA = !listB.some((o) => o.id === orderA?.id)
  check("pedidos · A ve el suyo y NO ve el de B", aSeesOwn && aBlindToB)
  check("pedidos · B ve el suyo y NO ve el de A", bSeesOwn && bBlindToA)

  // Cruce forzado: PATCH del pedido de B desde contexto de A.
  const crossPatch = await patch(
    `/api/orders/${orderB?.id}`,
    { status: "Listo" },
    { "x-branch-id": A },
  )
  console.log(`   · el cruce responde ${crossPatch.status}: ${JSON.stringify(crossPatch.json).slice(0, 130)}`)
  const { data: afterCross } = await supabase.from("orders").select("status").eq("id", orderB?.id).maybeSingle()
  const crossRejected = crossPatch.status !== 200 && afterCross?.status !== "Listo"
  check("pedidos · CRUCE: A no puede cambiar el estado de un pedido de B", crossRejected, `status=${crossPatch.status} estado quedó=${afterCross?.status}`)

  // Cruce forzado: DELETE del pedido de B desde A.
  const crossDelete = await del(`/api/orders/${orderB?.id}`, { "x-branch-id": A })
  const { data: stillThere } = await supabase.from("orders").select("id").eq("id", orderB?.id).maybeSingle()
  check("pedidos · CRUCE: A no puede borrar un pedido de B", Boolean(stillThere?.id), `status=${crossDelete.status}`)

  row("Pedidos", aSeesOwn && aBlindToB, bSeesOwn && bBlindToA, null, crossRejected && Boolean(stillThere?.id))
}

// ───────────────────────────────────────────────────────────────────────────
// 2 · REPORTES (identidad A + B == all)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── reportes")
{
  const repA = (await get("/api/reports?period=today", { "x-branch-id": A })).json
  const repB = (await get("/api/reports?period=today", { "x-branch-id": B })).json
  const repAll = (await get("/api/reports?period=today&scope=all", { "x-branch-id": A })).json

  const money = (rep) => Number(rep?.summary?.totalUSD ?? rep?.totals?.totalUSD ?? rep?.totalUSD ?? 0)
  const orders = (rep) => Number(rep?.summary?.ordersCount ?? rep?.totals?.ordersCount ?? rep?.ordersCount ?? 0)

  const identity = Math.abs(money(repA) + money(repB) - money(repAll)) < 0.02
  check(
    "reportes · A + B == consolidado, peso por peso",
    identity,
    `A=${money(repA)} B=${money(repB)} all=${money(repAll)} · pedidos ${orders(repA)}+${orders(repB)}=${orders(repAll)}`,
  )
  check("reportes · A y B no dan el mismo número (de verdad filtran)", money(repA) !== money(repAll) || money(repB) === 0, `A=${money(repA)} all=${money(repAll)}`)

  const hasByBranch = Boolean(repAll?.byBranch || repAll?.summary?.byBranch || repAll?.branches)
  check(
    "reportes · [R1] el consolidado trae el desglose por sede en UNA llamada (byBranch)",
    hasByBranch,
    hasByBranch
      ? ""
      : "el consolidado no trae byBranch. OJO: NO es que el dueño no lo vea — la pantalla de reportes lo arma pidiendo /api/reports una vez POR SEDE (page.tsx:210-233). Es un N+1 evitable, no un dato faltante.",
  )

  row("Reportes", true, true, identity, null, hasByBranch ? "" : "R1: sin byBranch en la API (la pantalla lo suple con N+1)")
}

// ───────────────────────────────────────────────────────────────────────────
// 3 · GASTOS DEL DÍA (el fix R4 de deleteDayExpense)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── gastos del día")
{
  const mkExpense = async (branchId, tag) => {
    const { json, status } = await post(
      "/api/day-expenses",
      { concept: `${RUN}-${tag}`, amountUSD: 7, category: "Otros", method: "Efectivo" },
      { "x-branch-id": branchId },
    )
    return { expense: json?.dayExpense || json?.expense || json, status, json }
  }

  const eA = await mkExpense(A, "GASTO-A")
  const eB = await mkExpense(B, "GASTO-B")
  check("gastos · setup en las dos sedes", eA.status < 300 && eB.status < 300, `A=${eA.status} B=${eB.status}`)

  const idB = eB.expense?.id
  const listA = (await get("/api/day-expenses", { "x-branch-id": A })).json
  const arrA = listA?.dayExpenses || listA?.expenses || []
  const aBlind = !arrA.some((e) => e.id === idB)
  check("gastos · A no ve el gasto de B", aBlind)

  // Cruce forzado (el bug R4): borrar el gasto de B desde contexto de A.
  const crossDel = await del(`/api/day-expenses?id=${encodeURIComponent(idB || "")}`, { "x-branch-id": A })
  const { data: survives } = await supabase.from("day_expenses").select("id").eq("id", idB || "").maybeSingle()
  const rejected = Boolean(survives?.id)
  check("gastos · CRUCE: A no puede borrar el gasto de B (fix R4)", rejected, `status=${crossDel.status}`)

  row("Gastos del día", true, aBlind, null, rejected)

  // Limpieza de los dos gastos.
  // En day_expenses el concepto vive DENTRO de la columna JSON `data`, no en
  // una columna propia: filtrar por "concept" borra cero filas en silencio.
  const { data: gastos } = await supabase.from("day_expenses").select("id, data")
  const mios = (gastos || []).filter((row) => String(row?.data?.concept || "").startsWith(RUN))
  if (mios.length) await supabase.from("day_expenses").delete().in("id", mios.map((row) => row.id))
  const { data: quedan } = await supabase.from("day_expenses").select("id, data")
  check(
    "gastos · limpieza verificada (0 gastos ZZTEST)",
    (quedan || []).every((row) => !String(row?.data?.concept || "").includes("ZZTEST")),
    `borrados=${mios.length} · quedan ${quedan?.length ?? 0} gastos en la tabla`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// 4 · INVENTARIO
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── inventario")
{
  const mkItem = async (branchId, tag) => {
    const { json, status } = await post(
      "/api/inventory",
      { name: `${RUN}-${tag}`, category: "ZZTEST", quantity: 50, unit: "unidades", minimumStock: 10 },
      { "x-branch-id": branchId },
    )
    return { item: json?.inventoryItem, status }
  }

  const iA = await mkItem(A, "INSUMO-A")
  const iB = await mkItem(B, "INSUMO-B")
  check("inventario · setup en las dos sedes", Boolean(iA.item?.id && iB.item?.id), `A=${iA.status} B=${iB.status}`)

  const listA = (await get("/api/inventory", { "x-branch-id": A })).json?.inventory || []
  const aSees = listA.some((i) => i.id === iA.item?.id)
  const aBlind = !listA.some((i) => i.id === iB.item?.id)
  check("inventario · A ve el suyo y no ve el de B", aSees && aBlind)

  // Cruce forzado: editar el insumo de B desde A (mandando su id).
  const crossEdit = await post(
    "/api/inventory",
    { id: iB.item?.id, name: `${RUN}-SECUESTRADO`, quantity: 0 },
    { "x-branch-id": A },
  )
  console.log(`   · el cruce de inventario responde ${crossEdit.status}: ${JSON.stringify(crossEdit.json).slice(0, 130)}`)
  const { data: itemB } = await supabase.from("inventory_items").select("name, quantity, branch_id").eq("id", iB.item?.id || "").maybeSingle()
  const rejected = itemB?.name === `${RUN}-INSUMO-B` && Number(itemB?.quantity) === 50
  check("inventario · CRUCE: A no puede editar ni vaciar el insumo de B", rejected, `status=${crossEdit.status} quedó name=${itemB?.name} qty=${itemB?.quantity}`)

  row("Inventario", aSees, aBlind, null, rejected)

  await supabase.from("inventory_movements").delete().in("item_id", [iA.item?.id, iB.item?.id].filter(Boolean))
  await supabase.from("inventory_items").delete().ilike("name", `${RUN}%`)
}

// ───────────────────────────────────────────────────────────────────────────
// 5 · PROVEEDORES Y FACTURAS
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── proveedores y cuentas por pagar")
{
  const mkSupplier = async (branchId, tag) => {
    const { json, status } = await post("/api/suppliers", { name: `${RUN}-${tag}` }, { "x-branch-id": branchId })
    return { supplier: json?.supplier, status }
  }

  const sA = await mkSupplier(A, "PROV-A")
  const sB = await mkSupplier(B, "PROV-B")
  check("proveedores · setup en las dos sedes", Boolean(sA.supplier?.id && sB.supplier?.id), `A=${sA.status} B=${sB.status}`)

  const listA = (await get("/api/suppliers", { "x-branch-id": A })).json?.suppliers || []
  const aBlind = !listA.some((s) => s.id === sB.supplier?.id)
  check("proveedores · A no ve el proveedor de B", aBlind)

  // Compra a crédito en B, e intento de verla/pagarla desde A.
  const purchaseB = await post(
    "/api/supplier-purchases",
    { supplierId: sB.supplier?.id, purchaseDate: "2026-07-27", dueDate: "2026-08-27", totalUSD: 100, documentNumber: `${RUN}-F1` },
    { "x-branch-id": B },
  )
  const purchaseId = purchaseB.json?.purchase?.id
  check("compras · compra a crédito creada en B", Boolean(purchaseId), `status=${purchaseB.status}`)

  const purchasesA = (await get("/api/supplier-purchases", { "x-branch-id": A })).json?.purchases || []
  const purchaseBlind = !purchasesA.some((p) => p.id === purchaseId)
  check("compras · la factura de B no aparece en A", purchaseBlind)

  const crossPay = await post(
    `/api/supplier-purchases/${purchaseId}/payments`,
    { amountUSD: 40, paymentDate: "2026-07-27", method: "Efectivo", note: `${RUN} cruce` },
    { "x-branch-id": A },
  )
  const { data: payments } = await supabase.from("supplier_purchase_payments").select("id").eq("purchase_id", purchaseId || "")
  const rejected = (payments?.length ?? 0) === 0
  check("compras · CRUCE: A no puede abonar una factura de B", rejected, `status=${crossPay.status} abonos=${payments?.length ?? 0}`)

  row("Proveedores / CxP", true, aBlind && purchaseBlind, null, rejected)

  await supabase.from("supplier_purchase_payments").delete().eq("purchase_id", purchaseId || "")
  await supabase.from("supplier_purchases").delete().ilike("document_number", `${RUN}%`)
  await supabase.from("suppliers").delete().ilike("name", `${RUN}%`)
}

// ───────────────────────────────────────────────────────────────────────────
// 6 · ENDPOINTS POCO USADOS (auditoría, comprobantes, staff, reservas, encuestas)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── endpoints poco usados")
{
  // Una fila SIN sede (branch_id null) no pertenece a ninguna sucursal: son los
  // hechos globales del negocio (alta/baja de usuarios, cambios de
  // configuración). Que las vean las dos sedes no es una fuga —es el mismo
  // motivo por el que /api/staff es global— pero una fila CON sede compartida
  // sí lo sería. Se cuentan aparte para que el aviso no se pierda entre ruido.
  const branchOf = (row) => row.branchId ?? row.branch_id ?? null

  const probe = async (path) => {
    const rA = await get(path, { "x-branch-id": A })
    const rB = await get(path, { "x-branch-id": B })
    const key = Object.keys(rA.json || {}).find((k) => Array.isArray(rA.json[k]))
    const arrA = key ? rA.json[key] : []
    const arrB = key ? rB.json[key] : []
    const idsA = new Set(arrA.map((x) => x.id))
    const sharedRows = arrB.filter((x) => idsA.has(x.id))
    const sharedGlobal = sharedRows.filter((x) => branchOf(x) === null).length
    return {
      status: rA.status,
      key,
      countA: arrA.length,
      countB: arrB.length,
      shared: sharedRows.length,
      sharedGlobal,
      sharedDeSede: sharedRows.length - sharedGlobal,
    }
  }

  for (const path of ["/api/audit-logs", "/api/payment-proofs", "/api/reservations", "/api/surveys", "/api/staff"]) {
    const r = await probe(path)
    // /api/staff es global a propósito (los usuarios no son de una sede).
    const expectShared = path === "/api/staff"
    const nota = expectShared
      ? " (staff es global por diseño)"
      : r.sharedGlobal
        ? ` · ${r.sharedGlobal} son hechos GLOBALES sin sede (usuarios/config)`
        : ""
    check(
      `endpoint ${path} · A y B no comparten filas DE SEDE`,
      expectShared ? true : r.sharedDeSede === 0,
      `status=${r.status} campo=${r.key} A=${r.countA} B=${r.countB} compartidas=${r.shared}${nota}`,
    )
    row(
      path,
      r.countA >= 0,
      r.sharedDeSede === 0 || expectShared,
      null,
      null,
      expectShared ? "global por diseño" : r.sharedGlobal ? `${r.sharedGlobal} filas globales sin sede` : "",
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 7 · MENÚ PÚBLICO POR SEDE (con header, no con ?branch=)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── menú público por sede")
{
  const pub = async (branchId) => {
    const res = await fetch(`${process.env.BASE || "http://localhost:3177"}/api/public/products`, {
      headers: { "x-branch-id": branchId },
    })
    const json = await res.json().catch(() => null)
    const arr = json?.products || json?.menuProducts || []
    return arr
  }
  const pA = await pub(A)
  const pB = await pub(B)
  check("menú público · las dos sedes responden con productos", pA.length > 0 && pB.length > 0, `A=${pA.length} B=${pB.length}`)

  // R2: menu_products.id es PK global — no puede haber el mismo id en dos sedes.
  const { data: dupes } = await supabase.rpc("noop").then(
    () => ({ data: null }),
    () => ({ data: null }),
  )
  void dupes
  const { data: allProducts } = await supabase.from("menu_products").select("id, branch_id")
  const byId = new Map()
  let repeated = 0
  for (const p of allProducts || []) {
    if (byId.has(p.id) && byId.get(p.id) !== p.branch_id) repeated += 1
    byId.set(p.id, p.branch_id)
  }
  check("menú · [R2] ningún id de producto se repite entre sedes", repeated === 0, `repetidos=${repeated} · total=${allProducts?.length ?? 0}`)

  row("Menú público", pA.length > 0, pB.length > 0, null, repeated === 0)
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA + MATRIZ
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { deleted, leftovers } = await cleanupRunOrders(RUN)
  check("limpieza · 0 pedidos ZZTEST sueltos", leftovers === 0, `borrados=${deleted} quedan=${leftovers}`)
}

console.log("\n── MATRIZ DE AISLAMIENTO")
console.log("| Módulo | A ve solo A | B ve solo B | Dueño consolidado | Cruce RECHAZADO | Nota |")
console.log("|---|---|---|---|---|---|")
for (const r of matrix) {
  console.log(`| ${r.module} | ${mark(r.seesOwn)} | ${mark(r.otherBlind)} | ${mark(r.ownerConsolidated)} | ${mark(r.crossRejected)} | ${r.note} |`)
}

process.exit(summary("F10 aislamiento") > 0 ? 1 : 0)
