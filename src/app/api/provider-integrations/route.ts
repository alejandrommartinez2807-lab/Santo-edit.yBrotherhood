import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, saveBusinessConfig } from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import {
  getProviderIntegrationDef,
  normalizeProviderIntegrations,
  PROVIDER_STATUSES,
  type ProviderIntegrationStatus,
} from "@/lib/providerIntegrations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Hotel · V8-E · Estado de los proveedores externos (fiscal/OTA/C2P/email).
// SIN secretos: solo el estado del trámite y notas del dueño; vive en
// business_config. Las tarjetas se muestran dentro de los módulos ya gateados
// (Facturación, Canales, Pagos online, CRM), por eso aquí solo se exige rol.

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const password =
    request.headers.get("x-local-password") || request.headers.get("x-admin-password") || ""
  const access = getRequestAccess(request, password)
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Esta clave no tiene permiso para las conexiones" }, { status: 403 }),
    }
  }
  return { ok: true as const, response: null }
}

export async function GET(request: NextRequest) {
  try {
    const access = checkRole(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const config = await getBusinessConfig()
    return NextResponse.json({ ok: true, providers: config.providerIntegrations })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las conexiones" },
      { status: 500 },
    )
  }
}

// POST: { providerId, status, notes } — actualiza UN proveedor.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-provider-integrations-post",
    limit: 30,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 100_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner", "manager"])
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const providerId = String(body.providerId || "").trim()
    const def = getProviderIntegrationDef(providerId)
    if (!def) return NextResponse.json({ error: "Proveedor no reconocido" }, { status: 400 })

    const status = String(body.status || "").trim() as ProviderIntegrationStatus
    if (!PROVIDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Estado no válido" }, { status: 400 })
    }

    const config = await getBusinessConfig()
    const providers = normalizeProviderIntegrations({
      ...config.providerIntegrations,
      [def.id]: { status, notes: String(body.notes || "") },
    })
    await saveBusinessConfig({ providerIntegrations: providers })
    return NextResponse.json({ ok: true, providers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la conexión" },
      { status: 500 },
    )
  }
}
