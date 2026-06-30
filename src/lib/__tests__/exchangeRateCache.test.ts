import { afterEach, describe, expect, it } from "vitest"
import {
  clearExchangeRateCacheForTests,
  getCachedExchangeRate,
  getExchangeRateFallbackCacheMs,
  getExchangeRateSuccessCacheMs,
  setCachedExchangeRate,
  type ExchangeRateCacheableResponse,
} from "@/lib/exchangeRateCache"

const baseRate: ExchangeRateCacheableResponse = {
  rate: 602.18,
  currency: "EUR",
  source: "BCV",
  name: "Euro Oficial BCV",
  valueDate: "Viernes, 26 Junio 2026",
  updatedAt: "2026-06-28T12:00:00.000Z",
  fallback: false,
}

function clearEnv() {
  delete process.env.EXCHANGE_RATE_CACHE_MS
  delete process.env.EXCHANGE_RATE_FALLBACK_CACHE_MS
}

afterEach(() => {
  clearExchangeRateCacheForTests()
  clearEnv()
})

describe("exchangeRateCache", () => {
  it("guarda una tasa válida hasta que expire la ventana", () => {
    process.env.EXCHANGE_RATE_CACHE_MS = "1000"

    setCachedExchangeRate(baseRate, 10_000)

    expect(getCachedExchangeRate(10_999)).toEqual(baseRate)
    expect(getCachedExchangeRate(11_001)).toBeNull()
  })

  it("usa una ventana más corta para respuestas de respaldo", () => {
    process.env.EXCHANGE_RATE_FALLBACK_CACHE_MS = "500"
    const fallbackRate: ExchangeRateCacheableResponse = {
      ...baseRate,
      source: "Fallback local",
      fallback: true,
      warning: "Tasa de respaldo",
    }

    setCachedExchangeRate(fallbackRate, 20_000)

    expect(getCachedExchangeRate(20_499)).toEqual(fallbackRate)
    expect(getCachedExchangeRate(20_501)).toBeNull()
  })

  it("ignora valores inválidos de entorno y conserva defaults seguros", () => {
    process.env.EXCHANGE_RATE_CACHE_MS = "-1"
    process.env.EXCHANGE_RATE_FALLBACK_CACHE_MS = "abc"

    expect(getExchangeRateSuccessCacheMs()).toBe(60_000)
    expect(getExchangeRateFallbackCacheMs()).toBe(15_000)
  })
})
