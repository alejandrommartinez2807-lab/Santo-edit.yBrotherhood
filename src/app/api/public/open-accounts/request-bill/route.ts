import { NextRequest, NextResponse } from "next/server"
import { getBusinessConfig, getOpenAccounts, setOpenAccountBillRequested } from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { sendStaffAlertPush } from "@/lib/orderPushNotifications"
import {
  cleanPublicTableText,
  findOpenAccountForPublicTable,
  normalizePublicTableLookup,
} from "@/lib/publicLocalTableAccounts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import {
  enforceRequestSizeLimit,
  enforceSameOriginRequest,
  getEnvByteLimit,
} from "@/lib/requestGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// "Pedir la cuenta" desde el teléfono del cliente: marca la cuenta abierta de
// su mesa como pedida (badge en caja/mesonero + push al staff). Idempotente:
// pedirla dos veces conserva la hora original. No expone datos de la cuenta.

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return NextResponse.json(data, { ...init, headers })
}

export async function POST(request: NextRequest) {
  const originGuardResponse = enforceSameOriginRequest(
    request,
    undefined,
    "api-public-request-bill-post",
  )

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("PUBLIC_OPEN_ACCOUNT_POST_MAX_BYTES", 32_000, {
      minBytes: 8_000,
      maxBytes: 128_000,
    }),
    message: "La solicitud es demasiado grande.",
    route: "api-public-request-bill-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  // Tope por IP, generoso: frena a un atacante que invente nombres de mesa,
  // pero deja pasar al local entero. En un restaurante TODOS los teléfonos
  // salen por la misma IP (el WiFi del local, o el CGNAT del operador), así
  // que un límite bajo por IP dejaba sin pedir la cuenta a las demás mesas.
  const ipLimitResponse = enforceRateLimit(request, {
    id: "api-public-request-bill-post",
    limit: 60,
    windowMs: 60_000,
    message: "Hay demasiadas solicitudes desde esta conexión. Espera un momento, por favor.",
  })

  if (ipLimitResponse) return ipLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const requestedTable =
      cleanPublicTableText(body.mesa) ||
      cleanPublicTableText(body.table) ||
      cleanPublicTableText(body.tableNumber)

    if (!requestedTable || requestedTable.length > 80) {
      return noStoreResponse(
        { ok: false, error: "Indica la mesa de tu cuenta" },
        { status: 400 },
      )
    }

    // Freno de verdad: POR MESA. Martillar el botón en la Mesa 3 no puede
    // dejar muda a la Mesa 4. La petición ya es idempotente (repetirla
    // conserva la hora y no vuelve a mandar push), así que el límite solo
    // existe para que nadie ametralle al staff con avisos nuevos.
    const tableLimitResponse = enforceRateLimit(request, {
      id: `api-public-request-bill-post:${normalizePublicTableLookup(requestedTable)}`,
      limit: 6,
      windowMs: 60_000,
      message: "Ya avisamos al personal. Espera un momento, por favor.",
    })

    if (tableLimitResponse) return tableLimitResponse

    const businessConfig = await getBusinessConfig()
    const config = businessConfig as unknown as Record<string, unknown>
    const openAccountsAccess = getModulePlanAccess(config, "openAccounts")

    if (!openAccountsAccess.effectiveEnabled) {
      return noStoreResponse(
        { ok: false, error: "Las cuentas abiertas no están disponibles" },
        { status: 403 },
      )
    }

    const branchId = await resolveBranchId(request)
    const openAccounts = await getOpenAccounts({ status: "Abierta" }, branchId)
    const openAccount = findOpenAccountForPublicTable(openAccounts, requestedTable)

    if (!openAccount) {
      return noStoreResponse(
        { ok: false, error: "Esta mesa no tiene una cuenta abierta" },
        { status: 404 },
      )
    }

    const result = await setOpenAccountBillRequested(openAccount.id, true, branchId)

    if (!result) {
      return noStoreResponse(
        { ok: false, error: "Esta mesa no tiene una cuenta abierta" },
        { status: 404 },
      )
    }

    // Push a los equipos del staff de la sede (mejor esfuerzo): el badge del
    // panel llega igual por el sondeo aunque el push no esté configurado.
    if (!result.alreadyRequested) {
      await sendStaffAlertPush(branchId, {
        title: `🔔 ${openAccount.tableNumber} pide la cuenta`,
        body: `Pendiente por cobrar: $${Number(openAccount.pendingUSD || 0).toFixed(2)}.`,
        url: "/local-santo/caja",
      })
    }

    return noStoreResponse({
      ok: true,
      alreadyRequested: result.alreadyRequested,
      requestedAt: result.requestedAt,
      tableName: openAccount.tableNumber,
    })
  } catch (error) {
    captureError(error, { route: "/api/public/open-accounts/request-bill", action: "POST" })

    return noStoreResponse(
      { ok: false, error: "No se pudo avisar al personal. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
