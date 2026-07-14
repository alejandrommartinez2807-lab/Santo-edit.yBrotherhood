import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig } from "@/lib/orders"
import { canLocalAccessUseModule, getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"

function pw(request: NextRequest) {
  return request.headers.get("x-local-password") || request.headers.get("x-admin-password") || ""
}

export async function checkPaymentsAccess(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, pw(request))
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }), role: null }
  }
  const forbidden = (m: string) => ({ ok: false as const, response: NextResponse.json({ error: m }, { status: 403 }), role: access.role })
  if (!allowedRoles.includes(access.role) || !canLocalAccessUseModule(access, "onlinePayments")) {
    return forbidden("Esta clave no tiene permiso para pagos")
  }
  const businessConfig = await getBusinessConfig()
  const a = getModulePlanAccess(businessConfig, "onlinePayments")
  if (!a.includedInPlan) return forbidden(`Pagos está disponible desde ${a.minimumPlanLabel}.`)
  if (!a.effectiveEnabled) return forbidden("Pagos está desactivado para este negocio.")
  return { ok: true as const, response: null, role: access.role, businessConfig }
}
