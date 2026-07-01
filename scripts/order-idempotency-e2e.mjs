// E2E de idempotencia de pedidos (sync offline). Necesita dev server + Supabase.
//   node scripts/order-idempotency-e2e.mjs
//
// Verifica que reenviar un pedido con el mismo client_order_id NO crea un
// duplicado: el servidor devuelve el pedido ya existente (idempotent:true),
// incluso si el payload reenviado cambió. Limpia lo que crea. Requiere la
// migración 0018_order_idempotency aplicada.

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const BASE = process.env.BASE || "http://localhost:3000"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const pwd = env.ORDERS_OWNER_PASSWORD

let pass = 0
let fail = 0
const check = (name, cond) => {
  console.log((cond ? "✓" : "✗ FALLA") + " " + name)
  cond ? pass++ : fail++
}
const get = (p, extra = {}) =>
  fetch(BASE + p, { headers: { "x-local-password": pwd, ...extra } }).then((r) => r.json())
const post = (p, body, extra = {}) =>
  fetch(BASE + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-local-password": pwd, ...extra },
    body: JSON.stringify(body),
  }).then((r) => r.json())

const clientOrderId = `e2e-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function main() {
  let createdId = null
  try {
    const A = (await get("/api/branches")).branches[0].id
    const branch = { "x-branch-id": A }

    const base = {
      clientOrderId,
      customerName: "IDEM-E2E",
      tableNumber: "M1",
      orderType: "Comer aquí",
      exchangeRate: 36,
      items: [{ id: 1, name: "P", price: 100, quantity: 1, paymentMode: "mixto" }],
    }

    // 1) Primera creación.
    const r1 = await post("/api/orders", base, branch)
    createdId = r1.order?.id
    check("1ª vez: pedido creado", Boolean(createdId) && !r1.idempotent)
    check("1ª vez: total correcto", Math.round(r1.order?.totalUSD) === 100)

    // 2) Reenvío idéntico (simula reintento de la cola offline).
    const r2 = await post("/api/orders", base, branch)
    check("reenvío idéntico: devuelve el MISMO pedido", r2.order?.id === createdId)
    check("reenvío idéntico: marcado idempotent", r2.idempotent === true)

    // 3) Reenvío con MISMA clave pero payload distinto (no debe crear ni mutar).
    const mutated = {
      ...base,
      customerName: "IDEM-E2E-CAMBIADO",
      items: [{ id: 1, name: "P", price: 999, quantity: 1, paymentMode: "mixto" }],
    }
    const r3 = await post("/api/orders", mutated, branch)
    check("reenvío mutado: mismo pedido, no uno nuevo", r3.order?.id === createdId)
    check("reenvío mutado: conserva total original (100, no 999)", Math.round(r3.order?.totalUSD) === 100)

    // 4) En DB: existe exactamente UNA fila con ese client_order_id.
    const { data: rows } = await sb
      .from("orders")
      .select("id")
      .eq("client_order_id", clientOrderId)
    check("DB: exactamente 1 fila para el client_order_id", (rows?.length ?? 0) === 1)
  } finally {
    if (createdId) await sb.from("orders").delete().eq("id", createdId)
    // Por si una carrera dejara alguna fila extra, limpiamos por clave también.
    await sb.from("orders").delete().eq("client_order_id", clientOrderId)
  }

  console.log(`\n==== ${pass} OK, ${fail} fallas ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
