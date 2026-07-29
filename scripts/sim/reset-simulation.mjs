// Limpia la base de PRUEBA para empezar una semana desde cero (§4 del guion).
//
// CANDADOS (todos obligatorios, en este orden):
//   1. guardStatic(): .env.simulacion válido, ref en la allowlist de prueba,
//      ref ≠ producción (denylist leída del respaldo), .env.local = sim.
//   2. La base debe tener environment_marker=simulation Y su
//      simulation_run_id debe COINCIDIR con SIMULATION_RUN_ID del entorno:
//      jamás se borra una base que otra corrida (u otro entorno) marcó.
//   3. --run-id=<id> en la línea de comandos, igual al del entorno: quien
//      borra escribe a mano QUÉ corrida está borrando.
//   4. Identidad de datos: solo usuarios @santo.local y solo las sedes de la
//      simulación. Un solo dato ajeno detiene todo.
//   5. Sin --yes es un simulacro: lista los conteos y NO borra nada.
//
// Uso:  node scripts/sim/reset-simulation.mjs --run-id=brotherhood-week-v1 [--yes]
//
// Además del borrado en la base, archiva el checkpoint local
// (estado.json → estado.pre-reset-<ts>.json): la información no se pierde,
// pero la semana nueva arranca limpia.
import { existsSync, renameSync } from "node:fs"
import { guardStatic, simEnv, supabase } from "./lib/simulation-guard.mjs"

const argRunId = process.argv.find((a) => a.startsWith("--run-id="))?.slice(9) || ""
const confirmed = process.argv.includes("--yes")

function fail(reason) {
  console.error(`\n✗ RESET DETENIDO: ${reason}`)
  console.error("  Nada fue borrado.")
  process.exit(3)
}

// ── Candado 1: guard estático (allowlist, denylist de producción, .env.local)
const { ref, runId } = guardStatic()

// ── Candado 3: el operador escribe el run-id a mano ─────────────────────────
if (!argRunId) fail("falta --run-id=<SIMULATION_RUN_ID> (escríbelo a mano)")
if (argRunId !== simEnv.SIMULATION_RUN_ID)
  fail(`--run-id "${argRunId}" ≠ SIMULATION_RUN_ID del entorno "${simEnv.SIMULATION_RUN_ID}"`)

// ── Candado 2: la base está marcada como simulación y es ESTA corrida ──────
const { data: cfgRow, error: cfgError } = await supabase
  .from("business_config")
  .select("config")
  .eq("id", 1)
  .maybeSingle()
if (cfgError) fail(`no puedo leer business_config: ${cfgError.message}`)
const config = cfgRow?.config || {}
if (config.environment_marker !== "simulation")
  fail("la base NO tiene environment_marker=simulation — no es una base de simulación marcada")
if (config.simulation_run_id !== simEnv.SIMULATION_RUN_ID)
  fail(
    `la base pertenece a la corrida "${config.simulation_run_id}", no a "${simEnv.SIMULATION_RUN_ID}"`,
  )

// ── Candado 4: identidad de datos (mismas comprobaciones que el guard vivo) ─
const { data: staff } = await supabase.from("staff_users").select("email")
const foreign = (staff || []).filter((s) => !String(s.email).endsWith("@santo.local"))
if (foreign.length)
  fail(`hay usuarios con emails no simulados: ${foreign.map((s) => s.email).join(", ")}`)
const { data: branches } = await supabase.from("branches").select("name")
const knownSim = new Set(["Principal", "San Diego"])
const strange = (branches || []).filter((b) => !knownSim.has(b.name))
if (strange.length)
  fail(`sedes desconocidas en la base: ${strange.map((b) => b.name).join(", ")}`)

// ── Qué se borra (hijas → padres para no chocar con FKs sin cascade) ───────
const TABLES = [
  "order_items",
  "payment_proofs",
  "order_cancellation_requests",
  "survey_responses",
  "inventory_movements",
  "push_subscriptions",
  "audit_logs",
  "day_expenses",
  "day_closes",
  "orders",
  "open_accounts",
  "order_branch_counters",
  "reservations",
  "tables",
  "delivery_zones",
  "delivery_distance_settings",
  "supplier_purchase_payments",
  "supplier_purchases",
  "suppliers",
  "inventory_recipes",
  "subrecipes",
  "inventory_items",
  "menu_products",
  "staff_users",
  "branches",
  "business_config",
]

console.log(`\nBase de PRUEBA ${ref} · corrida ${runId}`)
console.log("Conteo actual por tabla:")
const counts = {}
for (const table of TABLES) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
  counts[table] = error ? `(error: ${error.message})` : count ?? 0
  console.log(`  ${table.padEnd(32)} ${counts[table]}`)
}

const { data: authUsers } = await supabase.auth.admin
  .listUsers({ perPage: 1000 })
  .catch(() => ({ data: { users: [] } }))
const simAuthUsers = (authUsers?.users || []).filter((u) =>
  String(u.email || "").endsWith("@santo.local"),
)
console.log(`  usuarios de Auth @santo.local     ${simAuthUsers.length}`)

if (!confirmed) {
  console.log(
    "\nSimulacro (sin --yes): NO se borró nada." +
      "\nPara borrar de verdad: node scripts/sim/reset-simulation.mjs " +
      `--run-id=${runId} --yes`,
  )
  process.exit(0)
}

// ── Borrado real ────────────────────────────────────────────────────────────
console.log("\nBorrando…")
for (const table of TABLES) {
  // PostgREST exige un WHERE explícito: "id IS NOT NULL" vale para cualquier
  // tipo de PK (texto, uuid o numérica) y cubre todas las filas.
  const { error } = await supabase.from(table).delete().not("id", "is", null)
  if (error) fail(`borrando ${table}: ${error.message}`)
  console.log(`  ✓ ${table}`)
}

for (const user of simAuthUsers) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) console.warn(`  (aviso: no pude borrar el usuario Auth ${user.email}: ${error.message})`)
}
console.log(`  ✓ ${simAuthUsers.length} usuario(s) de Auth @santo.local`)

// ── Checkpoint local: se archiva, no se destruye ───────────────────────────
const ESTADO = "SIM-SEMANA/estado.json"
if (existsSync(ESTADO)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backup = `SIM-SEMANA/estado.pre-reset-${stamp}.json`
  renameSync(ESTADO, backup)
  console.log(`  ✓ checkpoint archivado: ${backup}`)
}

console.log(
  "\n✓ Base de prueba limpia. La próxima semana arranca con:" +
    "\n  node scripts/sim/run-week.mjs",
)
