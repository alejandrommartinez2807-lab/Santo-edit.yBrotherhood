export type BranchPaymentMethodKey =
  | "cash_usd"
  | "cash_ves"
  | "pago_movil"
  | "transfer"
  | "debit_card"
  | "credit_card"
  | "zelle"
  | "binance"
  | "other"

export type BranchConfig = {
  displayName: string
  shortDescription: string
  address: string
  googleMapsUrl: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  scheduleLine1: string
  scheduleLine2: string
  publicOrdersEnabled: boolean
  dineInEnabled: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  isTemporarilyClosed: boolean
  temporaryClosedMessage: string
  defaultPrepMinutes: number
  defaultDeliveryMinutes: number
  deliveryMinimumUSD: number
  deliveryCoverageNote: string
  paymentMethods: BranchPaymentMethodKey[]
  cashRegisterName: string
  receiptPrefix: string
  kitchenAreas: string[]
  printerName: string
  lowStockAlertsEnabled: boolean
  hideOutOfStockProducts: boolean
  rifNumber: string
  razonSocial: string
  fiscalAddress: string
  ivaDefaultRate: number
  pricesIncludeIva: boolean
  igtfEnabled: boolean
  igtfRate: number
  branchNotes: string
  updatedAt?: string
}

export const BRANCH_PAYMENT_METHODS: { key: BranchPaymentMethodKey; label: string }[] = [
  { key: "cash_usd", label: "Efectivo USD" },
  { key: "cash_ves", label: "Efectivo Bs" },
  { key: "pago_movil", label: "Pago móvil" },
  { key: "transfer", label: "Transferencia" },
  { key: "debit_card", label: "Débito" },
  { key: "credit_card", label: "Crédito" },
  { key: "zelle", label: "Zelle" },
  { key: "binance", label: "Binance" },
  { key: "other", label: "Otro" },
]

const PAYMENT_METHOD_KEYS = new Set(BRANCH_PAYMENT_METHODS.map((item) => item.key))

export const DEFAULT_BRANCH_CONFIG: BranchConfig = {
  displayName: "",
  shortDescription: "",
  address: "",
  googleMapsUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  scheduleLine1: "",
  scheduleLine2: "",
  publicOrdersEnabled: true,
  dineInEnabled: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  isTemporarilyClosed: false,
  temporaryClosedMessage: "Esta sede está cerrada temporalmente. Escríbenos para confirmar disponibilidad.",
  defaultPrepMinutes: 20,
  defaultDeliveryMinutes: 45,
  deliveryMinimumUSD: 0,
  deliveryCoverageNote: "",
  paymentMethods: ["cash_usd", "cash_ves", "pago_movil", "debit_card"],
  cashRegisterName: "Caja principal",
  receiptPrefix: "",
  kitchenAreas: ["Cocina"],
  printerName: "",
  lowStockAlertsEnabled: true,
  hideOutOfStockProducts: false,
  rifNumber: "",
  razonSocial: "",
  fiscalAddress: "",
  ivaDefaultRate: 16,
  pricesIncludeIva: true,
  igtfEnabled: true,
  igtfRate: 3,
  branchNotes: "",
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function cleanNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(max, Math.max(min, numericValue))
}

function cleanBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true
    if (["false", "0", "no"].includes(normalized)) return false
  }
  return fallback
}

export function normalizeBranchPaymentMethods(value: unknown): BranchPaymentMethodKey[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;,|]/g)
      : []
  const seen = new Set<BranchPaymentMethodKey>()

  rawList.forEach((rawItem) => {
    const key = cleanText(rawItem) as BranchPaymentMethodKey
    if (PAYMENT_METHOD_KEYS.has(key)) seen.add(key)
  })

  return seen.size ? Array.from(seen) : DEFAULT_BRANCH_CONFIG.paymentMethods
}

export function normalizeBranchKitchenAreas(value: unknown): string[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;,|\n]/g)
      : []
  const seen = new Set<string>()

  rawList.forEach((item) => {
    const text = cleanText(item)
    if (text) seen.add(text.slice(0, 60))
  })

  return seen.size ? Array.from(seen).slice(0, 8) : DEFAULT_BRANCH_CONFIG.kitchenAreas
}

export function normalizeBranchConfig(value: unknown): BranchConfig {
  const source = asRecord(value)
  const defaults = DEFAULT_BRANCH_CONFIG

  return {
    displayName: cleanText(source.displayName),
    shortDescription: cleanText(source.shortDescription),
    address: cleanText(source.address),
    googleMapsUrl: cleanText(source.googleMapsUrl),
    mainWhatsapp: cleanText(source.mainWhatsapp),
    deliveryWhatsapp: cleanText(source.deliveryWhatsapp),
    scheduleLine1: cleanText(source.scheduleLine1),
    scheduleLine2: cleanText(source.scheduleLine2),
    publicOrdersEnabled: cleanBoolean(source.publicOrdersEnabled, defaults.publicOrdersEnabled),
    dineInEnabled: cleanBoolean(source.dineInEnabled, defaults.dineInEnabled),
    pickupEnabled: cleanBoolean(source.pickupEnabled, defaults.pickupEnabled),
    deliveryEnabled: cleanBoolean(source.deliveryEnabled, defaults.deliveryEnabled),
    isTemporarilyClosed: cleanBoolean(source.isTemporarilyClosed, defaults.isTemporarilyClosed),
    temporaryClosedMessage:
      cleanText(source.temporaryClosedMessage) || defaults.temporaryClosedMessage,
    defaultPrepMinutes: Math.round(cleanNumber(source.defaultPrepMinutes, defaults.defaultPrepMinutes, 0, 240)),
    defaultDeliveryMinutes: Math.round(cleanNumber(source.defaultDeliveryMinutes, defaults.defaultDeliveryMinutes, 0, 240)),
    deliveryMinimumUSD: cleanNumber(source.deliveryMinimumUSD, defaults.deliveryMinimumUSD, 0, 9999),
    deliveryCoverageNote: cleanText(source.deliveryCoverageNote),
    paymentMethods: normalizeBranchPaymentMethods(source.paymentMethods),
    cashRegisterName: cleanText(source.cashRegisterName) || defaults.cashRegisterName,
    receiptPrefix: cleanText(source.receiptPrefix).slice(0, 20),
    kitchenAreas: normalizeBranchKitchenAreas(source.kitchenAreas),
    printerName: cleanText(source.printerName),
    lowStockAlertsEnabled: cleanBoolean(
      source.lowStockAlertsEnabled,
      defaults.lowStockAlertsEnabled,
    ),
    hideOutOfStockProducts: cleanBoolean(
      source.hideOutOfStockProducts,
      defaults.hideOutOfStockProducts,
    ),
    rifNumber: cleanText(source.rifNumber),
    razonSocial: cleanText(source.razonSocial),
    fiscalAddress: cleanText(source.fiscalAddress),
    ivaDefaultRate: cleanNumber(source.ivaDefaultRate, defaults.ivaDefaultRate, 0, 100),
    pricesIncludeIva: cleanBoolean(source.pricesIncludeIva, defaults.pricesIncludeIva),
    igtfEnabled: cleanBoolean(source.igtfEnabled, defaults.igtfEnabled),
    igtfRate: cleanNumber(source.igtfRate, defaults.igtfRate, 0, 100),
    branchNotes: cleanText(source.branchNotes),
    updatedAt: cleanText(source.updatedAt) || undefined,
  }
}

export function normalizeBranchConfigMap(value: unknown): Record<string, BranchConfig> {
  const source = asRecord(value)
  const result: Record<string, BranchConfig> = {}

  Object.entries(source).forEach(([branchId, branchConfig]) => {
    const cleanBranchId = cleanText(branchId)
    if (!cleanBranchId) return
    result[cleanBranchId] = normalizeBranchConfig(branchConfig)
  })

  return result
}

function setOverrideValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  target[key] = value
}

function withTextOverride<T extends Record<string, unknown>>(
  target: T,
  key: keyof T & string,
  value: string,
) {
  if (value) setOverrideValue(target, key, value)
}

function withNumberOverride<T extends Record<string, unknown>>(
  target: T,
  key: keyof T & string,
  value: number,
) {
  if (Number.isFinite(value)) setOverrideValue(target, key, value)
}

export function applyBranchConfigOverrides<T extends Record<string, unknown>>(
  businessConfig: T,
  branchConfigValue: unknown,
  branchId?: string | null,
): T & {
  selectedBranchId?: string
  branchConfig: BranchConfig
  branchPublicOrdersEnabled: boolean
  branchTemporarilyClosed: boolean
} {
  const branchConfig = normalizeBranchConfig(branchConfigValue)
  const effectiveConfig = { ...businessConfig } as T & {
    selectedBranchId?: string
    branchConfig: BranchConfig
    branchPublicOrdersEnabled: boolean
    branchTemporarilyClosed: boolean
  }

  withTextOverride(effectiveConfig, "businessName", branchConfig.displayName)
  withTextOverride(effectiveConfig, "businessShortDescription", branchConfig.shortDescription)
  withTextOverride(effectiveConfig, "googleMapsUrl", branchConfig.googleMapsUrl)
  withTextOverride(effectiveConfig, "mainWhatsapp", branchConfig.mainWhatsapp)
  withTextOverride(effectiveConfig, "deliveryWhatsapp", branchConfig.deliveryWhatsapp)
  withTextOverride(effectiveConfig, "scheduleLine1", branchConfig.scheduleLine1)
  withTextOverride(effectiveConfig, "scheduleLine2", branchConfig.scheduleLine2)
  withTextOverride(effectiveConfig, "rifNumber", branchConfig.rifNumber)
  withTextOverride(effectiveConfig, "razonSocial", branchConfig.razonSocial)
  withTextOverride(effectiveConfig, "fiscalAddress", branchConfig.fiscalAddress)
  withNumberOverride(effectiveConfig, "ivaDefaultRate", branchConfig.ivaDefaultRate)
  withNumberOverride(effectiveConfig, "igtfRate", branchConfig.igtfRate)

  setOverrideValue(effectiveConfig, "pricesIncludeIva", branchConfig.pricesIncludeIva)
  setOverrideValue(effectiveConfig, "igtfEnabled", branchConfig.igtfEnabled)
  effectiveConfig.branchConfig = branchConfig
  effectiveConfig.branchPublicOrdersEnabled = branchConfig.publicOrdersEnabled
  effectiveConfig.branchTemporarilyClosed = branchConfig.isTemporarilyClosed

  if (branchId) effectiveConfig.selectedBranchId = branchId

  if (businessConfig.deliveryEnabled !== false) {
    setOverrideValue(
      effectiveConfig,
      "deliveryEnabled",
      Boolean(
        branchConfig.publicOrdersEnabled &&
          branchConfig.deliveryEnabled &&
          !branchConfig.isTemporarilyClosed,
      ),
    )
  }

  return effectiveConfig
}
