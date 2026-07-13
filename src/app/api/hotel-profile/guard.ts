import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

function getRequestPassword(request: NextRequest) {
  return request.headers.get("x-local-password") || request.headers.get("x-admin-password") || ""
}

export async function checkHotelLandingAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }), role: null }
  }
  const forbidden = (message: string) => ({
    ok: false as const,
    response: NextResponse.json({ error: message }, { status: 403 }),
    role: access.role,
  })
  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "hotelLanding")) {
    return forbidden("Esta clave no tiene permiso para editar la página del hotel")
  }
  const businessConfig = await getBusinessConfig()
  const moduleAccess = getModulePlanAccess(businessConfig, "hotelLanding")
  if (!moduleAccess.includedInPlan) return forbidden(`La página del hotel está disponible desde ${moduleAccess.minimumPlanLabel}.`)
  if (!moduleAccess.effectiveEnabled) return forbidden("La página del hotel está desactivada para este negocio.")
  return { ok: true as const, response: null, role: access.role, businessConfig }
}
