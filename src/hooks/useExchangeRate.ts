"use client"

import { useEffect, useState } from "react"
import { BRANCH_CHANGE_EVENT, getSelectedBranchId } from "@/lib/branchClient"

// v4: tasa en DÓLARES (los precios del negocio son USD). La key nueva
// invalida la caché vieja del euro. La ventana es corta para que un cambio
// de tasa manual del dueño se refleje rápido en los clientes. La caché es
// por sede: una sucursal puede tener su propia tasa manual.
const CACHE_KEY = "santo_perrito_bcv_usd_rate_cache_v4"
const FALLBACK_USD_RATE = 667.05
const CACHE_DURATION = 5 * 60 * 1000

function getBranchCacheKey(branchId: string | null) {
  return branchId ? `${CACHE_KEY}:${branchId}` : CACHE_KEY
}

type CachedRate = {
  rate: number
  currency?: string
  source?: string
  name?: string
  valueDate?: string
  updatedAt?: string
  fallback?: boolean
  manual?: boolean
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
  manual?: boolean
  warning?: string
  isLoading: boolean
  error: string | null
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function readCachedRate(cacheKey: string) {
  try {
    const cachedRaw = window.localStorage.getItem(cacheKey)

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
    rate: FALLBACK_USD_RATE,
    currency: "USD",
    source: "Fallback local",
    name: "Dólar Oficial BCV",
    valueDate: undefined,
    updatedAt: undefined,
    fallback: true,
    manual: false,
    warning: undefined,
    isLoading: true,
    error: null,
  })

  // Cambia con la sede elegida por el cliente para recargar su tasa.
  const [branchTick, setBranchTick] = useState(0)

  useEffect(() => {
    const onBranchChange = () => setBranchTick((current) => current + 1)
    window.addEventListener(BRANCH_CHANGE_EVENT, onBranchChange)
    return () => window.removeEventListener(BRANCH_CHANGE_EVENT, onBranchChange)
  }, [])

  useEffect(() => {
    let isMounted = true

    const branchId = getSelectedBranchId()
    const cacheKey = getBranchCacheKey(branchId)
    const apiUrl = branchId
      ? `/api/exchange-rate?branch=${encodeURIComponent(branchId)}`
      : "/api/exchange-rate"

    async function loadRate() {
      const cached = readCachedRate(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        if (!isMounted) return

        setState({
          rate: cached.rate,
          currency: cached.currency ?? "USD",
          source: cached.source,
          name: cached.name,
          valueDate: cached.valueDate,
          updatedAt: cached.updatedAt,
          fallback: cached.fallback,
          manual: cached.manual,
          warning: cached.warning,
          isLoading: false,
          error: null,
        })

        return
      }

      try {
        const response = await fetch(apiUrl, {
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
          currency: data.currency ?? "USD",
          source: data.source,
          name: data.name,
          valueDate: data.valueDate,
          updatedAt: data.updatedAt,
          fallback: Boolean(data.fallback),
          manual: Boolean(data.manual),
          warning: data.warning,
          expiresAt: Date.now() + CACHE_DURATION,
        }

        window.localStorage.setItem(cacheKey, JSON.stringify(nextCache))

        if (!isMounted) return

        setState({
          rate,
          currency: nextCache.currency,
          source: nextCache.source,
          name: nextCache.name,
          valueDate: nextCache.valueDate,
          updatedAt: nextCache.updatedAt,
          fallback: nextCache.fallback,
          manual: nextCache.manual,
          warning: nextCache.warning,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido"

        const staleCache = readCachedRate(cacheKey)

        if (staleCache) {
          if (!isMounted) return

          setState({
            rate: staleCache.rate,
            currency: staleCache.currency ?? "USD",
            source: staleCache.source ?? "Última tasa guardada",
            name: staleCache.name ?? "Dólar Oficial BCV",
            valueDate: staleCache.valueDate,
            updatedAt: staleCache.updatedAt,
            fallback: true,
            manual: staleCache.manual,
            warning:
              "No se pudo actualizar la tasa. Se está usando la última tasa guardada.",
            isLoading: false,
            error: message,
          })

          return
        }

        if (!isMounted) return

        setState({
          rate: FALLBACK_USD_RATE,
          currency: "USD",
          source: "Fallback local",
          name: "Dólar Oficial BCV",
          valueDate: undefined,
          updatedAt: new Date().toISOString(),
          fallback: true,
          manual: false,
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
  }, [branchTick])

  return state
}
