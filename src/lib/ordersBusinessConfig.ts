import { BRAND } from "./brand"
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  DEFAULT_PUBLIC_NAV_BUTTONS,
  DEFAULT_PUBLIC_PAYMENT_METHODS,
  normalizePublicCategoryList,
  normalizePublicHiddenCategoryList,
  normalizePublicCoupons,
  normalizePublicNavButtons,
  normalizePublicPaymentMethodDetails,
  normalizePublicPaymentMethods,
  normalizePublicProductCardSize,
  type PublicNavButton,
  type PublicProductCardSize,
} from "./publicPageConfig"
import { getSupabaseAdmin } from "./supabaseServer"
import { normalizeBusinessComplexitySettings } from "./businessComplexity"
import {
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  getModulePlanAccess,
  normalizeLocalPlanMode,
  type LocalModuleKey,
  type LocalPlanKey,
  type LocalPlanMode,
} from "./localPlans"

export type BusinessViewMode = "simple" | "negocio" | "avanzado"

// "automatic" = dólar oficial BCV; "automaticEur" = euro oficial BCV (se
// actualiza igual de solo); "manual" = tasa fijada por el dueño.
export type ExchangeRateMode = "automatic" | "automaticEur" | "manual"

export type LocalTable = {
  id: string
  name: string
  area: string
  sortOrder: number
  isActive: boolean
  note?: string
}

export const DEFAULT_LOCAL_TABLES: LocalTable[] = [
  { id: "mesa-1", name: "Mesa 1", area: "Principal", sortOrder: 1, isActive: true },
  { id: "mesa-2", name: "Mesa 2", area: "Principal", sortOrder: 2, isActive: true },
  { id: "mesa-3", name: "Mesa 3", area: "Principal", sortOrder: 3, isActive: true },
  { id: "mesa-4", name: "Mesa 4", area: "Principal", sortOrder: 4, isActive: true },
  { id: "barra", name: "Barra", area: "Barra", sortOrder: 5, isActive: true },
  { id: "afuera", name: "Afuera", area: "Exterior", sortOrder: 6, isActive: true },
]

export type BusinessConfig = {
  businessName: string
  businessShortDescription: string
  businessType: string
  locationLabel: string
  // Fiscal (Venezuela): IVA por producto + IGTF en divisas. La emisión oficial
  // la hace la máquina fiscal; aquí guardamos los datos para el desglose.
  fiscalEnabled: boolean
  rifNumber: string
  razonSocial: string
  fiscalAddress: string
  ivaDefaultRate: number
  pricesIncludeIva: boolean
  igtfEnabled: boolean
  igtfRate: number
  themePrimaryColor: string
  themeAccentColor: string
  themeCreamColor: string
  productCardBackgroundColor: string
  productCardTextColor: string
  productCardBorderColor: string
  productCardButtonColor: string
  publicTagline: string
  publicInfoTitle: string
  publicInfoText: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  reviewsTitle: string
  reviewsText: string
  quickOrderTitle: string
  quickOrderText: string
  publicMenuEyebrow: string
  publicMenuTitle: string
  publicMenuText: string
  publicMenuSearchPlaceholder: string
  publicComboTitle: string
  publicComboText: string
  publicComboButtonText: string
  publicCustomizeButtonText: string
  publicCustomizerTitle: string
  publicCartTitle: string
  publicCartEmptyTitle: string
  publicCartEmptyText: string
  publicCartEmptyButtonText: string
  publicCartTotalLabel: string
  publicCartTotalHint: string
  publicCartLocalOrderButtonText: string
  publicCartWhatsappButtonText: string
  publicDivisaGroupTitle: string
  publicDivisaOnlyNote: string
  publicDivisaOnlyBadge: string
  publicRegularGroupTitle: string
  publicAvailabilityLabel: string
  // Métodos de pago del carrito público, editables por el dueño.
  publicPaymentMethods: string[]
  // Datos de cada método (pago móvil, Zelle…) que el cliente ve y copia.
  publicPaymentMethodDetails: Record<string, string>
  // Tamaño de las tarjetas del menú público (grande | media | compacta).
  publicProductCardSize: PublicProductCardSize
  // Cupones del carrito ("CODIGO 10" por línea); nunca se exponen al público.
  publicCoupons: string[]
  locationButtonText: string
  googleMapsUrl: string
  // Link "escríbenos una reseña" de Google (ficha del negocio), opcional.
  googleReviewUrl: string
  instagramUrl: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  // Botón público "¿Dudas con tu pedido? Escríbenos" (WhatsApp), apagable.
  orderHelpWhatsappEnabled: boolean
  // Botones de aviso al cliente por WhatsApp en el panel privado, apagables.
  orderWhatsappStageButtonsEnabled: boolean
  exchangeRateMode: ExchangeRateMode
  manualExchangeRate: number
  deliveryEnabled: boolean
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
  ownerDashboardModuleEnabled: boolean
  cashierModuleEnabled: boolean
  kitchenModuleEnabled: boolean
  deliveryModuleEnabled: boolean
  historyModuleEnabled: boolean
  expensesModuleEnabled: boolean
  menuProductsModuleEnabled: boolean
  promotionModuleEnabled: boolean
  promotionActive: boolean
  promotionTitle: string
  promotionText: string
  promotionHighlight: string
  promotionButtonText: string
  promotionButtonHref: string
  promotionProductId: number
  promotionProductName: string
  promotionPriceUSD: number
  promotionImage: string
  featuredProductsModuleEnabled: boolean
  featuredProductsActive: boolean
  featuredProductsTitle: string
  featuredProductsText: string
  featuredProductIds: number[]
  publicCategoryOrder: string[]
  publicHiddenCategories: string[]
  publicNavButtons: PublicNavButton[]
  customersModuleEnabled: boolean
  inventoryModuleEnabled: boolean
  inventoryAlertsModuleEnabled: boolean
  advancedMenuModuleEnabled: boolean
  productVariationsModuleEnabled: boolean
  productAddonsModuleEnabled: boolean
  productBuilderModuleEnabled: boolean
  productCombosModuleEnabled: boolean
  productAvailabilityModuleEnabled: boolean
  salesChannelsModuleEnabled: boolean
  paymentProofsModuleEnabled: boolean
  openAccountsModuleEnabled: boolean
  tablesModuleEnabled: boolean
  localTables: LocalTable[]
  qrTablesModuleEnabled: boolean
  reservationsModuleEnabled: boolean
  roomsModuleEnabled: boolean
  waiterConfirmationModuleEnabled: boolean
  kitchenItemsModuleEnabled: boolean
  ticketsModuleEnabled: boolean
  splitBillModuleEnabled: boolean
  serviceChargeTipsModuleEnabled: boolean
  suppliersModuleEnabled: boolean
  supplierPurchasesModuleEnabled: boolean
  accountsPayableModuleEnabled: boolean
  subrecipesModuleEnabled: boolean
  auditLogModuleEnabled: boolean
  visualEditorModuleEnabled: boolean
  trainingModeModuleEnabled: boolean
  // Estado en vivo del Modo entrenamiento: mientras está en true, TODOS los
  // pedidos nuevos se marcan como práctica (is_training) y se excluyen de
  // reportes/inventario/cierre. No es un módulo, es un interruptor de sesión.
  trainingModeActive: boolean
  branchesModuleEnabled: boolean
  defaultViewMode: BusinessViewMode
  soundEnabled: boolean
  filtersOpenByDefault: boolean
  allowCloseWithPendingOrders: boolean
  allowCloseWithPendingPayments: boolean
  updatedAt?: string
}

export type SaveBusinessConfigInput = Partial<BusinessConfig>

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: "Menú y pedidos",
  businessType: "",
  locationLabel: "Mesa",
  fiscalEnabled: false,
  rifNumber: "",
  razonSocial: "",
  fiscalAddress: "",
  ivaDefaultRate: 16,
  pricesIncludeIva: true,
  igtfEnabled: true,
  igtfRate: 3,
  themePrimaryColor: "#f5a623",
  themeAccentColor: "#ffb340",
  themeCreamColor: "#0d0d0d",
  productCardBackgroundColor: "#141414",
  productCardTextColor: "#ffffff",
  productCardBorderColor: "#f5a623",
  productCardButtonColor: "#f5a623",
  publicTagline: BRAND.tagline,
  publicInfoTitle: `Visita ${BRAND.name}`,
  publicInfoText: "Somos simples: porque nos gustan las buenas burgers. Ingredientes de calidad y mucho sabor. Abre nuestra ubicación en Google Maps o escribe por WhatsApp para coordinar tu pedido. Delivery & Pick Up en Valencia y San Diego.",
  scheduleTitle: "Horario",
  scheduleLine1: "Martes a domingo: 5:00 p.m. a 11:30 p.m.",
  scheduleLine2: "Lunes: cerrado",
  reviewsTitle: "Reseñas",
  reviewsText: "Después de probar tu pedido, puedes apoyar el negocio dejando tu reseña o compartiendo la página. Gracias por el apoyo, frater.",
  quickOrderTitle: "Pedido rápido",
  quickOrderText: "Agrega productos al carrito y registra el pedido en el local o envíalo directamente por WhatsApp.",
  publicMenuEyebrow: `Menú ${BRAND.name}`,
  publicMenuTitle: "Elige tu pedido",
  publicMenuText: "Combos en divisas y productos normales con referencia en bolívares según la tasa activa del negocio.",
  publicMenuSearchPlaceholder: "Buscar productos, combos o adicionales",
  publicComboTitle: "Combos disponibles",
  publicComboText: "Los combos se manejan en divisas para mantener precios claros.",
  publicComboButtonText: "Ver combos",
  publicCustomizeButtonText: "Elige tus ingredientes",
  publicCustomizerTitle: "Elige tus ingredientes",
  publicCartTitle: "Tu pedido",
  publicCartEmptyTitle: "Tu carrito está vacío",
  publicCartEmptyText: "Agrega productos del menú para preparar tu pedido.",
  publicCartEmptyButtonText: "Ver menú",
  publicCartTotalLabel: "Total a cobrar",
  publicCartTotalHint: "Total general en divisas",
  publicCartLocalOrderButtonText: "Registrar pedido local",
  publicCartWhatsappButtonText: "Enviar por WhatsApp",
  publicDivisaGroupTitle: "Combos",
  publicDivisaOnlyNote: "Pago solo en divisas",
  publicDivisaOnlyBadge: "Solo divisas",
  publicRegularGroupTitle: "Productos normales",
  publicAvailabilityLabel: "Disponible",
  publicPaymentMethods: [...DEFAULT_PUBLIC_PAYMENT_METHODS],
  publicPaymentMethodDetails: {},
  publicProductCardSize: "grande",
  publicCoupons: [],
  locationButtonText: "Abrir ubicación",
  googleMapsUrl: "",
  googleReviewUrl: "",
  instagramUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  orderHelpWhatsappEnabled: true,
  orderWhatsappStageButtonsEnabled: true,
  exchangeRateMode: "automatic",
  manualExchangeRate: 0,
  deliveryEnabled: true,
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
  ownerDashboardModuleEnabled: true,
  cashierModuleEnabled: true,
  kitchenModuleEnabled: true,
  deliveryModuleEnabled: true,
  historyModuleEnabled: true,
  expensesModuleEnabled: true,
  menuProductsModuleEnabled: true,
  promotionModuleEnabled: true,
  promotionActive: false,
  promotionTitle: "Promoción especial",
  promotionText: `Aprovecha una oferta preparada para disfrutar en ${BRAND.name}.`,
  promotionHighlight: "Disponible por tiempo limitado.",
  promotionButtonText: "Ver menú",
  promotionButtonHref: "#menu",
  promotionProductId: 0,
  promotionProductName: "",
  promotionPriceUSD: 0,
  promotionImage: "",
  featuredProductsModuleEnabled: true,
  featuredProductsActive: false,
  featuredProductsTitle: "Favoritos de la casa",
  featuredProductsText: "Una selección rápida para pedir lo más recomendado del menú.",
  featuredProductIds: [1, 2, 5],
  publicCategoryOrder: DEFAULT_PUBLIC_CATEGORY_ORDER,
  publicHiddenCategories: [],
  publicNavButtons: DEFAULT_PUBLIC_NAV_BUTTONS,
  customersModuleEnabled: true,
  inventoryModuleEnabled: true,
  inventoryAlertsModuleEnabled: true,
  advancedMenuModuleEnabled: true,
  productVariationsModuleEnabled: true,
  productAddonsModuleEnabled: true,
  productBuilderModuleEnabled: true,
  productCombosModuleEnabled: true,
  productAvailabilityModuleEnabled: true,
  salesChannelsModuleEnabled: true,
  paymentProofsModuleEnabled: true,
  openAccountsModuleEnabled: true,
  tablesModuleEnabled: true,
  localTables: DEFAULT_LOCAL_TABLES,
  qrTablesModuleEnabled: true,
  reservationsModuleEnabled: false,
  roomsModuleEnabled: false,
  waiterConfirmationModuleEnabled: true,
  kitchenItemsModuleEnabled: true,
  ticketsModuleEnabled: true,
  splitBillModuleEnabled: false,
  serviceChargeTipsModuleEnabled: false,
  suppliersModuleEnabled: false,
  supplierPurchasesModuleEnabled: false,
  accountsPayableModuleEnabled: false,
  subrecipesModuleEnabled: false,
  auditLogModuleEnabled: true,
  visualEditorModuleEnabled: true,
  trainingModeModuleEnabled: false,
  trainingModeActive: false,
  branchesModuleEnabled: true,
  defaultViewMode: "negocio",
  soundEnabled: true,
  filtersOpenByDefault: false,
  allowCloseWithPendingOrders: true,
  allowCloseWithPendingPayments: true,
}

function normalizeBooleanConfig(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "activado", "activada"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "desactivado", "desactivada"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeNumberListConfig(value: unknown, fallback: number[]) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue) ? parsedValue : cleanValue.split(/[;,|]/g)
          } catch {
            return cleanValue.split(/[;,|]/g)
          }
        })()
      : fallback

  const seen = new Set<number>()

  return source
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}


function createLocalTableId(value: string, index: number) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return base || `mesa-${index + 1}`
}

// Modo entrenamiento activo = módulo habilitado (plan + dueño) Y el interruptor
// en vivo encendido. Mientras esté activo, los pedidos nuevos son de práctica.
export function isTrainingModeActive(config: BusinessConfig): boolean {
  if (!getModulePlanAccess(config, "trainingMode").effectiveEnabled) return false
  return config.trainingModeActive === true
}

export function normalizeLocalTablesConfig(
  value: unknown,
  fallback: LocalTable[] = DEFAULT_LOCAL_TABLES
): LocalTable[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue)
              ? parsedValue
              : cleanValue.split(/[;,|\n]/g)
          } catch {
            return cleanValue.split(/[;,|\n]/g)
          }
        })()
      : []

  const seen = new Set<string>()
  const normalizedTables: LocalTable[] = []

  source.forEach((item, index) => {
    const rawItem = item && typeof item === "object" ? item as Partial<LocalTable> : { name: String(item || "") }
    const name = String(rawItem.name || "").trim()

    if (!name) return

    const comparableName = name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase()

    if (!comparableName || seen.has(comparableName)) return

    seen.add(comparableName)

    const sortOrder = Number(rawItem.sortOrder || index + 1)

    normalizedTables.push({
      id: String(rawItem.id || "").trim() || createLocalTableId(name, index),
      name,
      area: String(rawItem.area || "Principal").trim() || "Principal",
      sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? Math.round(sortOrder) : index + 1,
      isActive: normalizeBooleanConfig(rawItem.isActive, true),
      note: String(rawItem.note || "").trim(),
    })
  })

  normalizedTables.sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder
    return first.name.localeCompare(second.name)
  })

  return normalizedTables.length ? normalizedTables : fallback
}

export function getActiveLocalTableNames(tables: LocalTable[] | undefined) {
  const activeTables = normalizeLocalTablesConfig(tables || DEFAULT_LOCAL_TABLES)
    .filter((table) => table.isActive !== false)
    .map((table) => table.name)

  return activeTables.length
    ? activeTables
    : DEFAULT_LOCAL_TABLES.map((table) => table.name)
}


function normalizePositiveNumberConfig(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeViewMode(value: unknown): BusinessViewMode {
  const normalized = String(value || "").trim().toLowerCase()

  if (normalized === "simple") return "simple"
  if (normalized === "avanzado") return "avanzado"

  return "negocio"
}

function normalizeExchangeRateMode(value: unknown): ExchangeRateMode {
  const normalized = String(value || "").trim().toLowerCase()

  if (normalized === "manual") return "manual"
  if (normalized === "automaticeur" || normalized === "euro") {
    return "automaticEur"
  }

  return "automatic"
}

export function normalizeBusinessConfig(value: unknown): BusinessConfig {
  const source = (value || {}) as Partial<BusinessConfig>
  const manualExchangeRate = Number(source.manualExchangeRate || 0)

  return {
    businessName:
      String(source.businessName || "").trim() || DEFAULT_BUSINESS_CONFIG.businessName,
    businessShortDescription:
      String(source.businessShortDescription || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessShortDescription,
    businessType: String(source.businessType || "").trim(),
    locationLabel:
      String(source.locationLabel || "").trim() || DEFAULT_BUSINESS_CONFIG.locationLabel,
    fiscalEnabled: source.fiscalEnabled === true,
    rifNumber: String(source.rifNumber || "").trim(),
    razonSocial: String(source.razonSocial || "").trim(),
    fiscalAddress: String(source.fiscalAddress || "").trim(),
    ivaDefaultRate: Number.isFinite(Number(source.ivaDefaultRate))
      ? Math.min(100, Math.max(0, Number(source.ivaDefaultRate)))
      : DEFAULT_BUSINESS_CONFIG.ivaDefaultRate,
    pricesIncludeIva: source.pricesIncludeIva !== false,
    igtfEnabled: source.igtfEnabled !== false,
    igtfRate: Number.isFinite(Number(source.igtfRate))
      ? Math.min(100, Math.max(0, Number(source.igtfRate)))
      : DEFAULT_BUSINESS_CONFIG.igtfRate,
    themePrimaryColor:
      String(source.themePrimaryColor || "").trim() || DEFAULT_BUSINESS_CONFIG.themePrimaryColor,
    themeAccentColor:
      String(source.themeAccentColor || "").trim() || DEFAULT_BUSINESS_CONFIG.themeAccentColor,
    themeCreamColor:
      String(source.themeCreamColor || "").trim() || DEFAULT_BUSINESS_CONFIG.themeCreamColor,
    productCardBackgroundColor:
      String(source.productCardBackgroundColor || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.productCardBackgroundColor,
    productCardTextColor:
      String(source.productCardTextColor || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.productCardTextColor,
    productCardBorderColor:
      String(source.productCardBorderColor || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.productCardBorderColor,
    productCardButtonColor:
      String(source.productCardButtonColor || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.productCardButtonColor,
    publicTagline:
      String(source.publicTagline || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicTagline,
    publicInfoTitle:
      String(source.publicInfoTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicInfoTitle,
    publicInfoText:
      String(source.publicInfoText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicInfoText,
    scheduleTitle:
      String(source.scheduleTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleTitle,
    scheduleLine1:
      String(source.scheduleLine1 || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleLine1,
    scheduleLine2:
      String(source.scheduleLine2 || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleLine2,
    reviewsTitle:
      String(source.reviewsTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.reviewsTitle,
    reviewsText:
      String(source.reviewsText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.reviewsText,
    quickOrderTitle:
      String(source.quickOrderTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.quickOrderTitle,
    quickOrderText:
      String(source.quickOrderText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.quickOrderText,
    publicMenuEyebrow:
      String(source.publicMenuEyebrow || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuEyebrow,
    publicMenuTitle:
      String(source.publicMenuTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuTitle,
    publicMenuText:
      String(source.publicMenuText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuText,
    publicMenuSearchPlaceholder:
      String(source.publicMenuSearchPlaceholder || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuSearchPlaceholder,
    publicComboTitle:
      String(source.publicComboTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboTitle,
    publicComboText:
      String(source.publicComboText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboText,
    publicComboButtonText:
      String(source.publicComboButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboButtonText,
    publicCustomizeButtonText:
      String(source.publicCustomizeButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCustomizeButtonText,
    publicCustomizerTitle:
      String(source.publicCustomizerTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCustomizerTitle,
    publicCartTitle:
      String(source.publicCartTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTitle,
    publicCartEmptyTitle:
      String(source.publicCartEmptyTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyTitle,
    publicCartEmptyText:
      String(source.publicCartEmptyText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyText,
    publicCartEmptyButtonText:
      String(source.publicCartEmptyButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyButtonText,
    publicCartTotalLabel:
      String(source.publicCartTotalLabel || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTotalLabel,
    publicCartTotalHint:
      String(source.publicCartTotalHint || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTotalHint,
    publicCartLocalOrderButtonText:
      String(source.publicCartLocalOrderButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartLocalOrderButtonText,
    publicCartWhatsappButtonText:
      String(source.publicCartWhatsappButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartWhatsappButtonText,
    publicDivisaGroupTitle:
      String(source.publicDivisaGroupTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaGroupTitle,
    publicDivisaOnlyNote:
      String(source.publicDivisaOnlyNote || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaOnlyNote,
    publicDivisaOnlyBadge:
      String(source.publicDivisaOnlyBadge || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaOnlyBadge,
    publicRegularGroupTitle:
      String(source.publicRegularGroupTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicRegularGroupTitle,
    publicAvailabilityLabel:
      String(source.publicAvailabilityLabel || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicAvailabilityLabel,
    publicPaymentMethods: normalizePublicPaymentMethods(source.publicPaymentMethods),
    publicPaymentMethodDetails: normalizePublicPaymentMethodDetails(
      source.publicPaymentMethodDetails
    ),
    publicProductCardSize: normalizePublicProductCardSize(
      source.publicProductCardSize
    ),
    publicCoupons: normalizePublicCoupons(source.publicCoupons),
    locationButtonText:
      String(source.locationButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.locationButtonText,
    googleMapsUrl: String(source.googleMapsUrl || "").trim(),
    googleReviewUrl: String(source.googleReviewUrl || "").trim(),
    instagramUrl: String(source.instagramUrl || "").trim(),
    mainWhatsapp: String(source.mainWhatsapp || "").trim(),
    deliveryWhatsapp: String(source.deliveryWhatsapp || "").trim(),
    exchangeRateMode: normalizeExchangeRateMode(source.exchangeRateMode),
    manualExchangeRate:
      Number.isFinite(manualExchangeRate) && manualExchangeRate > 0
        ? manualExchangeRate
        : 0,
    orderHelpWhatsappEnabled: normalizeBooleanConfig(
      source.orderHelpWhatsappEnabled,
      DEFAULT_BUSINESS_CONFIG.orderHelpWhatsappEnabled
    ),
    orderWhatsappStageButtonsEnabled: normalizeBooleanConfig(
      source.orderWhatsappStageButtonsEnabled,
      DEFAULT_BUSINESS_CONFIG.orderWhatsappStageButtonsEnabled
    ),
    deliveryEnabled: normalizeBooleanConfig(
      source.deliveryEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryEnabled
    ),
    membershipPlan: normalizeLocalPlanKey(source.membershipPlan),
    membershipPlanMode: normalizeLocalPlanMode(source.membershipPlanMode),
    customIncludedModules: normalizeLocalModuleList(source.customIncludedModules),
    customBlockedModules: normalizeLocalModuleList(source.customBlockedModules),
    ownerDashboardModuleEnabled: normalizeBooleanConfig(
      source.ownerDashboardModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.ownerDashboardModuleEnabled
    ),
    cashierModuleEnabled: normalizeBooleanConfig(
      source.cashierModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.cashierModuleEnabled
    ),
    kitchenModuleEnabled: normalizeBooleanConfig(
      source.kitchenModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.kitchenModuleEnabled
    ),
    deliveryModuleEnabled: normalizeBooleanConfig(
      source.deliveryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryModuleEnabled
    ),
    historyModuleEnabled: normalizeBooleanConfig(
      source.historyModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.historyModuleEnabled
    ),
    expensesModuleEnabled: normalizeBooleanConfig(
      source.expensesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.expensesModuleEnabled
    ),
    menuProductsModuleEnabled: normalizeBooleanConfig(
      source.menuProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.menuProductsModuleEnabled
    ),
    promotionModuleEnabled: normalizeBooleanConfig(
      source.promotionModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.promotionModuleEnabled
    ),
    promotionActive: normalizeBooleanConfig(
      source.promotionActive,
      DEFAULT_BUSINESS_CONFIG.promotionActive
    ),
    promotionTitle:
      String(source.promotionTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionTitle,
    promotionText:
      String(source.promotionText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionText,
    promotionHighlight:
      String(source.promotionHighlight || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionHighlight,
    promotionButtonText:
      String(source.promotionButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionButtonText,
    promotionButtonHref:
      String(source.promotionButtonHref || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionButtonHref,
    promotionProductId: Math.round(normalizePositiveNumberConfig(source.promotionProductId)),
    promotionProductName: String(source.promotionProductName || "").trim(),
    promotionPriceUSD: normalizePositiveNumberConfig(source.promotionPriceUSD),
    promotionImage: String(source.promotionImage || "").trim(),
    featuredProductsModuleEnabled: normalizeBooleanConfig(
      source.featuredProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.featuredProductsModuleEnabled
    ),
    featuredProductsActive: normalizeBooleanConfig(
      source.featuredProductsActive,
      DEFAULT_BUSINESS_CONFIG.featuredProductsActive
    ),
    featuredProductsTitle:
      String(source.featuredProductsTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.featuredProductsTitle,
    featuredProductsText:
      String(source.featuredProductsText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.featuredProductsText,
    featuredProductIds: normalizeNumberListConfig(
      source.featuredProductIds,
      DEFAULT_BUSINESS_CONFIG.featuredProductIds
    ),
    publicCategoryOrder: normalizePublicCategoryList(source.publicCategoryOrder).length
      ? normalizePublicCategoryList(source.publicCategoryOrder)
      : DEFAULT_BUSINESS_CONFIG.publicCategoryOrder,
    publicHiddenCategories: normalizePublicHiddenCategoryList(source.publicHiddenCategories),
    publicNavButtons: normalizePublicNavButtons(source.publicNavButtons),
    customersModuleEnabled: normalizeBooleanConfig(
      source.customersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.customersModuleEnabled
    ),
    inventoryModuleEnabled: normalizeBooleanConfig(
      source.inventoryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryModuleEnabled
    ),
    inventoryAlertsModuleEnabled: normalizeBooleanConfig(
      source.inventoryAlertsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryAlertsModuleEnabled
    ),
    advancedMenuModuleEnabled: normalizeBooleanConfig(
      source.advancedMenuModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.advancedMenuModuleEnabled
    ),
    productVariationsModuleEnabled: normalizeBooleanConfig(
      source.productVariationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productVariationsModuleEnabled
    ),
    productAddonsModuleEnabled: normalizeBooleanConfig(
      source.productAddonsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productAddonsModuleEnabled
    ),
    productBuilderModuleEnabled: normalizeBooleanConfig(
      source.productBuilderModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productBuilderModuleEnabled
    ),
    productCombosModuleEnabled: normalizeBooleanConfig(
      source.productCombosModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productCombosModuleEnabled
    ),
    productAvailabilityModuleEnabled: normalizeBooleanConfig(
      source.productAvailabilityModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productAvailabilityModuleEnabled
    ),
    salesChannelsModuleEnabled: normalizeBooleanConfig(
      source.salesChannelsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.salesChannelsModuleEnabled
    ),
    paymentProofsModuleEnabled: normalizeBooleanConfig(
      source.paymentProofsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.paymentProofsModuleEnabled
    ),
    openAccountsModuleEnabled: normalizeBooleanConfig(
      source.openAccountsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.openAccountsModuleEnabled
    ),
    tablesModuleEnabled: normalizeBooleanConfig(
      source.tablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.tablesModuleEnabled
    ),
    localTables: normalizeLocalTablesConfig(
      source.localTables,
      DEFAULT_BUSINESS_CONFIG.localTables
    ),
    qrTablesModuleEnabled: normalizeBooleanConfig(
      source.qrTablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.qrTablesModuleEnabled
    ),
    reservationsModuleEnabled: normalizeBooleanConfig(
      source.reservationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.reservationsModuleEnabled
    ),
    roomsModuleEnabled: normalizeBooleanConfig(
      source.roomsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.roomsModuleEnabled
    ),
    waiterConfirmationModuleEnabled: normalizeBooleanConfig(
      source.waiterConfirmationModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.waiterConfirmationModuleEnabled
    ),
    kitchenItemsModuleEnabled: normalizeBooleanConfig(
      source.kitchenItemsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.kitchenItemsModuleEnabled
    ),
    ticketsModuleEnabled: normalizeBooleanConfig(
      source.ticketsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.ticketsModuleEnabled
    ),
    splitBillModuleEnabled: normalizeBooleanConfig(
      source.splitBillModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.splitBillModuleEnabled
    ),
    serviceChargeTipsModuleEnabled: normalizeBooleanConfig(
      source.serviceChargeTipsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.serviceChargeTipsModuleEnabled
    ),
    suppliersModuleEnabled: normalizeBooleanConfig(
      source.suppliersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.suppliersModuleEnabled
    ),
    supplierPurchasesModuleEnabled: normalizeBooleanConfig(
      source.supplierPurchasesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.supplierPurchasesModuleEnabled
    ),
    accountsPayableModuleEnabled: normalizeBooleanConfig(
      source.accountsPayableModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.accountsPayableModuleEnabled
    ),
    subrecipesModuleEnabled: normalizeBooleanConfig(
      source.subrecipesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.subrecipesModuleEnabled
    ),
    auditLogModuleEnabled: normalizeBooleanConfig(
      source.auditLogModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.auditLogModuleEnabled
    ),
    visualEditorModuleEnabled: normalizeBooleanConfig(
      source.visualEditorModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.visualEditorModuleEnabled
    ),
    trainingModeModuleEnabled: normalizeBooleanConfig(
      source.trainingModeModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.trainingModeModuleEnabled
    ),
    trainingModeActive: normalizeBooleanConfig(
      source.trainingModeActive,
      DEFAULT_BUSINESS_CONFIG.trainingModeActive
    ),
    branchesModuleEnabled: normalizeBooleanConfig(
      source.branchesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.branchesModuleEnabled
    ),
    defaultViewMode: normalizeViewMode(source.defaultViewMode),
    soundEnabled: normalizeBooleanConfig(
      source.soundEnabled,
      DEFAULT_BUSINESS_CONFIG.soundEnabled
    ),
    filtersOpenByDefault: normalizeBooleanConfig(
      source.filtersOpenByDefault,
      DEFAULT_BUSINESS_CONFIG.filtersOpenByDefault
    ),
    allowCloseWithPendingOrders: normalizeBooleanConfig(
      source.allowCloseWithPendingOrders,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingOrders
    ),
    allowCloseWithPendingPayments: normalizeBooleanConfig(
      source.allowCloseWithPendingPayments,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingPayments
    ),
    updatedAt: source.updatedAt ? String(source.updatedAt) : undefined,
  }
}

function applyPlanLocksToBusinessConfig(config: BusinessConfig): BusinessConfig {
  const ownerDashboardAccess = getModulePlanAccess(config, "ownerDashboard")
  const cashierAccess = getModulePlanAccess(config, "cashier")
  const kitchenAccess = getModulePlanAccess(config, "kitchen")
  const deliveryAccess = getModulePlanAccess(config, "delivery")
  const historyAccess = getModulePlanAccess(config, "history")
  const expensesAccess = getModulePlanAccess(config, "expenses")
  const promotionsAccess = getModulePlanAccess(config, "promotions")
  const menuProductsAccess = getModulePlanAccess(config, "menuProducts")
  const featuredProductsAccess = getModulePlanAccess(config, "featuredProducts")
  const customersAccess = getModulePlanAccess(config, "customers")
  const inventoryAccess = getModulePlanAccess(config, "inventory")
  const inventoryAlertsAccess = getModulePlanAccess(config, "inventoryAlerts")
  const advancedMenuAccess = getModulePlanAccess(config, "advancedMenu")
  const productVariationsAccess = getModulePlanAccess(config, "productVariations")
  const productAddonsAccess = getModulePlanAccess(config, "productAddons")
  const productBuilderAccess = getModulePlanAccess(config, "productBuilder")
  const productCombosAccess = getModulePlanAccess(config, "productCombos")
  const productAvailabilityAccess = getModulePlanAccess(config, "productAvailability")
  const salesChannelsAccess = getModulePlanAccess(config, "salesChannels")
  const paymentProofsAccess = getModulePlanAccess(config, "paymentProofs")
  const openAccountsAccess = getModulePlanAccess(config, "openAccounts")
  const tablesAccess = getModulePlanAccess(config, "tables")
  const qrTablesAccess = getModulePlanAccess(config, "qrTables")
  const reservationsAccess = getModulePlanAccess(config, "reservations")
  const roomsAccess = getModulePlanAccess(config, "rooms")
  const waiterConfirmationAccess = getModulePlanAccess(config, "waiterConfirmation")
  const kitchenItemsAccess = getModulePlanAccess(config, "kitchenItems")
  const ticketsAccess = getModulePlanAccess(config, "tickets")
  const splitBillAccess = getModulePlanAccess(config, "splitBill")
  const serviceChargeTipsAccess = getModulePlanAccess(config, "serviceChargeTips")
  const suppliersAccess = getModulePlanAccess(config, "suppliers")
  const supplierPurchasesAccess = getModulePlanAccess(config, "supplierPurchases")
  const accountsPayableAccess = getModulePlanAccess(config, "accountsPayable")
  const subrecipesAccess = getModulePlanAccess(config, "subrecipes")
  const auditLogAccess = getModulePlanAccess(config, "auditLog")
  const visualEditorAccess = getModulePlanAccess(config, "visualEditor")
  const trainingModeAccess = getModulePlanAccess(config, "trainingMode")
  const branchesAccess = getModulePlanAccess(config, "branches")
  const soundsAccess = getModulePlanAccess(config, "sounds")

  return {
    ...config,
    ownerDashboardModuleEnabled: ownerDashboardAccess.includedInPlan
      ? config.ownerDashboardModuleEnabled
      : false,
    cashierModuleEnabled: cashierAccess.includedInPlan
      ? config.cashierModuleEnabled
      : false,
    kitchenModuleEnabled: kitchenAccess.includedInPlan
      ? config.kitchenModuleEnabled
      : false,
    deliveryEnabled: deliveryAccess.includedInPlan ? config.deliveryEnabled : false,
    deliveryModuleEnabled: deliveryAccess.includedInPlan
      ? config.deliveryModuleEnabled
      : false,
    historyModuleEnabled: historyAccess.includedInPlan
      ? config.historyModuleEnabled
      : false,
    expensesModuleEnabled: expensesAccess.includedInPlan
      ? config.expensesModuleEnabled
      : false,
    promotionModuleEnabled: promotionsAccess.includedInPlan
      ? config.promotionModuleEnabled
      : false,
    promotionActive: promotionsAccess.includedInPlan && config.promotionModuleEnabled
      ? config.promotionActive
      : false,
    menuProductsModuleEnabled: menuProductsAccess.includedInPlan
      ? config.menuProductsModuleEnabled
      : false,
    featuredProductsModuleEnabled: featuredProductsAccess.includedInPlan
      ? config.featuredProductsModuleEnabled
      : false,
    featuredProductsActive: featuredProductsAccess.includedInPlan && config.featuredProductsModuleEnabled
      ? config.featuredProductsActive
      : false,
    customersModuleEnabled: customersAccess.includedInPlan
      ? config.customersModuleEnabled
      : false,
    inventoryModuleEnabled: inventoryAccess.includedInPlan
      ? config.inventoryModuleEnabled
      : false,
    inventoryAlertsModuleEnabled: inventoryAlertsAccess.includedInPlan
      ? config.inventoryAlertsModuleEnabled
      : false,
    advancedMenuModuleEnabled: advancedMenuAccess.includedInPlan
      ? config.advancedMenuModuleEnabled
      : false,
    productVariationsModuleEnabled: productVariationsAccess.includedInPlan
      ? config.productVariationsModuleEnabled
      : false,
    productAddonsModuleEnabled: productAddonsAccess.includedInPlan
      ? config.productAddonsModuleEnabled
      : false,
    productBuilderModuleEnabled: productBuilderAccess.includedInPlan
      ? config.productBuilderModuleEnabled
      : false,
    productCombosModuleEnabled: productCombosAccess.includedInPlan
      ? config.productCombosModuleEnabled
      : false,
    productAvailabilityModuleEnabled: productAvailabilityAccess.includedInPlan
      ? config.productAvailabilityModuleEnabled
      : false,
    salesChannelsModuleEnabled: salesChannelsAccess.includedInPlan
      ? config.salesChannelsModuleEnabled
      : false,
    paymentProofsModuleEnabled: paymentProofsAccess.includedInPlan
      ? config.paymentProofsModuleEnabled
      : false,
    openAccountsModuleEnabled: openAccountsAccess.includedInPlan
      ? config.openAccountsModuleEnabled
      : false,
    tablesModuleEnabled: tablesAccess.includedInPlan
      ? config.tablesModuleEnabled
      : false,
    qrTablesModuleEnabled: qrTablesAccess.includedInPlan
      ? config.qrTablesModuleEnabled
      : false,
    reservationsModuleEnabled: reservationsAccess.includedInPlan
      ? config.reservationsModuleEnabled
      : false,
    roomsModuleEnabled: roomsAccess.includedInPlan
      ? config.roomsModuleEnabled
      : false,
    waiterConfirmationModuleEnabled: waiterConfirmationAccess.includedInPlan
      ? config.waiterConfirmationModuleEnabled
      : false,
    kitchenItemsModuleEnabled: kitchenItemsAccess.includedInPlan
      ? config.kitchenItemsModuleEnabled
      : false,
    ticketsModuleEnabled: ticketsAccess.includedInPlan
      ? config.ticketsModuleEnabled
      : false,
    splitBillModuleEnabled: splitBillAccess.includedInPlan
      ? config.splitBillModuleEnabled
      : false,
    serviceChargeTipsModuleEnabled: serviceChargeTipsAccess.includedInPlan
      ? config.serviceChargeTipsModuleEnabled
      : false,
    suppliersModuleEnabled: suppliersAccess.includedInPlan
      ? config.suppliersModuleEnabled
      : false,
    supplierPurchasesModuleEnabled: supplierPurchasesAccess.includedInPlan
      ? config.supplierPurchasesModuleEnabled
      : false,
    accountsPayableModuleEnabled: accountsPayableAccess.includedInPlan
      ? config.accountsPayableModuleEnabled
      : false,
    subrecipesModuleEnabled: subrecipesAccess.includedInPlan
      ? config.subrecipesModuleEnabled
      : false,
    auditLogModuleEnabled: auditLogAccess.includedInPlan
      ? config.auditLogModuleEnabled
      : false,
    visualEditorModuleEnabled: visualEditorAccess.includedInPlan
      ? config.visualEditorModuleEnabled
      : false,
    trainingModeModuleEnabled: trainingModeAccess.includedInPlan
      ? config.trainingModeModuleEnabled
      : false,
    branchesModuleEnabled: branchesAccess.includedInPlan
      ? config.branchesModuleEnabled
      : false,
    soundEnabled: soundsAccess.includedInPlan ? config.soundEnabled : false,
  }
}

async function readRawBusinessConfig(): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("business_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "No se pudo cargar la configuración del negocio")
  }

  const raw = (data?.config ?? {}) as unknown
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
}

// Config cruda (sin normalizar) — para campos que el normalizador no contempla,
// como los colores de tema. No lanza: devuelve {} si falla.
export async function getRawBusinessConfig(): Promise<Record<string, unknown>> {
  try {
    return await readRawBusinessConfig()
  } catch {
    return {}
  }
}

export async function getBusinessConfig() {
  const raw = await readRawBusinessConfig()
  const normalized = applyPlanLocksToBusinessConfig(normalizeBusinessConfig(raw))
  // Los ajustes de complejidad (permisos públicos/internos, inventario auto) se
  // guardan en el mismo blob raw pero fuera del tipo BusinessConfig base. Los
  // leemos aquí para que los endpoints (privado y público) los expongan con sus
  // defaults cuando el dueño aún no los ha tocado.
  return { ...normalized, ...normalizeBusinessComplexitySettings(raw) }
}

export async function saveBusinessConfig(input: SaveBusinessConfigInput) {
  const supabase = getSupabaseAdmin()

  // Mezcla con lo existente para que un guardado parcial no borre el resto de
  // los campos (la app guarda secciones sueltas de la configuración).
  const existing = await readRawBusinessConfig()
  const merged = {
    ...existing,
    ...(input as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabase
    .from("business_config")
    .upsert({ id: 1, config: merged })

  if (error) {
    throw new Error(error.message || "No se pudo guardar la configuración del negocio")
  }

  return applyPlanLocksToBusinessConfig(normalizeBusinessConfig(merged))
}
