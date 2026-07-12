export type ExchangeRateCurrency = "USD" | "EUR"

export type ExchangeRateCacheableResponse = {
  rate: number
  currency: ExchangeRateCurrency
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

// Caché separada por moneda: el dueño puede trabajar con la tasa USD o EUR
// del BCV, y cada una guarda su propia lectura.
type ExchangeRateCacheGlobal = typeof globalThis & {
  __santoExchangeRateCache?: Partial<
    Record<ExchangeRateCurrency, ExchangeRateCacheEntry | null>
  > | null
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

export function getCachedExchangeRate(
  now = Date.now(),
  currency: ExchangeRateCurrency = "USD"
) {
  const entry = globalForExchangeRateCache.__santoExchangeRateCache?.[currency]

  if (!entry) return null

  if (entry.expiresAt <= now) {
    if (globalForExchangeRateCache.__santoExchangeRateCache) {
      globalForExchangeRateCache.__santoExchangeRateCache[currency] = null
    }
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
    ...globalForExchangeRateCache.__santoExchangeRateCache,
    [response.currency]: {
      response,
      expiresAt: now + cacheMs,
    },
  }

  return response
}

export function clearExchangeRateCacheForTests() {
  globalForExchangeRateCache.__santoExchangeRateCache = null
}
