import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard de las rutas de tarifas por temporada: valida rol + el módulo
// `rateSeasons`. Réplica del guard de habitaciones.

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

export function forbiddenResponse(message = "Esta clave no tiene permiso para usar tarifas por temporada") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkRateSeasonsAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "rateSeasons")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const rateSeasonsAccess = getModulePlanAccess(businessConfig, "rateSeasons")

  if (!rateSeasonsAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Tarifas por temporada está disponible desde ${rateSeasonsAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!rateSeasonsAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Tarifas por temporada está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
