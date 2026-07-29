// Corre la SEMANA COMPLETA de un tirón: guard → Día 0 → … → Día 7 →
// reconciliación → informes (§4 del guion). Exige partir de cero: si
// estado.json ya tiene días completados, este script se niega y manda a
// resume-week.mjs (reanudar) o a reset-simulation.mjs (empezar de nuevo) —
// así "de un tirón" nunca esconde una semana a medias.
//
// Uso: node scripts/sim/run-week.mjs [--seed=brotherhood-week-v1]
// Requisitos: dev server vivo en BASE (default http://localhost:3181) con
// .env.local = copia de .env.simulacion; el guard verifica todo lo demás.
import {
  DEFAULT_SEED,
  acquireLock,
  readEstado,
  runPendingWeek,
} from "./lib/week-runner.mjs"

const seed =
  process.argv.find((a) => a.startsWith("--seed="))?.slice(7) || DEFAULT_SEED

const estado = readEstado()
const completed = estado?.completedDays || []
if (completed.length > 0) {
  console.error(
    `✗ estado.json ya tiene ${completed.length} día(s) completados (${completed.join(", ")}).` +
      `\n  Para CONTINUAR esa semana:   node scripts/sim/resume-week.mjs` +
      `\n  Para EMPEZAR de cero:        node scripts/sim/reset-simulation.mjs (y luego run-week)`,
  )
  process.exit(2)
}

acquireLock()
runPendingWeek({ seed })
