import { NextResponse } from "next/server"
import { recordSecurityEvent } from "@/lib/securityEvents"

type HeaderReadable = {
  headers: {
    get(name: string): string | null
  }
}

type RateLimitEntry = {
  count: number
  resetAt: number
  lastSeenAt: number
}

type RateLimitStoreGlobal = typeof globalThis & {
  __santoRateLimitStore?: Map<string, RateLimitEntry>
  __santoRateLimitSweepCounter?: number
}

export type RateLimitOptions = {
  id: string
  limit: number
  windowMs: number
  message?: string
}

export type RateLimitResult = {
  allowed: boolean
  count: number
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
  key: string
}

const DEFAULT_RATE_LIMIT_MAX_KEYS = 10_000
const MIN_RATE_LIMIT_MAX_KEYS = 500
const MAX_RATE_LIMIT_MAX_KEYS = 100_000
const SWEEP_EVERY_REQUESTS = 100

const globalForRateLimit = globalThis as RateLimitStoreGlobal
const rateLimitStore =
  globalForRateLimit.__santoRateLimitStore ?? new Map<string, RateLimitEntry>()

globalForRateLimit.__santoRateLimitStore = rateLimitStore

function cleanHeaderValue(value: string | null) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) || ""
}

function cleanIp(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return "unknown"

  if (trimmedValue.startsWith("[") && trimmedValue.includes("]")) {
    return trimmedValue.slice(1, trimmedValue.indexOf("]")) || "unknown"
  }

  const colonCount = (trimmedValue.match(/:/g) || []).length

  if (colonCount === 1) {
    return trimmedValue.replace(/:\d+$/, "") || "unknown"
  }

  return trimmedValue || "unknown"
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 160)
}

function getEnvNumber(name: string, fallback: number, min: number, max: number) {
  const parsedValue = Number(process.env[name])

  if (!Number.isFinite(parsedValue)) {
    return Math.min(max, Math.max(min, Math.floor(fallback)))
  }

  return Math.min(max, Math.max(min, Math.floor(parsedValue)))
}

function getRateLimitMaxKeys() {
  return getEnvNumber(
    "RATE_LIMIT_MAX_KEYS",
    DEFAULT_RATE_LIMIT_MAX_KEYS,
    MIN_RATE_LIMIT_MAX_KEYS,
    MAX_RATE_LIMIT_MAX_KEYS
  )
}

function deleteOldestEntries(maxKeys: number) {
  if (rateLimitStore.size <= maxKeys) return

  const entries = [...rateLimitStore.entries()].sort(
    ([, first], [, second]) => first.lastSeenAt - second.lastSeenAt
  )
  const entriesToDelete = Math.max(0, rateLimitStore.size - maxKeys)

  for (const [key] of entries.slice(0, entriesToDelete)) {
    rateLimitStore.delete(key)
  }
}

function sweepExpiredEntries(now: number, force = false) {
  globalForRateLimit.__santoRateLimitSweepCounter =
    (globalForRateLimit.__santoRateLimitSweepCounter || 0) + 1

  const maxKeys = getRateLimitMaxKeys()
  const shouldSweepByCadence =
    globalForRateLimit.__santoRateLimitSweepCounter % SWEEP_EVERY_REQUESTS === 0
  const shouldSweepBySize = rateLimitStore.size > maxKeys

  if (!force && !shouldSweepByCadence && !shouldSweepBySize) return

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }

  deleteOldestEntries(maxKeys)
}

export function getClientIp(request: HeaderReadable) {
  return cleanIp(
    cleanHeaderValue(request.headers.get("x-forwarded-for")) ||
      cleanHeaderValue(request.headers.get("x-real-ip")) ||
      cleanHeaderValue(request.headers.get("cf-connecting-ip")) ||
      "unknown"
  )
}

export function checkRateLimit(
  request: HeaderReadable,
  options: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit))
  const windowMs = Math.max(1_000, Math.floor(options.windowMs))
  const ip = getClientIp(request)
  const key = `${sanitizeKeyPart(options.id)}:${sanitizeKeyPart(ip)}`
  const current = rateLimitStore.get(key)
  const shouldReset = !current || current.resetAt <= now
  const entry = shouldReset
    ? { count: 0, resetAt: now + windowMs, lastSeenAt: now }
    : current

  entry.count += 1
  entry.lastSeenAt = now
  rateLimitStore.set(key, entry)
  sweepExpiredEntries(now)

  const remaining = Math.max(0, limit - entry.count)
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000))

  return {
    allowed: entry.count <= limit,
    count: entry.count,
    limit,
    remaining,
    resetAt: entry.resetAt,
    retryAfterSeconds,
    key,
  }
}

export function buildRateLimitResponse(result: RateLimitResult, message?: string) {
  return NextResponse.json(
    {
      ok: false,
      code: "RATE_LIMITED",
      error: message || "Demasiadas solicitudes. Intenta nuevamente en unos segundos.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
      },
    }
  )
}

export function enforceRateLimit(request: HeaderReadable, options: RateLimitOptions) {
  const result = checkRateLimit(request, options)

  if (result.allowed) return null

  recordSecurityEvent({
    kind: "rate_limit",
    route: options.id,
    request,
    metadata: {
      limit: result.limit,
      count: result.count,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  })

  return buildRateLimitResponse(result, options.message)
}

export function getRateLimitStoreSizeForTests() {
  return rateLimitStore.size
}

export function clearRateLimitStoreForTests() {
  rateLimitStore.clear()
  globalForRateLimit.__santoRateLimitSweepCounter = 0
}
