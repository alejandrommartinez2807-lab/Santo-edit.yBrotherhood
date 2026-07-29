// PRUEBA DEL WEB PUSH CON VAPID REAL (desbloqueado 2026-07-29).
//
// Los navegadores de automatización de esta máquina no pueden suscribirse a
// un push service real (el Chromium de Playwright no trae credenciales y
// Edge lo niega bajo automatización), así que la entrega se prueba con un
// RECEPTOR Web Push propio: un servidor HTTPS local que recibe lo que el
// backend envía y lo DESCIFRA con las claves del "navegador" simulado
// (ECDH P-256 + auth, el mismo protocolo RFC 8291 que usa un teléfono).
//
// Eso demuestra la cadena completa del servidor: claves VAPID cargadas,
// suscripción guardada, disparo al marcar LISTO, firma VAPID válida, payload
// aes128gcm descifrable y contenido correcto. La única milla que NO cubre es
// la pantalla del dispositivo — eso se ve con un teléfono real.
//
// Requiere que el dev/prod server local corra con
// NODE_TLS_REJECT_UNAUTHORIZED=0 (el receptor usa certificado propio).
import { createServer } from "node:https"
import { readFileSync } from "node:fs"
import { createECDH, randomBytes, createHash } from "node:crypto"
import { createRequire } from "node:module"
import { guardLive, supabase } from "./lib/simulation-guard.mjs"
import { loginStaff, actorHeaders, publicHeaders } from "./lib/auth.mjs"
import { get, post, patch } from "./lib/api-client.mjs"
import { check, summary } from "./lib/assertions.mjs"
import { openDayLog, logLine, loadState } from "./lib/evidence-writer.mjs"

const require = createRequire(import.meta.url)
// http_ece viaja con web-push (dependencia ya instalada): descifra aes128gcm.
const ece = require("http_ece")

const SCRATCH =
  "C:/Users/maye2/AppData/Local/Temp/claude/D--Santo-edit/7e277a35-ee04-449a-b2f7-3b9b9aabcc78/scratchpad"
const SINK_PORT = 3999

await guardLive({ requireMarker: true })
openDayLog("push", "Prueba de web push con VAPID (receptor RFC 8291 propio)")

const st = loadState()
const P = st.ids.principal
const RATE = Number(st.rate || 40)
await loginStaff("alejandro", "Sim-alejandro-2026!")
const owner = actorHeaders({ username: "alejandro", ip: "10.75.1.1", branchId: P })
const cliente = publicHeaders("10.75.2.1", P)

// ── 1 · El servidor anuncia el push habilitado con la clave de SIMULACIÓN ──
const info = (await get("/api/public/push", cliente)).json
const envPublicKey = readFileSync(".env.simulacion", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("VAPID_PUBLIC_KEY="))
  ?.slice("VAPID_PUBLIC_KEY=".length)
  .trim()
check("PUSH-1", "el servidor anuncia push habilitado con la clave pública del entorno",
  info?.enabled === true && info?.publicKey === envPublicKey,
  `enabled=${info?.enabled} coincide=${info?.publicKey === envPublicKey}`)

// ── 2 · "Navegador" simulado: claves ECDH P-256 + auth (RFC 8291) ──────────
const browserEcdh = createECDH("prime256v1")
browserEcdh.generateKeys()
const b64url = (buf) => Buffer.from(buf).toString("base64url")
const subscriptionKeys = {
  p256dh: b64url(browserEcdh.getPublicKey()),
  auth: b64url(randomBytes(16)),
}

// ── 3 · Receptor HTTPS local (el "push service" de este navegador) ─────────
const received = []
const sink = createServer(
  {
    key: readFileSync(`${SCRATCH}/push-sink-key.pem`),
    cert: readFileSync(`${SCRATCH}/push-sink-cert.pem`),
  },
  (req, res) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      received.push({
        headers: req.headers,
        body: Buffer.concat(chunks),
      })
      res.writeHead(201).end()
    })
  },
)
await new Promise((resolve) => sink.listen(SINK_PORT, "127.0.0.1", resolve))

const pedidosCreados = []
try {
  // ── 4 · Pedido público real + suscripción a su aviso ─────────────────────
  const menu = (await get("/api/public/products", cliente)).json
  const prod = (menu.menuProducts || menu.products).find((p) => p.name === "Burger Clásica")
  const orderRes = await post("/api/orders", {
    customerName: "SIM push E2E",
    customerPhone: "04141119998",
    tableNumber: "Pick up",
    orderType: "Para llevar",
    paymentMethod: "Pago móvil",
    exchangeRate: RATE,
    items: [{ id: prod.id, name: prod.name, price: prod.price, quantity: 1 }],
  }, cliente, { label: "POST /api/orders (push)" })
  const orderId = orderRes.json?.order?.id
  if (orderId) pedidosCreados.push(orderId)

  const subRes = await post("/api/public/push", {
    orderId,
    subscription: {
      endpoint: `https://127.0.0.1:${SINK_PORT}/sim-push-sink`,
      keys: subscriptionKeys,
    },
  }, cliente, { label: "POST /api/public/push" })
  check("PUSH-2", "la suscripción del pedido se guarda (201)",
    subRes.status === 201, `status=${subRes.status} ${JSON.stringify(subRes.json)}`)

  // ── 5 · Caja lo marca LISTO: el backend debe EMPUJAR de verdad ───────────
  for (const status of ["Preparando", "Listo"]) {
    const res = await patch(`/api/orders/${orderId}`, { status }, owner)
    if (res.status !== 200) logLine(`PATCH ${status} → ${res.status} ${JSON.stringify(res.json)}`)
  }
  // El envío es asíncrono dentro de la ruta: espera corta con reintentos.
  for (let i = 0; i < 20 && received.length === 0; i += 1) {
    await new Promise((r) => setTimeout(r, 500))
  }

  check("PUSH-3", "el push LLEGÓ al receptor al marcar el pedido LISTO",
    received.length > 0, `entregas=${received.length}`)

  const delivery = received[0]
  const authHeader = String(delivery?.headers?.authorization || "")
  check("PUSH-4", "la entrega viene FIRMADA con VAPID (JWT + la clave pública del entorno)",
    /^vapid t=.+k=/.test(authHeader) && authHeader.includes(String(envPublicKey)),
    `authorization=${authHeader.slice(0, 40)}… incluyeClave=${authHeader.includes(String(envPublicKey))}`)
  check("PUSH-5", "el payload viaja CIFRADO (aes128gcm, RFC 8291)",
    String(delivery?.headers?.["content-encoding"]) === "aes128gcm" && delivery.body.length > 0,
    `encoding=${delivery?.headers?.["content-encoding"]} bytes=${delivery?.body?.length}`)

  // ── 6 · El "navegador" DESCIFRA el payload con sus claves ────────────────
  let decrypted = ""
  try {
    decrypted = ece
      .decrypt(delivery.body, {
        version: "aes128gcm",
        privateKey: browserEcdh,
        dh: subscriptionKeys.p256dh,
        authSecret: subscriptionKeys.auth,
      })
      .toString("utf8")
  } catch (error) {
    decrypted = `(fallo al descifrar: ${error.message})`
  }
  let payload = null
  try {
    payload = JSON.parse(decrypted)
  } catch {
    payload = null
  }
  check("PUSH-6", "el payload descifrado es el aviso real de 'pedido listo'",
    Boolean(payload) && /listo/i.test(JSON.stringify(payload)),
    `payload=${decrypted.slice(0, 160)}`)

  // ── 7 · La suscripción quedó en la base asociada al pedido ──────────────
  const { data: subRow } = await supabase
    .from("push_subscriptions").select("order_id,endpoint").eq("order_id", orderId).maybeSingle()
  check("PUSH-7", "la suscripción vive en push_subscriptions con su pedido",
    Boolean(subRow) && String(subRow.endpoint).includes("sim-push-sink"),
    `row=${JSON.stringify(subRow)}`)
} finally {
  sink.close()
  for (const id of pedidosCreados) {
    await supabase.from("push_subscriptions").delete().eq("order_id", id)
    await supabase.from("order_items").delete().eq("order_id", id)
    await supabase.from("orders").delete().eq("id", id)
  }
  logLine(`\nlimpieza: ${pedidosCreados.length} pedido(s) de prueba y sus suscripciones eliminados`)
}

const result = summary("Prueba de web push con VAPID")
process.exit(result.fail > 0 ? 1 : 0)
