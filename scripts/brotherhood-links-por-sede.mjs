// Carga los datos que pasó el dueño el 2026-07-25 (idempotente):
//
//  1) Instagram GENERAL del negocio (una sola cuenta para las dos sedes):
//     https://www.instagram.com/brotherhood_vzla/
//     Se guarda arriba, no por sede: cada sucursal lo hereda mientras no tenga
//     una cuenta propia.
//  2) Link de Google Maps POR SEDE (alimenta "Cómo llegar" de "Nuestros
//     locales" y, sin link de reseñas propio, también el botón "Reseñas").
//  3) "Preguntar en qué se pagó el delivery" APAGADO: la opción sigue en
//     Configuración para quien la quiera, pero no estorba el cobro.
//
// No pisa nada más de la configuración ni de las otras sedes.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-links-por-sede.mjs

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const INSTAGRAM_URL = "https://www.instagram.com/brotherhood_vzla/"

// Se busca la sede por nombre (sin acentos ni mayúsculas) para no depender de
// ids que cambian entre entornos.
const MAPS_BY_BRANCH = [
  { match: "vinedo", url: "https://maps.app.goo.gl/Az5L7jfzV6UDgtgTA" },
  { match: "san diego", url: "https://maps.app.goo.gl/faQaMiKRhanjLitS8" },
]

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

async function main() {
  const { data: branches, error: branchesError } = await supabase
    .from("branches")
    .select("id, name, is_active")
    .order("sort_order", { ascending: true })

  if (branchesError) throw new Error(branchesError.message)

  const { data: row, error } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const config = row?.config && typeof row.config === "object" ? { ...row.config } : {}
  const branchConfigs =
    config.branchConfigs && typeof config.branchConfigs === "object"
      ? { ...config.branchConfigs }
      : {}

  const changes = []

  if (config.instagramUrl !== INSTAGRAM_URL) {
    changes.push(`Instagram general: ${config.instagramUrl || "(vacío)"} → ${INSTAGRAM_URL}`)
    config.instagramUrl = INSTAGRAM_URL
  }

  if (config.cashierDeliveryPaymentInEnabled !== false) {
    changes.push(`"Delivery pagado en": ${config.cashierDeliveryPaymentInEnabled} → false (apagado)`)
    config.cashierDeliveryPaymentInEnabled = false
  }

  for (const target of MAPS_BY_BRANCH) {
    const branch = (branches ?? []).find((item) => normalize(item.name).includes(target.match))

    if (!branch) {
      console.warn(`⚠️  No encontré la sede "${target.match}" — se omite su link de Maps.`)
      continue
    }

    const current =
      branchConfigs[branch.id] && typeof branchConfigs[branch.id] === "object"
        ? { ...branchConfigs[branch.id] }
        : {}

    if (current.googleMapsUrl === target.url) continue

    changes.push(
      `Maps de "${branch.name}": ${current.googleMapsUrl || "(vacío)"} → ${target.url}`,
    )
    current.googleMapsUrl = target.url
    branchConfigs[branch.id] = current
  }

  if (!changes.length) {
    console.log("Todo ya estaba puesto. No se tocó nada.")
    return
  }

  config.branchConfigs = branchConfigs
  config.updatedAt = new Date().toISOString()

  const { error: saveError } = await supabase
    .from("business_config")
    .upsert({ id: 1, config })

  if (saveError) throw new Error(saveError.message)

  console.log("Guardado:")
  for (const change of changes) console.log(`  · ${change}`)
}

main().catch((error) => {
  console.error("Falló:", error.message)
  process.exitCode = 1
})
