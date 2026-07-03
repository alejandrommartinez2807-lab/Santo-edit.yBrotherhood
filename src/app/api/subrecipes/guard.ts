import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard compartido por las rutas de subrecetas: valida rol + el módulo
// `subrecipes` (subrecipesModuleEnabled / inclusión en el plan).

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

export function forbiddenResponse(message = "Esta clave no tiene permiso para usar subrecetas") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkSubrecipesAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "subrecipes")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const subrecipesAccess = getModulePlanAccess(businessConfig, "subrecipes")

  if (!subrecipesAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Subrecetas está disponible desde ${subrecipesAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!subrecipesAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Subrecetas está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
