export type ExchangeRateCacheableResponse = {
  rate: number
  currency: "USD"
  source: "BCV" | "DolarApi" | "Fallback local" | "Negocio"
  name: string
  valueDate?: string
  updatedAt: string
  fallback: boolean
  // true cuando la tasa la fijó el dueño en Configuración (modo manual).
  manual?: boolean
  warning?: string
  error?: string
}

type ExchangeRateCacheEntry = {
  response: ExchangeRateCacheableResponse
  expiresAt: number
}

type ExchangeRateCacheGlobal = typeof globalThis & {
  __santoExchangeRateCache?: ExchangeRateCacheEntry | null
}

const globalForExchangeRateCache = globalThis as ExchangeRateCacheGlobal
const DEFAULT_SUCCESS_CACHE_MS = 60_000
const DEFAULT_FALLBACK_CACHE_MS = 15_000

function readPositiveNumberEnv(name: string, fallback: number) {
  const parsedValue = Number(process.env[name])

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return fallback

  return Math.floor(parsedValue)
}

export function getExchangeRateSuccessCacheMs() {
  return readPositiveNumberEnv("EXCHANGE_RATE_CACHE_MS", DEFAULT_SUCCESS_CACHE_MS)
}

export function getExchangeRateFallbackCacheMs() {
  return readPositiveNumberEnv(
    "EXCHANGE_RATE_FALLBACK_CACHE_MS",
    DEFAULT_FALLBACK_CACHE_MS
  )
}

export function getCachedExchangeRate(now = Date.now()) {
  const entry = globalForExchangeRateCache.__santoExchangeRateCache

  if (!entry) return null

  if (entry.expiresAt <= now) {
    globalForExchangeRateCache.__santoExchangeRateCache = null
    return null
  }

  return entry.response
}

export function setCachedExchangeRate(
  response: ExchangeRateCacheableResponse,
  now = Date.now()
) {
  const cacheMs = response.fallback
    ? getExchangeRateFallbackCacheMs()
    : getExchangeRateSuccessCacheMs()

  globalForExchangeRateCache.__santoExchangeRateCache = {
    response,
    expiresAt: now + cacheMs,
  }

  return response
}

export function clearExchangeRateCacheForTests() {
  globalForExchangeRateCache.__santoExchangeRateCache = null
}
