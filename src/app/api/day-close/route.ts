import { NextRequest, NextResponse } from "next/server"
import {
  clearPaymentProofs,
  getBusinessConfig,
  getOrders,
  getPaymentProofs,
  isTrainingModeActive,
  markDayExpensesClosed,
  findRecentDayClose,
  saveDayClose,
  type SaveDayCloseInput,
} from "@/lib/orders"
import { captureError } from "@/lib/monitoring"
import { getDisplayOrderNumber } from "@/lib/localOrderHelpers"
import { getOrderPayment, getOrderTotals } from "@/lib/localOrderMoney"
import {
  CANCEL_REFUND_DEFAULT,
  inferCancelOriginFromNote,
  parseCancelNote,
} from "@/lib/orderCancellationInfo"
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalRole,
} from "@/lib/localAccess"
import { getModulePlanAccess } from "@/lib/localPlans"
import { resolveBranchId } from "@/lib/branch"
import { writeAuditLog } from "@/lib/audit"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Tope de pedidos que caben en la fotografía del cierre. Existe para que la
// fila JSONB de day_closes no crezca sin control.
const SNAPSHOT_ORDERS_LIMIT = 500

type SaveDayCloseInputWithDeliveryAudit = SaveDayCloseInput & {
  deliveryTotalRegisteredUSD?: number
  deliveryWithPaymentMethodUSD?: number
  deliveryWithoutPaymentMethodUSD?: number
}

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function getAccess(request: NextRequest) {
  return getRequestAccess(request, getRequestPassword(request))
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "No autorizado",
    },
    {
      status: 401,
    }
  )
}

function forbiddenResponse(message = "Esta clave no tiene permiso para guardar el cierre del día") {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  )
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getAccess(request)

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
      role: null,
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
    }
  }

  // Permisos PERSONALIZADOS además del rol (QA 2026-07-30): cerrar la caja del
  // día es de las cosas que el dueño quiere poder quitarle a alguien sin
  // cambiarle el rol entero.
  if (!canLocalAccessUseModule(access, "cashier")) {
    return {
      ok: false as const,
      response: forbiddenResponse("Este usuario no tiene permiso para Caja"),
      role: access.role,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    access,
  }
}

function toNumber(value: unknown) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeSummaryItems(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((item) => ({
    label: String(item?.label || "").trim() || "Sin nombre",
    count: toNumber(item?.count),
    totalUSD: toNumber(item?.totalUSD),
    totalVES: toNumber(item?.totalVES),
    totalCombosUSD: toNumber(item?.totalCombosUSD),
    totalRegularUSD: toNumber(item?.totalRegularUSD),
    totalRegularVES: toNumber(item?.totalRegularVES),
    deliveryCostUSD: toNumber(item?.deliveryCostUSD),
  }))
}

function normalizeFiscalIvaByRate(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((item) => ({
    rate: toNumber(item?.rate),
    baseUSD: toNumber(item?.baseUSD),
    ivaUSD: toNumber(item?.ivaUSD),
  }))
}

function normalizeProductsSold(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((item) => ({
    name: String(item?.name || "").trim() || "Producto",
    quantity: toNumber(item?.quantity),
    totalUSD: toNumber(item?.totalUSD),
    totalVES: toNumber(item?.totalVES),
    onlyCurrency: Boolean(item?.onlyCurrency),
  }))
}

function normalizeExpenses(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((item) => ({
    id: String(item?.id || "").trim(),
    dateLabel: String(item?.dateLabel || "").trim(),
    dateValue: String(item?.dateValue || "").trim(),
    concept: String(item?.concept || "").trim() || "Gasto",
    category: String(item?.category || "Otros").trim() || "Otros",
    amountUSD: toNumber(item?.amountUSD),
    amountVES: toNumber(item?.amountVES),
    equivalentUSD: toNumber(item?.equivalentUSD),
    method: String(item?.method || "Sin registrar").trim() || "Sin registrar",
    note: String(item?.note || "").trim(),
    createdAt: String(item?.createdAt || "").trim(),
  }))
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-day-close-post",
    limit: 12,
    windowMs: 60_000,
    envMaxBytes: "DAY_CLOSE_POST_MAX_BYTES",
    maxBytes: 2_000_000,
    minBytes: 128_000,
    hardMaxBytes: 5_000_000,
    rateLimitMessage: "Demasiados intentos de guardar cierres. Espera unos segundos e intenta nuevamente.",
    sizeLimitMessage: "El cierre es demasiado grande. Reduce el detalle exportado e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = checkRole(request, ["owner", "manager"])

    if (!access.ok) {
      return access.response
    }

    const businessConfig = await getBusinessConfig()
    const businessConfigRecord =
      businessConfig as unknown as Record<string, unknown>

    // Modo entrenamiento (P0 #10, 2026-07-24): GET /api/orders devuelve solo
    // pedidos de práctica mientras está activo, así que los totales del cierre
    // serían de mentira. Se rechaza con instrucción clara.
    if (isTrainingModeActive(businessConfig)) {
      return NextResponse.json(
        {
          error:
            "El modo entrenamiento está activo: los totales serían de práctica. Desactívalo en Configuración antes de guardar el cierre.",
        },
        { status: 409 },
      )
    }

    const historyAccess = getModulePlanAccess(businessConfigRecord, "history")

    if (!historyAccess.includedInPlan) {
      return forbiddenResponse(
        "Historial de cierres no está incluido en el plan activo. Solicita activación o sube el plan para guardar cierres."
      )
    }

    if (!historyAccess.effectiveEnabled) {
      return forbiddenResponse(
        "Historial de cierres está desactivado desde Configuración del negocio."
      )
    }

    const cashierAccess = getModulePlanAccess(businessConfigRecord, "cashier")
    const deliveryAccess = getModulePlanAccess(businessConfigRecord, "delivery")
    const expensesAccess = getModulePlanAccess(businessConfigRecord, "expenses")

    const supplierPurchasesAccess = getModulePlanAccess(
      businessConfigRecord,
      "supplierPurchases",
    )

    const canIncludeCashierAudit = cashierAccess.effectiveEnabled
    const canIncludeDeliveryAudit = deliveryAccess.effectiveEnabled
    const canIncludeExpensesAudit = expensesAccess.effectiveEnabled
    const canIncludeSupplierPayments = supplierPurchasesAccess.effectiveEnabled

    const body = await request.json()
    const rawDayClose = body.dayClose || body.closeSummary || body

    const summaryText = String(rawDayClose.summaryText || "").trim()

    if (!summaryText) {
      return NextResponse.json(
        {
          error: "Falta el resumen del cierre",
        },
        {
          status: 400,
        }
      )
    }

    const dayClose: SaveDayCloseInputWithDeliveryAudit = {
      id: String(rawDayClose.id || "").trim() || undefined,
      createdAt: String(rawDayClose.createdAt || "").trim() || undefined,
      dateLabel: String(rawDayClose.dateLabel || "").trim(),
      summaryText,

      ordersRegistered: toNumber(rawDayClose.ordersRegistered),
      activeOrders: toNumber(rawDayClose.activeOrders),
      deliveredOrders: toNumber(rawDayClose.deliveredOrders),
      canceledOrders: toNumber(rawDayClose.canceledOrders),
      // Dinero de anulados (política 2026-07-29): "se quedó" = en la gaveta,
      // línea aparte del cierre; "devuelto" = fuera del cierre, solo informa.
      cancelledKeptUSD: toNumber(rawDayClose.cancelledKeptUSD),
      cancelledKeptCount: toNumber(rawDayClose.cancelledKeptCount),
      cancelledRefundedUSD: toNumber(rawDayClose.cancelledRefundedUSD),
      cancelledRefundedCount: toNumber(rawDayClose.cancelledRefundedCount),
      deliveryRegistered: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryRegistered)
        : 0,
      deliveryDelivered: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryDelivered)
        : 0,
      deliveryActive: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryActive)
        : 0,

      totalConfirmedUSD: toNumber(rawDayClose.totalConfirmedUSD),
      productSalesUSD: toNumber(rawDayClose.productSalesUSD),
      combosUSD: toNumber(rawDayClose.combosUSD),
      regularUSD: toNumber(rawDayClose.regularUSD),
      regularVES: toNumber(rawDayClose.regularVES),
      deliveryCollectedUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryCollectedUSD)
        : 0,

      pendingTotalUSD: toNumber(rawDayClose.pendingTotalUSD),
      pendingCombosUSD: toNumber(rawDayClose.pendingCombosUSD),
      pendingRegularUSD: toNumber(rawDayClose.pendingRegularUSD),
      pendingRegularVES: toNumber(rawDayClose.pendingRegularVES),
      pendingDeliveryUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.pendingDeliveryUSD)
        : 0,

      totalSoldUSD: canIncludeCashierAudit
        ? toNumber(rawDayClose.totalSoldUSD)
        : 0,
      realCollectedUSD: canIncludeCashierAudit
        ? toNumber(rawDayClose.realCollectedUSD)
        : 0,
      realCashUSD: canIncludeCashierAudit
        ? toNumber(rawDayClose.realCashUSD)
        : 0,
      realVES: canIncludeCashierAudit
        ? toNumber(rawDayClose.realVES)
        : 0,
      realVESEquivalentUSD: canIncludeCashierAudit
        ? toNumber(rawDayClose.realVESEquivalentUSD)
        : 0,
      realPendingUSD: canIncludeCashierAudit
        ? toNumber(rawDayClose.realPendingUSD)
        : 0,
      paidOrders: canIncludeCashierAudit
        ? toNumber(rawDayClose.paidOrders)
        : 0,
      partialPaymentOrders: canIncludeCashierAudit
        ? toNumber(rawDayClose.partialPaymentOrders)
        : 0,
      pendingPaymentOrders: canIncludeCashierAudit
        ? toNumber(rawDayClose.pendingPaymentOrders)
        : 0,

      deliveryTotalRegisteredUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryTotalRegisteredUSD)
        : 0,
      deliveryWithPaymentMethodUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryWithPaymentMethodUSD)
        : 0,
      deliveryWithoutPaymentMethodUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryWithoutPaymentMethodUSD)
        : 0,
      deliveryPaidInUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryPaidInUSD)
        : 0,
      deliveryPaidInVES: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryPaidInVES)
        : 0,
      deliveryPaidInVESEquivalentUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryPaidInVESEquivalentUSD)
        : 0,
      deliveryPaidMixedUSD: canIncludeDeliveryAudit
        ? toNumber(rawDayClose.deliveryPaidMixedUSD)
        : 0,

      fiscalOrders: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalOrders) : 0,
      fiscalSubtotalUSD: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalSubtotalUSD) : 0,
      fiscalIvaTotalUSD: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalIvaTotalUSD) : 0,
      fiscalIgtfBaseUSD: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalIgtfBaseUSD) : 0,
      fiscalIgtfUSD: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalIgtfUSD) : 0,
      fiscalTotalUSD: canIncludeCashierAudit ? toNumber(rawDayClose.fiscalTotalUSD) : 0,
      fiscalIvaByRate: canIncludeCashierAudit ? normalizeFiscalIvaByRate(rawDayClose.fiscalIvaByRate) : [],

      expensesCount: canIncludeExpensesAudit
        ? toNumber(rawDayClose.expensesCount)
        : 0,
      expensesTotalUSD: canIncludeExpensesAudit
        ? toNumber(rawDayClose.expensesTotalUSD)
        : 0,
      expensesCashUSD: canIncludeExpensesAudit
        ? toNumber(rawDayClose.expensesCashUSD)
        : 0,
      expensesVES: canIncludeExpensesAudit
        ? toNumber(rawDayClose.expensesVES)
        : 0,
      expensesVESEquivalentUSD: canIncludeExpensesAudit
        ? toNumber(rawDayClose.expensesVESEquivalentUSD)
        : 0,
      netEstimatedUSD: canIncludeExpensesAudit
        ? toNumber(rawDayClose.netEstimatedUSD)
        : canIncludeCashierAudit
          ? toNumber(rawDayClose.realCollectedUSD)
          : 0,
      expenses: canIncludeExpensesAudit
        ? normalizeExpenses(rawDayClose.expenses)
        : [],

      supplierPaymentsCount: canIncludeSupplierPayments
        ? toNumber(rawDayClose.supplierPaymentsCount)
        : 0,
      supplierPaymentsUSD: canIncludeSupplierPayments
        ? toNumber(rawDayClose.supplierPaymentsUSD)
        : 0,
      supplierPaymentsVES: canIncludeSupplierPayments
        ? toNumber(rawDayClose.supplierPaymentsVES)
        : 0,
      supplierPaymentsEquivalentUSD: canIncludeSupplierPayments
        ? toNumber(rawDayClose.supplierPaymentsEquivalentUSD)
        : 0,
      netAfterPurchasesUSD: canIncludeSupplierPayments
        ? toNumber(rawDayClose.netAfterPurchasesUSD)
        : toNumber(rawDayClose.netEstimatedUSD),

      salesByType: normalizeSummaryItems(rawDayClose.salesByType),
      deliveryByPayment: canIncludeDeliveryAudit
        ? normalizeSummaryItems(rawDayClose.deliveryByPayment)
        : [],
      deliveryByZone: canIncludeDeliveryAudit
        ? normalizeSummaryItems(rawDayClose.deliveryByZone)
        : [],
      paymentByStatus: canIncludeCashierAudit
        ? normalizeSummaryItems(rawDayClose.paymentByStatus)
        : [],
      paymentByUSDMethod: canIncludeCashierAudit
        ? normalizeSummaryItems(rawDayClose.paymentByUSDMethod)
        : [],
      paymentByVESMethod: canIncludeCashierAudit
        ? normalizeSummaryItems(rawDayClose.paymentByVESMethod)
        : [],
      deliveryByPaymentIn: canIncludeDeliveryAudit
        ? normalizeSummaryItems(rawDayClose.deliveryByPaymentIn)
        : [],
      salesBySeller: canIncludeCashierAudit
        ? normalizeSummaryItems(rawDayClose.salesBySeller)
        : [],
      ordersByRegistrar: normalizeSummaryItems(rawDayClose.ordersByRegistrar),
      productsSold: normalizeProductsSold(rawDayClose.productsSold),
    }

    const branchId = await resolveBranchId(request)

    // Fotografía del día DENTRO del cierre: cada pedido con sus productos y
    // los comprobantes con su pedido asociado. Se toma aquí (servidor) porque
    // el reinicio que sigue al cierre borra los pedidos vivos. No-fatal: si
    // la fotografía falla, el cierre con los totales se guarda igual.
    let snapshotWarning = ""
    // Pedidos que NO cupieron en la fotografía. Si es > 0, el panel no debe
    // dejar reiniciar: se borrarían sin quedar registrados en ninguna parte.
    let snapshotTruncated = 0
    try {
      const [ordersToday, proofsToday] = await Promise.all([
        getOrders(branchId),
        getPaymentProofs({}, branchId),
      ])

      const realOrders = ordersToday.filter((order) => order.isTraining !== true)
      const displayNumberByOrderId = new Map(
        realOrders.map((order) => [order.id, getDisplayOrderNumber(order)]),
      )

      // El tope existe para que la fila JSONB del cierre no crezca sin control,
      // pero recortaba EN SILENCIO: si el local llevaba dos días sin reiniciar
      // (o hizo doble turno) y había 640 pedidos vivos, la fotografía guardaba
      // 500 y el reinicio posterior borraba los 640. Esos 140 pedidos no
      // quedaban ni en `orders` ni en el cierre. Ahora se avisa, y el panel
      // bloquea el reinicio cuando pasa (auditoría 2026-08-02).
      if (realOrders.length > SNAPSHOT_ORDERS_LIMIT) {
        snapshotTruncated = realOrders.length - SNAPSHOT_ORDERS_LIMIT
      }

      dayClose.orders = realOrders.slice(0, SNAPSHOT_ORDERS_LIMIT).map((order) => {
        const payment = getOrderPayment(order)
        const orderTotals = getOrderTotals(order)
        // Detalle de anulación: columnas 0036 primero; pedidos anteriores a
        // la migración caen a la nota "ANULADO: … | Por: …" (parseCancelNote).
        const isCancelled = order.status === "Cancelado"
        const legacyNote = isCancelled
          ? parseCancelNote(order.customerNote)
          : { reason: "", cancelledBy: "" }
        const cancelReason = isCancelled
          ? String(order.cancelReason || "").trim() || legacyNote.reason
          : ""
        const cancelOrigin = isCancelled
          ? order.cancelOrigin || inferCancelOriginFromNote(order.customerNote)
          : ""
        const cancelledBy = isCancelled
          ? String(order.cancelledByName || "").trim() || legacyNote.cancelledBy
          : ""
        const cancelRefund =
          isCancelled && payment.receivedEquivalentUSD > 0
            ? order.cancelRefund || CANCEL_REFUND_DEFAULT
            : ""

        return {
          id: order.id,
          displayNumber: getDisplayOrderNumber(order),
          createdAt: String(order.createdAt || ""),
          customerName: String(order.customerName || "Cliente"),
          location: String(order.tableNumber || ""),
          orderType: String(order.orderType || ""),
          status: String(order.status || ""),
          paymentStatus: payment.status,
          totalUSD: orderTotals.totalUSD,
          receivedEquivalentUSD: payment.receivedEquivalentUSD,
          registeredBy: String(order.registeredByName || "") || undefined,
          ...(cancelReason ? { cancelReason } : {}),
          ...(cancelOrigin ? { cancelOrigin } : {}),
          ...(cancelledBy ? { cancelledBy } : {}),
          ...(isCancelled && order.cancelledByRole
            ? { cancelledByRole: order.cancelledByRole }
            : {}),
          ...(cancelRefund ? { cancelRefund } : {}),
          ...(cancelRefund && payment.receivedEquivalentUSD > 0
            ? { cancelRefundUSD: payment.receivedEquivalentUSD }
            : {}),
          ...(isCancelled && typeof order.cancelInventoryUsed === "boolean"
            ? { cancelInventoryUsed: order.cancelInventoryUsed }
            : {}),
          ...(String(order.openAccountId || "").trim()
            ? { openAccountId: String(order.openAccountId || "").trim() }
            : {}),
          items: (order.items || []).map((item) => ({
            name: String(item.name || "Producto"),
            quantity: Number(item.quantity || 0),
            priceUSD: Number(item.price || 0),
            selectionSummary: String(item.selectionSummary || "") || undefined,
          })),
        }
      })

      // Cobros por ORIGEN (pedido del dueño 2026-07-28): cuánto entró vía
      // cuentas de mesa (cobro de cuenta completa, que la caja reparte FIFO
      // entre los pedidos de la cuenta) y cuánto por pedidos directos. Lo
      // calcula el servidor sobre los pedidos reales para que el historial
      // no dependa de la versión del cliente que cerró.
      if (canIncludeCashierAudit) {
        const account = { count: 0, totalUSD: 0 }
        const direct = { count: 0, totalUSD: 0 }
        for (const order of realOrders) {
          if (order.status === "Cancelado") continue
          const received = getOrderPayment(order).receivedEquivalentUSD
          if (!(received > 0)) continue
          if (String(order.openAccountId || "").trim()) {
            account.count += 1
            account.totalUSD += received
          } else {
            direct.count += 1
            direct.totalUSD += received
          }
        }
        const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
        dayClose.collectionByOrigin = [
          {
            // count = pedidos cobrados vía cuenta; las cuentas distintas se
            // ven en la fotografía pedido por pedido (openAccountId).
            label: "Cobros de cuentas de mesa",
            count: account.count,
            totalUSD: round2(account.totalUSD),
          },
          {
            label: "Cobros directos (sin cuenta)",
            count: direct.count,
            totalUSD: round2(direct.totalUSD),
          },
        ]
      }

      dayClose.paymentProofs = proofsToday.slice(0, 500).map((proof) => ({
        orderId: proof.orderId,
        orderDisplayNumber: displayNumberByOrderId.get(proof.orderId) || "",
        customerName: proof.customerName,
        reportedMethod: proof.reportedMethod,
        amountReportedUSD: proof.amountReportedUSD,
        amountReportedVES: proof.amountReportedVES,
        paymentReference: proof.paymentReference,
        status: proof.status,
        createdAt: proof.createdAt,
        proofImageUrl: proof.proofImageUrl,
        proofFileId: proof.proofFileId,
      }))
    } catch (snapshotError) {
      // Sin fotografía: el cierre conserva los totales de siempre — pero el
      // fallo ya no es invisible (antes era un catch vacío, P1 #8).
      captureError(snapshotError, { route: "/api/day-close", action: "snapshot" })
      snapshotWarning =
        "El cierre se guardó sin la lista de pedidos/comprobantes del día (falló la fotografía)."
    }

    if (snapshotTruncated > 0) {
      snapshotWarning = `${snapshotTruncated} pedido${
        snapshotTruncated === 1 ? "" : "s"
      } no cabe${snapshotTruncated === 1 ? "" : "n"} en la lista guardada del cierre (el tope es ${SNAPSHOT_ORDERS_LIMIT}). NO reinicies los pedidos: se borrarían sin quedar registrados. Cierra primero los días atrasados.`
    }

    // Idempotencia: si esta misma jornada y sede ya se cerró hace un momento,
    // se devuelve ESE cierre en vez de crear otro con el mismo dinero. Cubre el
    // reintento tras un fallo del reinicio, la recarga de la pantalla y al
    // dueño repitiendo desde otro equipo. El doble turno legítimo (horas
    // después) sigue funcionando. Se puede forzar con allowDuplicate.
    const allowDuplicate = body?.allowDuplicate === true
    const existingClose = allowDuplicate
      ? null
      : await findRecentDayClose(dayClose.dateLabel, branchId)

    if (existingClose) {
      return NextResponse.json({
        ok: true,
        dayClose: existingClose,
        message: "Este día ya estaba cerrado: se devolvió el cierre guardado.",
        alreadyClosed: true,
        access: { role: access.role, moduleKey: "history" },
      })
    }

    const savedDayClose = await saveDayClose(dayClose, branchId)

    // P0 #5: los gastos incluidos quedan marcados como CERRADOS — un segundo
    // cierre del mismo día ya no los vuelve a restar. No-fatal pero visible.
    if (Array.isArray(dayClose.expenses) && dayClose.expenses.length) {
      try {
        await markDayExpensesClosed(
          dayClose.expenses.map((expense) => String(expense?.id || "")),
          savedDayClose.id,
          branchId,
        )
      } catch (markError) {
        captureError(markError, { route: "/api/day-close", action: "markExpensesClosed" })
      }
    }

    // Los comprobantes ya quedaron archivados dentro del cierre: se limpian
    // del panel para que el día siguiente arranque en cero (las imágenes en
    // Storage se conservan y los links del historial siguen funcionando).
    if (Array.isArray(dayClose.paymentProofs)) {
      try {
        // Se limpia solo HASTA el comprobante más nuevo que entró en la
        // fotografía. Lo que llegó después (mientras se guardaba el cierre, o
        // lo que quedó fuera del tope del snapshot) sigue en el panel al día
        // siguiente en vez de desaparecer sin registro (auditoría 2026-08-02).
        const archivedUntil = dayClose.paymentProofs
          .map((proof) => String(proof?.createdAt || ""))
          .filter(Boolean)
          .sort()
          .at(-1)

        await clearPaymentProofs(branchId, { createdUntil: archivedUntil || null })
      } catch (clearError) {
        // Si la limpieza falla, los comprobantes siguen visibles en el panel;
        // nada se pierde — pero queda registrado (antes catch vacío).
        captureError(clearError, { route: "/api/day-close", action: "clearPaymentProofs" })
      }
    }

    await writeAuditLog({
      action: "day_close.saved",
      branchId,
      entityType: "day_close",
      entityId: savedDayClose.id,
      actor: getLocalAccessAuditActor(access.access),
      request,
      metadata: {
        realCollectedUSD: dayClose.realCollectedUSD,
        fiscalIvaTotalUSD: dayClose.fiscalIvaTotalUSD,
        fiscalIgtfUSD: dayClose.fiscalIgtfUSD,
        expensesTotalUSD: dayClose.expensesTotalUSD,
      },
    })

    return NextResponse.json({
      ok: true,
      dayClose: savedDayClose,
      message: "Cierre guardado correctamente.",
      ...(snapshotWarning ? { warning: snapshotWarning } : {}),
      // El panel lo usa para BLOQUEAR el reinicio: por encima del tope, borrar
      // los pedidos los haría desaparecer del todo.
      ...(snapshotTruncated > 0 ? { snapshotTruncated } : {}),
      access: {
        role: access.role,
        moduleKey: "history",
      },
      modules: {
        cashierAuditIncluded: canIncludeCashierAudit,
        deliveryAuditIncluded: canIncludeDeliveryAudit,
        expensesAuditIncluded: canIncludeExpensesAudit,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el cierre del día",
      },
      {
        status: 500,
      }
    )
  }
}
