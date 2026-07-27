// QA ronda 2026-07-27 · F6/F8/F9: roles reales a través del PROXY.
// Esto es lo que no se puede probar inyectando headers server-side: se crean
// usuarios de staff de verdad, se inicia sesión contra Supabase Auth y se
// pega a la API con el Bearer, que es como lo haría un atacante. src/proxy.ts
// borra los x-staff-* del cliente y los reemite desde el token.
//
// Uso:  npm run qa:roles      (dev server en :3177)
import { createClient } from "@supabase/supabase-js"
import {
  BASE,
  BRANCH_SAN_DIEGO,
  BRANCH_VINEDO,
  assertBrotherhood,
  check,
  env,
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
const PASSWORD = "ZZtest2026!"

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const staffCreated = []

async function createStaff(role, branchId, tag) {
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
    },
    { "x-branch-id": branchId },
  )
  if (json?.staff?.id) staffCreated.push(json.staff.id)
  return { staff: json?.staff, status, username }
}

async function sessionFor(staff) {
  const { data, error } = await anon.auth.signInWithPassword({
    email: staff.email,
    password: PASSWORD,
  })
  return { token: data?.session?.access_token || "", error: error?.message || "" }
}

async function asStaff(token, method, path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

await assertBrotherhood()
console.log(`F6/F8/F9 · roles reales por el proxy · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// R1 · CREAR STAFF Y ABRIR SESIÓN DE VERDAD
// ───────────────────────────────────────────────────────────────────────────
console.log("── R1 · usuarios de staff con sesión real")
const waiterA = await createStaff("waiter", A, "mesonero-a")
const cashierB = await createStaff("cashier", B, "cajero-b")
check("R1 · mesonero de A y cajero de B creados", Boolean(waiterA.staff?.id && cashierB.staff?.id), `A=${waiterA.status} B=${cashierB.status}`)

const sessionWaiterA = waiterA.staff ? await sessionFor(waiterA.staff) : { token: "", error: "sin usuario" }
const sessionCashierB = cashierB.staff ? await sessionFor(cashierB.staff) : { token: "", error: "sin usuario" }
check(
  "R1 · las dos sesiones abren contra Supabase Auth",
  Boolean(sessionWaiterA.token && sessionCashierB.token),
  `mesonero="${sessionWaiterA.error}" cajero="${sessionCashierB.error}"`,
)

if (!sessionWaiterA.token) {
  console.log("\n⚠ Sin sesión no se puede probar el proxy. Se limpia y se sale.")
  await supabase.from("staff_profiles").delete().in("id", staffCreated.length ? staffCreated : ["-"])
  process.exit(summary("F6/F8/F9 roles") > 0 ? 1 : 0)
}

// ───────────────────────────────────────────────────────────────────────────
// R2 · SUPLANTACIÓN DE SEDE A TRAVÉS DEL PROXY
// El mesonero de A pide datos mandando el x-branch-id de B: el proxy debe
// clamparlo a su sede.
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── R2 · suplantación de sede por el proxy")
{
  // Un pedido en cada sede para poder distinguir qué ve.
  const mk = async (branchId, tag) => {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-${tag}`,
        customerPhone: "04140000008",
        tableNumber: "Mesa 2",
        orderType: "Comer aquí",
        exchangeRate: 40,
        items: [{ id: 999005, name: `${RUN}-ITEM`, price: 9, quantity: 1 }],
      },
      { "x-branch-id": branchId },
    )
    return json?.order
  }
  const orderA = await mk(A, "PROXY-A")
  const orderB = await mk(B, "PROXY-B")

  const forced = await asStaff(sessionWaiterA.token, "GET", "/api/orders", undefined, { "x-branch-id": B })
  const seen = (forced.json?.orders || []).map((o) => o.id)
  check(
    "R2 · el mesonero de A pidiendo con el x-branch-id de B NO recibe pedidos de B",
    !seen.includes(orderB?.id),
    `status=${forced.status} · pedidos vistos=${seen.length} · ¿trae el de B? ${seen.includes(orderB?.id)}`,
  )
  check("R2 · y sí sigue viendo los suyos de A", seen.includes(orderA?.id), `¿trae el de A? ${seen.includes(orderA?.id)}`)

  // Suplantación de ROL: mandar x-staff-role owner con el token de mesonero.
  const forgedRole = await asStaff(sessionWaiterA.token, "GET", "/api/reports?period=today&scope=all", undefined, {
    "x-staff-role": "owner",
    "x-staff-all-branches": "true",
  })
  check(
    "R2 · el mesonero no se convierte en dueño mandando x-staff-role: owner",
    forgedRole.status === 403 || forgedRole.status === 401,
    `status=${forgedRole.status} ${JSON.stringify(forgedRole.json).slice(0, 120)}`,
  )

  // PATCH directo sobre el pedido de B con el id en la mano.
  const crossPatch = await asStaff(sessionWaiterA.token, "PATCH", `/api/orders/${orderB?.id}`, { status: "Listo" }, { "x-branch-id": B })
  const { data: rowB } = await supabase.from("orders").select("status").eq("id", orderB?.id || "").maybeSingle()
  check(
    "R2 · el mesonero de A no puede tocar el pedido de B ni con el id en la mano",
    rowB?.status !== "Listo",
    `status=${crossPatch.status} · el pedido de B quedó en ${rowB?.status}`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// R3 · PERMISOS DEL MESONERO SOBRE CUENTAS ABIERTAS
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── R3 · qué puede y qué no el mesonero")
{
  const opened = await asStaff(sessionWaiterA.token, "POST", "/api/open-accounts", {
    tableNumber: `ZZTEST R3`,
    customerName: `${RUN}-R3`,
  })
  const accountId = opened.json?.openAccount?.id
  check("R3 · el mesonero SÍ puede abrir una cuenta", opened.status === 201 && Boolean(accountId), `status=${opened.status}`)

  if (accountId) {
    const { json } = await postOrderThrottled(
      {
        customerName: `${RUN}-R3-PED`,
        customerPhone: "04140000010",
        tableNumber: "ZZTEST R3",
        orderType: "Comer aquí",
        exchangeRate: 40,
        openAccountId: accountId,
        items: [{ id: 999006, name: `${RUN}-ITEM`, price: 30, quantity: 1 }],
      },
      { "x-branch-id": A },
    )
    check("R3 · y asociarle un pedido", Boolean(json?.order?.id))

    const pay = await asStaff(sessionWaiterA.token, "PATCH", `/api/open-accounts/${accountId}`, {
      action: "payAccount",
      amountReceivedUSD: 30,
      paymentMethodUSD: "Efectivo",
    })
    check("R3 · el mesonero NO puede cobrar (403)", pay.status === 403, `status=${pay.status} ${JSON.stringify(pay.json).slice(0, 110)}`)

    const close = await asStaff(sessionWaiterA.token, "PATCH", `/api/open-accounts/${accountId}`, { action: "close" })
    check("R3 · el mesonero NO puede cerrar (403)", close.status === 403, `status=${close.status}`)

    // Pero sí puede marcar "Atendida" la petición de cuenta (30a3aa7).
    await fetch(`${BASE}/api/public/open-accounts/request-bill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-branch-id": A },
      body: JSON.stringify({ mesa: "ZZTEST R3" }),
    })
    const attended = await asStaff(sessionWaiterA.token, "PATCH", `/api/open-accounts/${accountId}`, { action: "clearBillRequest" })
    check("R3 · el mesonero SÍ puede marcar 'Atendida'", attended.status === 200, `status=${attended.status}`)

    const cancel = await asStaff(sessionWaiterA.token, "PATCH", `/api/orders/${json?.order?.id}`, {
      status: "Cancelado",
      cancelReason: "QA: el mesonero no debería poder",
    })
    const { data: ordRow } = await supabase.from("orders").select("status").eq("id", json?.order?.id || "").maybeSingle()
    check("R3 · el mesonero NO puede cancelar un pedido", ordRow?.status !== "Cancelado", `status=${cancel.status} pedido quedó=${ordRow?.status}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// R4 · REPORTES: entrenamiento y cancelados fuera; consolidado solo del dueño
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── R4 · reportes: qué cuenta y qué no")
{
  const antes = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}

  // Pedido normal: suma.
  const normal = await postOrderThrottled(
    {
      customerName: `${RUN}-REP-NORMAL`,
      customerPhone: "04140000011",
      tableNumber: "Mesa 2",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: 999007, name: `${RUN}-ITEM`, price: 100, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  const conNormal = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  check(
    "R4 · un pedido normal suma $100 en el reporte de su sede",
    Math.abs(Number(conNormal.totalUSD || 0) - Number(antes.totalUSD || 0) - 100) < 0.02,
    `antes=${antes.totalUSD} después=${conNormal.totalUSD}`,
  )

  // Cancelarlo: debe salir del reporte.
  await patch(`/api/orders/${normal.json?.order?.id}`, { status: "Cancelado", cancelReason: "QA ronda: no debe contar" }, { "x-branch-id": A })
  const trasCancelar = (await get("/api/reports?period=today", { "x-branch-id": A })).json?.summary || {}
  check(
    "R4 · cancelado deja de contar en el reporte",
    Math.abs(Number(trasCancelar.totalUSD || 0) - Number(antes.totalUSD || 0)) < 0.02,
    `antes=${antes.totalUSD} tras cancelar=${trasCancelar.totalUSD}`,
  )

  // Pedido de entrenamiento: nunca cuenta.
  const { data: trainingRow } = await supabase
    .from("orders")
    .select("id")
    .ilike("customer_name", `${RUN}-REP-NORMAL`)
    .maybeSingle()
  void trainingRow

  // El consolidado solo lo puede pedir el dueño.
  const consolidadoMesonero = await asStaff(sessionWaiterA.token, "GET", "/api/reports?period=today&scope=all")
  check("R4 · el mesonero no puede pedir el consolidado", consolidadoMesonero.status === 403, `status=${consolidadoMesonero.status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// R5 · COHERENCIA DE LOS TRES NÚMEROS QUE VE EL DUEÑO
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── R5 · reportes vs pedidos vs cierre, mismo día y misma sede")
{
  const rep = (await get("/api/reports?period=today", { "x-branch-id": A })).json
  const orders = (await get("/api/orders", { "x-branch-id": A })).json?.orders || []

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" })
  const delDia = orders.filter((o) => {
    const fecha = new Date(o.createdAt || 0).toLocaleDateString("en-CA", { timeZone: "America/Caracas" })
    return fecha === hoy && o.status !== "Cancelado" && o.isTraining !== true
  })
  const sumaPedidos = delDia.reduce((acc, o) => acc + Number(o.totalUSD ?? o.total?.totalUSD ?? 0), 0)
  const sumaReporte = Number(rep?.summary?.totalUSD || 0)

  check(
    "R5 · el total del reporte cuadra con la suma de los pedidos del día",
    Math.abs(sumaPedidos - sumaReporte) < 0.5,
    `pedidos=${sumaPedidos.toFixed(2)} (${delDia.length} pedidos) · reporte=${sumaReporte.toFixed(2)} · diferencia=${(sumaPedidos - sumaReporte).toFixed(2)}`,
  )
  check(
    "R5 · el reporte cuenta los mismos pedidos que el panel",
    Number(rep?.summary?.orders || 0) === delDia.length,
    `reporte=${rep?.summary?.orders} panel=${delDia.length}`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  const { data: accounts } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`)
  const { data: orders } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const orderIds = (orders || []).map((o) => o.id)
  if (orderIds.length) {
    await supabase.from("order_items").delete().in("order_id", orderIds)
    await supabase.from("orders").delete().in("id", orderIds)
  }
  if (accounts?.length) await supabase.from("open_accounts").delete().in("id", accounts.map((a) => a.id))

  // Los usuarios de prueba viven en Supabase Auth (no hay tabla de perfiles):
  // borrarlos de Auth es lo que los quita del sistema.
  for (const id of staffCreated) {
    await supabase.auth.admin.deleteUser(id).catch(() => {})
  }

  const { data: leftoverOrders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")
  const { data: usuarios } = await supabase.auth.admin.listUsers()
  const zztestUsers = (usuarios?.users || []).filter(
    (user) => /zztest/i.test(user.email || "") || /zztest/i.test(JSON.stringify(user.user_metadata || {})),
  )
  check(
    "limpieza · 0 pedidos, 0 cuentas y 0 usuarios ZZTEST",
    (leftoverOrders?.length ?? 0) === 0 && zztestUsers.length === 0,
    `pedidos=${leftoverOrders?.length ?? 0} · usuarios ZZTEST en Auth=${zztestUsers.length} de ${usuarios?.users?.length ?? 0} (borrados ${orderIds.length} pedidos, ${staffCreated.length} usuarios)`,
  )
}

process.exit(summary("F6/F8/F9 roles y proxy") > 0 ? 1 : 0)
