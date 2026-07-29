// Aserciones con evidencia: cada check queda en la bitácora del día con
// esperado vs real y estado PASS/FAIL. La ausencia de evidencia = no probado.
import { appendEvidence } from "./evidence-writer.mjs"

let pass = 0
let fail = 0
let blocked = 0
const failures = []

export function check(id, name, condition, detail = "") {
  const state = condition ? "PASS" : "FAIL"
  console.log(`${condition ? "✓" : "✗ FALLA"} [${id}] ${name}${detail ? ` — ${detail}` : ""}`)
  if (condition) pass += 1
  else {
    fail += 1
    failures.push({ id, name, detail })
  }
  appendEvidence({ id, name, state, detail })
  return condition
}

export function markBlocked(id, name, reason) {
  blocked += 1
  console.log(`◼ BLOCKED [${id}] ${name} — ${reason}`)
  appendEvidence({ id, name, state: "BLOCKED", detail: reason })
}

export function markNotApplicable(id, name, reason) {
  console.log(`○ N/A [${id}] ${name} — ${reason}`)
  appendEvidence({ id, name, state: "NOT_APPLICABLE", detail: reason })
}

export function summary(label = "") {
  console.log(`\n==== ${label ? label + ": " : ""}${pass} PASS · ${fail} FAIL · ${blocked} BLOCKED ====`)
  if (failures.length) {
    console.log("Fallas:")
    for (const f of failures) console.log(`  ✗ [${f.id}] ${f.name} — ${f.detail}`)
  }
  return { pass, fail, blocked, failures }
}
