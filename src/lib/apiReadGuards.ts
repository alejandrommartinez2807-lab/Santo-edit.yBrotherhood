import { NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/rateLimit"
import { enforceSameOriginRequest } from "@/lib/requestGuards"

type HeaderReadable = {
  headers: {
    get(name: string): string | null
  }
}

export type ApiReadGuardOptions = {
  id: string
  limit?: number
  windowMs?: number
  rateLimitMessage?: string
  originMessage?: string
  skipSameOrigin?: boolean
}

export type ApiReadGuardResolvedOptions = {
  id: string
  limit: number
  windowMs: number
  rateLimitMessage: string
  originMessage: string
  skipSameOrigin: boolean
}

const DEFAULT_PRIVATE_READ_LIMIT = 180
const DEFAULT_PRIVATE_READ_WINDOW_MS = 60_000

function cleanGuardId(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:._/-]/g, "_")
    .slice(0, 120)
}

export function resolveApiReadGuardOptions(
  options: ApiReadGuardOptions
): ApiReadGuardResolvedOptions {
  const id = cleanGuardId(options.id || "api-read") || "api-read"
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_PRIVATE_READ_LIMIT))
  const windowMs = Math.max(
    1_000,
    Math.floor(options.windowMs ?? DEFAULT_PRIVATE_READ_WINDOW_MS)
  )

  return {
    id,
    limit,
    windowMs,
    rateLimitMessage:
      options.rateLimitMessage ||
      "Demasiadas consultas. Espera unos segundos e intenta nuevamente.",
    originMessage: options.originMessage || "Solicitud no permitida desde este origen.",
    skipSameOrigin: options.skipSameOrigin === true,
  }
}

export function enforceApiReadGuards(
  request: HeaderReadable,
  options: ApiReadGuardOptions
): NextResponse | null {
  const resolvedOptions = resolveApiReadGuardOptions(options)
  const rateLimitResponse = enforceRateLimit(request, {
    id: resolvedOptions.id,
    limit: resolvedOptions.limit,
    windowMs: resolvedOptions.windowMs,
    message: resolvedOptions.rateLimitMessage,
  })

  if (rateLimitResponse) return rateLimitResponse

  if (!resolvedOptions.skipSameOrigin) {
    const originGuardResponse = enforceSameOriginRequest(
      request,
      resolvedOptions.originMessage,
      resolvedOptions.id
    )

    if (originGuardResponse) return originGuardResponse
  }

  return null
}
