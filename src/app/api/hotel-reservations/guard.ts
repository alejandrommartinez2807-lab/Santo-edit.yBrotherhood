import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard compartido por las rutas de reservas hoteleras: valida rol + el módulo
// `hotelReservations`. Mismo patrón que el guard de reservas de restaurante.

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

export function forbiddenResponse(message = "Esta clave no tiene permiso para usar reservas del hotel") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkHotelReservationsAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "hotelReservations")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(businessConfig, "hotelReservations")

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Reservas del hotel está disponible desde ${moduleAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Reservas del hotel está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
