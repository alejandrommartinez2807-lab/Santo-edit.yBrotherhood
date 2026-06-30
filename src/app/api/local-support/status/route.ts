import { NextRequest, NextResponse } from "next/server"
import { BRAND } from "@/lib/brand"
import { captureError } from "@/lib/monitoring"
import { getDeploymentReadiness } from "@/lib/deploymentReadiness"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"
import {
  getBusinessConfig,
  getDayCloses,
  getDayExpenses,
  getDeliveryZones,
  getOrders,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import {
  LOCAL_PLAN_DEFINITIONS,
  getLocalPlanDefinition,
  getModulePlanAccess,
  getVisibleSupportModules,
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  normalizeLocalPlanMode,
} from "@/lib/localPlans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

function forbiddenResponse(message = "Esta clave no tiene permiso para soporte") {
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
      roleLabel: "",
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
      roleLabel: access.roleLabel,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    roleLabel: access.roleLabel,
  }
}

function getDateKeyInCaracas(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value || "0000"
  const month = parts.find((part) => part.type === "month")?.value || "00"
  const day = parts.find((part) => part.type === "day")?.value || "00"

  return `${year}-${month}-${day}`
}

async function safeCheck<T>(label: string, fn: () => Promise<T>) {
  try {
    const data = await fn()

    return {
      label,
      ok: true,
      error: "",
      data,
    }
  } catch (error) {
    return {
      label,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `No se pudo revisar ${label}`,
      data: null,
    }
  }
}

function envConfigured(name: string) {
  return Boolean(String(process.env[name] || "").trim())
}

export async function GET(request: NextRequest) {
  const guardResponse = enforceApiReadGuards(request, {
    id: "api-local-support-status-get",
    limit: 30,
    windowMs: 60_000,
    rateLimitMessage: "Demasiadas consultas de soporte. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["support"])

    if (!access.ok) {
      return access.response
    }

    const todayKey = getDateKeyInCaracas(new Date())

    const [
      businessConfigCheck,
      ordersCheck,
      deliveryZonesCheck,
      dayClosesCheck,
      dayExpensesCheck,
    ] = await Promise.all([
      safeCheck("Configuración del negocio", () => getBusinessConfig()),
      safeCheck("Pedidos", () => getOrders()),
      safeCheck("Zonas de delivery", () => getDeliveryZones()),
      safeCheck("Cierres guardados", () => getDayCloses()),
      safeCheck("Gastos de hoy", () =>
        getDayExpenses({
          dateValue: todayKey,
        })
      ),
    ])

    const businessConfig = businessConfigCheck.data as
      | Record<string, unknown>
      | null
    const orders = Array.isArray(ordersCheck.data) ? ordersCheck.data : []
    const deliveryZones = Array.isArray(deliveryZonesCheck.data)
      ? deliveryZonesCheck.data
      : []
    const dayCloses = Array.isArray(dayClosesCheck.data) ? dayClosesCheck.data : []
    const dayExpenses = Array.isArray(dayExpensesCheck.data)
      ? dayExpensesCheck.data
      : []
    const plan = normalizeLocalPlanKey(businessConfig?.membershipPlan)
    const planMode = normalizeLocalPlanMode(businessConfig?.membershipPlanMode)
    const activePlan = getLocalPlanDefinition(plan)
    const customIncludedModules = normalizeLocalModuleList(
      businessConfig?.customIncludedModules
    )
    const customBlockedModules = normalizeLocalModuleList(
      businessConfig?.customBlockedModules
    )
    const planModules = getVisibleSupportModules().map((moduleDefinition) =>
      getModulePlanAccess(businessConfig || {}, moduleDefinition.key)
    )
    const includedPlanModules = planModules.filter(
      (moduleItem) => moduleItem.includedInPlan
    )

    return NextResponse.json({
      ok: true,
      access: {
        role: access.role,
        roleLabel: access.roleLabel,
      },
      checkedAt: new Date().toISOString(),
      environment: {
        ownerPasswordConfigured:
          envConfigured("ORDERS_OWNER_PASSWORD") ||
          envConfigured("ORDERS_ADMIN_PASSWORD") ||
          envConfigured("ADMIN_PASSWORD"),
        managerPasswordConfigured: envConfigured("ORDERS_MANAGER_PASSWORD"),
        cashierPasswordConfigured: envConfigured("ORDERS_CASHIER_PASSWORD"),
        kitchenPasswordConfigured: envConfigured("ORDERS_KITCHEN_PASSWORD"),
        deliveryPasswordConfigured: envConfigured("ORDERS_DELIVERY_PASSWORD"),
        supportPasswordConfigured:
          envConfigured("ORDERS_SUPPORT_PASSWORD") ||
          envConfigured("ORDERS_PROVIDER_PASSWORD"),
      },
      deploymentReadiness: getDeploymentReadiness(),
      business: {
        name: String(businessConfig?.businessName || BRAND.name),
        description: String(
          businessConfig?.businessShortDescription || "Menú y pedidos"
        ),
        deliveryEnabled: businessConfig?.deliveryEnabled !== false,
        exchangeRateMode: String(businessConfig?.exchangeRateMode || "automatic"),
        defaultViewMode: String(businessConfig?.defaultViewMode || "negocio"),
      },
      planSettings: {
        membershipPlan: plan,
        membershipPlanMode: planMode,
        customIncludedModules,
        customBlockedModules,
        activePlan,
        availablePlans: LOCAL_PLAN_DEFINITIONS,
        modules: planModules,
        includedCount: includedPlanModules.length,
        totalCount: planModules.length,
      },
      checks: [
        {
          key: "businessConfig",
          label: businessConfigCheck.label,
          ok: businessConfigCheck.ok,
          error: businessConfigCheck.error,
          detail: businessConfigCheck.ok
            ? "Configuración disponible"
            : businessConfigCheck.error,
        },
        {
          key: "planSettings",
          label: "Plan y módulos",
          ok: businessConfigCheck.ok,
          error: businessConfigCheck.error,
          detail: `${activePlan.label}${planMode === "custom" ? " · Personalizado" : ""} · ${includedPlanModules.length} módulo(s) incluido(s)`,
        },
        {
          key: "orders",
          label: ordersCheck.label,
          ok: ordersCheck.ok,
          error: ordersCheck.error,
          detail: `${orders.length} pedido(s) cargado(s)`,
        },
        {
          key: "deliveryZones",
          label: deliveryZonesCheck.label,
          ok: deliveryZonesCheck.ok,
          error: deliveryZonesCheck.error,
          detail: `${deliveryZones.length} zona(s) cargada(s)`,
        },
        {
          key: "dayCloses",
          label: dayClosesCheck.label,
          ok: dayClosesCheck.ok,
          error: dayClosesCheck.error,
          detail: `${dayCloses.length} cierre(s) guardado(s)`,
        },
        {
          key: "dayExpenses",
          label: dayExpensesCheck.label,
          ok: dayExpensesCheck.ok,
          error: dayExpensesCheck.error,
          detail: `${dayExpenses.length} gasto(s) de hoy`,
        },
      ],
      counts: {
        orders: orders.length,
        activeOrders: orders.filter(
          (order) =>
            order?.status !== "Entregado" &&
            order?.status !== "Cancelado"
        ).length,
        deliveryZones: deliveryZones.length,
        activeDeliveryZones: deliveryZones.filter(
          (zone) => zone?.isActive !== false
        ).length,
        dayCloses: dayCloses.length,
        dayExpenses: dayExpenses.length,
      },
    })
  } catch (error) {
    captureError(error, {
      route: "/api/local-support/status",
      action: "GET",
    })

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo revisar el soporte privado",
      },
      {
        status: 500,
      }
    )
  }
}
