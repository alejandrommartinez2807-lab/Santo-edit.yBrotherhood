export type DeploymentReadinessStatus = "ok" | "warning" | "error"

export type DeploymentReadinessGroup =
  | "supabase"
  | "access"
  | "security"
  | "uploads"
  | "payments"
  | "monitoring"
  | "site"

export type DeploymentReadinessCheck = {
  key: string
  group: DeploymentReadinessGroup
  label: string
  status: DeploymentReadinessStatus
  detail: string
  recommendation?: string
}

type ReadinessEnv = Record<string, string | undefined>

const STAFF_PASSWORD_KEYS = [
  "ORDERS_OWNER_PASSWORD",
  "ORDERS_ADMIN_PASSWORD",
  "ADMIN_PASSWORD",
  "ORDERS_MANAGER_PASSWORD",
  "ORDERS_CASHIER_PASSWORD",
  "ORDERS_WAITER_PASSWORD",
  "ORDERS_KITCHEN_PASSWORD",
  "ORDERS_DELIVERY_PASSWORD",
  "ORDERS_SUPPORT_PASSWORD",
  "ORDERS_PROVIDER_PASSWORD",
]

const REQUIRED_UPLOAD_LIMIT_KEYS = [
  "ORDERS_POST_MAX_BYTES",
  "PAYMENT_PROOF_POST_MAX_BYTES",
  "MENU_IMAGE_UPLOAD_MAX_BYTES",
  "ORDER_ATTACHMENT_IMAGE_MAX_BYTES",
  "PAYMENT_PROOF_IMAGE_MAX_BYTES",
  "MENU_IMAGE_UPLOAD_BYTES",
]

const MUTATION_LIMIT_KEYS = [
  "PRIVATE_API_MUTATION_MAX_BYTES",
  "MENU_PRODUCTS_MUTATION_MAX_BYTES",
  "INVENTORY_MUTATION_MAX_BYTES",
  "ORDER_DETAIL_MUTATION_MAX_BYTES",
  "ORDER_PAYMENT_MUTATION_MAX_BYTES",
  "DAY_CLOSE_POST_MAX_BYTES",
]

const GROUP_LABELS: Record<DeploymentReadinessGroup, string> = {
  supabase: "Supabase",
  access: "Acceso privado",
  security: "Seguridad API",
  uploads: "Cargas e imágenes",
  payments: "Pagos en línea",
  monitoring: "Monitoreo",
  site: "Sitio público",
}

function clean(value: unknown) {
  return String(value || "").trim()
}

function lower(value: unknown) {
  return clean(value).toLowerCase()
}

function isPlaceholderValue(value: unknown) {
  const text = lower(value)

  if (!text) return false

  return (
    text === "changeme" ||
    text === "change-me" ||
    text === "password" ||
    text === "123456" ||
    text === "admin" ||
    text === "demo" ||
    text.includes("tu-") ||
    text.includes("your-") ||
    text.includes("example") ||
    text.includes("placeholder") ||
    text.includes("rellena") ||
    text.includes("cambiar")
  )
}

function hasConfiguredValue(env: ReadinessEnv, key: string) {
  const value = clean(env[key])
  return Boolean(value) && !isPlaceholderValue(value)
}

function hasProvidedValue(env: ReadinessEnv, key: string) {
  return Boolean(clean(env[key]))
}

function buildCheck(check: DeploymentReadinessCheck): DeploymentReadinessCheck {
  return check
}

function isValidHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

function isValidAllowedOriginEntry(value: string) {
  const text = clean(value)
  if (!text) return true

  if (text.startsWith("http://")) return false
  if (text.startsWith("https://")) return isValidHttpsUrl(text)

  return /^[a-z0-9.-]+(:\d+)?$/i.test(text)
}

function getPositiveInteger(env: ReadinessEnv, key: string) {
  const rawValue = clean(env[key])
  if (!rawValue) return null

  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) return null

  return Math.floor(value)
}

function getConfiguredPasswordEntries(env: ReadinessEnv) {
  return STAFF_PASSWORD_KEYS.map((key) => ({
    key,
    value: clean(env[key]),
  })).filter((entry) => entry.value)
}

function getWeakPasswordKeys(env: ReadinessEnv) {
  return getConfiguredPasswordEntries(env)
    .filter((entry) => entry.value.length < 10 || isPlaceholderValue(entry.value))
    .map((entry) => entry.key)
}

function getDuplicatePasswordGroups(env: ReadinessEnv) {
  const byValue = new Map<string, string[]>()

  for (const entry of getConfiguredPasswordEntries(env)) {
    const normalized = entry.value
    const list = byValue.get(normalized) || []
    list.push(entry.key)
    byValue.set(normalized, list)
  }

  return Array.from(byValue.values()).filter((keys) => keys.length > 1)
}

function getConfiguredCount(env: ReadinessEnv, keys: string[]) {
  return keys.filter((key) => hasConfiguredValue(env, key)).length
}

function getInvalidNumberKeys(env: ReadinessEnv, keys: string[]) {
  return keys.filter((key) => clean(env[key]) && getPositiveInteger(env, key) === null)
}

function getAllowedOrigins(env: ReadinessEnv) {
  return clean(env.ALLOWED_API_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function getStripeConfiguredKeys(env: ReadinessEnv) {
  return ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CURRENCY"].filter((key) =>
    hasConfiguredValue(env, key)
  )
}

function getSentryDsn(env: ReadinessEnv) {
  return clean(env.SENTRY_DSN) || clean(env.NEXT_PUBLIC_SENTRY_DSN)
}

function isDisabledFlag(value: unknown) {
  const text = lower(value)
  return text === "true" || text === "1" || text === "yes"
}

function summarizeGroups(checks: DeploymentReadinessCheck[]) {
  return (Object.keys(GROUP_LABELS) as DeploymentReadinessGroup[]).map((key) => {
    const groupChecks = checks.filter((check) => check.group === key)
    const errors = groupChecks.filter((check) => check.status === "error").length
    const warnings = groupChecks.filter((check) => check.status === "warning").length

    return {
      key,
      label: GROUP_LABELS[key],
      status: errors > 0 ? "error" : warnings > 0 ? "warning" : "ok",
      total: groupChecks.length,
      errors,
      warnings,
    }
  })
}

export function getDeploymentReadiness(env: ReadinessEnv = process.env) {
  const checks: DeploymentReadinessCheck[] = []
  const supabaseUrl = clean(env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKeyConfigured = hasConfiguredValue(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceRoleConfigured = hasConfiguredValue(env, "SUPABASE_SERVICE_ROLE_KEY")
  const ownerAccessConfigured =
    hasProvidedValue(env, "ORDERS_OWNER_PASSWORD") ||
    hasProvidedValue(env, "ORDERS_ADMIN_PASSWORD") ||
    hasProvidedValue(env, "ADMIN_PASSWORD")
  const supportAccessConfigured =
    hasProvidedValue(env, "ORDERS_SUPPORT_PASSWORD") ||
    hasProvidedValue(env, "ORDERS_PROVIDER_PASSWORD")

  checks.push(
    buildCheck({
      key: "supabase-url",
      group: "supabase",
      label: "URL de Supabase",
      status: supabaseUrl ? (isValidHttpsUrl(supabaseUrl) ? "ok" : "error") : "error",
      detail: supabaseUrl
        ? isValidHttpsUrl(supabaseUrl)
          ? "NEXT_PUBLIC_SUPABASE_URL está configurada con HTTPS."
          : "NEXT_PUBLIC_SUPABASE_URL no parece ser una URL HTTPS válida."
        : "Falta NEXT_PUBLIC_SUPABASE_URL.",
      recommendation: supabaseUrl
        ? undefined
        : "Copia la URL del proyecto desde Supabase → Project Settings → API.",
    }),
    buildCheck({
      key: "supabase-anon-key",
      group: "supabase",
      label: "Clave pública de Supabase",
      status: anonKeyConfigured ? "ok" : "error",
      detail: anonKeyConfigured
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY está configurada."
        : "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      recommendation: anonKeyConfigured
        ? undefined
        : "Copia la anon key del proyecto. Es pública, pero debe pertenecer al cliente correcto.",
    }),
    buildCheck({
      key: "supabase-service-role",
      group: "supabase",
      label: "Service role de Supabase",
      status: serviceRoleConfigured ? "ok" : "error",
      detail: serviceRoleConfigured
        ? "SUPABASE_SERVICE_ROLE_KEY está configurada solo del lado servidor."
        : "Falta SUPABASE_SERVICE_ROLE_KEY.",
      recommendation: serviceRoleConfigured
        ? undefined
        : "Copia la service_role key real en Vercel y en .env.local. No la compartas con el cliente.",
    })
  )

  if (anonKeyConfigured && serviceRoleConfigured) {
    checks.push(
      buildCheck({
        key: "supabase-key-separation",
        group: "supabase",
        label: "Separación de claves Supabase",
        status:
          clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === clean(env.SUPABASE_SERVICE_ROLE_KEY)
            ? "error"
            : "ok",
        detail:
          clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === clean(env.SUPABASE_SERVICE_ROLE_KEY)
            ? "La anon key y la service_role key parecen iguales."
            : "La clave pública y la clave server son distintas.",
        recommendation:
          clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === clean(env.SUPABASE_SERVICE_ROLE_KEY)
            ? "Corrige las claves: la anon key va al navegador y la service_role solo al servidor."
            : undefined,
      })
    )
  }

  const weakPasswordKeys = getWeakPasswordKeys(env)
  const duplicatePasswordGroups = getDuplicatePasswordGroups(env)
  const configuredStaffPasswordCount = getConfiguredPasswordEntries(env).length

  checks.push(
    buildCheck({
      key: "owner-access",
      group: "access",
      label: "Acceso de dueño/admin",
      status: ownerAccessConfigured ? "ok" : "error",
      detail: ownerAccessConfigured
        ? "Hay al menos una clave de dueño/admin configurada."
        : "Falta una clave de dueño/admin.",
      recommendation: ownerAccessConfigured
        ? undefined
        : "Configura ORDERS_OWNER_PASSWORD u ORDERS_ADMIN_PASSWORD con una clave fuerte.",
    }),
    buildCheck({
      key: "support-access",
      group: "access",
      label: "Acceso de soporte",
      status: supportAccessConfigured ? "ok" : "warning",
      detail: supportAccessConfigured
        ? "Hay clave de soporte configurada para diagnósticos privados."
        : "No hay clave de soporte configurada.",
      recommendation: supportAccessConfigured
        ? undefined
        : "Configura ORDERS_SUPPORT_PASSWORD para poder revisar soporte sin usar la clave del dueño.",
    }),
    buildCheck({
      key: "staff-password-coverage",
      group: "access",
      label: "Claves por rol",
      status: configuredStaffPasswordCount >= 4 ? "ok" : "warning",
      detail: `${configuredStaffPasswordCount} clave(s) de rol configurada(s).`,
      recommendation:
        configuredStaffPasswordCount >= 4
          ? undefined
          : "Para operación real, configura claves distintas para dueño, caja, cocina, delivery/mesonero y soporte según el plan.",
    }),
    buildCheck({
      key: "staff-password-strength",
      group: "access",
      label: "Fortaleza de claves",
      status: weakPasswordKeys.length ? "warning" : "ok",
      detail: weakPasswordKeys.length
        ? `Hay ${weakPasswordKeys.length} clave(s) corta(s) o con valor de ejemplo.`
        : "Las claves configuradas no parecen ser valores cortos o de ejemplo.",
      recommendation: weakPasswordKeys.length
        ? `Revisa: ${weakPasswordKeys.join(", ")}. Usa claves largas y distintas.`
        : undefined,
    }),
    buildCheck({
      key: "staff-password-duplicates",
      group: "access",
      label: "Claves duplicadas",
      status: duplicatePasswordGroups.length ? "warning" : "ok",
      detail: duplicatePasswordGroups.length
        ? `Hay ${duplicatePasswordGroups.length} grupo(s) de claves duplicadas entre roles.`
        : "No se detectan claves duplicadas entre roles.",
      recommendation: duplicatePasswordGroups.length
        ? `Cambia las claves repetidas: ${duplicatePasswordGroups
            .map((keys) => keys.join(" + "))
            .join("; ")}.`
        : undefined,
    })
  )

  const rateLimitMaxKeys = getPositiveInteger(env, "RATE_LIMIT_MAX_KEYS")
  const allowedOrigins = getAllowedOrigins(env)
  const invalidOrigins = allowedOrigins.filter((origin) => !isValidAllowedOriginEntry(origin))

  checks.push(
    buildCheck({
      key: "rate-limit-store-size",
      group: "security",
      label: "Tamaño del rate limit",
      status: rateLimitMaxKeys && rateLimitMaxKeys >= 1_000 ? "ok" : "warning",
      detail: rateLimitMaxKeys
        ? `RATE_LIMIT_MAX_KEYS=${rateLimitMaxKeys}.`
        : "RATE_LIMIT_MAX_KEYS no está configurado o no es válido.",
      recommendation:
        rateLimitMaxKeys && rateLimitMaxKeys >= 1_000
          ? undefined
          : "Usa un valor como 10000 para evitar crecimiento indefinido del store en memoria.",
    }),
    buildCheck({
      key: "allowed-api-origins",
      group: "security",
      label: "Orígenes API permitidos",
      status: invalidOrigins.length ? "warning" : "ok",
      detail: invalidOrigins.length
        ? `Hay ${invalidOrigins.length} origen(es) con formato inválido.`
        : allowedOrigins.length
          ? `${allowedOrigins.length} origen(es) extra configurado(s).`
          : "Sin orígenes extra; se permite el mismo dominio del sitio.",
      recommendation: invalidOrigins.length
        ? "Usa HTTPS o hosts válidos separados por coma. Evita http:// en producción."
        : undefined,
    }),
    buildCheck({
      key: "security-event-logging",
      group: "security",
      label: "Eventos de seguridad",
      status: isDisabledFlag(env.SECURITY_EVENT_LOGGING) || clean(env.SECURITY_EVENT_LOGGING) === "" ? "ok" : "ok",
      detail:
        clean(env.SECURITY_EVENT_LOGGING) === "false"
          ? "SECURITY_EVENT_LOGGING está desactivado."
          : "Los eventos de seguridad se registran sin guardar IP cruda.",
      recommendation:
        clean(env.SECURITY_EVENT_LOGGING) === "false"
          ? "Actívalo en producción si quieres auditar bloqueos por abuso."
          : undefined,
    })
  )

  const invalidUploadLimitKeys = getInvalidNumberKeys(env, [
    ...REQUIRED_UPLOAD_LIMIT_KEYS,
    ...MUTATION_LIMIT_KEYS,
  ])
  const configuredUploadLimits = getConfiguredCount(env, REQUIRED_UPLOAD_LIMIT_KEYS)

  checks.push(
    buildCheck({
      key: "upload-limits",
      group: "uploads",
      label: "Límites de imágenes y requests",
      status: invalidUploadLimitKeys.length ? "warning" : configuredUploadLimits >= 5 ? "ok" : "warning",
      detail: invalidUploadLimitKeys.length
        ? `Hay ${invalidUploadLimitKeys.length} límite(s) con valor inválido.`
        : `${configuredUploadLimits}/${REQUIRED_UPLOAD_LIMIT_KEYS.length} límite(s) principales configurado(s).`,
      recommendation: invalidUploadLimitKeys.length
        ? `Corrige valores numéricos positivos en: ${invalidUploadLimitKeys.join(", ")}.`
        : configuredUploadLimits >= 5
          ? undefined
          : "Mantén límites explícitos para pedidos, comprobantes e imágenes del menú.",
    })
  )

  const stripeKeys = getStripeConfiguredKeys(env)
  const stripeEnabled = hasConfiguredValue(env, "STRIPE_SECRET_KEY") || hasConfiguredValue(env, "STRIPE_WEBHOOK_SECRET")
  const stripeSecret = clean(env.STRIPE_SECRET_KEY)
  const stripeWebhook = clean(env.STRIPE_WEBHOOK_SECRET)
  const siteUrl = clean(env.NEXT_PUBLIC_SITE_URL)

  checks.push(
    buildCheck({
      key: "stripe-completeness",
      group: "payments",
      label: "Stripe opcional",
      status: stripeEnabled
        ? hasConfiguredValue(env, "STRIPE_SECRET_KEY") && hasConfiguredValue(env, "STRIPE_WEBHOOK_SECRET")
          ? "ok"
          : "error"
        : "ok",
      detail: stripeEnabled
        ? `${stripeKeys.length} variable(s) de Stripe configurada(s).`
        : "Stripe no está configurado; los pagos manuales siguen funcionando.",
      recommendation:
        stripeEnabled &&
        (!hasConfiguredValue(env, "STRIPE_SECRET_KEY") || !hasConfiguredValue(env, "STRIPE_WEBHOOK_SECRET"))
          ? "Configura STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET juntos, o deja ambos vacíos."
          : undefined,
    }),
    buildCheck({
      key: "stripe-key-format",
      group: "payments",
      label: "Formato de claves Stripe",
      status:
        !stripeEnabled ||
        ((stripeSecret.startsWith("sk_") || !stripeSecret) &&
          (stripeWebhook.startsWith("whsec_") || !stripeWebhook))
          ? "ok"
          : "warning",
      detail: stripeEnabled
        ? "Se revisó el formato esperado de STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET."
        : "Sin Stripe activo.",
      recommendation:
        stripeEnabled &&
        !((stripeSecret.startsWith("sk_") || !stripeSecret) &&
          (stripeWebhook.startsWith("whsec_") || !stripeWebhook))
          ? "Verifica que la secret key empiece por sk_ y el webhook secret por whsec_."
          : undefined,
    })
  )

  const sentryDsn = getSentryDsn(env)
  const tracesSampleRate = clean(env.SENTRY_TRACES_SAMPLE_RATE)
  const parsedTracesSampleRate = tracesSampleRate ? Number(tracesSampleRate) : 0

  checks.push(
    buildCheck({
      key: "sentry-dsn",
      group: "monitoring",
      label: "Sentry/monitoreo remoto",
      status: sentryDsn ? "ok" : "warning",
      detail: sentryDsn
        ? "Hay DSN de Sentry configurado."
        : "No hay DSN de Sentry; queda activo el log local del servidor.",
      recommendation: sentryDsn
        ? undefined
        : "Para producción con muchos clientes, activa Sentry real cuando quieras monitoreo centralizado.",
    }),
    buildCheck({
      key: "sentry-remote-enabled",
      group: "monitoring",
      label: "Monitoreo remoto habilitado",
      status: sentryDsn && isDisabledFlag(env.MONITORING_REMOTE_DISABLED) ? "warning" : "ok",
      detail:
        sentryDsn && isDisabledFlag(env.MONITORING_REMOTE_DISABLED)
          ? "Hay DSN pero MONITORING_REMOTE_DISABLED desactiva el envío remoto."
          : "La configuración de monitoreo remoto no bloquea el funcionamiento.",
      recommendation:
        sentryDsn && isDisabledFlag(env.MONITORING_REMOTE_DISABLED)
          ? "Pon MONITORING_REMOTE_DISABLED=false si quieres enviar eventos a Sentry."
          : undefined,
    }),
    buildCheck({
      key: "sentry-traces-sample-rate",
      group: "monitoring",
      label: "Sample rate de Sentry",
      status:
        !tracesSampleRate ||
        (Number.isFinite(parsedTracesSampleRate) && parsedTracesSampleRate >= 0 && parsedTracesSampleRate <= 1)
          ? "ok"
          : "warning",
      detail: tracesSampleRate
        ? `SENTRY_TRACES_SAMPLE_RATE=${tracesSampleRate}.`
        : "SENTRY_TRACES_SAMPLE_RATE no definido; se usa 0.",
      recommendation:
        tracesSampleRate &&
        !(Number.isFinite(parsedTracesSampleRate) && parsedTracesSampleRate >= 0 && parsedTracesSampleRate <= 1)
          ? "Usa un valor entre 0 y 1. Ejemplo: 0 en inicio, 0.05 si quieres trazas limitadas."
          : undefined,
    })
  )

  checks.push(
    buildCheck({
      key: "public-site-url",
      group: "site",
      label: "URL pública del sitio",
      status: siteUrl ? (isValidHttpsUrl(siteUrl) ? "ok" : "warning") : "warning",
      detail: siteUrl
        ? isValidHttpsUrl(siteUrl)
          ? "NEXT_PUBLIC_SITE_URL usa HTTPS."
          : "NEXT_PUBLIC_SITE_URL no parece HTTPS válido."
        : "NEXT_PUBLIC_SITE_URL está vacío.",
      recommendation: siteUrl
        ? undefined
        : "Configúralo en Vercel cuando actives pagos online, enlaces públicos o integraciones externas.",
    })
  )

  const errors = checks.filter((check) => check.status === "error").length
  const warnings = checks.filter((check) => check.status === "warning").length
  const ok = errors === 0

  return {
    ok,
    status: errors > 0 ? "error" : warnings > 0 ? "warning" : "ok",
    checkedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      ok: checks.length - errors - warnings,
      warnings,
      errors,
    },
    groups: summarizeGroups(checks),
    checks,
  }
}
