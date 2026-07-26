// Limpia dos textos VIEJOS del carrito que estaban guardados pero muertos.
//
// Contexto (2026-07-25): "Etiqueta del total" (publicCartTotalLabel) y "Texto
// bajo el total" (publicCartTotalHint) existían en Configuración pero no se
// usaban en ninguna parte de la página. Al conectarlos, sus valores guardados
// —"Total a cobrar" y "Total general en divisas", del diseño anterior— pisaron
// la redacción en cristiano del rediseño ("Tienes que pagar lo siguiente:").
//
// Este script borra esos valores para que manden los nuevos valores por
// defecto, que SON la redacción actual. El dueño puede escribir los suyos
// cuando quiera desde Configuración.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-textos-carrito.mjs

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Solo se borran si siguen teniendo el texto viejo: si el dueño ya escribió el
// suyo, no se toca.
const STALE = {
  publicCartTotalLabel: "Total a cobrar",
  publicCartTotalHint: "Total general en divisas",
}

async function main() {
  const { data: row, error } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const config = row?.config && typeof row.config === "object" ? { ...row.config } : {}
  const changes = []

  for (const [key, staleValue] of Object.entries(STALE)) {
    const current = String(config[key] || "").trim()
    if (!current) continue
    if (current !== staleValue) {
      console.log(`· ${key}: el dueño ya puso "${current}" — no se toca.`)
      continue
    }
    config[key] = ""
    changes.push(`${key}: "${staleValue}" → (vacío, usa el texto actual de la página)`)
  }

  if (!changes.length) {
    console.log("Nada que limpiar.")
    return
  }

  config.updatedAt = new Date().toISOString()

  const { error: saveError } = await supabase
    .from("business_config")
    .upsert({ id: 1, config })

  if (saveError) throw new Error(saveError.message)

  console.log("Limpiado:")
  for (const change of changes) console.log(`  · ${change}`)
}

main().catch((error) => {
  console.error("Falló:", error.message)
  process.exitCode = 1
})
