// QA SEGURIDAD · ataques EN VIVO contra la superficie pública.
//
// Corre los ataques de dinero y de datos de la Parte A del
// PROMPT-SEGURIDAD-Y-VIDA-REAL.md que NO tienen suite propia todavía. Los que
// ya están cubiertos (roles/proxy, aislamiento de sede, permisos) viven en
// qa:roles, qa:branch-isolation y qa:usuarios — este NO los repite.
//
// Por defecto pega a PRODUCCIÓN (brotherhood-xi.vercel.app): mientras el sistema
// no se entregue al cliente, sus datos transaccionales son de prueba y se borran
// en la entrega (autorizado por el dueño 2026-07-30). Todo lo que este script
// crea lleva prefijo ZZTEST- y se borra al final, con verificación.
//
// NUNCA toca: el menú real, la configuración, sucursales/mesas/claves ni las
// compras precargadas. Solo crea y borra pedidos y cuentas ZZTEST propias.
//
// Uso:  npm run qa:seguridad
//       BASE=http://localhost:3177 npm run qa:seguridad   (contra dev)
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const BASE = process.env.BASE || "https://brotherhood-xi.vercel.app"
const VINEDO = "04fb974d-bd2d-4086-ae9e-c74653309b04"
const RUN = `ZZTEST-SEG-${Date.now()}`

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const H = { "Content-Type": "application/json", "x-branch-id": VINEDO, Origin: BASE, Referer: `${BASE}/` }
const cleanup = { orders: new Set(), accounts: new Set() }

const cleanId = (value) => String(value ?? "").trim()

let pass = 0, fail = 0
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? (pass += 1) : (fail += 1)
}

async function post(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
async function get(path) {
  const res = await fetch(BASE + path, { headers: H })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}

// Identidad: no escribir si el server no es Brotherhood.
async function assertBrotherhood() {
  const res = await fetch(BASE + "/", { headers: { accept: "text/html" } })
  const title = ((await res.text()).match(/<title>([^<]*)<\/title>/i)?.[1] || "").trim()
  if (!/brotherhood/i.test(title)) {
    console.error(`✗ ABORTADO: ${BASE} no es Brotherhood (title: "${title}")`)
    process.exit(2)
  }
  return title
}

// Un pedido que ENTRA (pasa el guard de precio) para poder probar la lógica
// que viene después. Prueba productos reales hasta que uno cree el pedido.
let productoValido = null
async function pedidoValido(extraBody) {
  if (productoValido) {
    return post("/api/orders", {
      customerName: `${RUN}-x`, tableNumber: "Mesa 2", orderType: "Comer aquí", exchangeRate: 40,
      items: [{ ...productoValido, quantity: 1 }], ...extraBody,
    })
  }
  const { data: prods } = await supabase.from("menu_products").select("id,name,price")
    .eq("is_active", true).eq("branch_id", VINEDO).limit(8)
  for (const p of prods || []) {
    const item = { id: Number(p.id), name: p.name, price: Number(p.price) }
    const r = await post("/api/orders", {
      customerName: `${RUN}-probe`, tableNumber: "Mesa 2", orderType: "Comer aquí", exchangeRate: 40,
      items: [{ ...item, quantity: 1 }], ...extraBody,
    })
    if (r.status === 200 || r.status === 201) {
      if (r.json?.order?.id) cleanup.orders.add(r.json.order.id)
      productoValido = item
      return r
    }
  }
  return { status: 0, json: { error: "ningún producto entró" } }
}

const title = await assertBrotherhood()
console.log(`QA seguridad · ${BASE} (${title}) · run=${RUN}\n`)

// ───────────────────────────────────────────────────────────────────────────
// S1 · H-1 · Fuga de cuentas de mesa (LECTURA PURA, no escribe nada)
// ───────────────────────────────────────────────────────────────────────────
console.log("── S1 · fuga de datos: estado de cuentas de mesa sin clave")
{
  const mesas = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Barra", "Afuera"]
  let conNombre = 0, conMontos = 0, barridas = 0
  const ejemplos = []
  for (const mesa of mesas) {
    const r = await get(`/api/public/table-account-status?mesa=${encodeURIComponent(mesa)}`)
    if (r.status !== 200) continue
    barridas += 1
    const acc = r.json?.openAccount
    if (acc?.customerName) { conNombre += 1; ejemplos.push(`${mesa}→"${acc.customerName}" $${acc.pendingUSD}`) }
    if (acc && (acc.pendingUSD != null || acc.totalEstimatedUSD != null)) conMontos += 1
  }
  console.log(`   barridas ${barridas} mesas sin ninguna clave · ${conNombre} exponen NOMBRE de cliente · ${conMontos} exponen montos`)
  if (ejemplos.length) console.log(`   ejemplos: ${ejemplos.slice(0, 4).join(" · ")}`)
  // CERRADO el 2026-07-30 (H-1): el nombre del cliente ya no viaja en la
  // respuesta pública. Los montos SÍ siguen: son los que la propia mesa ve al
  // pedir su cuenta desde el teléfono (decisión de diseño, no un descuido).
  check("S1 · [H-1 CERRADO] el endpoint público YA NO expone el nombre del cliente",
    conNombre === 0,
    conNombre === 0
      ? `barridas ${barridas} mesas sin clave y 0 nombres · ${conMontos} con montos (aceptado: es la cuenta de la propia mesa)`
      : `🔴 TODAVÍA filtra ${conNombre} nombre(s) desde internet`)
}

// ───────────────────────────────────────────────────────────────────────────
// S2 · Precio manipulado (debe estar BLOQUEADO)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S2 · precio manipulado al crear pedido")
{
  const { data: prods } = await supabase.from("menu_products").select("id,name,price")
    .eq("is_active", true).eq("branch_id", VINEDO).gt("price", 5).limit(1)
  const p = prods?.[0]
  const r = await post("/api/orders", {
    customerName: `${RUN}-precio`, tableNumber: "Mesa 2", orderType: "Comer aquí", exchangeRate: 40,
    items: [{ id: Number(p.id), name: p.name, price: 0.01, quantity: 1 }],
  })
  const ordId = r.json?.order?.id
  if (ordId) cleanup.orders.add(ordId)
  let guardado = null
  if (ordId) {
    const { data } = await supabase.from("orders").select("total_usd").eq("id", ordId).maybeSingle()
    guardado = Number(data?.total_usd)
  }
  // Bloqueado = el pedido se rechazó (400) O se guardó al PRECIO REAL, no a 0,01.
  const bloqueado = r.status === 400 || (guardado != null && guardado >= Number(p.price) - 0.5)
  check("S2 · un pedido con precio 0,01 NO se cobra a 0,01", bloqueado,
    `producto $${p.price} → status ${r.status}${guardado != null ? ` · guardado $${guardado}` : ""}`)
}

// ───────────────────────────────────────────────────────────────────────────
// S3 · Tasa de cambio manipulada (debe estar BLOQUEADA)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S3 · tasa de cambio manipulada")
{
  const r = await pedidoValido({ customerName: `${RUN}-tasa`, exchangeRate: 1 })
  const ordId = r.json?.order?.id
  if (ordId) cleanup.orders.add(ordId)
  let tasa = null
  if (ordId) {
    const { data } = await supabase.from("orders").select("exchange_rate").eq("id", ordId).maybeSingle()
    tasa = Number(data?.exchange_rate)
  }
  const bloqueado = r.status === 400 || (tasa != null && tasa > 10)
  check("S3 · una tasa de 1 no sobrevive (el server impone la real)", bloqueado,
    `status ${r.status}${tasa != null ? ` · tasa guardada ${tasa}` : ""}`)
}

// ───────────────────────────────────────────────────────────────────────────
// S4 · H-4 · Cargar comida a la cuenta de OTRA mesa (hallazgo ABIERTO)
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S4 · [H-4] cargar comida a la cuenta de otra mesa")
{
  // Cuenta víctima ZZTEST propia en Mesa 2.
  const abrir = await post("/api/public/open-accounts", { mesa: "Mesa 2", customerName: `${RUN}-victima` })
  let accId = abrir.json?.openAccount?.id || abrir.json?.account?.id
  if (!accId) {
    const { data } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`).maybeSingle()
    accId = data?.id
  }
  if (accId) cleanup.accounts.add(accId)
  const { data: antes } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()

  const ataque = await pedidoValido({ customerName: `${RUN}-atacante`, attachToTableOpenAccount: true })
  const ordId = ataque.json?.order?.id
  if (ordId) cleanup.orders.add(ordId)
  const { data: despues } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()
  const subio = Number(despues?.pending_usd ?? 0) - Number(antes?.pending_usd ?? 0)
  const { data: row } = ordId
    ? await supabase.from("orders").select("open_account_id,status").eq("id", ordId).maybeSingle()
    : { data: null }
  const atado = Boolean(cleanId(row?.open_account_id))

  // CERRADO el 2026-07-30 con el camino B: el pedido entra igual (la cocina lo
  // ve de una vez) pero NO se ata a la cuenta ni mueve el pendiente hasta que
  // alguien del local lo confirme desde el panel.
  const bloqueado = !atado && Math.abs(subio) < 0.005
  check("S4 · [H-4 CERRADO] un desconocido YA NO puede cargar comida a la cuenta ajena",
    bloqueado,
    bloqueado
      ? `pendiente intacto ($${subio.toFixed(2)}) y el pedido quedó SIN atar — lo tiene que sumar el personal`
      : `🔴 el fraude sigue vivo (atado=${atado}, pendiente +$${subio.toFixed(2)})`)

  // La otra mitad del trato con el dueño: atrasar la comida para tapar un
  // fraude poco frecuente sería peor que el fraude. El pedido TIENE que entrar.
  const enCocina = row?.status === "Nuevo"
  check("S4b · …pero el pedido SÍ entra y la cocina lo ve (no se atrasa el servicio)",
    Boolean(ordId) && enCocina,
    `status HTTP ${ataque.status} · pedido ${ordId ? "creado" : "NO creado"} · estado en base "${row?.status ?? "—"}" · avisa al cliente=${ataque.json?.openAccountAwaitingStaff === true}`)

  // S4c · El reverso, y la prueba de que el arreglo no rompió el negocio: con
  // la confirmación del PERSONAL el mismo pedido sí entra en la cuenta. Sin
  // esto, "bloqueado" podría significar simplemente que la función se rompió.
  if (ordId && accId) {
    const clave = env.ORDERS_CASHIER_PASSWORD || env.ORDERS_ADMIN_PASSWORD || env.ORDERS_OWNER_PASSWORD || ""
    const res = await fetch(`${BASE}/api/open-accounts/${encodeURIComponent(accId)}`, {
      method: "PATCH",
      headers: { ...H, "x-admin-password": clave },
      body: JSON.stringify({ action: "attachOrder", orderId: ordId }),
    })
    let json = null; try { json = await res.json() } catch {}
    const { data: tras } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()
    const subioConPersonal = Number(tras?.pending_usd ?? 0) - Number(antes?.pending_usd ?? 0)
    check("S4c · con la confirmación del personal SÍ se suma (no se pierde la venta)",
      res.status === 200 && subioConPersonal > 0,
      res.status === 200
        ? `caja confirmó y el pendiente subió $${subioConPersonal.toFixed(2)}`
        : `status ${res.status}${json?.error ? ` · ${json.error}` : ""}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// S5 · H-4 · Fingir la confirmación mandando openAccountId directo
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── S5 · [H-4] adjuntar por openAccountId directo")
{
  const abrir = await post("/api/public/open-accounts", { mesa: "Mesa 3", customerName: `${RUN}-victima2` })
  let accId = abrir.json?.openAccount?.id || abrir.json?.account?.id
  if (!accId) {
    const { data } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}-victima2%`).maybeSingle()
    accId = data?.id
  }
  if (accId) cleanup.accounts.add(accId)
  const { data: antes } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()

  const ataque = await pedidoValido({ customerName: `${RUN}-atacante2`, tableNumber: "Mesa 3", openAccountId: accId })
  const ordId2 = ataque.json?.order?.id
  if (ordId2) cleanup.orders.add(ordId2)
  const { data: despues } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()
  const subio = Number(despues?.pending_usd ?? 0) - Number(antes?.pending_usd ?? 0)
  const { data: row2 } = ordId2
    ? await supabase.from("orders").select("open_account_id").eq("id", ordId2).maybeSingle()
    : { data: null }
  const atado2 = Boolean(cleanId(row2?.open_account_id))

  // Tener el id de la cuenta en la mano (se saca del S1) tampoco sirve: el
  // camino B no distingue cómo pediste sumarte, solo QUIÉN lo confirma.
  const bloqueado = !atado2 && Math.abs(subio) < 0.005
  check("S5 · [H-4 CERRADO] mandar el openAccountId directo TAMPOCO carga a la cuenta",
    bloqueado,
    bloqueado
      ? `pendiente intacto ($${subio.toFixed(2)}) con el id de la cuenta en la mano`
      : `🔴 movió la cuenta (atado=${atado2}, +$${subio.toFixed(2)})`)
}

// ───────────────────────────────────────────────────────────────────────────
// LIMPIEZA (garantizada) + verificación
// ───────────────────────────────────────────────────────────────────────────
console.log("\n── limpieza")
{
  // Barre TODO lo del run por si algún id no quedó registrado.
  const { data: ordersRun } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  for (const o of ordersRun || []) cleanup.orders.add(o.id)
  for (const id of cleanup.orders) {
    await supabase.from("order_items").delete().eq("order_id", id)
    await supabase.from("orders").delete().eq("id", id)
  }
  for (const id of cleanup.accounts) await supabase.from("open_accounts").delete().eq("id", id)

  const { data: qO } = await supabase.from("orders").select("id").ilike("customer_name", `${RUN}%`)
  const { data: qA } = await supabase.from("open_accounts").select("id").ilike("customer_name", `${RUN}%`)
  check("limpieza · 0 pedidos y 0 cuentas ZZTEST-SEG restantes",
    (qO?.length ?? 0) === 0 && (qA?.length ?? 0) === 0,
    `pedidos=${qO?.length ?? 0} cuentas=${qA?.length ?? 0} (borrados ${cleanup.orders.size} pedidos, ${cleanup.accounts.size} cuentas)`)
}

console.log(`\n==== seguridad: ${pass} OK, ${fail} fallas ====`)
console.log("Nota: los checks están en positivo — un '✓' significa 'el ataque NO pasa'.")
console.log("H-1 (nombre del cliente) y H-4 (cargar comida a la cuenta ajena) se cerraron")
console.log("el 2026-07-30; S4b y S4c son la otra mitad del trato: el pedido igual entra a")
console.log("cocina, y con la confirmación del personal la venta sí se suma a la cuenta.")
process.exit(fail > 0 ? 1 : 0)
