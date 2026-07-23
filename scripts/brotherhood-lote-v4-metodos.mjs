// Lote v4 Brotherhood — F6: métodos de pago Zelle vs Transferencia.
//
// Estado detectado 2026-07-22: publicPaymentMethods no tenía "Zelle" (por eso el
// pago mixto solo ofrecía "Efectivo en divisas" como divisa), y el dato de
// "Transferencia" era en realidad "Datos de zelle" (mal etiquetado).
//
// Este script (idempotente):
//  1) Agrega "Zelle" a publicPaymentMethods (es divisa → aparece en el dropdown
//     de divisas del pago mixto).
//  2) Si el dato de "Transferencia" es en realidad de Zelle, lo MUEVE a la llave
//     "Zelle" y deja "Transferencia" con un texto guía para que el dueño ponga
//     los datos reales de la transferencia en Bs.
//  3) No pisa datos que ya estén bien puestos.
//
// El dueño luego ajusta los textos reales en Configuración.
//
// Uso:  node --env-file=.env.local scripts/brotherhood-lote-v4-metodos.mjs

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TRANSFER_PLACEHOLDER =
  "Escribe aquí los datos de tu transferencia en Bs: banco, número de cuenta, cédula/RIF y nombre."

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

async function main() {
  const { data: row, error } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const config = row?.config && typeof row.config === "object" ? { ...row.config } : {}

  // --- Métodos ---
  const methods = Array.isArray(config.publicPaymentMethods)
    ? [...config.publicPaymentMethods]
    : []
  const hasZelle = methods.some((m) => normalize(m) === "zelle")

  if (!hasZelle) {
    // Insertar Zelle junto a las divisas (después de "Efectivo en divisas" si
    // existe; si no, al final).
    const idx = methods.findIndex((m) => normalize(m).includes("divisa"))
    if (idx >= 0) methods.splice(idx + 1, 0, "Zelle")
    else methods.push("Zelle")
    config.publicPaymentMethods = methods
    console.log(`+ "Zelle" agregado a publicPaymentMethods → ${JSON.stringify(methods)}`)
  } else {
    console.log("= Zelle ya estaba en publicPaymentMethods")
  }

  // --- Datos por método ---
  const details =
    config.publicPaymentMethodDetails && typeof config.publicPaymentMethodDetails === "object"
      ? { ...config.publicPaymentMethodDetails }
      : {}

  const transferData = String(details["Transferencia"] || "")
  const transferIsActuallyZelle = normalize(transferData).includes("zelle")

  if (!details["Zelle"] && transferIsActuallyZelle) {
    // Mover el dato de zelle de "Transferencia" a "Zelle".
    details["Zelle"] = transferData
    details["Transferencia"] = TRANSFER_PLACEHOLDER
    console.log('+ Dato de zelle movido de "Transferencia" a "Zelle"; "Transferencia" con texto guía')
  } else if (!details["Zelle"]) {
    details["Zelle"] = "Escribe aquí tu correo/teléfono de Zelle y el nombre del titular."
    console.log('+ "Zelle" agregado con texto guía (Transferencia sin cambios)')
  } else {
    console.log("= Zelle ya tenía datos; sin cambios en detalles")
  }

  if (!details["Transferencia"]) {
    details["Transferencia"] = TRANSFER_PLACEHOLDER
  }

  config.publicPaymentMethodDetails = details
  config.updatedAt = new Date().toISOString()

  const { error: writeError } = await supabase
    .from("business_config")
    .upsert({ id: 1, config })

  if (writeError) throw new Error(writeError.message)

  console.log("Listo: F6 métodos (Zelle/Transferencia) aplicado.")
  console.log("  publicPaymentMethods:", JSON.stringify(config.publicPaymentMethods))
  console.log("  detalles:", Object.keys(details).join(", "))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
