// Escritor de evidencia y estado reanudable de la semana.
// SIM-SEMANA/estado.json es el checkpoint: "sigue" arranca de aquí, no de memoria.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs"

const DIR = "SIM-SEMANA"
let currentLog = null

export function openDayLog(dayKey, title) {
  mkdirSync(DIR, { recursive: true })
  currentLog = `${DIR}/${dayKey}.md`
  if (!existsSync(currentLog)) {
    writeFileSync(currentLog, `# ${title}\n\nrun: ${process.env.SIMULATION_RUN_ID || "brotherhood-week-001"} · inicio real: ${new Date().toISOString()}\n\n`)
  } else {
    appendFileSync(currentLog, `\n---\nreanudado: ${new Date().toISOString()}\n\n`)
  }
}

export function logLine(text) {
  if (currentLog) appendFileSync(currentLog, text + "\n")
}

export function appendEvidence({ id, name, state, detail }) {
  if (!currentLog) return
  appendFileSync(currentLog, `- \`${state}\` **${id}** ${name}${detail ? ` — ${detail}` : ""}\n`)
}

export function loadState() {
  const path = `${DIR}/estado.json`
  if (!existsSync(path)) return { completedDays: [], quotas: {}, ids: {}, bugs: [], commits: [] }
  return JSON.parse(readFileSync(path, "utf8"))
}

export function saveState(state) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(`${DIR}/estado.json`, JSON.stringify(state, null, 2))
}

export function bumpQuota(state, key, by = 1) {
  state.quotas[key] = (state.quotas[key] || 0) + by
}

export function writeJson(name, value) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(`${DIR}/${name}`, JSON.stringify(value, null, 2))
}

export function readJson(name, fallback = null) {
  const path = `${DIR}/${name}`
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback
}

export function appendBug(entry) {
  mkdirSync(DIR, { recursive: true })
  const path = `${DIR}/bugs.md`
  if (!existsSync(path)) writeFileSync(path, "# Bugs encontrados durante la semana\n\n")
  appendFileSync(path, entry + "\n")
}
