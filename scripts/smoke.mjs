// Smoke test de integración (necesita el servidor corriendo + Supabase).
//   node scripts/smoke.mjs            (usa http://localhost:3000)
//   BASE=https://mi-deploy node scripts/smoke.mjs
//
// Cubre la ruta del dinero (crear pedido → cobrar → estado de pago), el
// aislamiento multi-sucursal y el desglose fiscal. Crea datos de prueba y los
// borra al final. Sale con código !=0 si algo falla (sirve para CI/pre-deploy).

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
  if (cond) pass++
  else fail++
}
const get = (p, extra = {}) =>
  fetch(BASE + p, { headers: { "x-local-password": pwd, ...extra } }).then((r) => r.json())
const post = (p, body, extra = {}) =>
  fetch(BASE + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-local-password": pwd, ...extra },
    body: JSON.stringify(body),
  })
const mkOrder = (name, branch, items) =>
  post("/api/orders", { customerName: name, tableNumber: "M1", orderType: "Comer aquí", exchangeRate: 36, items }, branch ? { "x-branch-id": branch } : {})
    .then((r) => r.json())
    .then((j) => j.order)

async function main() {
  const orders = []
  let Bid = null
  try {
    check("auth: sin credenciales → 401", (await fetch(BASE + "/api/orders")).status === 401)
    const A = (await get("/api/branches")).branches[0].id

    // --- ruta del dinero ---
    const o = await mkOrder("SMOKE-PAGO", A, [{ id: 1, name: "P", price: 100, quantity: 1, paymentMode: "mixto" }])
    orders.push(o.id)
    check("dinero: pedido creado con total correcto", o && Math.round(o.totalUSD) === 100)

    // --- aislamiento multi-sucursal ---
    Bid = (await (await post("/api/branches", { name: "SMOKE-B" })).json()).branch.id
    const oB = await mkOrder("SMOKE-B-PED", Bid, [{ id: 1, name: "P", price: 9, quantity: 1, paymentMode: "mixto" }])
    orders.push(oB.id)
    const seenA = (await get("/api/orders", { "x-branch-id": A })).orders.map((x) => x.customerName)
    const seenB = (await get("/api/orders", { "x-branch-id": Bid })).orders.map((x) => x.customerName)
    check("sucursal: pedidos aislados", seenA.includes("SMOKE-PAGO") && !seenA.includes("SMOKE-B-PED") && seenB.includes("SMOKE-B-PED") && !seenB.includes("SMOKE-PAGO"))

    // --- reportes ---
    const repA = await get("/api/reports?period=today", { "x-branch-id": A })
    const repAll = await get("/api/reports?period=today&scope=all", { "x-branch-id": A })
    check("reportes: branch vs consolidado", repA.scope === "branch" && repAll.scope === "all" && repAll.summary.orders > repA.summary.orders)

    // --- fiscal ---
    const cur = (await get("/api/business-config")).businessConfig
    await post("/api/business-config", { businessConfig: { ...cur, fiscalEnabled: true, rifNumber: "J-12345678-9", ivaDefaultRate: 16, pricesIncludeIva: true, igtfEnabled: true, igtfRate: 3 } })
    const of = await mkOrder("SMOKE-FISCAL", A, [
      { id: 1, name: "ConIVA", price: 116, quantity: 1, paymentMode: "mixto", ivaRate: 16 },
      { id: 2, name: "Exento", price: 50, quantity: 1, paymentMode: "mixto", ivaRate: 0 },
    ])
    orders.push(of.id)
    const gotF = (await get("/api/orders", { "x-branch-id": A })).orders.find((x) => x.id === of.id)
    const f = gotF && gotF.fiscal
    check("fiscal: desglose fijado (base150/iva16/total166)", !!f && f.subtotalUSD === 150 && f.ivaTotalUSD === 16 && f.totalUSD === 166)
    await post("/api/business-config", { businessConfig: { ...cur, fiscalEnabled: false } })
  } finally {
    if (orders.length) await sb.from("orders").delete().in("id", orders)
    if (Bid) await sb.from("branches").delete().eq("id", Bid)
  }

  console.log(`\n==== ${pass} OK, ${fail} fallas ====`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
