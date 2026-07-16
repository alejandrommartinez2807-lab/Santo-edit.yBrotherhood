import { captureError } from "@/lib/monitoring"
import {
  buildAuthCall,
  buildExecuteCall,
  normalizeOdooBaseUrl,
  parseJsonRpcResult,
  readAuthUid,
  type JsonRpcBody,
} from "@/lib/odooSync"

// ============================================================
// Hotel · V8-A · Transporte Odoo — SOLO SERVIDOR (usa red).
//
// Habla el JSON-RPC de Odoo (POST a {url}/jsonrpc). La lógica pura (armado y
// lectura de las llamadas) vive en odooSync.ts; aquí solo el fetch, con timeout
// y best-effort (nunca lanza: devuelve { ok:false, error }).
// ============================================================

const ODOO_TIMEOUT_MS = 12_000

export type OdooConnection = {
  baseUrl: string
  dbName: string
  login: string
  apiKey: string
}

type OdooCallResult = { ok: true; result: unknown } | { ok: false; error: string }

/** POST del cuerpo JSON-RPC a /jsonrpc, con timeout. Nunca lanza. */
async function postJsonRpc(baseUrl: string, body: JsonRpcBody): Promise<OdooCallResult> {
  const url = `${normalizeOdooBaseUrl(baseUrl)}/jsonrpc`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ODOO_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ok: false, error: `Odoo respondió HTTP ${response.status}. Revisa la URL.` }
    }
    const json = await response.json().catch(() => null)
    return parseJsonRpcResult(json)
  } catch (error) {
    captureError(error, { route: "lib/odooClient", action: "postJsonRpc" })
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Odoo no respondió a tiempo. Revisa la URL y que la instancia esté en línea."
        : "No se pudo conectar con Odoo. Revisa la URL/red."
    return { ok: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** Autentica y devuelve el uid válido, o el error legible. Nunca lanza. */
export async function odooAuthenticate(
  conn: OdooConnection,
): Promise<{ ok: true; uid: number } | { ok: false; error: string }> {
  if (!conn.baseUrl) return { ok: false, error: "Falta la URL de Odoo." }
  if (!conn.dbName) return { ok: false, error: "Falta el nombre de la base de datos." }
  if (!conn.login) return { ok: false, error: "Falta el usuario." }
  if (!conn.apiKey) return { ok: false, error: "Falta la API Key." }

  const parsed = await postJsonRpc(conn.baseUrl, buildAuthCall(conn.dbName, conn.login, conn.apiKey))
  if (!parsed.ok) return parsed
  const uid = readAuthUid(parsed)
  if (uid === null) {
    return { ok: false, error: "Credenciales rechazadas por Odoo (usuario, API Key o base de datos incorrectos)." }
  }
  return { ok: true, uid }
}

/**
 * Ejecuta un método de modelo (execute_kw) ya autenticado. Para las fases de
 * sincronización (crear/actualizar registros). Nunca lanza.
 */
export async function odooExecute(
  conn: OdooConnection,
  uid: number,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<OdooCallResult> {
  return postJsonRpc(conn.baseUrl, buildExecuteCall(conn.dbName, uid, conn.apiKey, model, method, args, kwargs))
}
