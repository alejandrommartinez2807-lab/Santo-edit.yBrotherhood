import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard de la ruta de reportes del hotel: valida rol + el módulo `hotelReports`.
// Réplica del guard de habitaciones.

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

export function forbiddenResponse(message = "Esta clave no tiene permiso para ver los reportes del hotel") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkHotelReportsAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "hotelReports")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const hotelReportsAccess = getModulePlanAccess(businessConfig, "hotelReports")

  if (!hotelReportsAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Reportes del hotel está disponible desde ${hotelReportsAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!hotelReportsAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Reportes del hotel está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
