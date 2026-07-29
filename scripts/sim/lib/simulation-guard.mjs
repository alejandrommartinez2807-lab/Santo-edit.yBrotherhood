// Guard de simulación · SEMANA REAL BLINDADA
// Ninguna escritura puede ocurrir sin que TODAS estas comprobaciones pasen.
// Regla absoluta: el project ref de producción (leído de .env.local.produccion.bak
// SOLO para la denylist, sin imprimir keys) jamás puede ser el destino.
import { readFileSync, existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const SIM_ENV_FILE = ".env.simulacion"
const PROD_BACKUP_FILE = ".env.local.produccion.bak"
const ALLOWLIST = ["gnyvdlxlrjwbsdctincy"]

export function parseEnvFile(path) {
  if (!existsSync(path)) return null
  const text = readFileSync(path, "utf8")
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

export function projectRefOf(url) {
  const match = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  return match ? match[1] : ""
}

export const simEnv = parseEnvFile(SIM_ENV_FILE)
export const BASE = process.env.BASE || "http://localhost:3181"

function fail(reason) {
  console.error(`\n✗ GUARD DE SIMULACIÓN FALLÓ: ${reason}`)
  console.error("  Ninguna escritura fue realizada. Proceso detenido.")
  process.exit(3)
}

export const supabase = simEnv
  ? createClient(simEnv.NEXT_PUBLIC_SUPABASE_URL, simEnv.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null

// Comprobaciones estáticas (sin red). Siempre primero.
export function guardStatic() {
  if (!simEnv) fail(`${SIM_ENV_FILE} no existe`)
  if (simEnv.SIMULATION_MODE !== "true") fail("SIMULATION_MODE no es exactamente 'true'")
  if (!simEnv.SIMULATION_RUN_ID) fail("falta SIMULATION_RUN_ID")

  const ref = projectRefOf(simEnv.NEXT_PUBLIC_SUPABASE_URL)
  if (!ref) fail("no se pudo extraer el project ref de NEXT_PUBLIC_SUPABASE_URL")
  if (ref !== simEnv.EXPECTED_SUPABASE_PROJECT_REF)
    fail(`ref ${ref} ≠ EXPECTED_SUPABASE_PROJECT_REF ${simEnv.EXPECTED_SUPABASE_PROJECT_REF}`)
  if (!ALLOWLIST.includes(ref)) fail(`ref ${ref} no está en la allowlist de proyectos de prueba`)

  // Denylist: el ref de producción, leído del respaldo (sin imprimir sus keys).
  const prodEnv = parseEnvFile(PROD_BACKUP_FILE)
  const prodRef = projectRefOf(prodEnv?.NEXT_PUBLIC_SUPABASE_URL)
  if (prodRef && ref === prodRef) fail("el ref coincide con PRODUCCIÓN — prohibido")
  if (!prodRef) console.warn("  (aviso: no pude leer el ref de producción para la denylist)")

  // El dev server usa .env.local: debe ser la copia de simulación.
  const local = parseEnvFile(".env.local")
  const localRef = projectRefOf(local?.NEXT_PUBLIC_SUPABASE_URL)
  if (localRef !== ref) fail(`.env.local apunta a '${localRef}', no al proyecto de prueba`)
  if (local?.SIMULATION_MODE !== "true") fail(".env.local no tiene SIMULATION_MODE=true")

  return { ref, runId: simEnv.SIMULATION_RUN_ID }
}

// Comprobaciones vivas: el server responde, es Brotherhood y habla con la
// base de PRUEBA (se demuestra con un sondeo de identidad de datos, no por fe).
export async function guardLive({ requireMarker = true } = {}) {
  const { ref, runId } = guardStatic()

  let html = ""
  try {
    const res = await fetch(BASE + "/", { headers: { accept: "text/html" } })
    html = await res.text()
  } catch {
    fail(`el dev server no responde en ${BASE}`)
  }
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || "").trim()
  if (!/brotherhood/i.test(title)) fail(`el server en ${BASE} no es Brotherhood (title: "${title}")`)

  // Sondeo de identidad: creamos una sede centinela en la base de PRUEBA
  // (service role) y comprobamos que el server la refleja al listar sedes.
  // Si el server apuntara a otra base, el centinela jamás aparecería.
  const nonce = `sim-probe-${Date.now()}`
  const { data: probeBranch, error: probeError } = await supabase
    .from("branches")
    .insert({ name: nonce, sort_order: 999, is_active: true })
    .select("id")
    .single()
  if (probeError) fail(`no puedo escribir el centinela en la base de prueba: ${probeError.message}`)
  const probeRes = await fetch(BASE + "/api/public/branches", {
    headers: { accept: "application/json" },
  })
  const probeJson = await probeRes.json().catch(() => ({}))
  const reflected = JSON.stringify(probeJson).includes(nonce)
  await supabase.from("branches").delete().eq("id", probeBranch.id)
  if (!reflected) fail("el dev server NO refleja la base de prueba (¿apunta a otra base?)")

  const { data: cfgRow } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()
  const config = cfgRow?.config || {}

  // Marca de entorno dentro de la base (el Día 0 la crea; el resto la exige).
  if (requireMarker && config.environment_marker !== "simulation")
    fail("la base no tiene environment_marker=simulation (¿es la base correcta?)")

  // No usuarios/sedes/pedidos reales conocidos.
  const { data: staff } = await supabase.from("staff_users").select("email")
  const foreign = (staff || []).filter((s) => !String(s.email).endsWith("@santo.local"))
  if (foreign.length) fail(`hay usuarios con emails no simulados: ${foreign.map((s) => s.email).join(", ")}`)
  const { data: branches } = await supabase.from("branches").select("name")
  const knownSim = new Set(["Principal", "San Diego"])
  const strange = (branches || []).filter((b) => !knownSim.has(b.name))
  if (strange.length) fail(`sedes desconocidas en la base: ${strange.map((b) => b.name).join(", ")}`)

  console.log(`✓ GUARD OK · ref=${ref} · run=${runId} · server=${BASE} ("${title}")`)
  return { ref, runId, title }
}

export async function createEnvironmentMarker() {
  const { data: cfgRow } = await supabase.from("business_config").select("config").eq("id", 1).maybeSingle()
  const config = cfgRow?.config || {}
  await supabase.from("business_config").upsert({
    id: 1,
    config: { ...config, environment_marker: "simulation", simulation_run_id: simEnv.SIMULATION_RUN_ID },
  })
  console.log("✓ marca de entorno creada: environment_marker=simulation")
}
