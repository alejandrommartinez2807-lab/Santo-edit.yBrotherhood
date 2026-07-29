// Reanuda la semana desde el CHECKPOINT REAL de estado.json (§4 del guion):
// relee qué días están completados en disco y corre solo lo que falta, en
// orden, con el mismo candado de proceso único que run-week (nunca dos días
// a la vez). No acepta "desde qué día" por parámetro a propósito: la memoria
// del operador no es la fuente de verdad, el checkpoint sí.
//
// Uso: node scripts/sim/resume-week.mjs
import { acquireLock, readEstado, runPendingWeek } from "./lib/week-runner.mjs"

const estado = readEstado()
if (!estado) {
  console.error(
    "✗ No hay SIM-SEMANA/estado.json: no existe semana que reanudar." +
      "\n  Para arrancar desde cero: node scripts/sim/run-week.mjs",
  )
  process.exit(2)
}

const completed = estado.completedDays || []
const pending = ["dia-0", "dia-1", "dia-2", "dia-3", "dia-4", "dia-5", "dia-6", "dia-7"].filter(
  (d) => !completed.includes(d),
)
console.log(
  `Checkpoint: ${completed.length} día(s) completados (${completed.join(", ") || "ninguno"}).`,
)
console.log(
  pending.length
    ? `Pendientes: ${pending.join(", ")} + reconciliación + informes.`
    : "Todos los días completados: solo correré reconciliación + informes.",
)

acquireLock()
runPendingWeek({ seed: estado.seed || undefined })
