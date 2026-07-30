// QA ronda 2026-07-30 · USUARIOS REALES + MATRIZ DE PERMISOS POR ROL.
// Crea un usuario de staff POR CADA ROL (Supabase Auth de verdad), inicia
// sesión con cada uno y verifica contra la API (vía el proxy, como lo haría
// la app) que cada rol puede EXACTAMENTE lo suyo y nada más:
//   U1 · ciclo de vida: validaciones de creación (clave corta, rol inválido,
//        usuario duplicado) y listado del dueño.
//   U2 · sesiones reales; la clave errada no abre sesión.
//   U3 · matriz de módulos: 12 puertas × 6 roles (auditoría, staff,
//        proveedores, compras, inventario, reportes, consolidado, cierres,
//        gastos, menú, pedidos, configuración).
//   U4 · estados y cobros: cocina avanza pero no cancela ni cobra; el
//        mesonero solo entrega lo LISTO y no cobra; delivery no toca estados
//        de mesa; el promotor entrega pero no cancela; caja cobra.
//   U5 · aislamiento: el cajero de una sede no ve ni toca la otra.
//   U6 · permisos CUSTOM: recortar módulos a un usuario cierra la puerta que
//        su rol tenía abierta; restaurar el modo rol la reabre.
//   U7 · desactivación: is_active=false (PATCH y DELETE soft) mata el acceso
//        del token al instante.
//
// Requisitos: dev server FRESCO en :3177 y `npm run backup` corrido antes.
// Uso:  npm run qa:usuarios
import { createClient } from "@supabase/supabase-js"
import {
  BASE,
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  env,
  get,
  post,
  patch,
  del,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const B = BRANCH_VINEDO
const PASSWORD = "ZZtest2026!"
const ROLES = ["manager", "cashier", "kitchen", "waiter", "delivery", "promoter"]

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const staffCreated = []
const users = {} // role -> { staff, token, username }

async function createStaff(role, branchId, tag, extra = {}) {
  const username = `zztest-${tag}-${Date.now()}`.toLowerCase()
  const { json, status } = await post(
    "/api/staff",
    {
      username,
      password: PASSWORD,
      role,
      fullName: `${RUN} ${tag}`,
      allBranches: false,
      allowedBranchIds: [branchId],
      ...extra,
    },
    { "x-branch-id": branchId },
  )
  if (json?.staff?.id) staffCreated.push(json.staff.id)
  return { staff: json?.staff, status, username, error: json?.error }
}

async function sessionFor(staff, password = PASSWORD) {
  const { data, error } = await anon.auth.signInWithPassword({ email: staff.email, password })
  return { token: data?.session?.access_token || "", error: error?.message || "" }
}

async function asStaff(token, method, path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-branch-id": A,
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, json }
}

async function orderStatus(orderId) {
  const { data } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle()
  return data?.status || "?"
}

await assertBrotherhood()
console.log(`Usuarios reales + matriz de permisos · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// U1 · CICLO DE VIDA DE USUARIOS
// ───────────────────────────────────────────────────────────────────────────
console.log("── U1 · creación y validaciones")
{
  const short = await createStaff("cashier", A, "clave-corta", { password: "123" })
  check("U1 · clave de 3 caracteres se rechaza (400)", short.status === 400, `status=${short.status} "${short.error}"`)

  const badRole = await createStaff("hacker", A, "rol-invalido")
  check("U1 · rol inexistente se rechaza (400)", badRole.status === 400, `status=${badRole.status} "${badRole.error}"`)

  for (const role of ROLES) {
    const created = await createStaff(role, A, role)
    users[role] = created
    check(`U1 · ${role} creado en San Diego`, created.status === 201 || created.status === 200, `status=${created.status} ${created.error || ""}`)
  }

  const dup = await post(
    "/api/staff",
    { username: users.cashier.username, password: PASSWORD, role: "cashier", fullName: `${RUN} dup` },
    { "x-branch-id": A },
  )
  check("U1 · usuario duplicado se rechaza", dup.status === 400, `status=${dup.status} "${dup.json?.error}"`)

  const list = await get("/api/staff", { "x-branch-id": A })
  const names = JSON.stringify(list.json || {})
  const allListed = ROLES.every((role) => names.includes(users[role].username))
  check("U1 · el dueño ve los 6 en la lista de usuarios", list.status === 200 && allListed, `status=${list.status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// U2 · SESIONES REALES
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U2 · sesiones")
{
  for (const role of ROLES) {
    const session = await sessionFor(users[role].staff)
    users[role].token = session.token
    check(`U2 · ${role} abre sesión real`, Boolean(session.token), session.error)
  }

  const wrong = await sessionFor(users.cashier.staff, "clave-equivocada-123")
  check("U2 · la clave errada NO abre sesión", !wrong.token, wrong.error)
}

if (ROLES.some((role) => !users[role].token)) {
  console.log("\n⚠ Sin todas las sesiones no tiene sentido la matriz. Limpieza y salida.")
  for (const id of staffCreated) await supabase.auth.admin.deleteUser(id).catch(() => {})
  await supabase.from("staff_users").delete().in("id", staffCreated.length ? staffCreated : ["-"])
  process.exit(1)
}

// ───────────────────────────────────────────────────────────────────────────
// U3 · MATRIZ DE MÓDULOS (12 puertas × 6 roles)
// Cada puerta declara qué roles la pasan; el resto debe recibir 401/403.
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U3 · matriz de módulos")
{
  const PROBES = [
    { name: "auditoría (GET /api/audit-logs)", method: "GET", path: "/api/audit-logs", allow: [] },
    { name: "usuarios (GET /api/staff)", method: "GET", path: "/api/staff", allow: [] },
    { name: "crear usuario (POST /api/staff)", method: "POST", path: "/api/staff", body: { username: "zztest-nope", password: PASSWORD, role: "cashier" }, allow: [] },
    { name: "proveedores (GET /api/suppliers)", method: "GET", path: "/api/suppliers", allow: [] },
    { name: "registrar compra (POST /api/supplier-purchases)", method: "POST", path: "/api/supplier-purchases", body: {}, allow: [] },
    { name: "inventario (GET /api/inventory)", method: "GET", path: "/api/inventory", allow: [] },
    { name: "reportes de la sede (GET /api/reports)", method: "GET", path: "/api/reports?period=today", allow: ["manager"] },
    { name: "consolidado (GET /api/reports&scope=all)", method: "GET", path: "/api/reports?period=today&scope=all", allow: [] },
    { name: "historial de cierres (GET /api/day-closes)", method: "GET", path: "/api/day-closes", allow: ["manager"] },
    { name: "gastos del día (GET /api/day-expenses)", method: "GET", path: "/api/day-expenses", allow: ["manager"] },
    { name: "menú staff (GET /api/menu-products)", method: "GET", path: "/api/menu-products", allow: [] },
    // La config se guarda por POST (no hay PATCH: probarlo da 405 y no dice nada).
    { name: "configuración (POST /api/business-config)", method: "POST", path: "/api/business-config", body: {}, allow: [] },
  ]

  for (const probe of PROBES) {
    const results = []
    let allOk = true
    for (const role of ROLES) {
      const { status } = await asStaff(users[role].token, probe.method, probe.path, probe.body)
      const shouldPass = probe.allow.includes(role)
      const passed = shouldPass ? status === 200 || status === 201 : status === 401 || status === 403
      if (!passed) allOk = false
      results.push(`${role}=${status}${passed ? "" : "✗"}`)
    }
    const allowText = probe.allow.length ? `solo ${probe.allow.join("+")}` : "nadie (solo dueño)"
    check(`U3 · ${probe.name} — ${allowText}`, allOk, results.join(" "))
  }

  // Todos los roles SÍ leen su panel de pedidos (cada uno por su módulo).
  const seen = []
  let allRead = true
  for (const role of ROLES) {
    const { status } = await asStaff(users[role].token, "GET", "/api/orders")
    if (status !== 200) allRead = false
    seen.push(`${role}=${status}`)
  }
  check("U3 · panel de pedidos (GET /api/orders) — todos los roles leen el suyo", allRead, seen.join(" "))
}

// ───────────────────────────────────────────────────────────────────────────
// U4 · ESTADOS Y COBROS POR ROL
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U4 · estados y cobros")
{
  const mk = async (tag) => {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-${tag}`,
        customerPhone: "04140000021",
        tableNumber: "Mesa 2",
        orderType: "Comer aquí",
        exchangeRate: 40,
        items: [{ id: 999011, name: `${RUN}-ITEM`, price: 12, quantity: 1 }],
      },
      { "x-branch-id": A },
    )
    return json?.order
  }
  const o1 = await mk("FLUJO")
  const o2 = await mk("SALTO")
  check("U4 · dos pedidos de prueba creados", Boolean(o1?.id && o2?.id))

  // Cocina: avanza la preparación…
  const k1 = await asStaff(users.kitchen.token, "PATCH", `/api/orders/${o1.id}`, { status: "Preparando" })
  const k2 = await asStaff(users.kitchen.token, "PATCH", `/api/orders/${o1.id}`, { status: "Listo" })
  check("U4 · cocina avanza Nuevo→Preparando→Listo", k1.status === 200 && k2.status === 200, `${k1.status}/${k2.status} → ${await orderStatus(o1.id)}`)

  // …pero NO cancela ni entrega.
  const kCancel = await asStaff(users.kitchen.token, "PATCH", `/api/orders/${o1.id}`, { status: "Cancelado", cancelReason: "QA no debería" })
  check("U4 · cocina NO puede cancelar", kCancel.status !== 200 && (await orderStatus(o1.id)) !== "Cancelado", `status=${kCancel.status} pedido=${await orderStatus(o1.id)}`)
  const kDeliver = await asStaff(users.kitchen.token, "PATCH", `/api/orders/${o1.id}`, { status: "Entregado" })
  check("U4 · cocina NO puede entregar", kDeliver.status !== 200 && (await orderStatus(o1.id)) === "Listo", `status=${kDeliver.status}`)

  // Mesonero: NO entrega lo que no está LISTO (o2 sigue Nuevo)…
  const wSkip = await asStaff(users.waiter.token, "PATCH", `/api/orders/${o2.id}`, { status: "Entregado" })
  check("U4 · el mesonero NO entrega un pedido Nuevo (403 claro, no 500)", wSkip.status === 403 && (await orderStatus(o2.id)) === "Nuevo", `status=${wSkip.status}`)
  // …sí entrega lo LISTO (o1) y puede des-entregar.
  const wDeliver = await asStaff(users.waiter.token, "PATCH", `/api/orders/${o1.id}`, { status: "Entregado" })
  check("U4 · el mesonero SÍ entrega lo LISTO", wDeliver.status === 200 && (await orderStatus(o1.id)) === "Entregado", `status=${wDeliver.status}`)
  const wUndo = await asStaff(users.waiter.token, "PATCH", `/api/orders/${o1.id}`, { status: "Listo" })
  check("U4 · el mesonero puede des-entregar (Entregado→Listo)", wUndo.status === 200 && (await orderStatus(o1.id)) === "Listo", `status=${wUndo.status}`)
  // …y no cancela ni cobra.
  const wCancel = await asStaff(users.waiter.token, "PATCH", `/api/orders/${o1.id}`, { status: "Cancelado", cancelReason: "QA" })
  check("U4 · el mesonero NO cancela", wCancel.status !== 200 && (await orderStatus(o1.id)) !== "Cancelado", `status=${wCancel.status}`)
  const wPay = await asStaff(users.waiter.token, "PATCH", `/api/orders/${o1.id}/payment`, { amountReceivedUSD: 12, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" })
  check("U4 · el mesonero NO cobra", wPay.status === 401 || wPay.status === 403, `status=${wPay.status}`)

  // Delivery: no toca estados de pedidos de mesa.
  const dMove = await asStaff(users.delivery.token, "PATCH", `/api/orders/${o2.id}`, { status: "Preparando" })
  check("U4 · delivery NO cambia estados de mesa", dMove.status !== 200 && (await orderStatus(o2.id)) === "Nuevo", `status=${dMove.status}`)

  // Promotor: avanza y entrega lo suyo, pero NO cancela.
  const pMove = await asStaff(users.promoter.token, "PATCH", `/api/orders/${o2.id}`, { status: "Preparando" })
  check("U4 · el promotor SÍ avanza un pedido", pMove.status === 200, `status=${pMove.status}`)
  const pCancel = await asStaff(users.promoter.token, "PATCH", `/api/orders/${o2.id}`, { status: "Cancelado", cancelReason: "QA" })
  check("U4 · el promotor NO cancela", pCancel.status !== 200 && (await orderStatus(o2.id)) !== "Cancelado", `status=${pCancel.status}`)

  // Caja: cobra de verdad; cocina no.
  const kPay = await asStaff(users.kitchen.token, "PATCH", `/api/orders/${o1.id}/payment`, { amountReceivedUSD: 12, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" })
  check("U4 · cocina NO cobra", kPay.status === 401 || kPay.status === 403, `status=${kPay.status}`)
  const cPay = await asStaff(users.cashier.token, "PATCH", `/api/orders/${o1.id}/payment`, { amountReceivedUSD: 12, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" })
  check("U4 · caja SÍ cobra ($12 efectivo)", cPay.status === 200, `status=${cPay.status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// U5 · AISLAMIENTO DE SEDE (cajero de A vs pedido de B)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U5 · aislamiento de sede")
{
  const { json } = await postOrderThrottled(
    {
      customerName: `${RUN}-SEDE-B`,
      customerPhone: "04140000022",
      tableNumber: "Mesa 3",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: 999012, name: `${RUN}-ITEM`, price: 7, quantity: 1 }],
    },
    { "x-branch-id": B },
  )
  const orderB = json?.order
  check("U5 · pedido de prueba en Viñedo creado", Boolean(orderB?.id))

  const forced = await asStaff(users.cashier.token, "GET", "/api/orders", undefined, { "x-branch-id": B })
  const seen = (forced.json?.orders || []).map((o) => o.id)
  check("U5 · el cajero de San Diego NO ve pedidos de Viñedo ni forzando el header", !seen.includes(orderB?.id), `vistos=${seen.length}`)

  const crossPay = await asStaff(users.cashier.token, "PATCH", `/api/orders/${orderB?.id}/payment`, { amountReceivedUSD: 7, paymentMethodUSD: "Efectivo divisas", deliveryPaymentIn: "Divisas" }, { "x-branch-id": B })
  const { data: rowB } = await supabase.from("orders").select("payment_status").eq("id", orderB?.id || "").maybeSingle()
  check("U5 · tampoco puede COBRAR el pedido de Viñedo (404 claro, no 500)", crossPay.status === 404 && rowB?.payment_status !== "paid", `status=${crossPay.status} payment_status=${rowB?.payment_status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// U6 · PERMISOS CUSTOM RECORTAN DE VERDAD
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U6 · permisos custom")
{
  const opened = await asStaff(users.cashier.token, "POST", "/api/open-accounts", {
    tableNumber: "ZZTEST U6",
    customerName: `${RUN}-U6`,
  })
  const accountId = opened.json?.openAccount?.id
  check("U6 · el cajero (modo rol) SÍ abre una cuenta", opened.status === 201 && Boolean(accountId), `status=${opened.status}`)

  const cut = await patch(
    `/api/staff/${users.cashier.staff.id}`,
    { permissionsMode: "custom", allowedModules: ["mainPanel", "cashier"] },
    { "x-branch-id": A },
  )
  check("U6 · el dueño recorta módulos al cajero (custom sin openAccounts)", cut.status === 200, `status=${cut.status} ${cut.json?.error || ""}`)

  const blocked = await asStaff(users.cashier.token, "PATCH", `/api/open-accounts/${accountId}`, { action: "close" })
  check("U6 · con el recorte, cerrar la cuenta se bloquea (403)", blocked.status === 403, `status=${blocked.status}`)

  // U6b (fuga encontrada el 2026-07-30): el recorte tiene que valer en la API,
  // no solo en el menú. Se prueba con el ENCARGADO, que por rol sí abre estas
  // puertas: al dejarlo en "mainPanel" las tres deben cerrarse. Antes del
  // arreglo, gastos/cierres/comprobantes seguían respondiendo 200.
  const PUERTAS_CUSTOM = [
    ["gastos del día", "/api/day-expenses"],
    ["historial de cierres", "/api/day-closes"],
    ["comprobantes", "/api/payment-proofs"],
  ]

  const abiertasAntes = []
  for (const [nombre, path] of PUERTAS_CUSTOM) {
    const { status } = await asStaff(users.manager.token, "GET", path)
    if (status === 200) abiertasAntes.push([nombre, path])
  }
  check("U6b · el encargado por rol abre gastos, cierres y comprobantes", abiertasAntes.length === 3, `abre ${abiertasAntes.length}/3`)

  const recorteManager = await patch(
    `/api/staff/${users.manager.staff.id}`,
    { permissionsMode: "custom", allowedModules: ["mainPanel"] },
    { "x-branch-id": A },
  )
  check("U6b · el dueño lo deja solo con el panel principal", recorteManager.status === 200, `status=${recorteManager.status}`)

  const fugas = []
  for (const [nombre, path] of abiertasAntes) {
    const { status } = await asStaff(users.manager.token, "GET", path)
    if (status !== 403 && status !== 401) fugas.push(`${nombre}=${status}`)
  }
  check(
    "U6b · recortado, la API TAMBIÉN se las cierra (no solo el menú)",
    fugas.length === 0,
    fugas.length ? `siguen abiertas: ${fugas.join(", ")}` : "las 3 cerradas con 403",
  )

  await patch(
    `/api/staff/${users.manager.staff.id}`,
    { permissionsMode: "role", allowedModules: [] },
    { "x-branch-id": A },
  )

  const restore = await patch(
    `/api/staff/${users.cashier.staff.id}`,
    { permissionsMode: "role", allowedModules: [] },
    { "x-branch-id": A },
  )
  check("U6 · restaurado el modo rol", restore.status === 200, `status=${restore.status}`)

  const reopenGate = await asStaff(users.cashier.token, "PATCH", `/api/open-accounts/${accountId}`, { action: "close" })
  check("U6 · con el rol de vuelta, la misma puerta abre (cierra la cuenta)", reopenGate.status === 200, `status=${reopenGate.status} ${reopenGate.json?.error || ""}`)
}

// ───────────────────────────────────────────────────────────────────────────
// U7 · DESACTIVAR MATA EL ACCESO AL INSTANTE
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── U7 · desactivación")
{
  const before = await asStaff(users.waiter.token, "GET", "/api/orders")
  check("U7 · el mesonero activo lee pedidos", before.status === 200, `status=${before.status}`)

  const off = await patch(`/api/staff/${users.waiter.staff.id}`, { is_active: false }, { "x-branch-id": A })
  check("U7 · el dueño lo desactiva (PATCH is_active=false)", off.status === 200, `status=${off.status}`)

  const after = await asStaff(users.waiter.token, "GET", "/api/orders")
  check("U7 · el MISMO token queda muerto (401/403)", after.status === 401 || after.status === 403, `status=${after.status}`)

  const softDelete = await del(`/api/staff/${users.kitchen.staff.id}`, { "x-branch-id": A })
  check("U7 · DELETE de usuario = desactivación (histórico intacto)", softDelete.status === 200, `status=${softDelete.status}`)
  const kitchenAfter = await asStaff(users.kitchen.token, "GET", "/api/orders")
  check("U7 · el token de cocina también queda muerto", kitchenAfter.status === 401 || kitchenAfter.status === 403, `status=${kitchenAfter.status}`)

  // Un empleado no gestiona usuarios ni se edita a sí mismo.
  const selfEdit = await asStaff(users.cashier.token, "PATCH", `/api/staff/${users.cashier.staff.id}`, { role: "owner" })
  check("U7 · el cajero NO puede autoascenderse a dueño", selfEdit.status === 401 || selfEdit.status === 403, `status=${selfEdit.status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA TOTAL
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: accounts } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`)
  if (accounts?.length) await supabase.from("open_accounts").delete().in("id", accounts.map((a) => a.id))
  const orders = await cleanupRunOrders(RUN)

  for (const id of staffCreated) {
    await supabase.auth.admin.deleteUser(id).catch(() => {})
  }
  await supabase.from("staff_users").delete().in("id", staffCreated.length ? staffCreated : ["-"])

  const { data: leftoverOrders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const { data: leftoverStaff } = await supabase.from("staff_users").select("id").ilike("email", "%zztest%")
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const zztestAuth = (authUsers?.users || []).filter((u) => /zztest/i.test(u.email || ""))
  check(
    "limpieza · 0 pedidos, 0 cuentas, 0 usuarios ZZTEST (tabla y Auth)",
    (leftoverOrders?.length ?? 0) === 0 && (leftoverStaff?.length ?? 0) === 0 && zztestAuth.length === 0,
    `pedidos=${leftoverOrders?.length ?? 0} staff=${leftoverStaff?.length ?? 0} auth=${zztestAuth.length} (borrados: ${orders.deleted} pedidos, ${staffCreated.length} usuarios)`,
  )
}

process.exit(summary("usuarios y permisos") > 0 ? 1 : 0)
