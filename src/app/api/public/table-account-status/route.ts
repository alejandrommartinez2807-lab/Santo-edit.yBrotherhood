import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessConfig,
  getOpenAccounts,
  getReservations,
  normalizeLocalTablesConfig,
} from "@/lib/orders"
import { getModulePlanAccess } from "@/lib/localPlans"
import {
  findBlockingReservationForTable,
  getReservationNow,
} from "@/lib/reservationConflicts"
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
    const branchId = await resolveBranchId(request)

    // Reserva vigente "ahora" para esta mesa (módulo Reservas): el flujo del
    // cliente la muestra como ocupada durante su franja. Sin datos del cliente
    // que reservó — solo la franja.
    const reservationsAccess = getModulePlanAccess(config, "reservations")
    let reservedNow = false
    let reservationStart = ""
    let reservationEnd = ""

    if (reservationsAccess.effectiveEnabled && tableId) {
      const now = getReservationNow()
      const reservations = await getReservations(
        { date: now.date, status: "activa" },
        branchId
      )
      const blocking = findBlockingReservationForTable(reservations, tableId, now)

      if (blocking) {
        reservedNow = true
        reservationStart = blocking.startTime
        reservationEnd = blocking.endTime
      }
    }

    if (!openAccountsAccess.effectiveEnabled) {
      return noStoreResponse({
        ok: true,
        requestedTable,
        tableId,
        tableName,
        hasOpenAccount: false,
        openAccountsAvailable: false,
        reservedNow,
        reservationStart,
        reservationEnd,
      })
    }

    const openAccounts = await getOpenAccounts(
      { status: "Abierta" },
      branchId
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
      reservedNow,
      reservationStart,
      reservationEnd,
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
