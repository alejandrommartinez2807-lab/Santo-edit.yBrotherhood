import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  normalizeLocalTablesConfig,
  saveBusinessConfig,
  type BusinessViewMode,
  type ExchangeRateMode,
  type SaveBusinessConfigInput,
} from "@/lib/orders"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalRole,
} from "@/lib/localAccess"
import {
  SIMPLE_BUSINESS_CONFIG_FIELDS,
  coerceSimpleConfigValue,
} from "@/lib/businessConfigFields"
import {
  getModulePlanAccess,
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  normalizeLocalPlanMode,
  type LocalModuleKey,
} from "@/lib/localPlans"

import {
  BUSINESS_COMPLEXITY_CONFIG_KEYS,
  normalizeBusinessComplexityProfile,
} from "@/lib/businessComplexity"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  normalizePublicCategoryList,
  normalizePublicCoupons,
  normalizePublicHiddenCategoryList,
  normalizePublicNavButtons,
  normalizePublicPaymentMethodDetails,
  normalizePublicPaymentMethods,
} from "@/lib/publicPageConfig"
import { writeAuditLog } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MODULE_KEY_BY_CONFIG_KEY: Record<string, LocalModuleKey> = {
  ownerDashboardModuleEnabled: "ownerDashboard",
  cashierModuleEnabled: "cashier",
  kitchenModuleEnabled: "kitchen",
  deliveryEnabled: "delivery",
  deliveryModuleEnabled: "delivery",
  historyModuleEnabled: "history",
  expensesModuleEnabled: "expenses",
  promotionModuleEnabled: "promotions",
  menuProductsModuleEnabled: "menuProducts",
  featuredProductsModuleEnabled: "featuredProducts",
  customersModuleEnabled: "customers",
  inventoryModuleEnabled: "inventory",
  inventoryAlertsModuleEnabled: "inventoryAlerts",
  advancedMenuModuleEnabled: "advancedMenu",
  productVariationsModuleEnabled: "productVariations",
  productAddonsModuleEnabled: "productAddons",
  productBuilderModuleEnabled: "productBuilder",
  productCombosModuleEnabled: "productCombos",
  productAvailabilityModuleEnabled: "productAvailability",
  salesChannelsModuleEnabled: "salesChannels",
  paymentProofsModuleEnabled: "paymentProofs",
  openAccountsModuleEnabled: "openAccounts",
  tablesModuleEnabled: "tables",
  qrTablesModuleEnabled: "qrTables",
  reservationsModuleEnabled: "reservations",
  waiterConfirmationModuleEnabled: "waiterConfirmation",
  kitchenItemsModuleEnabled: "kitchenItems",
  ticketsModuleEnabled: "tickets",
  splitBillModuleEnabled: "splitBill",
  serviceChargeTipsModuleEnabled: "serviceChargeTips",
  suppliersModuleEnabled: "suppliers",
  supplierPurchasesModuleEnabled: "supplierPurchases",
  accountsPayableModuleEnabled: "accountsPayable",
  subrecipesModuleEnabled: "subrecipes",
  auditLogModuleEnabled: "auditLog",
  visualEditorModuleEnabled: "visualEditor",
  trainingModeModuleEnabled: "trainingMode",
  branchesModuleEnabled: "branches",
  soundEnabled: "sounds",
}

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function getAccess(request: NextRequest) {
  return getRequestAccess(request, getRequestPassword(request))
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "No autorizado",
    },
    {
      status: 401,
    }
  )
}

function forbiddenResponse(message = "Esta clave no tiene permiso para esta acción") {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  )
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getAccess(request)

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
      role: null,
    }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "settings")) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    access,
  }
}

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function readString(source: Record<string, unknown>, key: string) {
  return String(source[key] || "").trim()
}

function readNumber(source: Record<string, unknown>, key: string) {
  const numberValue = Number(source[key] || 0)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

function readNumberArray(source: Record<string, unknown>, key: string) {
  const value = source[key]
  const rawList = Array.isArray(value)
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
      : []
  const seen = new Set<number>()

  return rawList
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function readBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key]

  if (typeof value === "boolean") {
    return value
  }

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "activado", "activada", "enabled", "on"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "desactivado", "desactivada", "disabled", "off"].includes(normalized)) {
    return false
  }

  return false
}

function readExchangeRateMode(
  source: Record<string, unknown>,
  key: string
): ExchangeRateMode {
  const normalized = readString(source, key).toLowerCase()

  return normalized === "manual" ? "manual" : "automatic"
}

function readViewMode(source: Record<string, unknown>, key: string): BusinessViewMode {
  const normalized = readString(source, key).toLowerCase()

  if (normalized === "simple") return "simple"
  if (normalized === "avanzado") return "avanzado"

  return "negocio"
}

function setBooleanConfig(
  config: SaveBusinessConfigInput,
  source: Record<string, unknown>,
  key: string,
  currentBusinessConfig: Record<string, unknown>,
  role: LocalRole
) {
  if (!hasOwn(source, key)) return

  const requestedValue = readBoolean(source, key)
  const moduleKey = MODULE_KEY_BY_CONFIG_KEY[key]

  if (role === "owner" && moduleKey) {
    const moduleAccess = getModulePlanAccess(currentBusinessConfig, moduleKey)

    ;(config as Record<string, unknown>)[key] = moduleAccess.includedInPlan
      ? requestedValue
      : false
    return
  }

  ;(config as Record<string, unknown>)[key] = requestedValue
}

function setPlanConfig(
  config: SaveBusinessConfigInput,
  source: Record<string, unknown>,
  role: LocalRole
) {
  if (role !== "support") return

  if (hasOwn(source, "membershipPlan")) {
    ;(config as Record<string, unknown>).membershipPlan = normalizeLocalPlanKey(
      source.membershipPlan
    )
  }

  if (hasOwn(source, "membershipPlanMode")) {
    ;(config as Record<string, unknown>).membershipPlanMode = normalizeLocalPlanMode(
      source.membershipPlanMode
    )
  }

  if (hasOwn(source, "customIncludedModules")) {
    ;(config as Record<string, unknown>).customIncludedModules = normalizeLocalModuleList(
      source.customIncludedModules
    )
  }

  if (hasOwn(source, "customBlockedModules")) {
    ;(config as Record<string, unknown>).customBlockedModules = normalizeLocalModuleList(
      source.customBlockedModules
    )
  }
}

function normalizeBusinessConfigPayload(
  source: Record<string, unknown>,
  currentBusinessConfig: Record<string, unknown>,
  role: LocalRole
) {
  const config: SaveBusinessConfigInput = {}

  setPlanConfig(config, source, role)

  // Campos escalares simples (identidad, apariencia, fiscal): un solo registro
  // (lib/businessConfigFields) los define, así no se desincronizan nunca más.
  for (const field of SIMPLE_BUSINESS_CONFIG_FIELDS) {
    if (hasOwn(source, field.key)) {
      ;(config as Record<string, unknown>)[field.key] = coerceSimpleConfigValue(
        source[field.key],
        field,
      )
    }
  }

  const stringConfigKeys = [
    "publicTagline",
    "publicInfoTitle",
    "publicInfoText",
    "scheduleTitle",
    "scheduleLine1",
    "scheduleLine2",
    "reviewsTitle",
    "reviewsText",
    "quickOrderTitle",
    "quickOrderText",
    "publicMenuEyebrow",
    "publicMenuTitle",
    "publicMenuText",
    "publicMenuSearchPlaceholder",
    "publicComboTitle",
    "publicComboText",
    "publicComboButtonText",
    "publicCustomizeButtonText",
    "publicCustomizerTitle",
    "publicCartTitle",
    "publicCartEmptyTitle",
    "publicCartEmptyText",
    "publicCartEmptyButtonText",
    "publicCartTotalLabel",
    "publicCartTotalHint",
    "publicCartLocalOrderButtonText",
    "publicCartWhatsappButtonText",
    "publicDivisaGroupTitle",
    "publicDivisaOnlyNote",
    "publicDivisaOnlyBadge",
    "publicRegularGroupTitle",
    "publicAvailabilityLabel",
    "locationButtonText",
    "googleMapsUrl",
    "googleReviewUrl",
    "instagramUrl",
  ]

  const canEditAdvancedPublicConfig =
    role === "support" ||
    getModulePlanAccess(currentBusinessConfig, "advancedPublicConfig").includedInPlan

  stringConfigKeys.forEach((key) => {
    if (hasOwn(source, key) && canEditAdvancedPublicConfig) {
      ;(config as Record<string, unknown>)[key] = readString(source, key)
    }
  })

  if (hasOwn(source, "publicCategoryOrder") && canEditAdvancedPublicConfig) {
    ;(config as Record<string, unknown>).publicCategoryOrder = normalizePublicCategoryList(
      source.publicCategoryOrder
    )
  }

  if (hasOwn(source, "publicHiddenCategories") && canEditAdvancedPublicConfig) {
    ;(config as Record<string, unknown>).publicHiddenCategories = normalizePublicHiddenCategoryList(
      source.publicHiddenCategories
    )
  }

  if (hasOwn(source, "publicNavButtons") && canEditAdvancedPublicConfig) {
    ;(config as Record<string, unknown>).publicNavButtons = normalizePublicNavButtons(
      source.publicNavButtons
    )
  }

  // Métodos de pago del carrito: config operativa (no requiere el plan de
  // personalización avanzada, igual que los toggles de delivery).
  if (hasOwn(source, "publicPaymentMethods")) {
    ;(config as Record<string, unknown>).publicPaymentMethods = normalizePublicPaymentMethods(
      source.publicPaymentMethods
    )
  }

  // Datos de cada método (pago móvil, Zelle…): config operativa; el carrito
  // los muestra desplegables para que el cliente copie y pague directo.
  if (hasOwn(source, "publicPaymentMethodDetails")) {
    ;(config as Record<string, unknown>).publicPaymentMethodDetails =
      normalizePublicPaymentMethodDetails(source.publicPaymentMethodDetails)
  }

  // Cupones del carrito ("CODIGO 10" por línea): config operativa. No viajan
  // en la respuesta pública; el cliente valida el suyo en /api/public/coupons.
  if (hasOwn(source, "publicCoupons")) {
    ;(config as Record<string, unknown>).publicCoupons = normalizePublicCoupons(
      source.publicCoupons
    )
  }

  const canEditPromotions =
    role === "support" ||
    getModulePlanAccess(currentBusinessConfig, "promotions").includedInPlan

  const promotionTextKeys = [
    "promotionTitle",
    "promotionText",
    "promotionHighlight",
    "promotionButtonText",
    "promotionButtonHref",
    "promotionProductName",
    "promotionImage",
  ]

  promotionTextKeys.forEach((key) => {
    if (hasOwn(source, key) && canEditPromotions) {
      ;(config as Record<string, unknown>)[key] = readString(source, key)
    }
  })

  const canEditFeaturedProducts =
    role === "support" ||
    getModulePlanAccess(currentBusinessConfig, "featuredProducts").includedInPlan

  const featuredProductTextKeys = [
    "featuredProductsTitle",
    "featuredProductsText",
  ]

  featuredProductTextKeys.forEach((key) => {
    if (hasOwn(source, key) && canEditFeaturedProducts) {
      ;(config as Record<string, unknown>)[key] = readString(source, key)
    }
  })

  if (hasOwn(source, "featuredProductIds") && canEditFeaturedProducts) {
    ;(config as Record<string, unknown>).featuredProductIds = readNumberArray(
      source,
      "featuredProductIds"
    )
  }

  if (hasOwn(source, "featuredProductsActive") && canEditFeaturedProducts) {
    ;(config as Record<string, unknown>).featuredProductsActive = readBoolean(
      source,
      "featuredProductsActive"
    )
  }

  if (hasOwn(source, "promotionActive") && canEditPromotions) {
    ;(config as Record<string, unknown>).promotionActive = readBoolean(
      source,
      "promotionActive"
    )
  }

  if (hasOwn(source, "promotionProductId") && canEditPromotions) {
    ;(config as Record<string, unknown>).promotionProductId = Math.round(
      readNumber(source, "promotionProductId")
    )
  }

  if (hasOwn(source, "promotionPriceUSD") && canEditPromotions) {
    ;(config as Record<string, unknown>).promotionPriceUSD = readNumber(
      source,
      "promotionPriceUSD"
    )
  }

  if (hasOwn(source, "exchangeRateMode")) {
    config.exchangeRateMode = readExchangeRateMode(source, "exchangeRateMode")
  }

  if (hasOwn(source, "manualExchangeRate")) {
    config.manualExchangeRate = readNumber(source, "manualExchangeRate")
  }

  setBooleanConfig(config, source, "deliveryEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "ownerDashboardModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "cashierModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "kitchenModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "deliveryModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "historyModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "expensesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "promotionModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "menuProductsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "featuredProductsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "customersModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "inventoryModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "inventoryAlertsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "advancedMenuModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "productVariationsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "productAddonsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "productBuilderModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "productCombosModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "productAvailabilityModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "salesChannelsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "paymentProofsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "openAccountsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "tablesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "qrTablesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "reservationsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "waiterConfirmationModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "kitchenItemsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "ticketsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "splitBillModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "serviceChargeTipsModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "suppliersModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "supplierPurchasesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "accountsPayableModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "subrecipesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "auditLogModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "visualEditorModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "trainingModeModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "branchesModuleEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "soundEnabled", currentBusinessConfig, role)
  setBooleanConfig(config, source, "filtersOpenByDefault", currentBusinessConfig, role)
  setBooleanConfig(config, source, "allowCloseWithPendingOrders", currentBusinessConfig, role)
  setBooleanConfig(config, source, "allowCloseWithPendingPayments", currentBusinessConfig, role)
  setBooleanConfig(config, source, "trainingModeActive", currentBusinessConfig, role)

  const canEditTables =
    role === "support" ||
    getModulePlanAccess(currentBusinessConfig, "tables").includedInPlan

  if (hasOwn(source, "localTables") && canEditTables) {
    ;(config as Record<string, unknown>).localTables = normalizeLocalTablesConfig(
      source.localTables
    )
  }

  if (hasOwn(source, "defaultViewMode")) {
    config.defaultViewMode = readViewMode(source, "defaultViewMode")
  }

  // Ajustes de complejidad del negocio (permisos públicos/internos e inventario
  // automático). Se guardan en el mismo blob; getBusinessConfig los relee con
  // normalizeBusinessComplexitySettings. Sólo se tocan las claves presentes en
  // el payload, para no reiniciar el resto en un guardado parcial.
  for (const key of BUSINESS_COMPLEXITY_CONFIG_KEYS) {
    if (!hasOwn(source, key)) continue
    ;(config as Record<string, unknown>)[key] =
      key === "businessComplexityProfile"
        ? normalizeBusinessComplexityProfile(source[key])
        : readBoolean(source, key)
  }

  return config
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "support"])

    if (!access.ok) {
      return access.response
    }

    const businessConfig = await getBusinessConfig()

    return NextResponse.json({
      ok: true,
      businessConfig,
      access: {
        role: access.role,
        canEditPlan: access.role === "support",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración del negocio",
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-business-config-post",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 2_000_000,
    rateLimitMessage: "Demasiados cambios de configuración. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner", "support"])

    if (!access.ok || !access.role) {
      return access.response
    }

    const body = await request.json()
    const rawBusinessConfig = (body.businessConfig || body.config || body || {}) as Record<
      string,
      unknown
    >
    const currentBusinessConfig = (await getBusinessConfig()) as unknown as Record<
      string,
      unknown
    >
    const businessConfigInput = normalizeBusinessConfigPayload(
      rawBusinessConfig,
      currentBusinessConfig,
      access.role
    )
    const businessConfig = await saveBusinessConfig(businessConfigInput)

    await writeAuditLog({
      action: "business_config.updated",
      entityType: "business_config",
      actor: getLocalAccessAuditActor(access.access),
      request,
      metadata: { changedKeys: Object.keys(businessConfigInput) },
    })

    return NextResponse.json({
      ok: true,
      businessConfig,
      message:
        access.role === "support"
          ? "Plan y módulos guardados correctamente."
          : "Configuración guardada correctamente.",
      access: {
        role: access.role,
        canEditPlan: access.role === "support",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración del negocio",
      },
      {
        status: 500,
      }
    )
  }
}
