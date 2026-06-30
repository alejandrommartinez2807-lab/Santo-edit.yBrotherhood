import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getOpenAccounts,
  normalizeLocalTablesConfig,
} from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import {
  cleanPublicTableText,
  getActivePublicLocalTables,
  findOpenAccountForPublicTable,
  resolvePublicLocalTable,
} from "@/lib/publicLocalTableAccounts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

  return NextResponse.json(data, {
    ...init,
    headers,
  })
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-table-account-status-get",
    limit: 90,
    windowMs: 60_000,
    message: "Demasiadas consultas de mesa. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const requestedTable =
      cleanPublicTableText(request.nextUrl.searchParams.get("mesa")) ||
      cleanPublicTableText(request.nextUrl.searchParams.get("table")) ||
      cleanPublicTableText(request.nextUrl.searchParams.get("ubicacion")) ||
      cleanPublicTableText(request.nextUrl.searchParams.get("ubicación"))

    if (!requestedTable) {
      return noStoreResponse(
        {
          ok: false,
          error: "Indica la mesa que quieres consultar",
        },
        { status: 400 }
      )
    }

    const businessConfig = await getBusinessConfig()
    const config = businessConfig as unknown as Record<string, unknown>
    const openAccountsAccess = getModulePlanAccess(config, "openAccounts")
    const tables = getActivePublicLocalTables(
      normalizeLocalTablesConfig(config.localTables, [])
    )
    const resolvedTable = resolvePublicLocalTable(requestedTable, tables)

    if (tables.length > 0 && !resolvedTable) {
      return noStoreResponse(
        {
          ok: false,
          error: "Mesa no encontrada o inactiva",
          requestedTable,
          tableName: "",
          hasOpenAccount: false,
          openAccountsAvailable: openAccountsAccess.effectiveEnabled,
        },
        { status: 404 }
      )
    }

    const tableName = resolvedTable?.name || requestedTable
    const tableId = resolvedTable?.id || ""

    if (!openAccountsAccess.effectiveEnabled) {
      return noStoreResponse({
        ok: true,
        requestedTable,
        tableId,
        tableName,
        hasOpenAccount: false,
        openAccountsAvailable: false,
      })
    }

    const openAccounts = await getOpenAccounts(
      { status: "Abierta" },
      await resolveBranchId(request)
    )
    const openAccount = findOpenAccountForPublicTable(openAccounts, tableName)
    const hasOpenAccount = Boolean(openAccount)

    return noStoreResponse({
      ok: true,
      requestedTable,
      tableId,
      tableName,
      hasOpenAccount,
      openAccountsAvailable: true,
      openAccount: openAccount
        ? {
            id: openAccount.id,
            tableNumber: openAccount.tableNumber,
            customerName: openAccount.customerName,
            status: openAccount.status,
            totalEstimatedUSD: openAccount.totalEstimatedUSD,
            totalCollectedUSD: openAccount.totalCollectedUSD,
            pendingUSD: openAccount.pendingUSD,
            createdAt: openAccount.createdAt,
            updatedAt: openAccount.updatedAt,
            orders: Array.isArray(openAccount.orders) ? openAccount.orders : [],
          }
        : null,
    })
  } catch (error) {
    captureError(error, { route: "/api/public/table-account-status", action: "GET" })

    return noStoreResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el estado de la mesa",
      },
      { status: 500 }
    )
  }
}
