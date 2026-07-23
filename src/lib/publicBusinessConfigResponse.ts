import { BRAND } from "@/lib/brand"
import { normalizeBusinessComplexitySettings } from "@/lib/businessComplexity"
import { normalizeKitchenFlowMode } from "@/lib/ordersBusinessConfig"
import { normalizeProductIds } from "@/lib/productIdList"
import { getModulePlanAccess } from "@/lib/localPlans"
import { isOnlinePaymentsEnabled } from "@/lib/stripe"
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  normalizePublicCategoryList,
  normalizePublicHiddenCategoryList,
  normalizePublicNavButtons,
  normalizePublicPaymentMethodDetails,
  normalizePublicPaymentMethods,
  normalizePublicProductCardSize,
} from "@/lib/publicPageConfig"

type MembershipPlan = "menuDigital" | "basic" | "operational" | "pro" | "complete"
type MembershipPlanMode = "fixed" | "custom"

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
  // Controles de complejidad visibles para el cliente (qué puede hacer al pedir).
  // Solo se exponen las claves públicas; los permisos internos quedan fuera.
  const complexity = normalizeBusinessComplexitySettings(config)
  const membershipPlan = normalizeMembershipPlan(config.membershipPlan)
  const membershipPlanMode = normalizeMembershipPlanMode(config.membershipPlanMode)
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
  const splitBillAccess = getModulePlanAccess(config, "splitBill")
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
    // Símbolo de moneda del sitio público: solo "$" o "€".
    publicCurrencySymbol: cleanText(config.publicCurrencySymbol) === "€" ? "€" : "$",
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
    publicCartTitle: cleanText(config.publicCartTitle) || "Tu pedido",
    publicCartEmptyTitle:
      cleanText(config.publicCartEmptyTitle) || "Tu carrito está vacío",
    publicCartEmptyText:
      cleanText(config.publicCartEmptyText) ||
      "Agrega productos del menú para preparar tu pedido.",
    publicCartEmptyButtonText:
      cleanText(config.publicCartEmptyButtonText) || "Ver menú",
    publicCartTotalLabel:
      cleanText(config.publicCartTotalLabel) || "Total a cobrar",
    publicCartTotalHint:
      cleanText(config.publicCartTotalHint) || "Total general en divisas",
    publicCartLocalOrderButtonText:
      cleanText(config.publicCartLocalOrderButtonText) || "Registrar pedido local",
    publicCartWhatsappButtonText:
      cleanText(config.publicCartWhatsappButtonText) || "Enviar por WhatsApp",
    publicDivisaGroupTitle:
      cleanText(config.publicDivisaGroupTitle) || "Combos",
    publicDivisaOnlyNote:
      cleanText(config.publicDivisaOnlyNote) || "Pago solo en divisas",
    publicDivisaOnlyBadge:
      cleanText(config.publicDivisaOnlyBadge) || "Solo divisas",
    publicRegularGroupTitle:
      cleanText(config.publicRegularGroupTitle) || "Productos normales",
    publicPaymentMethods: normalizePublicPaymentMethods(config.publicPaymentMethods),
    publicPaymentMethodDetails: normalizePublicPaymentMethodDetails(
      config.publicPaymentMethodDetails,
    ),
    publicProductCardSize: normalizePublicProductCardSize(
      config.publicProductCardSize,
    ),
    publicAvailabilityLabel:
      cleanText(config.publicAvailabilityLabel) || "Disponible",
    locationButtonText: cleanText(config.locationButtonText),
    googleMapsUrl: cleanUrl(config.googleMapsUrl),
    googleReviewUrl: cleanUrl(config.googleReviewUrl),
    instagramUrl: cleanUrl(config.instagramUrl),
    mainWhatsapp: cleanWhatsappNumber(config.mainWhatsapp),
    deliveryWhatsapp: cleanWhatsappNumber(config.deliveryWhatsapp),
    orderHelpWhatsappEnabled: config.orderHelpWhatsappEnabled !== false,
    // Encuesta post-venta: la leen los paneles internos (caja/pedidos) que se
    // alimentan de esta misma respuesta. No expone nada sensible.
    postSaleSurveyEnabled: config.postSaleSurveyEnabled !== false,
    postSaleSurveyMessage: cleanText(config.postSaleSurveyMessage),
    // Guía y advertencias del checkout público (configurables por el dueño).
    publicOrderStepsEnabled: config.publicOrderStepsEnabled !== false,
    publicPrepayNoticeEnabled: config.publicPrepayNoticeEnabled !== false,
    publicPrepayNoticeText: cleanText(config.publicPrepayNoticeText),
    publicOpenAccountHintHighlighted: config.publicOpenAccountHintHighlighted !== false,
    // Flujo de pago del checkout (dueño): captura/referencia antes de
    // registrar, y minutos de anulación automática sin pago (0 = apagada,
    // el cliente lo ve como aviso en su confirmación).
    publicPaymentBeforeRegisterEnabled:
      config.publicPaymentBeforeRegisterEnabled === true,
    // Foto obligatoria de divisas en efectivo (default off) y 2 capturas en
    // pago mixto (default on): banderas del checkout/reporte público.
    publicCashDivisaPhotoRequired: config.publicCashDivisaPhotoRequired === true,
    publicMixedSecondProofEnabled: config.publicMixedSecondProofEnabled !== false,
    publicUnpaidAutoCancelMinutes: (() => {
      const minutes = Number(config.publicUnpaidAutoCancelMinutes)
      if (!Number.isFinite(minutes)) return 0
      return Math.min(240, Math.max(0, Math.round(minutes)))
    })(),
    exchangeRateMode:
      normalizeText(config.exchangeRateMode) === "manual"
        ? "manual"
        : "automatic",
    manualExchangeRate: normalizeNumber(config.manualExchangeRate),
    membershipPlan,
    membershipPlanMode,
    localOrdersEnabled: planAllowsLocalOrders(membershipPlan),
    deliveryEnabled: deliveryEnabled && planAllowsDelivery(membershipPlan),
    deliveryModuleEnabled:
      deliveryModuleEnabled && planAllowsDelivery(membershipPlan),
    paymentProofsEnabled: paymentProofsAccess.effectiveEnabled,
    paymentProofsModuleEnabled: paymentProofsAccess.effectiveEnabled,
    openAccountsEnabled: openAccountsAccess.effectiveEnabled,
    splitBillEnabled: splitBillAccess.effectiveEnabled,
    kitchenFlowMode: normalizeKitchenFlowMode(config.kitchenFlowMode),
    // Config operativa de caja: mostrar u ocultar "Delivery pagado en".
    cashierDeliveryPaymentInEnabled: config.cashierDeliveryPaymentInEnabled !== false,
    publicPaymentMethodChangeEnabled: config.publicPaymentMethodChangeEnabled !== false,
    localTables: normalizePublicLocalTables(config.localTables),
    promotionActive: promotionCanShow,
    promotionTitle: promotionCanShow ? promotionTitle : "",
    promotionText: promotionCanShow ? promotionText : "",
    // Texto propio de la ventana emergente (vacío = usa promotionText).
    promotionPopupText: promotionCanShow ? cleanText(config.promotionPopupText) : "",
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
    // Ventana emergente de la promoción al entrar (además de la sección).
    promotionPopupEnabled: promotionCanShow && config.promotionPopupEnabled === true,
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
    publicAllowOrdering: complexity.publicAllowOrdering,
    publicAllowEatHere: complexity.publicAllowEatHere,
    publicAllowTakeaway: complexity.publicAllowTakeaway,
    publicAllowDelivery: complexity.publicAllowDelivery,
    publicAllowOpenAccounts: complexity.publicAllowOpenAccounts,
    publicAllowPaymentProofs: complexity.publicAllowPaymentProofs,
    publicAllowProductCustomization: complexity.publicAllowProductCustomization,
    publicAllowCustomerNotes: complexity.publicAllowCustomerNotes,
    publicAllowAttachments: complexity.publicAllowAttachments,
    publicRequireCustomerPhone: complexity.publicRequireCustomerPhone,
    updatedAt: cleanText(config.updatedAt),
  }
}
