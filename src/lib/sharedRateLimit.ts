import { getSupabaseAdmin } from "@/lib/supabaseServer"
import {
  checkRateLimit,
  peekRateLimit,
  type RateLimitOptions,
  type RateLimitResult,
} from "@/lib/rateLimit"

// Contador de rate limit COMPARTIDO entre instancias (migración 0037).
//
// El contador en memoria no sirve contra un ataque repartido: en Vercel cada
// instancia serverless tiene su propio Map, así que el límite efectivo era
// "instancias x límite". Quien sondeaba las contraseñas de rol solo tenía que
// espaciar los intentos para que cayeran en procesos distintos, cada uno con el
// contador en cero.
//
// Aquí el conteo lo hace Postgres con una sentencia atómica, así que todas las
// instancias comparten el mismo número.
//
// DEGRADACIÓN: si la migración 0037 todavía no está aplicada —o la base no
// responde— se cae al contador en memoria de siempre. Es fail-OPEN a propósito:
// un fallo de la base no puede dejar al personal sin poder entrar al panel en
// pleno servicio. Mientras tanto la protección es la de antes, no menos.

type SharedRateLimitRow = { hits: number; reset_at: string }

// Se recuerda si la tabla no existe para no castigar cada petición con una
// llamada condenada a fallar. Se reintenta pasado un rato, por si se aplicó la
// migración sin reiniciar.
type SharedRateLimitGlobal = typeof globalThis & {
  __sharedRateLimitUnavailableUntil?: number
}

const globalForShared = globalThis as SharedRateLimitGlobal
const UNAVAILABLE_RETRY_MS = 60_000

function isUnavailable(now: number) {
  return (globalForShared.__sharedRateLimitUnavailableUntil || 0) > now
}

function markUnavailable(now: number) {
  globalForShared.__sharedRateLimitUnavailableUntil = now + UNAVAILABLE_RETRY_MS
}

function buildKey(options: RateLimitOptions, ip: string) {
  return `${options.id}:${ip}`.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 200)
}

function toResult(
  row: SharedRateLimitRow | null,
  options: RateLimitOptions,
  key: string,
  now: number,
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit))
  const windowMs = Math.max(1_000, Math.floor(options.windowMs))
  const count = Math.max(0, Number(row?.hits) || 0)
  const parsedReset = row?.reset_at ? Date.parse(row.reset_at) : Number.NaN
  const resetAt = Number.isFinite(parsedReset) ? parsedReset : now + windowMs

  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
    key,
  }
}

// Consulta el contador compartido SIN gastar intento.
export async function peekSharedRateLimit(
  request: { headers: { get(name: string): string | null } },
  options: RateLimitOptions,
  ip: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  if (isUnavailable(now)) return peekRateLimit(request, options, now)

  const key = buildKey(options, ip)

  try {
    const { data, error } = await getSupabaseAdmin().rpc("peek_rate_limit", {
      p_key: key,
    })

    if (error) {
      markUnavailable(now)
      return peekRateLimit(request, options, now)
    }

    const row = (Array.isArray(data) ? data[0] : data) as SharedRateLimitRow | null

    // Sin fila todavía: nadie ha gastado intentos con esta clave.
    const result = toResult(row, options, key, now)

    // `peek` no suma, así que "permitido" es count < limit (no <=).
    return { ...result, allowed: result.count < result.limit }
  } catch {
    markUnavailable(now)
    return peekRateLimit(request, options, now)
  }
}

// Gasta un intento del contador compartido y devuelve cómo queda.
export async function registerSharedRateLimitHit(
  request: { headers: { get(name: string): string | null } },
  options: RateLimitOptions,
  ip: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  if (isUnavailable(now)) return checkRateLimit(request, options, now)

  const key = buildKey(options, ip)

  try {
    const { data, error } = await getSupabaseAdmin().rpc("increment_rate_limit", {
      p_key: key,
      p_window_ms: Math.max(1_000, Math.floor(options.windowMs)),
    })

    if (error) {
      markUnavailable(now)
      return checkRateLimit(request, options, now)
    }

    const row = (Array.isArray(data) ? data[0] : data) as SharedRateLimitRow | null

    maybePurgeSharedRateLimit()

    return toResult(row, options, key, now)
  } catch {
    markUnavailable(now)
    return checkRateLimit(request, options, now)
  }
}

// ¿Está funcionando el contador compartido, o se está usando el de memoria?
// Lo consulta el diagnóstico de "listo para producción".
export function isSharedRateLimitDegraded(now = Date.now()) {
  return isUnavailable(now)
}

// Barrido de ventanas ya vencidas para que la tabla no crezca sin fin. Se
// dispara de vez en cuando desde el propio tráfico (1 de cada 500 registros),
// así no hace falta un cron: en un local con actividad salta solo varias veces
// al día, y en uno parado no hace falta porque no entran filas nuevas.
const PURGE_EVERY = 500
let purgeCounter = 0

export function maybePurgeSharedRateLimit() {
  purgeCounter += 1

  if (purgeCounter % PURGE_EVERY !== 0) return

  // Sin await: la limpieza no debe retrasar la respuesta al usuario.
  void Promise.resolve(getSupabaseAdmin().rpc("purge_rate_limit_hits")).catch(
    () => undefined,
  )
}
