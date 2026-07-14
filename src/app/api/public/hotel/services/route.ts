import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getResortServices } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json(data, { ...init, headers })
}

async function servicesEnabled() {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>
  const access = getModulePlanAccess(config, "resortServices")
  return access.includedInPlan && access.effectiveEnabled
}

// GET público: catálogo de servicios/actividades activos (spa, tours, eventos…)
// para mostrarlos en la landing del hotel. Solo campos vitrina, sin cupos.
export async function GET(request: NextRequest) {
  try {
    if (!(await servicesEnabled())) {
      return noStore({ ok: true, enabled: false, services: [] })
    }
    const branchId = await resolveBranchId(request)
    const all = await getResortServices(branchId)
    const services = all
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
      }))
    return noStore({ ok: true, enabled: true, services })
  } catch (error) {
    captureError(error, { route: "/api/public/hotel/services", action: "GET" })
    return noStore({ ok: true, enabled: false, services: [] })
  }
}
