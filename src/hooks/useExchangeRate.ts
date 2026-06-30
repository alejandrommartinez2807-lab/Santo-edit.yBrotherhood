"use client"

import { useEffect, useState } from "react"

const CACHE_KEY = "santo_perrito_bcv_euro_rate_cache_v3"
const FALLBACK_EURO_RATE = 602.18768455
const CACHE_DURATION = 30 * 60 * 1000

type CachedRate = {
  rate: number
  currency?: string
  source?: string
  name?: string
  valueDate?: string
  updatedAt?: string
  fallback?: boolean
  warning?: string
  expiresAt: number
}

type ExchangeRateState = {
  rate: number
  currency?: string
  source?: string
  name?: string
  valueDate?: string
  updatedAt?: string
  fallback?: boolean
  warning?: string
  isLoading: boolean
  error: string | null
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function readCachedRate() {
  try {
    const cachedRaw = window.localStorage.getItem(CACHE_KEY)

    if (!cachedRaw) {
      return null
    }

    const cached = JSON.parse(cachedRaw) as CachedRate

    if (!isValidRate(cached.rate)) {
      return null
    }

    return cached
  } catch {
    return null
  }
}

export function useExchangeRate(): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>({
    rate: FALLBACK_EURO_RATE,
    currency: "EUR",
    source: "Fallback local",
    name: "Euro Oficial BCV",
    valueDate: undefined,
    updatedAt: undefined,
    fallback: true,
    warning: undefined,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    async function loadRate() {
      const cached = readCachedRate()

      if (cached && cached.expiresAt > Date.now()) {
        if (!isMounted) return

        setState({
          rate: cached.rate,
          currency: cached.currency ?? "EUR",
          source: cached.source,
          name: cached.name,
          valueDate: cached.valueDate,
          updatedAt: cached.updatedAt,
          fallback: cached.fallback,
          warning: cached.warning,
          isLoading: false,
          error: null,
        })

        return
      }

      try {
        const response = await fetch("/api/exchange-rate", {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("No se pudo consultar la tasa del servidor")
        }

        const data = await response.json()
        const rate = Number(data.rate)

        if (!isValidRate(rate)) {
          throw new Error("La tasa recibida no es válida")
        }

        const nextCache: CachedRate = {
          rate,
          currency: data.currency ?? "EUR",
          source: data.source,
          name: data.name,
          valueDate: data.valueDate,
          updatedAt: data.updatedAt,
          fallback: Boolean(data.fallback),
          warning: data.warning,
          expiresAt: Date.now() + CACHE_DURATION,
        }

        window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextCache))

        if (!isMounted) return

        setState({
          rate,
          currency: nextCache.currency,
          source: nextCache.source,
          name: nextCache.name,
          valueDate: nextCache.valueDate,
          updatedAt: nextCache.updatedAt,
          fallback: nextCache.fallback,
          warning: nextCache.warning,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido"

        const staleCache = readCachedRate()

        if (staleCache) {
          if (!isMounted) return

          setState({
            rate: staleCache.rate,
            currency: staleCache.currency ?? "EUR",
            source: staleCache.source ?? "Última tasa guardada",
            name: staleCache.name ?? "Euro Oficial BCV",
            valueDate: staleCache.valueDate,
            updatedAt: staleCache.updatedAt,
            fallback: true,
            warning:
              "No se pudo actualizar la tasa. Se está usando la última tasa guardada.",
            isLoading: false,
            error: message,
          })

          return
        }

        if (!isMounted) return

        setState({
          rate: FALLBACK_EURO_RATE,
          currency: "EUR",
          source: "Fallback local",
          name: "Euro Oficial BCV",
          valueDate: undefined,
          updatedAt: new Date().toISOString(),
          fallback: true,
          warning:
            "No se pudo consultar la tasa oficial en este momento. Se está usando una tasa de respaldo local.",
          isLoading: false,
          error: message,
        })
      }
    }

    loadRate()

    return () => {
      isMounted = false
    }
  }, [])

  return state
}
