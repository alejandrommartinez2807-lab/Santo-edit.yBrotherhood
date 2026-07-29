// Cliente HTTP de la simulación: mide cada llamada (para el reporte de
// rendimiento), reintenta 429 esperando la ventana y nunca esconde errores.
import { BASE } from "./simulation-guard.mjs"
import { recordTiming } from "./performance.mjs"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function call(method, path, body, headers = {}, { label, retries429 = 6 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now()
    let res
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      recordTiming(label || `${method} ${path}`, Date.now() - startedAt, 0)
      return { status: 0, json: null, error: error.message, ms: Date.now() - startedAt }
    }
    const ms = Date.now() - startedAt
    if (res.status === 429 && attempt < retries429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 12
      await sleep(Math.min(retryAfter, 62) * 1000 + 250)
      continue
    }
    let json = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    recordTiming(label || `${method} ${path.split("?")[0].replace(/\/[0-9a-f-]{16,}/g, "/:id")}`, ms, res.status)
    return { status: res.status, json, res, ms }
  }
}

export const get = (path, headers, opts) => call("GET", path, undefined, headers, opts)
export const post = (path, body, headers, opts) => call("POST", path, body, headers, opts)
export const patch = (path, body, headers, opts) => call("PATCH", path, body, headers, opts)
export const del = (path, headers, opts) => call("DELETE", path, undefined, headers, opts)
export { sleep }
