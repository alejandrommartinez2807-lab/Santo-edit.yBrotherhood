import { captureInfo } from "@/lib/monitoring"

type HeaderReadable = {
  headers: {
    get(name: string): string | null
  }
}

export type SecurityEventKind =
  | "rate_limit"
  | "request_too_large"
  | "cross_origin"
  | "invalid_payload"

export type SecurityEvent = {
  kind: SecurityEventKind
  route: string
  request?: HeaderReadable
  metadata?: Record<string, unknown>
}

export type SecurityEventPayload = {
  kind: SecurityEventKind
  route: string
  clientFingerprint?: string
  userAgentFingerprint?: string
  hasForwardedFor?: boolean
  hasRealIp?: boolean
  hasCfIp?: boolean
  [key: string]: unknown
}

const MAX_METADATA_KEYS = 30
const MAX_METADATA_STRING_LENGTH = 240

function firstHeaderValue(value: string | null) {
  return (
    String(value || "")
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) || ""
  )
}

function cleanHeaderValue(value: string | null) {
  return firstHeaderValue(value).slice(0, MAX_METADATA_STRING_LENGTH)
}

function normalizeForFingerprint(value: string) {
  return value.trim().toLowerCase().slice(0, 240)
}

export function fingerprintSecurityValue(value: string) {
  const normalizedValue = normalizeForFingerprint(value)
  let hash = 0x811c9dc5

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash ^= normalizedValue.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `fp_${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function getSecurityClientSource(request?: HeaderReadable) {
  if (!request) return {}

  const forwardedFor = cleanHeaderValue(request.headers.get("x-forwarded-for"))
  const realIp = cleanHeaderValue(request.headers.get("x-real-ip"))
  const cfIp = cleanHeaderValue(request.headers.get("cf-connecting-ip"))
  const userAgent = cleanHeaderValue(request.headers.get("user-agent"))
  const sourceIp = forwardedFor || realIp || cfIp || "unknown"

  return {
    clientFingerprint: fingerprintSecurityValue(sourceIp),
    userAgentFingerprint: userAgent ? fingerprintSecurityValue(userAgent) : "unknown",
    hasForwardedFor: Boolean(forwardedFor),
    hasRealIp: Boolean(realIp),
    hasCfIp: Boolean(cfIp),
  }
}

function shouldLogSecurityEvents() {
  if (process.env.NODE_ENV === "test") return false
  return process.env.SECURITY_EVENT_LOGGING !== "false"
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string") return value.slice(0, MAX_METADATA_STRING_LENGTH)
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeMetadataValue)

  if (typeof value === "object") {
    const output: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_METADATA_KEYS
    )) {
      output[key.slice(0, MAX_METADATA_STRING_LENGTH)] = sanitizeMetadataValue(item)
    }

    return output
  }

  return String(value).slice(0, MAX_METADATA_STRING_LENGTH)
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {}

  return sanitizeMetadataValue(metadata) as Record<string, unknown>
}

export function buildSecurityEventPayload(
  event: SecurityEvent
): SecurityEventPayload {
  return {
    kind: event.kind,
    route: event.route || "unknown",
    ...getSecurityClientSource(event.request),
    ...sanitizeMetadata(event.metadata),
  }
}

export function recordSecurityEvent(event: SecurityEvent) {
  if (!shouldLogSecurityEvents()) return

  captureInfo(`security:${event.kind}`, {
    route: event.route || "unknown",
    action: event.kind,
    level: "warning",
    metadata: buildSecurityEventPayload(event),
  })
}
