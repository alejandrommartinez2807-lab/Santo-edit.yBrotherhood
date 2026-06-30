import { NextResponse } from "next/server"
import { recordSecurityEvent } from "@/lib/securityEvents"

type HeaderReadable = {
  headers: {
    get(name: string): string | null
  }
}

export type RequestSizeLimitOptions = {
  maxBytes: number
  message?: string
  route?: string
}

export type RequestSizeLimitResult = {
  allowed: boolean
  contentLength: number | null
  maxBytes: number
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

export function parseContentLength(value: string | null) {
  if (!value) return null

  const trimmedValue = value.trim()
  if (!/^\d+$/.test(trimmedValue)) return null

  const parsedValue = Number(trimmedValue)
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 0) return null

  return parsedValue
}

export function getRequestContentLength(request: HeaderReadable) {
  return parseContentLength(request.headers.get("content-length"))
}

export function checkRequestSizeLimit(
  request: HeaderReadable,
  options: RequestSizeLimitOptions
): RequestSizeLimitResult {
  const maxBytes = Math.max(1_024, Math.floor(options.maxBytes))
  const contentLength = getRequestContentLength(request)

  return {
    allowed: contentLength === null || contentLength <= maxBytes,
    contentLength,
    maxBytes,
  }
}

export function buildRequestSizeLimitResponse(
  result: RequestSizeLimitResult,
  message?: string
) {
  return NextResponse.json(
    {
      ok: false,
      code: "REQUEST_TOO_LARGE",
      error: message || "La solicitud es demasiado grande. Reduce el contenido e intenta nuevamente.",
      maxBytes: result.maxBytes,
    },
    {
      status: 413,
      headers: NO_STORE_HEADERS,
    }
  )
}

export function enforceRequestSizeLimit(
  request: HeaderReadable,
  options: RequestSizeLimitOptions
) {
  const result = checkRequestSizeLimit(request, options)

  if (result.allowed) return null

  recordSecurityEvent({
    kind: "request_too_large",
    route: options.route || "request-size-limit",
    request,
    metadata: {
      contentLength: result.contentLength,
      maxBytes: result.maxBytes,
    },
  })

  return buildRequestSizeLimitResponse(result, options.message)
}

type EnvByteLimitOptions = {
  minBytes?: number
  maxBytes?: number
}

export function getEnvByteLimit(
  envName: string,
  fallbackBytes: number,
  options: EnvByteLimitOptions = {}
) {
  const minBytes = Math.max(1, Math.floor(options.minBytes ?? 1_024))
  const maxBytes = Math.max(minBytes, Math.floor(options.maxBytes ?? Number.MAX_SAFE_INTEGER))
  const parsedValue = Number(process.env[envName])

  if (!Number.isFinite(parsedValue)) {
    return Math.min(maxBytes, Math.max(minBytes, Math.floor(fallbackBytes)))
  }

  return Math.min(maxBytes, Math.max(minBytes, Math.floor(parsedValue)))
}

export type SameOriginGuardResult = {
  allowed: boolean
  requestHost: string
  sourceHost: string
  source: "origin" | "referer" | "none"
  reason: "same-host" | "allowed-host" | "www-alias" | "missing-source" | "blocked"
}

function firstHeaderValue(value: string | null) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) || ""
}

function normalizeComparableHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "")
}

function removeWwwPrefix(value: string) {
  return normalizeComparableHost(value).replace(/^www\./, "")
}

function getHostFromUrl(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ""

  try {
    return normalizeComparableHost(new URL(trimmedValue).host)
  } catch {
    return normalizeComparableHost(trimmedValue.replace(/^https?:\/\//, "").split("/")[0] || "")
  }
}

function getAllowedApiOriginHosts() {
  return String(process.env.ALLOWED_API_ORIGINS || "")
    .split(/[\s,]+/)
    .map(getHostFromUrl)
    .filter(Boolean)
}

function hostsMatchWithWwwAlias(firstHost: string, secondHost: string) {
  if (!firstHost || !secondHost) return false
  if (firstHost === secondHost) return true

  return removeWwwPrefix(firstHost) === removeWwwPrefix(secondHost)
}

export function isAllowedApiSourceHost(sourceHost: string, requestHost: string) {
  const cleanSourceHost = normalizeComparableHost(sourceHost)
  const cleanRequestHost = normalizeComparableHost(requestHost)

  if (!cleanSourceHost) return false
  if (cleanRequestHost && cleanSourceHost === cleanRequestHost) return true
  if (hostsMatchWithWwwAlias(cleanSourceHost, cleanRequestHost)) return true

  return getAllowedApiOriginHosts().some((allowedHost) =>
    hostsMatchWithWwwAlias(cleanSourceHost, allowedHost)
  )
}

export function getRequestHost(request: HeaderReadable) {
  return normalizeComparableHost(
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
      firstHeaderValue(request.headers.get("host"))
  )
}

export function checkSameOriginRequest(request: HeaderReadable): SameOriginGuardResult {
  const requestHost = getRequestHost(request)
  const originHost = getHostFromUrl(firstHeaderValue(request.headers.get("origin")))

  if (originHost) {
    const allowed = Boolean(requestHost) && isAllowedApiSourceHost(originHost, requestHost)

    return {
      allowed,
      requestHost,
      sourceHost: originHost,
      source: "origin",
      reason: allowed
        ? originHost === requestHost
          ? "same-host"
          : hostsMatchWithWwwAlias(originHost, requestHost)
            ? "www-alias"
            : "allowed-host"
        : "blocked",
    }
  }

  const refererHost = getHostFromUrl(firstHeaderValue(request.headers.get("referer")))

  if (refererHost) {
    const allowed = Boolean(requestHost) && isAllowedApiSourceHost(refererHost, requestHost)

    return {
      allowed,
      requestHost,
      sourceHost: refererHost,
      source: "referer",
      reason: allowed
        ? refererHost === requestHost
          ? "same-host"
          : hostsMatchWithWwwAlias(refererHost, requestHost)
            ? "www-alias"
            : "allowed-host"
        : "blocked",
    }
  }

  return {
    allowed: true,
    requestHost,
    sourceHost: "",
    source: "none",
    reason: "missing-source",
  }
}

export function buildSameOriginResponse(message?: string) {
  return NextResponse.json(
    {
      ok: false,
      code: "ORIGIN_NOT_ALLOWED",
      error: message || "Solicitud no permitida desde este origen.",
    },
    {
      status: 403,
      headers: NO_STORE_HEADERS,
    }
  )
}

export function enforceSameOriginRequest(
  request: HeaderReadable,
  message?: string,
  route = "same-origin"
) {
  const result = checkSameOriginRequest(request)

  if (result.allowed) return null

  recordSecurityEvent({
    kind: "cross_origin",
    route,
    request,
    metadata: {
      requestHost: result.requestHost,
      sourceHost: result.sourceHost,
      source: result.source,
      reason: result.reason,
    },
  })

  return buildSameOriginResponse(message)
}
