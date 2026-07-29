// Orquestador de la semana simulada (§4 del guion): corre los días en orden
// estricto, respetando que NUNCA haya dos días a la vez — estado.json es un
// checkpoint único y dos procesos lo corromperían. Lo usan run-week.mjs y
// resume-week.mjs; la fuente de verdad del avance es SIEMPRE estado.json en
// disco (se relee antes de cada paso), no la memoria de este proceso.
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"

const ESTADO_FILE = "SIM-SEMANA/estado.json"
const LOCK_FILE = "SIM-SEMANA/.week-lock"
export const DEFAULT_SEED = "brotherhood-week-v1"

export function readEstado() {
  if (!existsSync(ESTADO_FILE)) return null
  try {
    return JSON.parse(readFileSync(ESTADO_FILE, "utf8"))
  } catch {
    console.error(`✗ ${ESTADO_FILE} existe pero no es JSON válido — no toco nada.`)
    process.exit(2)
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Candado de proceso único. Si hay un lock de un proceso VIVO, se aborta; un
// lock huérfano (proceso muerto) se reemplaza avisando.
export function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    let stale = null
    try {
      stale = JSON.parse(readFileSync(LOCK_FILE, "utf8"))
    } catch {
      stale = {}
    }
    if (isProcessAlive(stale?.pid)) {
      console.error(
        `✗ Ya hay una semana corriendo (pid ${stale.pid}, desde ${stale.startedAt}).` +
          ` Dos días a la vez corromperían estado.json — me detengo.`,
      )
      process.exit(2)
    }
    console.warn(`  (lock huérfano de pid ${stale?.pid} — lo reemplazo)`)
    unlinkSync(LOCK_FILE)
  }
  writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    { flag: "wx" },
  )
  const release = () => {
    try {
      unlinkSync(LOCK_FILE)
    } catch {
      /* ya no está */
    }
  }
  process.on("exit", release)
  process.on("SIGINT", () => process.exit(130))
  process.on("SIGTERM", () => process.exit(143))
  return release
}

function runScript(args, label) {
  console.log(`\n══════════════════════════════════════════════`)
  console.log(`▶ ${label}: node ${args.join(" ")}`)
  console.log(`══════════════════════════════════════════════`)
  const result = spawnSync(process.execPath, args, { stdio: "inherit" })
  if (result.status !== 0) {
    console.error(
      `\n✗ "${label}" terminó con código ${result.status}. La semana se detiene aquí.` +
        `\n  El checkpoint real quedó en ${ESTADO_FILE}; para continuar:` +
        `\n  node scripts/sim/resume-week.mjs`,
    )
    process.exit(result.status || 1)
  }
}

// Corre lo que falte de la semana según estado.json. `seed` solo aplica si el
// Día 0 aún no corrió.
export function runPendingWeek({ seed = DEFAULT_SEED } = {}) {
  // El guard exige el dev server vivo y la base de PRUEBA verificada ANTES de
  // cualquier escritura (el propio guard sale con código 3 si algo no cuadra).
  runScript(["scripts/sim/check-guard.mjs"], "Guard de simulación")

  const done = () => new Set(readEstado()?.completedDays || [])

  if (!done().has("dia-0")) {
    runScript(["scripts/sim/dia-0.mjs", `--seed=${seed}`], "Día 0 — fundación")
  } else {
    console.log("✓ Día 0 ya completado (checkpoint) — no se repite")
  }

  if (!done().has("dia-1")) {
    runScript(["scripts/sim/dia-1.mjs"], "Día 1")
    // El repaso REHACE cobertura que el Día 1 dejó pendiente (p. ej. los 5
    // delivery del contrato de la API) y CREA pedidos: solo corre pegado a un
    // Día 1 recién ejecutado. Si un proceso muere justo entre ambos, la
    // reconciliación final lo delata (55 pedidos del plan no cuadran).
    runScript(["scripts/sim/dia-1-repaso.mjs"], "Día 1 — repaso")
  } else {
    console.log("✓ Día 1 ya completado (checkpoint) — no se repite")
  }

  for (let day = 2; day <= 7; day += 1) {
    if (done().has(`dia-${day}`)) {
      console.log(`✓ Día ${day} ya completado (checkpoint) — no se repite`)
      continue
    }
    runScript(["scripts/sim/dias-2-7.mjs", `--day=${day}`], `Día ${day}`)
  }

  runScript(["scripts/sim/reconciliacion-final.mjs"], "Reconciliación semanal")
  runScript(["scripts/sim/informes.mjs"], "Informes")

  console.log("\n✓ Semana completa: Día 0 → Día 7 + reconciliación + informes.")
}
