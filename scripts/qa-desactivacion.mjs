// QA ronda 2026-07-30 · ¿LA DESACTIVACIÓN DE USUARIOS ES REAL O DECORATIVA?
//
// La pregunta del dueño: "si despido a alguien y lo desactivo, ¿de verdad no
// puede entrar?". Un check que solo mira "el token dejó de servir" NO alcanza:
// pudo dejar de servir por cualquier otra razón. Este script prueba CAUSALIDAD
// y busca los huecos por donde un despedido podría volver a entrar:
//
//   D1 · Control de causalidad: vivo → desactivado (muere) → REACTIVADO con el
//        MISMO token (revive) → desactivado otra vez. Si revive al reactivar,
//        la causa es la desactivación y nada más.
//   D2 · Cobertura: cada puerta que el usuario ABRÍA estando activo se mide de
//        nuevo desactivado. Una puerta que ya estaba cerrada no prueba nada.
//   D3 · Inmediatez: 3 peticiones seguidas justo después de desactivar (sin
//        esperar) — si hubiera caché de sesión, alguna pasaría.
//   D4 · El despedido intenta ENTRAR DE NUEVO: su usuario y clave siguen
//        existiendo en Supabase Auth, así que puede obtener un token FRESCO.
//        Ese token nuevo tampoco puede abrir el panel ni la API.
//   D5 · "Eliminar" es desactivar: el acceso muere pero el historial queda
//        (su fila en usuarios y sus registros de auditoría siguen ahí).
//   D6 · ATAQUE al fail-open: la comprobación del servidor es
//        `is_active === false`, así que un NULL en esa columna pasaría de
//        largo. Se fuerza el NULL a propósito para ver si el token revive.
//   D7 · El desactivado no puede reactivarse a sí mismo con su propio token.
//   D8 · No se puede dejar el negocio sin ningún dueño activo.
//
// Requisitos: dev server FRESCO en :3177 y `npm run backup` corrido antes.
// Uso:  npm run qa:desactivacion
import { createClient } from "@supabase/supabase-js"
import {
  BASE,
  BRANCH_SAN_DIEGO,
  assertBrotherhood,
  check,
  cleanupRunOrders,
  del,
  env,
  patch,
  post,
  postOrderThrottled,
  summary,
  supabase,
} from "./qa-lib.mjs"

const RUN = `ZZTEST-${Date.now()}`
const A = BRANCH_SAN_DIEGO
const PASSWORD = "ZZtest2026!"

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const staffCreated = []

async function createStaff(role, tag) {
  const username = `zztest-${tag}-${Date.now()}`.toLowerCase()
  const { json, status } = await post(
    "/api/staff",
    {
      username,
      password: PASSWORD,
      role,
      fullName: `${RUN} ${tag}`,
      allBranches: false,
      allowedBranchIds: [A],
    },
    { "x-branch-id": A },
  )
  if (json?.staff?.id) staffCreated.push(json.staff.id)
  return { staff: json?.staff, status, username, error: json?.error }
}

async function sessionFor(staff) {
  const { data, error } = await anon.auth.signInWithPassword({
    email: staff.email,
    password: PASSWORD,
  })
  return { token: data?.session?.access_token || "", error: error?.message || "" }
}

async function asStaff(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-branch-id": A,
      // La puerta del panel exige mismo origen; sin esto el 401 podría venir
      // del guard de origen y no de la desactivación (falso positivo).
      Origin: BASE,
      Referer: `${BASE}/local-santo`,
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

const isOpen = (status) => status === 200 || status === 201
const isClosed = (status) => status === 401 || status === 403

async function setActive(staffId, active) {
  return patch(`/api/staff/${staffId}`, { is_active: active }, { "x-branch-id": A })
}

async function activeInDb(staffId) {
  const { data } = await supabase.from("staff_users").select("is_active").eq("id", staffId).maybeSingle()
  return data?.is_active
}

await assertBrotherhood()
console.log(`¿La desactivación es real? · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// D1 · CONTROL DE CAUSALIDAD
// ───────────────────────────────────────────────────────────────────────────
console.log("── D1 · control de causalidad (vivo → muerto → revivido → muerto)")
const cashier = await createStaff("cashier", "cajero")
check("D1 · cajero de prueba creado", Boolean(cashier.staff?.id), `status=${cashier.status} ${cashier.error || ""}`)

if (!cashier.staff?.id) {
  console.log("\n⚠ Sin usuario no hay experimento. Salida.")
  process.exit(1)
}

const session = await sessionFor(cashier.staff)
check("D1 · abre sesión real contra Supabase Auth", Boolean(session.token), session.error)
const TOKEN = session.token

const vivo1 = await asStaff(TOKEN, "GET", "/api/orders")
check("D1 · (a) ACTIVO: el token abre la API", isOpen(vivo1.status), `status=${vivo1.status}`)

const off1 = await setActive(cashier.staff.id, false)
check("D1 · (b) el dueño lo DESACTIVA", off1.status === 200 && (await activeInDb(cashier.staff.id)) === false, `status=${off1.status} is_active=${await activeInDb(cashier.staff.id)}`)

const muerto1 = await asStaff(TOKEN, "GET", "/api/orders")
check("D1 · (c) DESACTIVADO: el MISMO token ya no abre", isClosed(muerto1.status), `status=${muerto1.status}`)

const on1 = await setActive(cashier.staff.id, true)
check("D1 · (d) el dueño lo REACTIVA", on1.status === 200 && (await activeInDb(cashier.staff.id)) === true, `status=${on1.status}`)

const revivido = await asStaff(TOKEN, "GET", "/api/orders")
check(
  "D1 · (e) PRUEBA DE CAUSA: reactivado, el MISMO token vuelve a abrir",
  isOpen(revivido.status),
  `status=${revivido.status} — si esto falla, el 401 de (c) no lo causó la desactivación`,
)

const off2 = await setActive(cashier.staff.id, false)
const muerto2 = await asStaff(TOKEN, "GET", "/api/orders")
check("D1 · (f) desactivado otra vez: se cierra de nuevo (repetible)", off2.status === 200 && isClosed(muerto2.status), `status=${muerto2.status}`)

// ───────────────────────────────────────────────────────────────────────────
// D2 · COBERTURA: TODA PUERTA QUE ABRÍA, AHORA CERRADA
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D2 · cobertura de puertas (solo cuentan las que abría activo)")
{
  const DOORS = [
    { name: "panel de pedidos (GET /api/orders)", method: "GET", path: "/api/orders" },
    { name: "cuentas abiertas (GET /api/open-accounts)", method: "GET", path: "/api/open-accounts" },
    { name: "abrir cuenta (POST /api/open-accounts)", method: "POST", path: "/api/open-accounts", body: { tableNumber: "ZZTEST D2", customerName: `${RUN}-D2` } },
    { name: "comprobantes (GET /api/payment-proofs)", method: "GET", path: "/api/payment-proofs" },
    { name: "puerta del panel (GET /api/local-auth?moduleKey=cashier)", method: "GET", path: "/api/local-auth?moduleKey=cashier" },
  ]

  // Fase 1: con el usuario ACTIVO, medir qué abre de verdad.
  await setActive(cashier.staff.id, true)
  const abiertas = []
  for (const door of DOORS) {
    const { status } = await asStaff(TOKEN, door.method, door.path, door.body)
    if (isOpen(status)) abiertas.push({ ...door, activo: status })
    else console.log(`   · (ignorada: activo ya daba ${status}) ${door.name}`)
  }
  check("D2 · el cajero activo abre al menos 3 puertas para comparar", abiertas.length >= 3, `abría ${abiertas.length} de ${DOORS.length}`)

  // Fase 2: desactivado, ninguna de ESAS puertas puede seguir abierta.
  await setActive(cashier.staff.id, false)
  const resultados = []
  let todasCerradas = true
  for (const door of abiertas) {
    const { status } = await asStaff(TOKEN, door.method, door.path, door.body)
    if (!isClosed(status)) todasCerradas = false
    resultados.push(`${door.name.split(" (")[0]}: ${door.activo}→${status}${isClosed(status) ? "" : "✗"}`)
  }
  check(`D2 · desactivado se cierran TODAS (${abiertas.length}/${abiertas.length})`, todasCerradas, resultados.join(" · "))
}

// ───────────────────────────────────────────────────────────────────────────
// D3 · INMEDIATEZ (sin caché de sesión)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D3 · inmediatez")
{
  await setActive(cashier.staff.id, true)
  const antes = await asStaff(TOKEN, "GET", "/api/orders")
  await setActive(cashier.staff.id, false)

  const seguidas = []
  for (let i = 0; i < 3; i += 1) {
    const { status } = await asStaff(TOKEN, "GET", "/api/orders")
    seguidas.push(status)
  }
  check(
    "D3 · 3 peticiones seguidas justo tras desactivar: ninguna pasa (no hay caché)",
    isOpen(antes.status) && seguidas.every(isClosed),
    `antes=${antes.status} después=[${seguidas.join(", ")}]`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// D4 · EL DESPEDIDO INTENTA ENTRAR DE NUEVO (token FRESCO)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D4 · el despedido vuelve a intentar con sesión nueva")
{
  const relogin = await sessionFor(cashier.staff)
  // Supabase Auth NO borra la cuenta al desactivar en el sistema: es esperable
  // que dé token. Lo que importa es que ese token no abra NADA.
  check(
    "D4 · su usuario/clave siguen existiendo en Supabase Auth (da token nuevo)",
    Boolean(relogin.token),
    relogin.token ? "token nuevo emitido — ahora tiene que servir para nada" : `no emitió token (${relogin.error})`,
  )

  if (relogin.token) {
    const panel = await asStaff(relogin.token, "GET", "/api/local-auth?moduleKey=cashier")
    check("D4 · con el token NUEVO la puerta del panel lo rechaza", isClosed(panel.status), `status=${panel.status} "${panel.json?.error || ""}"`)

    const api = await asStaff(relogin.token, "GET", "/api/orders")
    check("D4 · con el token NUEVO la API lo rechaza", isClosed(api.status), `status=${api.status}`)

    const escribir = await asStaff(relogin.token, "POST", "/api/open-accounts", { tableNumber: "ZZTEST D4", customerName: `${RUN}-D4` })
    check("D4 · con el token NUEVO tampoco puede ESCRIBIR", isClosed(escribir.status), `status=${escribir.status}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// D5 · "ELIMINAR" = DESACTIVAR, CON HISTORIAL INTACTO
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D5 · eliminar conserva el historial")
{
  const kitchen = await createStaff("kitchen", "cocina")
  const kSession = kitchen.staff ? await sessionFor(kitchen.staff) : { token: "" }
  check("D5 · usuario de cocina creado y con sesión", Boolean(kSession.token))

  // Deja huella real: mueve un pedido (eso escribe en la auditoría con su nombre).
  const { json } = await postOrderThrottled(
    {
      customerName: `${RUN}-D5`,
      customerPhone: "04140000031",
      tableNumber: "Mesa 2",
      orderType: "Comer aquí",
      exchangeRate: 40,
      items: [{ id: 999021, name: `${RUN}-ITEM`, price: 10, quantity: 1 }],
    },
    { "x-branch-id": A },
  )
  const orderId = json?.order?.id
  const movio = await asStaff(kSession.token, "PATCH", `/api/orders/${orderId}`, { status: "Preparando" })
  check("D5 · cocina deja huella (mueve un pedido a Preparando)", movio.status === 200, `status=${movio.status}`)

  const borrado = await del(`/api/staff/${kitchen.staff.id}`, { "x-branch-id": A })
  check("D5 · el dueño lo 'elimina'", borrado.status === 200, `status=${borrado.status}`)

  const tras = await asStaff(kSession.token, "GET", "/api/orders")
  check("D5 · su acceso muere", isClosed(tras.status), `status=${tras.status}`)

  const { data: fila } = await supabase.from("staff_users").select("id, is_active").eq("id", kitchen.staff.id).maybeSingle()
  check("D5 · pero la FILA sigue (desactivada, no borrada)", Boolean(fila) && fila.is_active === false, `fila=${Boolean(fila)} is_active=${fila?.is_active}`)

  const { data: huella } = await supabase
    .from("audit_logs")
    .select("id, actor_label")
    .eq("entity_id", orderId || "-")
    .eq("action", "order.status.updated")
  check(
    "D5 · su huella en auditoría sobrevive al 'borrado'",
    (huella?.length ?? 0) > 0,
    `registros=${huella?.length ?? 0} actor="${huella?.[0]?.actor_label || ""}"`,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// D6 · ATAQUE AL FAIL-OPEN: is_active = NULL
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D6 · ataque: is_active = NULL (la comprobación es === false)")
{
  const nulled = await supabase
    .from("staff_users")
    .update({ is_active: null })
    .eq("id", cashier.staff.id)
    .select("id, is_active")

  if (nulled.error) {
    check(
      "D6 · la columna no admite NULL: el hueco es imposible en la base",
      true,
      `la base rechaza el NULL (${nulled.error.code} ${nulled.error.message})`,
    )
  } else {
    const conNull = await asStaff(TOKEN, "GET", "/api/orders")
    check(
      "D6 · con is_active = NULL el acceso sigue CERRADO (no hay fail-open)",
      isClosed(conNull.status),
      `is_active=null → status=${conNull.status}${isOpen(conNull.status) ? " ← FAIL-OPEN: un NULL revive al despedido" : ""}`,
    )
    // Devolver la fila a false para no dejar la base en un estado raro.
    await supabase.from("staff_users").update({ is_active: false }).eq("id", cashier.staff.id)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// D7 · EL DESACTIVADO NO SE REACTIVA A SÍ MISMO
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D7 · autorreactivación")
{
  const selfOn = await asStaff(TOKEN, "PATCH", `/api/staff/${cashier.staff.id}`, { is_active: true })
  const sigueApagado = (await activeInDb(cashier.staff.id)) !== true
  check("D7 · con su propio token NO puede reactivarse", isClosed(selfOn.status) && sigueApagado, `status=${selfOn.status} is_active=${await activeInDb(cashier.staff.id)}`)

  const selfOwner = await asStaff(TOKEN, "PATCH", `/api/staff/${cashier.staff.id}`, { role: "owner" })
  check("D7 · ni ascenderse a dueño", isClosed(selfOwner.status), `status=${selfOwner.status}`)
}

// ───────────────────────────────────────────────────────────────────────────
// D8 · EL NEGOCIO NO SE QUEDA SIN DUEÑO
// Solo se intenta si hay UN único dueño activo (ahí la protección debe saltar
// y el intento es inofensivo). Con 2+ el intento sí desactivaría a alguien
// real: se omite a propósito.
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── D8 · último dueño activo")
{
  const { data: owners } = await supabase
    .from("staff_users")
    .select("id, email")
    .eq("role", "owner")
    .eq("is_active", true)

  if ((owners?.length ?? 0) === 0) {
    console.log(
      "   · omitido: este negocio NO tiene usuario dueño en staff_users — el dueño entra por CLAVE (ORDERS_OWNER_PASSWORD), así que no hay nada que desactivar.",
    )
  } else if ((owners?.length ?? 0) === 1) {
    const target = owners[0]
    const intento = await setActive(target.id, false)
    const sigueActivo = (await activeInDb(target.id)) === true
    check(
      "D8 · desactivar al ÚNICO dueño se rechaza y queda activo",
      intento.status === 400 && sigueActivo,
      `status=${intento.status} "${intento.json?.error || ""}" · sigue activo=${sigueActivo}`,
    )
    if (!sigueActivo) {
      await supabase.from("staff_users").update({ is_active: true }).eq("id", target.id)
      console.log("   ⚠ se reactivó al dueño por seguridad")
    }
  } else {
    console.log(`   · omitido: hay ${owners?.length ?? 0} dueños activos (con 2+ el intento desactivaría a uno real)`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA
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

  const { data: leftoverStaff } = await supabase.from("staff_users").select("id").ilike("email", "%zztest%")
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const zztestAuth = (authUsers?.users || []).filter((u) => /zztest/i.test(u.email || ""))
  const { data: leftoverOrders } = await supabase.from("orders").select("id").ilike("customer_name", "ZZTEST%")

  check(
    "limpieza · 0 usuarios y 0 pedidos ZZTEST (tabla y Auth)",
    (leftoverStaff?.length ?? 0) === 0 && zztestAuth.length === 0 && (leftoverOrders?.length ?? 0) === 0,
    `staff=${leftoverStaff?.length ?? 0} auth=${zztestAuth.length} pedidos=${leftoverOrders?.length ?? 0} (borrados ${orders.deleted} pedidos, ${staffCreated.length} usuarios)`,
  )

  // Retrato del personal real que queda (no es un check: es el dato que el
  // dueño necesita para saber a QUIÉN puede desactivar y quién entra por clave).
  const { data: reales } = await supabase
    .from("staff_users")
    .select("email, role, is_active")
    .not("email", "ilike", "%zztest%")
  console.log(`\npersonal real con usuario propio (${reales?.length ?? 0}):`)
  for (const row of reales || []) {
    console.log(`   · ${row.email} · ${row.role} · ${row.is_active ? "activo" : "DESACTIVADO"}`)
  }
  console.log(
    "   ⚠ los roles que NO aparezcan aquí entran por la CLAVE del .env: desactivar usuarios no los afecta.",
  )
}

process.exit(summary("desactivación real") > 0 ? 1 : 0)
