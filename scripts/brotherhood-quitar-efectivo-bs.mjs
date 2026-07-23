// Quita "Efectivo en Bs" de los métodos de pago públicos de Brotherhood
// (pedido del dueño 2026-07-23). Idempotente: si ya no está, no hace nada.
// Uso: node --env-file=.env.local scripts/brotherhood-quitar-efectivo-bs.mjs
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function isEfectivoBs(value) {
  const n = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
  return n.includes("efectivo") && (n.includes("bs") || n.includes("boliv"))
}

async function main() {
  const { data: row, error } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const config = row?.config && typeof row.config === "object" ? { ...row.config } : {}
  const methods = Array.isArray(config.publicPaymentMethods) ? [...config.publicPaymentMethods] : []
  const next = methods.filter((m) => !isEfectivoBs(m))

  if (next.length === methods.length) {
    console.log("= 'Efectivo en Bs' ya no estaba en publicPaymentMethods:", JSON.stringify(methods))
    return
  }

  config.publicPaymentMethods = next
  // Limpia también su detalle si existía.
  if (config.publicPaymentMethodDetails && typeof config.publicPaymentMethodDetails === "object") {
    const details = { ...config.publicPaymentMethodDetails }
    for (const key of Object.keys(details)) if (isEfectivoBs(key)) delete details[key]
    config.publicPaymentMethodDetails = details
  }
  config.updatedAt = new Date().toISOString()

  const { error: writeError } = await supabase.from("business_config").upsert({ id: 1, config })
  if (writeError) throw new Error(writeError.message)

  console.log("+ 'Efectivo en Bs' quitado.")
  console.log("  antes:", JSON.stringify(methods))
  console.log("  ahora:", JSON.stringify(next))
}

main().catch((e) => { console.error(e); process.exit(1) })
