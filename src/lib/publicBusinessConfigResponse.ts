import { BRAND } from "@/lib/brand"
import { normalizeProductIds } from "@/lib/productIdList"
import { getModulePlanAccess } from "@/lib/localPlans"
import { isOnlinePaymentsEnabled } from "@/lib/stripe"
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  normalizePublicCategoryList,
  normalizePublicHiddenCategoryList,
  normalizePublicNavButtons,
} from "@/lib/publicPageConfig"

type MembershipPlan = "menuDigital" | "basic" | "operational" | "pro" | "complete"
type MembershipPlanMode = "fixed" | "custom"
type PublicComplexityProfile = "simple" | "standard" | "advanced" | "custom"

type PublicComplexityDefaults = {
  publicOrdersEnabled: boolean
  publicLocalOrdersEnabled: boolean
  publicTakeawayOrdersEnabled: boolean
  publicDeliveryOrdersEnabled: boolean
  publicOpenAccountEnabled: boolean
  publicPaymentProofsEnabled: boolean
  publicIngredientCustomizationEnabled: boolean
  publicAddonsEnabled: boolean
  publicNotesEnabled: boolean
  publicCustomerNotesEnabled: boolean
  publicAttachmentsEnabled: boolean
  publicCustomerAttachmentsEnabled: boolean
  publicCustomerImageAttachmentEnabled: boolean
  publicPhoneRequired: boolean
}

const PUBLIC_COMPLEXITY_PROFILE_DEFAULTS: Record<PublicComplexityProfile, PublicComplexityDefaults> = {
  simple: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: false,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: false,
    publicOpenAccountEnabled: false,
    publicPaymentProofsEnabled: false,
    publicIngredientCustomizationEnabled: false,
    publicAddonsEnabled: false,
    publicNotesEnabled: false,
    publicCustomerNotesEnabled: false,
    publicAttachmentsEnabled: false,
    publicCustomerAttachmentsEnabled: false,
    publicCustomerImageAttachmentEnabled: false,
    publicPhoneRequired: false,
  },
  standard: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
  advanced: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
  custom: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
}

type PublicBusinessConfigSource = Record<string, unknown>

export function cleanText(value: unknown) {
  return String(value || "").trim()
}

function cleanUrl(value: unknown) {
  return cleanText(value)
}

export function cleanPromotionHref(value: unknown) {
  const cleanValue = cleanText(value)

  if (!cleanValue) return ""

  if (
    cleanValue.startsWith("#") ||
    cleanValue.startsWith("/") ||
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
    return cleanValue
  }

  return ""
}

export function cleanWhatsappNumber(value: unknown) {
  const rawValue = cleanText(value)
  const onlyDigits = rawValue.replace(/\D/g, "")

  if (!onlyDigits) return ""

  if (onlyDigits.startsWith("00")) {
    return onlyDigits.slice(2)
  }

  if (onlyDigits.startsWith("0") && onlyDigits.length === 11) {
    return `58${onlyDigits.slice(1)}`
  }

  return onlyDigits
}

export function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function normalizeMembershipPlan(value: unknown): MembershipPlan {
  const normalized = normalizeText(value)

  if (
    normalized === "menudigital" ||
    normalized === "menu digital" ||
    normalized === "menu-digital" ||
    normalized === "menu_digital"
  ) {
    return "menuDigital"
  }

  if (
    normalized === "basic" ||
    normalized === "basico" ||
    normalized === "básico" ||
    normalized === "plan basico" ||
    normalized === "plan básico"
  ) {
    return "basic"
  }

  if (
    normalized === "operational" ||
    normalized === "operativo" ||
    normalized === "operation" ||
    normalized === "plan operativo"
  ) {
    return "operational"
  }

  if (
    normalized === "pro" ||
    normalized === "profesional" ||
    normalized === "plan pro"
  ) {
    return "pro"
  }

  return "complete"
}

export function normalizeMembershipPlanMode(value: unknown): MembershipPlanMode {
  const normalized = normalizeText(value)

  if (
    normalized === "custom" ||
    normalized === "personalizado" ||
    normalized === "personalizada"
  ) {
    return "custom"
  }

  return "fixed"
}

export function normalizeBusinessComplexityProfile(value: unknown): PublicComplexityProfile {
  const normalized = normalizeText(value)

  if (
    normalized === "simple" ||
    normalized === "sencillo" ||
    normalized === "basico" ||
    normalized === "básico"
  ) {
    return "simple"
  }

  if (
    normalized === "standard" ||
    normalized === "estandar" ||
    normalized === "estándar" ||
    normalized === "normal"
  ) {
    return "standard"
  }

  if (
    normalized === "custom" ||
    normalized === "personalizado" ||
    normalized === "personalizada"
  ) {
    return "custom"
  }

  return "advanced"
}

function readPublicControlBoolean(
  config: PublicBusinessConfigSource,
  key: keyof PublicComplexityDefaults,
  fallback: boolean
) {
  return Object.prototype.hasOwnProperty.call(config, key)
    ? normalizeBoolean(config[key], fallback)
    : fallback
}

function readPublicControlBooleanAliases(
  config: PublicBusinessConfigSource,
  keys: Array<keyof PublicComplexityDefaults | string>,
  fallback: boolean
) {
  const matchedKey = keys.find((key) =>
    Object.prototype.hasOwnProperty.call(config, key)
  )

  return matchedKey ? normalizeBoolean(config[matchedKey], fallback) : fallback
}

export function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0

  const normalized = normalizeText(value)

  if (
    [
      "true",
      "1",
      "si",
      "sí",
      "activo",
      "activa",
      "activado",
      "activada",
      "visible",
      "habilitado",
      "habilitada",
      "enabled",
      "on",
    ].includes(normalized)
  ) {
    return true
  }

  if (
    [
      "false",
      "0",
      "no",
      "inactivo",
      "inactiva",
      "desactivado",
      "desactivada",
      "oculto",
      "oculta",
      "hidden",
      "disabled",
      "off",
    ].includes(normalized)
  ) {
    return false
  }

  return fallback
}

export { normalizeProductIds }

export function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

export function normalizePublicLocalTables(value: unknown) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? (() => {
          try {
            const parsedValue = JSON.parse(value)
            return Array.isArray(parsedValue) ? parsedValue : value.split(/[;,|\n]/g)
          } catch {
            return value.split(/[;,|\n]/g)
          }
        })()
      : []
  const seen = new Set<string>()
  const tables: Array<{
    id: string
    name: string
    area: string
    sortOrder: number
    isActive: boolean
  }> = []

  rawList.forEach((item, index) => {
    const rawItem = item && typeof item === "object" ? item as Record<string, unknown> : { name: String(item || "") }
    const name = cleanText(rawItem.name)
    const key = normalizeText(name)

    if (!name || !key || seen.has(key)) return

    seen.add(key)

    const sortOrder = normalizeNumber(rawItem.sortOrder) || index + 1

    tables.push({
      id: cleanText(rawItem.id) || key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `mesa-${index + 1}`,
      name,
      area: cleanText(rawItem.area) || "Principal",
      sortOrder: Math.round(sortOrder),
      isActive: normalizeBoolean(rawItem.isActive, true),
    })
  })

  return tables
    .filter((table) => table.isActive !== false)
    .sort((first, second) => {
      if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder
      return first.name.localeCompare(second.name)
    })
}

export function planAllowsLocalOrders(plan: MembershipPlan) {
  return plan !== "menuDigital"
}

export function planAllowsDelivery(plan: MembershipPlan) {
  return plan === "operational" || plan === "pro" || plan === "complete"
}

export function buildPublicBusinessConfigResponse(
  businessConfig: unknown
) {
  const config = businessConfig as PublicBusinessConfigSource
  const membershipPlan = normalizeMembershipPlan(config.membershipPlan)
  const membershipPlanMode = normalizeMembershipPlanMode(config.membershipPlanMode)
  const businessComplexityProfile = normalizeBusinessComplexityProfile(
    config.businessComplexityProfile ||
      config.publicBusinessComplexityProfile ||
      config.businessComplexity ||
      config.businessComplexityLevel ||
      config.businessComplexityMode ||
      config.publicComplexityProfile ||
      config.publicComplexityMode
  )
  const publicComplexityDefaults = PUBLIC_COMPLEXITY_PROFILE_DEFAULTS[businessComplexityProfile]
  const publicOrdersEnabled = readPublicControlBoolean(
    config,
    "publicOrdersEnabled",
    publicComplexityDefaults.publicOrdersEnabled
  )
  const publicLocalOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      config,
      "publicLocalOrdersEnabled",
      publicComplexityDefaults.publicLocalOrdersEnabled
    )
  const publicTakeawayOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      config,
      "publicTakeawayOrdersEnabled",
      publicComplexityDefaults.publicTakeawayOrdersEnabled
    )
  const publicDeliveryOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      config,
      "publicDeliveryOrdersEnabled",
      publicComplexityDefaults.publicDeliveryOrdersEnabled
    )
  const publicOpenAccountEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      config,
      "publicOpenAccountEnabled",
      publicComplexityDefaults.publicOpenAccountEnabled
    )
  const publicPaymentProofsEnabled = readPublicControlBooleanAliases(
    config,
    ["publicPaymentProofsEnabled", "publicPaymentProofUploadEnabled"],
    publicComplexityDefaults.publicPaymentProofsEnabled
  )
  const publicIngredientCustomizationEnabled = readPublicControlBoolean(
    config,
    "publicIngredientCustomizationEnabled",
    publicComplexityDefaults.publicIngredientCustomizationEnabled
  )
  const publicAddonsEnabled = readPublicControlBoolean(
    config,
    "publicAddonsEnabled",
    publicComplexityDefaults.publicAddonsEnabled
  )
  const publicNotesEnabled = readPublicControlBooleanAliases(
    config,
    ["publicNotesEnabled", "publicCustomerNotesEnabled"],
    publicComplexityDefaults.publicNotesEnabled
  )
  const publicAttachmentsEnabled = readPublicControlBooleanAliases(
    config,
    [
      "publicAttachmentsEnabled",
      "publicCustomerAttachmentsEnabled",
      "publicCustomerImageAttachmentEnabled",
    ],
    publicComplexityDefaults.publicAttachmentsEnabled
  )
  const publicPhoneRequired = readPublicControlBoolean(
    config,
    "publicPhoneRequired",
    publicComplexityDefaults.publicPhoneRequired
  )
  const deliveryEnabled = normalizeBoolean(config.deliveryEnabled, true)
  const deliveryModuleEnabled = normalizeBoolean(config.deliveryModuleEnabled, true)
  const promotionAccess = getModulePlanAccess(config, "promotions")
  const promotionActive = normalizeBoolean(config.promotionActive, false)
  const promotionTitle = cleanText(config.promotionTitle)
  const promotionText = cleanText(config.promotionText)
  const promotionHighlight = cleanText(config.promotionHighlight)
  const promotionProductId = Math.round(normalizeNumber(config.promotionProductId))
  const promotionProductName = cleanText(config.promotionProductName)
  const promotionPriceUSD = normalizeNumber(config.promotionPriceUSD)
  const promotionImage = cleanUrl(config.promotionImage)
  const promotionCanShow =
    promotionAccess.effectiveEnabled &&
    promotionActive &&
    Boolean(
      promotionTitle ||
        promotionText ||
        promotionHighlight ||
        promotionProductName ||
        promotionImage ||
        promotionPriceUSD > 0
    )
  const featuredProductsAccess = getModulePlanAccess(config, "featuredProducts")
  const paymentProofsAccess = getModulePlanAccess(config, "paymentProofs")
  const openAccountsAccess = getModulePlanAccess(config, "openAccounts")
  const featuredProductsActive = normalizeBoolean(config.featuredProductsActive, false)
  const featuredProductIds = normalizeProductIds(config.featuredProductIds)
  const featuredProductsCanShow =
    featuredProductsAccess.effectiveEnabled &&
    featuredProductsActive &&
    featuredProductIds.length > 0

  return {
    businessName: cleanText(config.businessName) || BRAND.name,
    businessType: cleanText(config.businessType),
    locationLabel: cleanText(config.locationLabel) || "Mesa",
    onlinePaymentsEnabled: isOnlinePaymentsEnabled(),
    fiscalEnabled: config.fiscalEnabled === true,
    ivaDefaultRate: Number.isFinite(Number(config.ivaDefaultRate)) ? Number(config.ivaDefaultRate) : 16,
    pricesIncludeIva: config.pricesIncludeIva !== false,
    igtfEnabled: config.igtfEnabled !== false,
    igtfRate: Number.isFinite(Number(config.igtfRate)) ? Number(config.igtfRate) : 3,
    businessShortDescription:
      cleanText(config.businessShortDescription) || "Menú y pedidos",
    themePrimaryColor: cleanText(config.themePrimaryColor) || "#a00000",
    themeAccentColor: cleanText(config.themeAccentColor) || "#ffd23c",
    themeCreamColor: cleanText(config.themeCreamColor) || "#fff7e8",
    productCardBackgroundColor:
      cleanText(config.productCardBackgroundColor) || "#ffffff",
    productCardTextColor: cleanText(config.productCardTextColor) || "#4a0000",
    productCardBorderColor:
      cleanText(config.productCardBorderColor) || "#a00000",
    productCardButtonColor:
      cleanText(config.productCardButtonColor) || "#ffd23c",
    publicTagline: cleanText(config.publicTagline),
    publicInfoTitle: cleanText(config.publicInfoTitle),
    publicInfoText: cleanText(config.publicInfoText),
    scheduleTitle: cleanText(config.scheduleTitle),
    scheduleLine1: cleanText(config.scheduleLine1),
    scheduleLine2: cleanText(config.scheduleLine2),
    reviewsTitle: cleanText(config.reviewsTitle),
    reviewsText: cleanText(config.reviewsText),
    quickOrderTitle: cleanText(config.quickOrderTitle),
    quickOrderText: cleanText(config.quickOrderText),
    publicMenuEyebrow: cleanText(config.publicMenuEyebrow) || `Menú ${cleanText(config.businessName) || BRAND.name}`,
    publicMenuTitle: cleanText(config.publicMenuTitle) || "Elige tu pedido",
    publicMenuText:
      cleanText(config.publicMenuText) ||
      "Combos en divisas y productos normales con referencia en bolívares según la tasa activa del negocio.",
    publicMenuSearchPlaceholder:
      cleanText(config.publicMenuSearchPlaceholder) ||
      "Buscar productos, combos o adicionales",
    publicComboTitle: cleanText(config.publicComboTitle) || "Combos disponibles",
    publicComboText:
      cleanText(config.publicComboText) ||
      "Los combos se manejan en divisas para mantener precios claros.",
    publicComboButtonText: cleanText(config.publicComboButtonText) || "Ver combos",
    publicCustomizeButtonText:
      cleanText(config.publicCustomizeButtonText) || "Elige tus ingredientes",
    publicCustomizerTitle:
      cleanText(config.publicCustomizerTitle) ||
      cleanText(config.publicCustomizeButtonText) ||
      "Elige tus ingredientes",
    locationButtonText: cleanText(config.locationButtonText),
    googleMapsUrl: cleanUrl(config.googleMapsUrl),
    instagramUrl: cleanUrl(config.instagramUrl),
    mainWhatsapp: cleanWhatsappNumber(config.mainWhatsapp),
    deliveryWhatsapp: cleanWhatsappNumber(config.deliveryWhatsapp),
    exchangeRateMode:
      normalizeText(config.exchangeRateMode) === "manual"
        ? "manual"
        : "automatic",
    manualExchangeRate: normalizeNumber(config.manualExchangeRate),
    membershipPlan,
    membershipPlanMode,
    businessComplexityProfile,
    publicOrdersEnabled,
    publicLocalOrdersEnabled,
    publicTakeawayOrdersEnabled,
    publicDeliveryOrdersEnabled,
    publicOpenAccountEnabled,
    publicPaymentProofsEnabled,
    publicPaymentProofUploadEnabled: publicPaymentProofsEnabled,
    publicIngredientCustomizationEnabled,
    publicAddonsEnabled,
    publicNotesEnabled,
    publicCustomerNotesEnabled: publicNotesEnabled,
    publicAttachmentsEnabled,
    publicCustomerAttachmentsEnabled: publicAttachmentsEnabled,
    publicCustomerImageAttachmentEnabled: publicAttachmentsEnabled,
    publicPhoneRequired,
    localOrdersEnabled:
      planAllowsLocalOrders(membershipPlan) &&
      publicOrdersEnabled &&
      (publicLocalOrdersEnabled || publicTakeawayOrdersEnabled),
    deliveryEnabled:
      deliveryEnabled &&
      planAllowsDelivery(membershipPlan) &&
      publicOrdersEnabled &&
      publicDeliveryOrdersEnabled,
    deliveryModuleEnabled:
      deliveryModuleEnabled && planAllowsDelivery(membershipPlan),
    paymentProofsEnabled:
      paymentProofsAccess.effectiveEnabled && publicPaymentProofsEnabled,
    paymentProofsModuleEnabled: paymentProofsAccess.effectiveEnabled,
    openAccountsEnabled:
      openAccountsAccess.effectiveEnabled && publicOpenAccountEnabled,
    localTables: normalizePublicLocalTables(config.localTables),
    promotionActive: promotionCanShow,
    promotionTitle: promotionCanShow ? promotionTitle : "",
    promotionText: promotionCanShow ? promotionText : "",
    promotionHighlight: promotionCanShow ? promotionHighlight : "",
    promotionButtonText: promotionCanShow
      ? cleanText(config.promotionButtonText) || "Ver menú"
      : "",
    promotionButtonHref: promotionCanShow
      ? cleanPromotionHref(config.promotionButtonHref) || "#menu"
      : "",
    promotionProductId: promotionCanShow ? promotionProductId : 0,
    promotionProductName: promotionCanShow ? promotionProductName : "",
    promotionPriceUSD: promotionCanShow ? promotionPriceUSD : 0,
    promotionImage: promotionCanShow ? promotionImage : "",
    featuredProductsActive: featuredProductsCanShow,
    featuredProductsTitle: featuredProductsCanShow
      ? cleanText(config.featuredProductsTitle) || "Favoritos de la casa"
      : "",
    featuredProductsText: featuredProductsCanShow
      ? cleanText(config.featuredProductsText)
      : "",
    featuredProductIds: featuredProductsCanShow ? featuredProductIds : [],
    publicCategoryOrder: normalizePublicCategoryList(config.publicCategoryOrder).length
      ? normalizePublicCategoryList(config.publicCategoryOrder)
      : DEFAULT_PUBLIC_CATEGORY_ORDER,
    publicHiddenCategories: normalizePublicHiddenCategoryList(config.publicHiddenCategories),
    publicNavButtons: normalizePublicNavButtons(config.publicNavButtons),
    updatedAt: cleanText(config.updatedAt),
  }
}
