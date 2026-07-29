// Recolector de tiempos por operación → p50/p95/máx/errores para rendimiento.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"

const store = new Map()

export function recordTiming(label, ms, status) {
  const entry = store.get(label) || { samples: [], errors: 0, timeouts: 0 }
  entry.samples.push(ms)
  if (!status || status >= 500) entry.errors += 1
  if (!status) entry.timeouts += 1
  store.set(label, entry)
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

export function performanceSummary() {
  const result = {}
  for (const [label, entry] of store.entries()) {
    const sorted = [...entry.samples].sort((a, b) => a - b)
    result[label] = {
      count: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted[sorted.length - 1] || 0,
      errors: entry.errors,
      timeouts: entry.timeouts,
    }
  }
  return result
}

// Fusiona el resumen de esta corrida dentro de SIM-SEMANA/rendimiento.json
export function flushPerformance(dayKey) {
  mkdirSync("SIM-SEMANA", { recursive: true })
  const path = "SIM-SEMANA/rendimiento.json"
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}
  existing[dayKey] = performanceSummary()
  writeFileSync(path, JSON.stringify(existing, null, 2))
}
