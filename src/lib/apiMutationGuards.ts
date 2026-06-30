import { NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/rateLimit"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

type HeaderReadable = {
  headers: {
    get(name: string): string | null
  }
}

export type ApiMutationGuardOptions = {
  id: string
  limit?: number
  windowMs?: number
  maxBytes?: number
  envMaxBytes?: string
  minBytes?: number
  hardMaxBytes?: number
  rateLimitMessage?: string
  sizeLimitMessage?: string
  originMessage?: string
  skipSameOrigin?: boolean
}

export type ApiMutationGuardResolvedOptions = {
  id: string
  limit: number
  windowMs: number
  maxBytes: number
  rateLimitMessage: string
  sizeLimitMessage: string
  originMessage: string
  skipSameOrigin: boolean
}

const DEFAULT_PRIVATE_MUTATION_LIMIT = 120
const DEFAULT_PRIVATE_MUTATION_WINDOW_MS = 60_000
const DEFAULT_PRIVATE_MUTATION_MAX_BYTES = 2_000_000
const DEFAULT_PRIVATE_MUTATION_MIN_BYTES = 64_000
const DEFAULT_PRIVATE_MUTATION_HARD_MAX_BYTES = 5_000_000

function cleanGuardId(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:._/-]/g, "_")
    .slice(0, 120)
}

export function resolveApiMutationGuardOptions(
  options: ApiMutationGuardOptions
): ApiMutationGuardResolvedOptions {
  const id = cleanGuardId(options.id || "api-mutation") || "api-mutation"
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_PRIVATE_MUTATION_LIMIT))
  const windowMs = Math.max(
    1_000,
    Math.floor(options.windowMs ?? DEFAULT_PRIVATE_MUTATION_WINDOW_MS)
  )
  const minBytes = Math.max(
    1_024,
    Math.floor(options.minBytes ?? DEFAULT_PRIVATE_MUTATION_MIN_BYTES)
  )
  const hardMaxBytes = Math.max(
    minBytes,
    Math.floor(options.hardMaxBytes ?? DEFAULT_PRIVATE_MUTATION_HARD_MAX_BYTES)
  )
  const fallbackBytes = Math.floor(options.maxBytes ?? DEFAULT_PRIVATE_MUTATION_MAX_BYTES)
  const maxBytes = options.envMaxBytes
    ? getEnvByteLimit(options.envMaxBytes, fallbackBytes, {
        minBytes,
        maxBytes: hardMaxBytes,
      })
    : Math.min(hardMaxBytes, Math.max(minBytes, fallbackBytes))

  return {
    id,
    limit,
    windowMs,
    maxBytes,
    rateLimitMessage:
      options.rateLimitMessage ||
      "Demasiadas solicitudes. Espera unos segundos e intenta nuevamente.",
    sizeLimitMessage:
      options.sizeLimitMessage ||
      "La solicitud es demasiado grande. Reduce el contenido e intenta nuevamente.",
    originMessage: options.originMessage || "Solicitud no permitida desde este origen.",
    skipSameOrigin: options.skipSameOrigin === true,
  }
}

export function enforceApiMutationGuards(
  request: HeaderReadable,
  options: ApiMutationGuardOptions
): NextResponse | null {
  const resolvedOptions = resolveApiMutationGuardOptions(options)
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

  return enforceRequestSizeLimit(request, {
    maxBytes: resolvedOptions.maxBytes,
    message: resolvedOptions.sizeLimitMessage,
    route: resolvedOptions.id,
  })
}
