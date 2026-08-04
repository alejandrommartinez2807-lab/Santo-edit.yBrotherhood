// Limpia de `business_config.staffUsers` las entradas huérfanas que dejaron las
// rondas de QA (`zztest-…`). Son inofensivas —el panel lista desde la tabla
// `staff_users`, así que no se ven— pero ensucian la configuración que hereda
// el cliente y hacen que ese JSON pese de más.
//
// Solo borra una entrada si cumple LAS DOS condiciones:
//   1. su usuario empieza por `zztest-`
//   2. NO existe una fila suya en `staff_users` (o sea: nadie puede entrar con ella)
//
// Uso:
//   node scripts/limpiar-usuarios-zztest.mjs            → solo informa (no toca nada)
//   node scripts/limpiar-usuarios-zztest.mjs --aplicar   → escribe, con respaldo previo
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const APLICAR = process.argv.includes("--aplicar")

function leerEnv(archivo = ".env.local") {
  return Object.fromEntries(
    fs
      .readFileSync(archivo, "utf8")
      .split(/\r?\n/)
      .filter((linea) => /^[A-Z_0-9]+=/.test(linea))
      .map((linea) => {
        const i = linea.indexOf("=")
        return [linea.slice(0, i), linea.slice(i + 1).replace(/^["']|["']$/g, "")]
      })
  )
}

const env = leerEnv()
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: fila, error: errorConfig } = await db
  .from("business_config")
  .select("id, config")
  .maybeSingle()

if (errorConfig) throw new Error(`No se pudo leer la configuración: ${errorConfig.message}`)
if (!fila) throw new Error("No hay fila de configuración del negocio")

const config = fila.config || {}
const usuarios = Array.isArray(config.staffUsers) ? config.staffUsers : []

const { data: reales, error: errorStaff } = await db.from("staff_users").select("id")
if (errorStaff) throw new Error(`No se pudo leer el personal: ${errorStaff.message}`)

const idsReales = new Set((reales || []).map((u) => u.id))

const esHuerfanoDeQa = (usuario) =>
  /^zztest-/i.test(String(usuario?.username || "")) && !idsReales.has(usuario?.id)

const aBorrar = usuarios.filter(esHuerfanoDeQa)
const quedan = usuarios.filter((usuario) => !esHuerfanoDeQa(usuario))

console.log(`usuarios en la configuración: ${usuarios.length}`)
console.log(`filas reales en staff_users:  ${idsReales.size}`)
console.log(`huérfanos de QA a borrar:     ${aBorrar.length}`)
console.log(`quedarían:                    ${quedan.length}`)
console.log(`\nse conservan: ${quedan.map((u) => u.username || u.id).join(", ") || "(ninguno)"}`)

// Red de seguridad: si el filtro se llevara por delante a alguien real, no se
// escribe nada. Los tres usuarios del local valen más que la limpieza.
const perdidosReales = usuarios.filter((u) => idsReales.has(u.id) && !quedan.includes(u))
if (perdidosReales.length) {
  console.error(`\n✖ ABORTADO: el filtro se llevaría ${perdidosReales.length} usuario(s) real(es).`)
  process.exit(1)
}

if (!aBorrar.length) {
  console.log("\nNada que limpiar.")
  process.exit(0)
}

if (!APLICAR) {
  console.log("\n(simulación) Ejecuta con --aplicar para escribir.")
  process.exit(0)
}

const respaldo = path.join(os.tmpdir(), `business-config-staffUsers-${Date.now()}.json`)
fs.writeFileSync(respaldo, JSON.stringify(usuarios, null, 2), "utf8")
console.log(`\nrespaldo de la lista anterior: ${respaldo}`)

const { error: errorEscritura } = await db
  .from("business_config")
  .update({ config: { ...config, staffUsers: quedan } })
  .eq("id", fila.id)

if (errorEscritura) throw new Error(`No se pudo escribir: ${errorEscritura.message}`)

const { data: comprobacion } = await db
  .from("business_config")
  .select("config")
  .eq("id", fila.id)
  .maybeSingle()

const despues = comprobacion?.config?.staffUsers || []
console.log(`✔ escrito · la configuración quedó con ${despues.length} usuarios`)
