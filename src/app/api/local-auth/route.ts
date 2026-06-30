import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import {
  canLocalAccessUseModule,
  getRequestAccess,
  isKnownLocalModuleKey,
  type LocalModuleKey,
} from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { captureError } from "@/lib/monitoring"
import { enforceRateLimit } from "@/lib/rateLimit"
import { enforceSameOriginRequest } from "@/lib/requestGuards"
import { touchStaffLastAccess } from "@/lib/staffUsers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

function localAuthResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"])

  return NextResponse.json(data, {
    ...init,
    headers,
  })
}

function readPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function readModuleKey(request: NextRequest): LocalModuleKey {
  const rawModuleKey = request.nextUrl.searchParams.get("moduleKey") || "mainPanel"

  if (isKnownLocalModuleKey(rawModuleKey)) {
    return rawModuleKey
  }

  return "mainPanel"
}

async function handleLocalAuth(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-local-auth",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiados intentos de acceso. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-local-auth")

  if (originGuardResponse) return originGuardResponse

  try {
    const password = readPassword(request)
    const moduleKey = readModuleKey(request)
    const localAccess = getRequestAccess(request, password)

    if (!localAccess.ok) {
      return localAuthResponse(
        {
          ok: false,
          error: "Clave no autorizada",
          access: {
            role: null,
            roleLabel: "",
            moduleKey,
            canAccessRole: false,
            moduleEnabled: false,
            includedInPlan: false,
            allowed: false,
          },
        },
        {
          status: 401,
        }
      )
    }

    const businessConfig = await getBusinessConfig()
    const businessConfigRecord = businessConfig as unknown as Record<string, unknown>

    const planAccess = getModulePlanAccess(businessConfigRecord, moduleKey)
    const includedInPlan = planAccess.includedInPlan
    const moduleEnabled = planAccess.enabledByOwner
    const effectiveEnabled = planAccess.effectiveEnabled
    const canAccessRole = canLocalAccessUseModule(localAccess, moduleKey)
    const allowed = effectiveEnabled && canAccessRole

    if (allowed && localAccess.staffId) {
      await touchStaffLastAccess(localAccess.staffId)
    }

    return localAuthResponse(
      {
        ok: allowed,
        error: allowed
          ? ""
          : !includedInPlan
            ? "Este módulo no está incluido en el plan activo"
            : !moduleEnabled
              ? "Módulo desactivado desde configuración"
              : "Esta clave no tiene acceso a este módulo",
        access: {
          role: localAccess.role,
          roleLabel: localAccess.roleLabel,
          staffId: localAccess.staffId || null,
          username: localAccess.username || "",
          displayName: localAccess.displayName || "",
          permissionsMode: localAccess.permissionsMode || "role",
          allowedModules: localAccess.allowedModules || [],
          allBranches: localAccess.allBranches !== false,
          allowedBranchIds: localAccess.allowedBranchIds || [],
          moduleKey,
          canAccessRole,
          moduleEnabled,
          enabledByOwner: planAccess.enabledByOwner,
          effectiveEnabled,
          includedInPlan,
          lockedByPlan: planAccess.lockedByPlan,
          allowed,
          plan: planAccess.plan,
          planLabel: planAccess.planLabel,
          planMode: planAccess.planMode,
          minimumPlan: planAccess.minimumPlan,
          minimumPlanLabel: planAccess.minimumPlanLabel,
        },
        businessConfig: {
          businessName: businessConfig.businessName,
        },
      },
      {
        status: allowed ? 200 : 403,
      }
    )
  } catch (error) {
    captureError(error, { route: "/api/local-auth", action: request.method })

    return localAuthResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo validar el acceso privado",
      },
      {
        status: 500,
      }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleLocalAuth(request)
}

export async function POST(request: NextRequest) {
  return handleLocalAuth(request)
}
