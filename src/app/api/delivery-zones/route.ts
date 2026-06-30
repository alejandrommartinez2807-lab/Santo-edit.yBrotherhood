import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getDeliveryZones,
  saveDeliveryZones,
  type DeliveryZone,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

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

  if (!allowedRoles.includes(access.role)) {
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
  }
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function cleanCost(value: unknown) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : NaN
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normalizeDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const deliveryZones: DeliveryZone[] = []

  value.forEach((zone) => {
    const name = cleanText(zone?.name)
    const costUSD = cleanCost(zone?.costUSD)
    const key = normalizeComparableText(name)

    if (!name || !key || seen.has(key) || !Number.isFinite(costUSD)) {
      return
    }

    seen.add(key)

    deliveryZones.push({
      name,
      costUSD,
      isActive: zone?.isActive !== false,
    })
  })

  return deliveryZones
}

async function getDeliveryModuleAccess() {
  const businessConfig = await getBusinessConfig()
  const businessConfigRecord = businessConfig as unknown as Record<string, unknown>
  const moduleAccess = getModulePlanAccess(businessConfigRecord, "delivery")

  return {
    businessConfig,
    moduleAccess,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { moduleAccess } = await getDeliveryModuleAccess()

    if (!moduleAccess.effectiveEnabled) {
      return NextResponse.json({
        deliveryZones: [],
        module: {
          key: "delivery",
          includedInPlan: moduleAccess.includedInPlan,
          enabledByOwner: moduleAccess.enabledByOwner,
          effectiveEnabled: moduleAccess.effectiveEnabled,
          lockedByPlan: moduleAccess.lockedByPlan,
          message: moduleAccess.lockedByPlan
            ? "Delivery no está incluido en el plan activo."
            : "Delivery está desactivado desde la configuración del negocio.",
        },
      })
    }

    const deliveryZones = await getDeliveryZones(await resolveBranchId(request))

    return NextResponse.json({
      deliveryZones,
      module: {
        key: "delivery",
        includedInPlan: moduleAccess.includedInPlan,
        enabledByOwner: moduleAccess.enabledByOwner,
        effectiveEnabled: moduleAccess.effectiveEnabled,
        lockedByPlan: moduleAccess.lockedByPlan,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las zonas de delivery",
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-delivery-zones-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Demasiados cambios de zonas de delivery. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const access = checkRole(request, ["owner"])

    if (!access.ok) {
      return access.response
    }

    const { moduleAccess } = await getDeliveryModuleAccess()

    if (!moduleAccess.effectiveEnabled) {
      return forbiddenResponse(
        moduleAccess.lockedByPlan
          ? "Delivery no está incluido en el plan activo. Solicita activación para configurar zonas de delivery."
          : "Delivery está desactivado desde la configuración del negocio. Actívalo antes de editar zonas."
      )
    }

    const body = await request.json()
    const deliveryZones = normalizeDeliveryZones(body.deliveryZones)

    if (!deliveryZones.length) {
      return NextResponse.json(
        {
          error: "Debes dejar al menos una zona de delivery",
        },
        {
          status: 400,
        }
      )
    }

    const savedDeliveryZones = await saveDeliveryZones(deliveryZones, await resolveBranchId(request))

    return NextResponse.json({
      deliveryZones: savedDeliveryZones,
      access: {
        role: access.role,
      },
      module: {
        key: "delivery",
        includedInPlan: moduleAccess.includedInPlan,
        enabledByOwner: moduleAccess.enabledByOwner,
        effectiveEnabled: moduleAccess.effectiveEnabled,
        lockedByPlan: moduleAccess.lockedByPlan,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar las zonas de delivery",
      },
      {
        status: 500,
      }
    )
  }
}
