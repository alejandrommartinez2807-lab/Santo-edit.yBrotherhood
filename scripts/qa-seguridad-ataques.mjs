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
  // Es un hallazgo ABIERTO: hoy "pasa" (expone). El check documenta el estado.
  check("S1 · [H-1 ABIERTO] el endpoint público expone datos de la cuenta sin clave",
    conNombre > 0 || conMontos > 0,
    conNombre > 0 ? `🔴 filtra nombre del cliente desde internet (decisión del dueño pendiente)` : "solo montos")
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
  const { data: row } = ordId ? await supabase.from("orders").select("open_account_id").eq("id", ordId).maybeSingle() : { data: null }
  const atado = row?.open_account_id === accId

  // ABIERTO hoy: el pedido se ata y el pendiente sube SIN que nadie confirme.
  // Cuando se implemente el camino B este check debe invertirse.
  const fraudeVivo = atado && subio > 0
  check("S4 · [H-4 ABIERTO] un desconocido carga comida a la cuenta ajena sin confirmación",
    fraudeVivo,
    fraudeVivo ? `🔴 pendiente +$${subio.toFixed(2)} sin que el local confirme — pendiente el camino B`
      : `parece cerrado (atado=${atado}, subió $${subio.toFixed(2)}) — ¿ya se implementó el camino B?`)
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
  if (ataque.json?.order?.id) cleanup.orders.add(ataque.json.order.id)
  const { data: despues } = await supabase.from("open_accounts").select("pending_usd").eq("id", accId).maybeSingle()
  const subio = Number(despues?.pending_usd ?? 0) - Number(antes?.pending_usd ?? 0)
  const fraudeVivo = subio > 0
  check("S5 · [H-4 ABIERTO] mandar el openAccountId directo también carga a la cuenta",
    fraudeVivo,
    fraudeVivo ? `🔴 pendiente +$${subio.toFixed(2)} con el id en la mano` : `no movió la cuenta ($${subio.toFixed(2)})`)
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
console.log("Nota: S1, S4 y S5 son hallazgos ABIERTOS — su '✓' significa 'confirmado que")
console.log("el hueco existe HOY'. Cuando se cierren (quitar el nombre / camino B), estos")
console.log("checks hay que INVERTIRLOS para que verifiquen que ya no se puede.")
process.exit(fail > 0 ? 1 : 0)
