import { NextRequest, NextResponse } from "next/server"
import {
  createOpenAccount,
  getBusinessConfig,
  getOpenAccounts,
  normalizeLocalTablesConfig,
} from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import {
  cleanPublicTableText,
  findOpenAccountForPublicTable,
  getActivePublicLocalTables,
  resolvePublicLocalTable,
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

// Endpoint PÚBLICO para que un cliente abra la cuenta de su mesa al escanear
// el QR. No requiere contraseña del personal, pero sí valida que:
//   - el módulo de cuentas abiertas esté activo en el plan/config, y
//   - la mesa exista y esté activa.
// Es idempotente: si la mesa ya tiene una cuenta abierta, la devuelve en vez
// de fallar (así el cliente simplemente se suma a la cuenta existente).

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return NextResponse.json(data, { ...init, headers })
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-open-accounts-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiados intentos de abrir cuenta. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const originGuardResponse = enforceSameOriginRequest(request, undefined, "api-public-open-accounts-post")

  if (originGuardResponse) return originGuardResponse

  const sizeLimitResponse = enforceRequestSizeLimit(request, {
    maxBytes: getEnvByteLimit("PUBLIC_OPEN_ACCOUNT_POST_MAX_BYTES", 32_000, {
      minBytes: 8_000,
      maxBytes: 128_000,
    }),
    message: "La solicitud para abrir cuenta es demasiado grande.",
    route: "api-public-open-accounts-post",
  })

  if (sizeLimitResponse) return sizeLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const requestedTable =
      cleanPublicTableText(body.mesa) ||
      cleanPublicTableText(body.table) ||
      cleanPublicTableText(body.tableNumber)
    const customerName = cleanPublicTableText(body.customerName)
    const customerPhone = cleanPublicTableText(body.customerPhone)

    if (!requestedTable) {
      return noStoreResponse(
        { ok: false, error: "Indica la mesa para abrir la cuenta" },
        { status: 400 }
      )
    }

    // Tope anti-abuso de longitud (endpoint público)
    if (requestedTable.length > 80 || customerName.length > 120 || customerPhone.length > 40) {
      return noStoreResponse(
        { ok: false, error: "Datos demasiado largos" },
        { status: 400 }
      )
    }

    const businessConfig = await getBusinessConfig()
    const config = businessConfig as unknown as Record<string, unknown>
    const openAccountsAccess = getModulePlanAccess(config, "openAccounts")

    if (!openAccountsAccess.effectiveEnabled) {
      return noStoreResponse(
        {
          ok: false,
          error: "Las cuentas abiertas no están disponibles en este momento",
          openAccountsAvailable: false,
        },
        { status: 403 }
      )
    }

    const tables = getActivePublicLocalTables(
      normalizeLocalTablesConfig(config.localTables, [])
    )
    const resolvedTable = resolvePublicLocalTable(requestedTable, tables)

    if (tables.length > 0 && !resolvedTable) {
      return noStoreResponse(
        { ok: false, error: "Mesa no encontrada o inactiva", requestedTable },
        { status: 404 }
      )
    }

    const tableName = resolvedTable?.name || requestedTable

    // Si ya hay una cuenta abierta en esta mesa, la reutilizamos (idempotente)
    const branchId = await resolveBranchId(request)
    const openAccounts = await getOpenAccounts({ status: "Abierta" }, branchId)
    const existing = findOpenAccountForPublicTable(openAccounts, tableName)

    if (existing) {
      return noStoreResponse({
        ok: true,
        alreadyOpen: true,
        tableName,
        openAccount: existing,
      })
    }

    const openAccount = await createOpenAccount(
      {
        tableNumber: tableName,
        customerName: customerName || tableName,
        customerPhone: customerPhone || undefined,
        openedBy: "Cliente (QR)",
      },
      branchId,
    )

    return noStoreResponse(
      { ok: true, alreadyOpen: false, tableName, openAccount },
      { status: 201 }
    )
  } catch (error) {
    captureError(error, { route: "/api/public/open-accounts", action: "POST" })

    // El índice único puede saltar si dos clientes abren a la vez: reintenta
    // devolviendo la cuenta existente.
    return noStoreResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo abrir la cuenta",
      },
      { status: 400 }
    )
  }
}
