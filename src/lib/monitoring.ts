type MonitoringLevel = "error" | "warning" | "info"

type MonitoringContext = {
  route: string
  action?: string
  metadata?: Record<string, unknown>
  level?: MonitoringLevel
}

type OptionalSentryScope = {
  setTag?: (key: string, value: string) => void
  setLevel?: (level: MonitoringLevel) => void
  setContext?: (key: string, context: Record<string, unknown>) => void
}

type OptionalSentrySdk = {
  init?: (options: Record<string, unknown>) => void
  captureException?: (error: unknown) => void
  captureMessage?: (message: string, level?: MonitoringLevel) => void
  withScope?: (callback: (scope: OptionalSentryScope) => void) => void
}

type MonitoringGlobal = typeof globalThis & {
  __santoSentrySdkPromise?: Promise<OptionalSentrySdk | null>
  __santoSentryInitialized?: boolean
}

const globalForMonitoring = globalThis as MonitoringGlobal
const MAX_METADATA_DEPTH = 3
const MAX_ARRAY_ITEMS = 20
const MAX_STRING_LENGTH = 1_000
const MAX_OBJECT_KEYS = 40

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || "Error desconocido")
}

function getErrorName(error: unknown) {
  if (error instanceof Error) return error.name
  return "Error"
}

function shouldLogMonitoringErrors() {
  return process.env.MONITORING_LOG_ERRORS !== "false"
}

function getSentryDsn() {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ""
}

function getSentryEnvironment() {
  return process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV || "production"
}

function getSentryTracesSampleRate() {
  const rawValue = process.env.SENTRY_TRACES_SAMPLE_RATE
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0
  if (parsedValue > 1) return 1

  return parsedValue
}

function getBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback
  return value === "true" || value === "1" || value === "yes"
}

function sanitizeString(value: string) {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…`
    : value
}

function sanitizeMonitoringValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === "string") return sanitizeString(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    }
  }

  if (depth >= MAX_METADATA_DEPTH) return "[MaxDepth]"

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMonitoringValue(item, depth + 1))
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)

    for (const [key, item] of entries) {
      output[sanitizeString(key)] = sanitizeMonitoringValue(item, depth + 1)
    }

    return output
  }

  return String(value)
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {}

  return sanitizeMonitoringValue(metadata) as Record<string, unknown>
}

function buildMonitoringPayload(error: unknown, context: MonitoringContext) {
  return {
    source: "santo-monitoring",
    route: context.route,
    action: context.action || "unknown",
    level: context.level || "error",
    errorName: getErrorName(error),
    errorMessage: getErrorMessage(error),
    sentryReady: hasSentryDsnConfigured(),
    remoteEnabled: isRemoteMonitoringEnabled(),
    environment: getSentryEnvironment(),
    metadata: sanitizeMetadata(context.metadata),
  }
}

async function importOptionalSentry() {
  if (!globalForMonitoring.__santoSentrySdkPromise) {
    globalForMonitoring.__santoSentrySdkPromise = (async () => {
      try {
        const importer = new Function(
          "specifier",
          "return import(specifier)"
        ) as (specifier: string) => Promise<OptionalSentrySdk>

        return await importer("@sentry/nextjs")
      } catch {
        return null
      }
    })()
  }

  return globalForMonitoring.__santoSentrySdkPromise
}

function initializeSentryIfNeeded(sentry: OptionalSentrySdk | null) {
  if (!sentry?.init || globalForMonitoring.__santoSentryInitialized) return

  const dsn = getSentryDsn()
  if (!dsn) return

  sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    enabled: true,
    debug: getBooleanEnv(process.env.SENTRY_DEBUG, false),
    tracesSampleRate: getSentryTracesSampleRate(),
  })

  globalForMonitoring.__santoSentryInitialized = true
}

async function sendToRemoteMonitoring(error: unknown, context: MonitoringContext) {
  if (!isRemoteMonitoringEnabled()) return

  const sentry = await importOptionalSentry()
  initializeSentryIfNeeded(sentry)

  if (!sentry) return

  const metadata = sanitizeMetadata(context.metadata)
  const level = context.level || "error"

  if (sentry.withScope) {
    sentry.withScope((scope) => {
      scope.setTag?.("route", context.route)
      scope.setTag?.("action", context.action || "unknown")
      scope.setLevel?.(level)
      scope.setContext?.("santo", metadata)

      if (level === "error" && sentry.captureException) {
        sentry.captureException(error)
        return
      }

      sentry.captureMessage?.(getErrorMessage(error), level)
    })

    return
  }

  if (level === "error") {
    sentry.captureException?.(error)
    return
  }

  sentry.captureMessage?.(getErrorMessage(error), level)
}

export function hasSentryDsnConfigured() {
  return Boolean(getSentryDsn())
}

export function isRemoteMonitoringEnabled() {
  return hasSentryDsnConfigured() && process.env.MONITORING_REMOTE_DISABLED !== "true"
}

export function captureError(error: unknown, context: MonitoringContext) {
  const payload = buildMonitoringPayload(error, { ...context, level: context.level || "error" })

  if (shouldLogMonitoringErrors()) {
    // Base local segura: en Vercel/Node queda en logs aunque Sentry no esté instalado.
    console.error("[monitoring]", payload)
  }

  void sendToRemoteMonitoring(error, { ...context, level: "error" })
}

export function captureInfo(message: string, context: MonitoringContext) {
  const payload = buildMonitoringPayload(message, { ...context, level: context.level || "info" })

  if (shouldLogMonitoringErrors()) {
    console.info("[monitoring]", payload)
  }

  void sendToRemoteMonitoring(message, { ...context, level: context.level || "info" })
}
