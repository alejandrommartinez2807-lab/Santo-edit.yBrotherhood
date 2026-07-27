// QA ronda 2026-07-27 · Estado REAL de la BD (no del repo): migraciones
// aplicadas o no, RLS vivo con la anon key, bucket de comprobantes.
// Solo LECTURA. Salida: lista APLICADA / PENDIENTE / SIN VERIFICAR.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

function loadEnvFile() {
  const text = readFileSync(".env.local", "utf8")
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=")
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ""),
        ]
      }),
  )
}

const env = loadEnvFile()
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const anon = anonKey
  ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false } })
  : null

const results = []
function report(name, state, detail = "") {
  results.push({ name, state, detail })
  console.log(`${state === "APLICADA" ? "✓" : state === "PENDIENTE" ? "✗" : "·"} ${name}: ${state}${detail ? " — " + detail : ""}`)
}

// Columna existe = migración de columnas aplicada (42703 si falta).
async function columnCheck(name, table, columns) {
  const { error } = await service.from(table).select(columns).limit(1)
  if (!error) return report(name, "APLICADA")
  if (error.code === "42703") return report(name, "PENDIENTE", error.message)
  report(name, "SIN VERIFICAR", `${error.code}: ${error.message}`)
}

await columnCheck("0030 payment_proofs segunda imagen", "payment_proofs", "proof_image_url_2, proof_file_id_2, proof_file_name_2")
await columnCheck("0031 orders.payment_method", "orders", "payment_method")

// RLS vivo: la anon key NO debe poder leer estas tablas (deny-all sin políticas).
async function rlsCheck(name, table) {
  if (!anon) return report(name, "SIN VERIFICAR", "no hay NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local")
  const { data, error } = await anon.from(table).select("*").limit(1)
  if (error) return report(name, "APLICADA", `anon bloqueado (${error.code ?? error.message})`)
  if ((data?.length ?? 0) === 0) return report(name, "APLICADA", "anon recibe 0 filas (RLS deny-all)")
  report(name, "PENDIENTE", `¡anon LEE ${data.length} fila(s) de ${table}!`)
}

await rlsCheck("0032 RLS orders (muestra del barrido)", "orders")
await rlsCheck("0032 RLS payment_proofs", "payment_proofs")
await rlsCheck("0032 RLS order_branch_counters", "order_branch_counters")
await rlsCheck("0034 RLS supplier_purchase_payments", "supplier_purchase_payments")

// 0032 (2): bucket payment-proofs privado.
{
  const { data, error } = await service.storage.getBucket("payment-proofs")
  if (error) report("0032 bucket payment-proofs privado", "SIN VERIFICAR", error.message)
  else report("0032 bucket payment-proofs privado", data.public ? "PENDIENTE" : "APLICADA", `public=${data.public}`)
}

// 0033/0035: el índice único normalizado no se puede leer por PostgREST; se
// comprueba conductualmente en F2 (dos cuentas "Mesa 1"/"mesa 1" en la misma
// sede deben chocar). Aquí solo dejamos constancia.
report("0033/0035 índice cuenta abierta por sede", "SIN VERIFICAR", "prueba conductual en F2")

const pendientes = results.filter((r) => r.state === "PENDIENTE")
console.log(`\n==== ${results.length} chequeos · ${pendientes.length} PENDIENTES ====`)
process.exit(0)
