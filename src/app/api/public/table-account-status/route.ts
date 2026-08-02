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
import { getLocalTablesForBranch } from "@/lib/branchLocalTables"
import { getBillRequestedAt } from "@/lib/openAccountBillRequest"
import {
  cleanPublicTableText,
  getActivePublicLocalTables,
  findOpenAccountForPublicTable,
  resolvePublicLocalTable,
} from "@/lib/publicLocalTableAccounts"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"
import { isTableTokenEnabled, isValidTableToken } from "@/lib/tableAccessToken"

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

// PENDIENTE DE DECISIÓN DEL DUEÑO (auditoría 2026-08-02, severidad baja).
//
// Sigue siendo público y sin clave, y los nombres de mesa se adivinan solos
// ("Mesa 1", "Barra"): desde fuera del local se pueden recorrer todas las mesas
// de las dos sedes y leer, en vivo, cuánto lleva consumido cada una y qué pidió.
// No hay datos personales desde H-1, pero sí inteligencia comercial (ticket
// medio, ocupación, horas pico).
//
// Cerrarlo del todo exige cambiar el flujo del QR —meter un código en el enlace
// de la mesa, o atar la consulta al pedido del comensal— y Alejandro pidió
// medir el alcance y consultarle antes de tocarlo. El rate limit de abajo es lo
// que frena hoy el barrido sistemático.
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
    // Mesas de la SEDE del QR (H13): antes se validaba contra las globales.
    const branchIdForTables = await resolveBranchId(request)
    const tables = getActivePublicLocalTables(
      normalizeLocalTablesConfig(
        await getLocalTablesForBranch(branchIdForTables, config.localTables),
        []
      )
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

    // ¿Viene del QR de ESTA mesa? El token (?t=) va firmado con el secreto del
    // negocio y no se puede adivinar como sí se adivina "Mesa 1". Solo con él
    // se devuelven los montos y el detalle de lo consumido.
    //
    // Si el negocio no tiene ORDERS_API_SECRET configurado no hay firma posible
    // y exigirla dejaría a TODOS los comensales sin ver su cuenta, así que en
    // ese caso se mantiene el comportamiento anterior. El chequeo de "listo para
    // producción" avisa de que falta el secreto.
    const tableToken = String(request.nextUrl.searchParams.get("t") || "").trim()
    const hasTableToken =
      !isTableTokenEnabled() || isValidTableToken(tableToken, tableName, branchId)

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
      // Sin el token del QR, la respuesta NO lleva montos ni detalle de lo
      // consumido: solo si la mesa tiene cuenta abierta, que es lo que necesita
      // el comensal para unirse. Ver src/lib/tableAccessToken.ts.
      openAccountDetail: hasTableToken,
      openAccount: openAccount
        ? hasTableToken
          ? {
            id: openAccount.id,
            tableNumber: openAccount.tableNumber,
            // H-1 (2026-07-30): el NOMBRE del cliente ya no sale de aquí. Este
            // endpoint es público y sin clave, y los nombres de mesa se
            // adivinan solos ("Mesa 1", "Mesa 2", "Barra"), así que cualquiera
            // desde internet barría el local y sacaba quién está sentado en
            // cada mesa y cuánto debe. La pantalla del cliente NUNCA pintó este
            // dato —lo recibía y lo guardaba en una variable sin usar
            // (OpenAccountInfo.tsx)—, así que quitarlo no cambia nada de lo que
            // ve el comensal y elimina el dato más personal de la respuesta.
            // Los montos SÍ se quedan: son los que la mesa ve al pedir su
            // propia cuenta desde el teléfono.
            status: openAccount.status,
            // "" = nadie ha pedido la cuenta; ISO = desde cuándo está pedida.
            billRequestedAt: getBillRequestedAt(openAccount.note),
            totalEstimatedUSD: openAccount.totalEstimatedUSD,
            totalCollectedUSD: openAccount.totalCollectedUSD,
            pendingUSD: openAccount.pendingUSD,
            createdAt: openAccount.createdAt,
            updatedAt: openAccount.updatedAt,
            // …y tampoco en CADA PEDIDO. Quitar solo el nombre de la cuenta no
            // cerraba nada: la respuesta seguía trayendo el nombre repetido en
            // los 8 pedidos de la mesa (medido el 2026-07-30, "Carlos" en cada
            // uno). Se manda exactamente lo que la pantalla del cliente usa
            // para ver su propia cuenta —número, estado, montos y qué se
            // pidió— y nada más. `tableNumber` sobra: es la mesa que preguntó.
            orders: (Array.isArray(openAccount.orders) ? openAccount.orders : []).map(
              (order) => ({
                id: order.id,
                displayNumber: order.displayNumber,
                status: order.status,
                paymentStatus: order.paymentStatus,
                totalUSD: order.totalUSD,
                totalVES: order.totalVES,
                exchangeRate: order.exchangeRate,
                receivedEquivalentUSD: order.receivedEquivalentUSD,
                pendingUSD: order.pendingUSD,
                createdAt: order.createdAt,
                itemsText: order.itemsText,
                items: order.items,
              })
            ),
          }
          : {
              // Versión reducida (QR sin token, o barrido desde fuera): basta
              // para que la pantalla ofrezca "unirme a la cuenta de la mesa" y
              // no revela cuánto se lleva gastado ni qué se pidió.
              id: openAccount.id,
              tableNumber: openAccount.tableNumber,
              status: openAccount.status,
              billRequestedAt: getBillRequestedAt(openAccount.note),
              orders: [],
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
