// LIMPIEZA de los datos de prueba que los e2e de Brotherhood dejaron por error
// en la BD de PRODUCCIÓN de Pizzería 007 el 2026-07-27 ~04:25 UTC.
// Causa: en localhost:3000 vivía el dev server de Pizzería y los e2e de la
// línea base le escribieron por API; su limpieza borra en el Supabase de
// Brotherhood, así que todo quedó huérfano allá.
// CORRER A MANO: node zz-clean-pizzeria.mjs   (desde D:\Santo edit)
// Borra SOLO los ids listados (verificados uno a uno en solo-lectura).
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const txt = readFileSync("C:/Users/maye2/Videos/pizzeria-007-nueva/.env.local", "utf8")
const env = Object.fromEntries(
  txt.split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=")
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const ORDERS = [
  "ord-ms2q412d-26j9eudnah", // SMOKE-PAGO
  "ord-ms2q43rd-edullnyiji", // SMOKE-B-PED
  "ord-ms2q4by9-etybbu1blt", // SMOKE-FISCAL
  "ord-ms2q5auw-ik6j9eodqk", // IDEM-E2E
]
const SUPPLIERS = [
  "1f388b82-9441-4fee-902b-800871d35c07", // SMOKE-1785126324507-PROV
  "13c6bd84-5748-43d0-acdf-0ceb590bac7f", // PAYABLE-1785126341417-PROV
  "79737f57-6077-4983-8a17-eb6aa08bc334", // PAYABLE-1785126527755-PROV
]
const PURCHASES = [
  "f6382d26-ec50-4599-a859-ba2cfef4a53e",
  "e340a30d-9d7e-428b-8af9-c5ae409208e8",
  "b5aa9d90-4f43-4708-a38c-3f981b92f3f9",
]
const INVENTORY_ITEMS = ["inv-1785126327625-05jag9"] // SMOKE-...-HARINA

async function wipe(table, column, ids) {
  if (!ids.length) return
  const { data, error } = await sb.from(table).delete().in(column, ids).select("id")
  console.log(`${table}: ${error ? "ERROR " + error.message : (data?.length ?? 0) + " borrados"}`)
}

// Dependientes primero.
await wipe("supplier_purchase_payments", "purchase_id", PURCHASES)
await wipe("order_items", "order_id", ORDERS)
await wipe("inventory_movements", "item_id", INVENTORY_ITEMS).catch(() => {})
await wipe("supplier_purchases", "id", PURCHASES)
await wipe("orders", "id", ORDERS)
await wipe("suppliers", "id", SUPPLIERS)
await wipe("inventory_items", "id", INVENTORY_ITEMS)

// Verificación final: no debe quedar nada con los prefijos de prueba.
for (const [table, column] of [
  ["orders", "customer_name"],
  ["suppliers", "name"],
  ["inventory_items", "name"],
  ["supplier_purchases", "supplier_name"],
]) {
  const { data, error } = await sb
    .from(table)
    .select("id")
    .or(`${column}.ilike.SMOKE-%,${column}.ilike.PAYABLE-%,${column}.ilike.IDEM-%`)
  console.log(`verificación ${table}: ${error ? error.message : (data?.length ?? 0) + " restantes"}`)
}
