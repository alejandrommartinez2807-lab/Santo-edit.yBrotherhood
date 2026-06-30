import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

// Guard compartido por las rutas de proveedores: valida rol + el módulo
// `suppliers` (suppliersModuleEnabled / inclusión en el plan).

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

export function forbiddenResponse(message = "Esta clave no tiene permiso para usar proveedores") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function checkSuppliersAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return { ok: false as const, response: unauthorizedResponse(), role: null }
  }

  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "suppliers")) {
    return { ok: false as const, response: forbiddenResponse(), role: access.role }
  }

  const businessConfig = await getBusinessConfig()
  const suppliersAccess = getModulePlanAccess(businessConfig, "suppliers")

  if (!suppliersAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        `Proveedores está disponible desde ${suppliersAccess.minimumPlanLabel}.`
      ),
      role: access.role,
    }
  }

  if (!suppliersAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse("Proveedores está desactivado para este negocio."),
      role: access.role,
    }
  }

  return { ok: true as const, response: null, role: access.role, businessConfig }
}
