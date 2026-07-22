// Lote v3 Brotherhood — F0 "Datos rápidos" (solo datos, sin schema).
// 1) Sede San Diego: fija googleMapsUrl en branchConfigs.
// 2) Quita "Por confirmar" de config.publicPaymentMethods (método público).
//
// Idempotente: se puede correr varias veces sin duplicar ni romper nada.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-lote-v3-data.mjs

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SAN_DIEGO_MAPS_URL = "https://maps.app.goo.gl/UZ3ExmvEYx8kaGZt7"

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

async function main() {
  // --- Cargar business_config (fila única id=1) ---
  const { data: row, error: readError } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()

  if (readError) throw new Error(readError.message)

  const config = row?.config && typeof row.config === "object" ? { ...row.config } : {}

  // --- Buscar la sede San Diego ---
  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select("id,name")

  if (branchError) throw new Error(branchError.message)

  const sanDiego = (branches || []).find((b) => normalizeName(b.name).includes("san diego"))

  if (!sanDiego) {
    console.warn("! No se encontró la sede San Diego; se omite el paso del mapa.")
  } else {
    const branchConfigs =
      config.branchConfigs && typeof config.branchConfigs === "object"
        ? { ...config.branchConfigs }
        : {}
    const current =
      branchConfigs[sanDiego.id] && typeof branchConfigs[sanDiego.id] === "object"
        ? { ...branchConfigs[sanDiego.id] }
        : {}
    current.googleMapsUrl = SAN_DIEGO_MAPS_URL
    current.updatedAt = new Date().toISOString()
    branchConfigs[sanDiego.id] = current
    config.branchConfigs = branchConfigs
    console.log(`+ San Diego (${sanDiego.id}) googleMapsUrl = ${SAN_DIEGO_MAPS_URL}`)
  }

  // --- Quitar "Por confirmar" de publicPaymentMethods ---
  const currentMethods = Array.isArray(config.publicPaymentMethods)
    ? config.publicPaymentMethods
    : []
  const filtered = currentMethods.filter(
    (m) => normalizeName(m) !== "por confirmar",
  )

  if (currentMethods.length && filtered.length !== currentMethods.length) {
    config.publicPaymentMethods = filtered
    console.log(`+ Quitado "Por confirmar" de publicPaymentMethods (${currentMethods.length} → ${filtered.length})`)
  } else if (!currentMethods.length) {
    console.log("= publicPaymentMethods no está seteado (usa el default sin 'Por confirmar')")
  } else {
    console.log("= publicPaymentMethods ya no tenía 'Por confirmar'")
  }

  config.updatedAt = new Date().toISOString()

  const { error: writeError } = await supabase
    .from("business_config")
    .upsert({ id: 1, config })

  if (writeError) throw new Error(writeError.message)

  console.log("Listo: F0 datos rápidos aplicados.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
