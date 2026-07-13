import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard compartido por las rutas de habitaciones: valida rol + el módulo
// `rooms` (roomsModuleEnabled / inclusión en el plan). Réplica del guard de
// reservas para mantener el mismo patrón de acceso.

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

export function forbiddenResponse(message = "Esta clave no tiene permiso para usar habitaciones") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkRoomsAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "rooms")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const roomsAccess = getModulePlanAccess(businessConfig, "rooms")

  if (!roomsAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Habitaciones está disponible desde ${roomsAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!roomsAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Habitaciones está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
