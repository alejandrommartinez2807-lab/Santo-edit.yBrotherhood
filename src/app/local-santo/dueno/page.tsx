"use client"

import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Search,
  TrendingUp,
  Truck,
  WalletCards,
  XCircle,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import type {
  DayCloseProductSold,
  DayCloseSummaryItem,
  DayExpense,
  DeliveryPaymentIn,
  LocalOrder,
  OrderItem,
  OrderPayment,
  PaymentStatus,
  SavedDayClose,
  SupplierPurchase,
} from "@/lib/orders"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

type DashboardRangeMode = "today" | "last7" | "custom"

type SavedDayCloseWithDeliveryAudit = SavedDayClose & {
  deliveryTotalRegisteredUSD?: number
  deliveryWithPaymentMethodUSD?: number
  deliveryWithoutPaymentMethodUSD?: number
}

type SummaryItem = {
  label: string
  count: number
  totalUSD: number
  totalVES?: number
  deliveryCostUSD?: number
}

type ProductSold = {
  name: string
  quantity: number
  totalUSD: number
  totalVES: number
  onlyCurrency: boolean
}

type DashboardReport = {
  label: string
  sourceCount: number

  ordersRegistered: number
  activeOrders: number
  deliveredOrders: number
  canceledOrders: number

  deliveryRegistered: number
  deliveryDelivered: number
  deliveryPending: number
  deliveryReportedToConfirm: number

  readyWithoutDelivered: number

  totalSoldUSD: number
  realCollectedUSD: number
  realCashUSD: number
  realVES: number
  realVESEquivalentUSD: number
  realPendingUSD: number

  paidOrders: number
  partialPaymentOrders: number
  pendingPaymentOrders: number

  deliveryTotalRegisteredUSD: number
  deliveryWithPaymentMethodUSD: number
  deliveryWithoutPaymentMethodUSD: number
  deliveryPaidInUSD: number
  deliveryPaidInVES: number
  deliveryPaidInVESEquivalentUSD: number
  deliveryPaidMixedUSD: number
  pendingDeliveryUSD: number

  expensesCount: number
  expensesTotalUSD: number
  expensesCashUSD: number
  expensesVES: number
  expensesVESEquivalentUSD: number
  netEstimatedUSD: number
  inventoryPurchaseCount: number
  inventoryPurchaseTotalUSD: number

  expensesByProvider: SummaryItem[]
  expensesByType: SummaryItem[]
  productsSold: ProductSold[]
  deliveryByZone: SummaryItem[]
  paymentByUSDMethod: SummaryItem[]
  paymentByVESMethod: SummaryItem[]
  deliveryByPaymentIn: SummaryItem[]
  paymentByStatus: SummaryItem[]
}

type DashboardAlertTone = "danger" | "warning" | "good" | "info"

type DashboardAlert = {
  title: string
  description: string
  value?: string
  tone: DashboardAlertTone
}

function toNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function roundMoney(value: unknown) {
  return toNumber(value)
}

function normalizeComparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      "No se pudieron leer los datos del negocio. Revisa que el acceso privado esté funcionando correctamente."
    )
  }
}

function getDateKeyInCaracas(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value || "0000"
  const month = parts.find((part) => part.type === "month")?.value || "00"
  const day = parts.find((part) => part.type === "day")?.value || "00"

  return `${year}-${month}-${day}`
}

function getTodayDateInputValue() {
  return getDateKeyInCaracas(new Date())
}

function getDateInputValueDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  return getDateKeyInCaracas(date)
}

function formatDate(value: string) {
  if (!value) return "Sin fecha"

  try {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(date)
  } catch {
    return value
  }
}

function formatShortDateKey(value: string) {
  if (!value) return "Sin fecha"

  try {
    const [year, month, day] = value.split("-")

    if (!year || !month || !day) return value

    return `${day}/${month}/${year}`
  } catch {
    return value
  }
}

function isComboItem(item: OrderItem) {
  return item.paymentMode === "divisa"
}

function isDeliveryOrder(order: LocalOrder) {
  return (
    order.orderType === "Delivery" ||
    order.tableNumber?.toLowerCase().startsWith("delivery") ||
    Boolean(
      order.customerPhone ||
        order.deliveryAddress ||
        order.deliveryReference ||
        order.deliveryZone
    )
  )
}

function cleanDeliveryLocation(value: string) {
  return value.replace(/^delivery\s*-\s*/i, "").trim()
}

function getDisplayTableNumber(order: LocalOrder) {
  if (isDeliveryOrder(order)) {
    const cleanZone = String(order.deliveryZone || "").trim()
    const cleanTableNumber = cleanDeliveryLocation(String(order.tableNumber || ""))

    return cleanZone || cleanTableNumber || "Delivery"
  }

  return order.tableNumber || "Sin ubicación"
}

function getOrderDeliveryCost(order: LocalOrder) {
  const savedCost = Number(order.deliveryCostUSD || 0)

  if (savedCost > 0) return savedCost
  if (!isDeliveryOrder(order)) return 0

  const normalizedZone = String(order.deliveryZone || order.tableNumber || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (normalizedZone.includes("trigalena")) return 2
  if (normalizedZone.includes("centro")) return 1
  if (normalizedZone.includes("prebo")) return 2.5
  if (normalizedZone.includes("naguanagua")) return 3
  if (normalizedZone.includes("samanes")) return 3
  if (normalizedZone.includes("san diego")) return 4

  return 0
}

function getOrderTotals(order: LocalOrder) {
  const exchangeRate = Number(order.exchangeRate || 0)
  const deliveryCostUSD = getOrderDeliveryCost(order)

  const itemTotals = Array.isArray(order.items)
    ? order.items.reduce(
        (totals, item) => {
          const subtotal = Number(item.price || 0) * Number(item.quantity || 0)

          if (isComboItem(item)) {
            totals.totalCombosUSD += subtotal
          } else {
            totals.totalRegularUSD += subtotal
          }

          return totals
        },
        {
          totalCombosUSD: 0,
          totalRegularUSD: 0,
        }
      )
    : {
        totalCombosUSD: 0,
        totalRegularUSD: 0,
      }

  const hasReadableItems = Array.isArray(order.items) && order.items.length > 0

  const totalCombosUSD = hasReadableItems
    ? itemTotals.totalCombosUSD
    : Number(order.totalCombosUSD ?? 0)

  const totalRegularUSD = hasReadableItems
    ? itemTotals.totalRegularUSD
    : Number(order.totalRegularUSD ?? 0)

  const totalRegularVES = hasReadableItems
    ? totalRegularUSD * exchangeRate
    : Number(order.totalRegularVES ?? order.totalVES ?? totalRegularUSD * exchangeRate)

  const totalBeforeDeliveryUSD = totalCombosUSD + totalRegularUSD
  const totalUSD = totalBeforeDeliveryUSD + deliveryCostUSD

  return {
    totalUSD: roundMoney(totalUSD),
    totalCombosUSD: roundMoney(totalCombosUSD),
    totalRegularUSD: roundMoney(totalRegularUSD),
    totalRegularVES: roundMoney(totalRegularVES),
    deliveryCostUSD: roundMoney(deliveryCostUSD),
    totalBeforeDeliveryUSD: roundMoney(totalBeforeDeliveryUSD),
  }
}

function calculatePaymentStatus(
  receivedEquivalentUSD: number,
  totalOrderUSD: number
): PaymentStatus {
  const received = roundMoney(receivedEquivalentUSD)
  const total = roundMoney(totalOrderUSD)

  if (received <= 0) return "Pendiente"
  if (received >= total - 0.01) return "Pagado"

  return "Pago parcial"
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === "Pago parcial" || value === "Pagado") return value

  return "Pendiente"
}

function normalizeDeliveryPaymentIn(value: unknown): DeliveryPaymentIn {
  const normalized = normalizeComparableText(String(value || ""))

  if (normalized === "divisas" || normalized === "divisa") return "Divisas"
  if (
    normalized === "bolivares" ||
    normalized === "bolivar" ||
    normalized === "bs" ||
    normalized === "ves"
  ) {
    return "Bolívares"
  }

  if (normalized === "mixto" || normalized === "mixta") return "Mixto"

  return "Sin registrar"
}

function normalizePaymentMethodUSD(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "divisas sin metodo"
  ) {
    return ""
  }

  if (
    normalized === "efectivo divisas" ||
    normalized === "efectivo en divisas" ||
    normalized === "divisas" ||
    normalized === "divisa" ||
    normalized === "dolares" ||
    normalized === "dolares efectivo" ||
    normalized === "usd" ||
    normalized === "cash" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo divisas"
  }

  if (normalized.includes("zelle")) return "Zelle"

  if (
    normalized.includes("binance") ||
    normalized.includes("usdt") ||
    normalized.includes("tether")
  ) {
    return "Binance / USDT"
  }

  if (
    normalized.includes("transferencia internacional") ||
    normalized.includes("transferencia externa") ||
    normalized.includes("wire")
  ) {
    return "Transferencia internacional"
  }

  return "Otro"
}

function normalizePaymentMethodVES(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "bolivares sin metodo"
  ) {
    return ""
  }

  if (
    normalized === "pago movil" ||
    normalized === "pagomovil" ||
    normalized.includes("pago movil") ||
    normalized.includes("movil")
  ) {
    return "Pago móvil"
  }

  if (normalized.includes("punto")) return "Punto"
  if (normalized.includes("transferencia")) return "Transferencia"

  if (
    normalized === "efectivo bs" ||
    normalized === "efectivo bolivares" ||
    normalized === "bolivares" ||
    normalized === "bs" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo Bs"
  }

  if (normalized.includes("biopago") || normalized.includes("bio pago")) {
    return "Biopago"
  }

  return "Otro"
}

function getOrderPayment(order: LocalOrder): OrderPayment {
  const orderTotals = getOrderTotals(order)
  const savedPayment = order.payment

  const totalOrderUSD = roundMoney(
    savedPayment?.totalOrderUSD ??
      order.paymentTotalOrderUSD ??
      orderTotals.totalUSD
  )

  const receivedEquivalentUSD = roundMoney(
    savedPayment?.receivedEquivalentUSD ??
      order.paymentReceivedEquivalentUSD ??
      0
  )

  const calculatedStatus = calculatePaymentStatus(
    receivedEquivalentUSD,
    totalOrderUSD
  )

  const status = normalizePaymentStatus(
    savedPayment?.status ?? order.paymentStatus ?? calculatedStatus
  )

  const pendingUSD =
    status === "Pagado"
      ? 0
      : roundMoney(
          savedPayment?.pendingUSD ??
            order.paymentPendingUSD ??
            Math.max(totalOrderUSD - receivedEquivalentUSD, 0)
        )

  return {
    status,
    amountReceivedUSD: roundMoney(
      savedPayment?.amountReceivedUSD ?? order.amountReceivedUSD ?? 0
    ),
    amountReceivedVES: roundMoney(
      savedPayment?.amountReceivedVES ?? order.amountReceivedVES ?? 0
    ),
    paymentMethodUSD: normalizePaymentMethodUSD(
      savedPayment?.paymentMethodUSD ?? order.paymentMethodUSD ?? ""
    ),
    paymentMethodVES: normalizePaymentMethodVES(
      savedPayment?.paymentMethodVES ?? order.paymentMethodVES ?? ""
    ),
    deliveryPaymentIn: normalizeDeliveryPaymentIn(
      savedPayment?.deliveryPaymentIn ?? order.deliveryPaymentIn
    ),
    paymentNote: String(savedPayment?.paymentNote ?? order.paymentNote ?? ""),
    totalOrderUSD,
    receivedEquivalentUSD,
    pendingUSD,
    updatedAt: String(savedPayment?.updatedAt ?? order.paymentUpdatedAt ?? ""),
  }
}

function shouldShowAsActive(order: LocalOrder) {
  return order.status !== "Entregado" && order.status !== "Cancelado"
}

function createEmptyReport(label: string): DashboardReport {
  return {
    label,
    sourceCount: 0,

    ordersRegistered: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    canceledOrders: 0,

    deliveryRegistered: 0,
    deliveryDelivered: 0,
    deliveryPending: 0,
    deliveryReportedToConfirm: 0,

    readyWithoutDelivered: 0,

    totalSoldUSD: 0,
    realCollectedUSD: 0,
    realCashUSD: 0,
    realVES: 0,
    realVESEquivalentUSD: 0,
    realPendingUSD: 0,

    paidOrders: 0,
    partialPaymentOrders: 0,
    pendingPaymentOrders: 0,

    deliveryTotalRegisteredUSD: 0,
    deliveryWithPaymentMethodUSD: 0,
    deliveryWithoutPaymentMethodUSD: 0,
    deliveryPaidInUSD: 0,
    deliveryPaidInVES: 0,
    deliveryPaidInVESEquivalentUSD: 0,
    deliveryPaidMixedUSD: 0,
    pendingDeliveryUSD: 0,

    expensesCount: 0,
    expensesTotalUSD: 0,
    expensesCashUSD: 0,
    expensesVES: 0,
    expensesVESEquivalentUSD: 0,
    netEstimatedUSD: 0,
    inventoryPurchaseCount: 0,
    inventoryPurchaseTotalUSD: 0,

    expensesByProvider: [],
    expensesByType: [],
    productsSold: [],
    deliveryByZone: [],
    paymentByUSDMethod: [],
    paymentByVESMethod: [],
    deliveryByPaymentIn: [],
    paymentByStatus: [],
  }
}

function addSummaryToMap(
  map: Map<string, SummaryItem>,
  label: string,
  count: number,
  totalUSD: number,
  totalVES = 0,
  deliveryCostUSD = 0
) {
  const cleanLabel = label.trim() || "Sin registrar"
  const current = map.get(cleanLabel) || {
    label: cleanLabel,
    count: 0,
    totalUSD: 0,
    totalVES: 0,
    deliveryCostUSD: 0,
  }

  current.count += count
  current.totalUSD += roundMoney(totalUSD)
  current.totalVES = roundMoney((current.totalVES || 0) + roundMoney(totalVES))
  current.deliveryCostUSD = roundMoney(
    (current.deliveryCostUSD || 0) + roundMoney(deliveryCostUSD)
  )

  map.set(cleanLabel, current)
}

function summaryMapToArray(map: Map<string, SummaryItem>) {
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      count: toNumber(item.count),
      totalUSD: toNumber(item.totalUSD),
      totalVES: toNumber(item.totalVES),
      deliveryCostUSD: toNumber(item.deliveryCostUSD),
    }))
    .sort((a, b) => {
      if (b.totalUSD !== a.totalUSD) return b.totalUSD - a.totalUSD
      return b.count - a.count
    })
}


function getExpenseSource(expense: unknown): Record<string, unknown> {
  if (!expense || typeof expense !== "object") {
    return {}
  }

  return expense as Record<string, unknown>
}

function getExpenseText(expense: unknown, key: string) {
  const source = getExpenseSource(expense)

  return String(source[key] || "").trim()
}

function getExpenseProvider(expense: unknown) {
  return (
    getExpenseText(expense, "provider") ||
    getExpenseText(expense, "supplier") ||
    "Sin proveedor"
  )
}

function getExpenseType(expense: unknown) {
  return (
    getExpenseText(expense, "expenseType") ||
    getExpenseText(expense, "type") ||
    "Gasto operativo"
  )
}

function getExpenseEquivalentUSD(expense: unknown) {
  const source = getExpenseSource(expense)

  return toNumber(source.equivalentUSD)
}

function getExpenseAmountVES(expense: unknown) {
  const source = getExpenseSource(expense)

  return toNumber(source.amountVES)
}

function getExpenseInventoryItemName(expense: unknown) {
  return (
    getExpenseText(expense, "inventoryItemName") ||
    getExpenseText(expense, "itemName") ||
    getExpenseText(expense, "inventoryName")
  )
}

function getExpenseInventoryQuantity(expense: unknown) {
  const source = getExpenseSource(expense)

  return toNumber(source.inventoryQuantity)
}

function isInventoryLinkedExpense(expense: unknown) {
  const source = getExpenseSource(expense)
  const type = normalizeComparableText(getExpenseType(expense))
  const hasInventoryFlag =
    source.inventoryLinked === true ||
    String(source.inventoryLinked || "").toLowerCase() === "true"
  const hasInventoryData = Boolean(
    getExpenseText(expense, "inventoryItemId") ||
      getExpenseInventoryItemName(expense) ||
      getExpenseInventoryQuantity(expense) > 0
  )

  return (
    hasInventoryFlag ||
    hasInventoryData ||
    type.includes("inventario") ||
    type.includes("materia prima") ||
    type.includes("compra")
  )
}

function addExpenseToDashboardSummaries(
  expense: unknown,
  providerMap: Map<string, SummaryItem>,
  typeMap: Map<string, SummaryItem>
) {
  const provider = getExpenseProvider(expense)
  const expenseType = getExpenseType(expense)
  const amountUSD = getExpenseEquivalentUSD(expense)
  const amountVES = getExpenseAmountVES(expense)

  addSummaryToMap(providerMap, provider, 1, amountUSD, amountVES)
  addSummaryToMap(typeMap, expenseType, 1, amountUSD, amountVES)
}

function addExpensesToDashboardReport(
  report: DashboardReport,
  expenses: unknown[]
) {
  const providerMap = new Map<string, SummaryItem>()
  const typeMap = new Map<string, SummaryItem>()

  expenses.forEach((expense) => {
    addExpenseToDashboardSummaries(expense, providerMap, typeMap)

    if (isInventoryLinkedExpense(expense)) {
      report.inventoryPurchaseCount += 1
      report.inventoryPurchaseTotalUSD += getExpenseEquivalentUSD(expense)
    }
  })

  report.inventoryPurchaseCount = toNumber(report.inventoryPurchaseCount)
  report.inventoryPurchaseTotalUSD = roundMoney(report.inventoryPurchaseTotalUSD)
  report.expensesByProvider = summaryMapToArray(providerMap)
  report.expensesByType = summaryMapToArray(typeMap)
}

function getProductsSoldFromOrders(orders: LocalOrder[]) {
  const productMap = new Map<string, ProductSold>()

  orders.forEach((order) => {
    if (!Array.isArray(order.items)) return

    order.items.forEach((item) => {
      const subtotalUSD = Number(item.price || 0) * Number(item.quantity || 0)
      const onlyCurrency = isComboItem(item)
      const subtotalVES = onlyCurrency
        ? 0
        : subtotalUSD * Number(order.exchangeRate || 0)

      const current = productMap.get(item.name) || {
        name: item.name,
        quantity: 0,
        totalUSD: 0,
        totalVES: 0,
        onlyCurrency,
      }

      current.quantity += Number(item.quantity || 0)
      current.totalUSD += subtotalUSD
      current.totalVES += subtotalVES
      current.onlyCurrency = current.onlyCurrency && onlyCurrency

      productMap.set(item.name, current)
    })
  })

  return Array.from(productMap.values())
    .map((product) => ({
      ...product,
      quantity: toNumber(product.quantity),
      totalUSD: toNumber(product.totalUSD),
      totalVES: toNumber(product.totalVES),
    }))
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return b.totalUSD - a.totalUSD
    })
}

function getReportFromCurrentDay(
  orders: LocalOrder[],
  expenses: DayExpense[],
  label: string
): DashboardReport {
  const todayKey = getTodayDateInputValue()
  const ordersToday = orders.filter(
    (order) => getDateKeyInCaracas(order.createdAt) === todayKey
  )
  const billableOrders = ordersToday.filter((order) => order.status !== "Cancelado")
  const activeOrders = ordersToday.filter(shouldShowAsActive)
  const deliveredOrders = ordersToday.filter((order) => order.status === "Entregado")
  const canceledOrders = ordersToday.filter((order) => order.status === "Cancelado")
  const deliveryOrders = ordersToday.filter(isDeliveryOrder)
  const deliveryDelivered = deliveredOrders.filter(isDeliveryOrder)
  const deliveryPending = deliveryOrders.filter(shouldShowAsActive)
  const readyWithoutDelivered = ordersToday.filter((order) => order.status === "Listo")
  const deliveryReportedToConfirm = ordersToday.filter(
    (order) =>
      order.deliveryReportStatus === "Entrega reportada" &&
      order.status !== "Entregado" &&
      order.status !== "Cancelado"
  )

  const paymentByStatusMap = new Map<string, SummaryItem>()
  const paymentByUSDMethodMap = new Map<string, SummaryItem>()
  const paymentByVESMethodMap = new Map<string, SummaryItem>()
  const deliveryByPaymentInMap = new Map<string, SummaryItem>()
  const deliveryByZoneMap = new Map<string, SummaryItem>()

  const report = createEmptyReport(label)

  report.sourceCount = 1
  report.ordersRegistered = ordersToday.length
  report.activeOrders = activeOrders.length
  report.deliveredOrders = deliveredOrders.length
  report.canceledOrders = canceledOrders.length
  report.deliveryRegistered = deliveryOrders.length
  report.deliveryDelivered = deliveryDelivered.length
  report.deliveryPending = deliveryPending.length
  report.deliveryReportedToConfirm = deliveryReportedToConfirm.length
  report.readyWithoutDelivered = readyWithoutDelivered.length

  billableOrders.forEach((order) => {
    const orderTotals = getOrderTotals(order)
    const payment = getOrderPayment(order)
    const exchangeRate = Number(order.exchangeRate || 0)
    const amountReceivedVESEquivalentUSD =
      payment.amountReceivedVES > 0 && exchangeRate > 0
        ? payment.amountReceivedVES / exchangeRate
        : 0

    report.totalSoldUSD += orderTotals.totalUSD
    report.realCollectedUSD += payment.receivedEquivalentUSD
    report.realCashUSD += payment.amountReceivedUSD
    report.realVES += payment.amountReceivedVES
    report.realVESEquivalentUSD += amountReceivedVESEquivalentUSD
    report.realPendingUSD += payment.pendingUSD

    if (payment.status === "Pagado") {
      report.paidOrders += 1
    } else if (payment.status === "Pago parcial") {
      report.partialPaymentOrders += 1
    } else {
      report.pendingPaymentOrders += 1
    }

    addSummaryToMap(
      paymentByStatusMap,
      payment.status,
      1,
      payment.receivedEquivalentUSD
    )

    if (payment.amountReceivedUSD > 0) {
      addSummaryToMap(
        paymentByUSDMethodMap,
        payment.paymentMethodUSD || "Divisas sin método",
        1,
        payment.amountReceivedUSD
      )
    }

    if (payment.amountReceivedVES > 0) {
      addSummaryToMap(
        paymentByVESMethodMap,
        payment.paymentMethodVES || "Bolívares sin método",
        1,
        amountReceivedVESEquivalentUSD,
        payment.amountReceivedVES
      )
    }

    if (isDeliveryOrder(order)) {
      addSummaryToMap(
        deliveryByZoneMap,
        getDisplayTableNumber(order),
        1,
        orderTotals.totalUSD,
        0,
        orderTotals.deliveryCostUSD
      )
    }

    if (isDeliveryOrder(order) && orderTotals.deliveryCostUSD > 0) {
      const deliveryCostVES = orderTotals.deliveryCostUSD * exchangeRate
      const hasRegisteredDeliveryPayment =
        payment.deliveryPaymentIn !== "Sin registrar" &&
        payment.receivedEquivalentUSD > 0

      report.deliveryTotalRegisteredUSD += orderTotals.deliveryCostUSD

      if (hasRegisteredDeliveryPayment) {
        report.deliveryWithPaymentMethodUSD += orderTotals.deliveryCostUSD

        addSummaryToMap(
          deliveryByPaymentInMap,
          payment.deliveryPaymentIn,
          1,
          orderTotals.deliveryCostUSD,
          payment.deliveryPaymentIn === "Bolívares" ? deliveryCostVES : 0,
          orderTotals.deliveryCostUSD
        )

        if (payment.deliveryPaymentIn === "Divisas") {
          report.deliveryPaidInUSD += orderTotals.deliveryCostUSD
        } else if (payment.deliveryPaymentIn === "Bolívares") {
          report.deliveryPaidInVES += deliveryCostVES
          report.deliveryPaidInVESEquivalentUSD += orderTotals.deliveryCostUSD
        } else if (payment.deliveryPaymentIn === "Mixto") {
          report.deliveryPaidMixedUSD += orderTotals.deliveryCostUSD
        }
      } else {
        report.deliveryWithoutPaymentMethodUSD += orderTotals.deliveryCostUSD
      }
    }
  })

  expenses.forEach((expense) => {
    report.expensesCount += 1
    report.expensesCashUSD += toNumber(expense.amountUSD)
    report.expensesVES += toNumber(expense.amountVES)
    report.expensesTotalUSD += toNumber(expense.equivalentUSD)
  })

  addExpensesToDashboardReport(report, expenses)

  report.realCashUSD = roundMoney(report.realCashUSD)
  report.realVES = roundMoney(report.realVES)
  report.realVESEquivalentUSD = roundMoney(report.realVESEquivalentUSD)
  report.realCollectedUSD = roundMoney(
    report.realCashUSD + report.realVESEquivalentUSD
  )
  report.totalSoldUSD = roundMoney(report.totalSoldUSD)
  report.realPendingUSD = roundMoney(
    Math.max(report.realPendingUSD, report.totalSoldUSD - report.realCollectedUSD)
  )
  report.deliveryTotalRegisteredUSD = roundMoney(report.deliveryTotalRegisteredUSD)
  report.deliveryWithPaymentMethodUSD = roundMoney(report.deliveryWithPaymentMethodUSD)
  report.deliveryWithoutPaymentMethodUSD = roundMoney(
    report.deliveryWithoutPaymentMethodUSD
  )
  report.deliveryPaidInUSD = roundMoney(report.deliveryPaidInUSD)
  report.deliveryPaidInVES = roundMoney(report.deliveryPaidInVES)
  report.deliveryPaidInVESEquivalentUSD = roundMoney(
    report.deliveryPaidInVESEquivalentUSD
  )
  report.deliveryPaidMixedUSD = roundMoney(report.deliveryPaidMixedUSD)
  report.pendingDeliveryUSD = roundMoney(
    deliveryPending.reduce(
      (total, order) => total + getOrderTotals(order).deliveryCostUSD,
      0
    )
  )
  report.expensesCashUSD = roundMoney(report.expensesCashUSD)
  report.expensesVES = roundMoney(report.expensesVES)
  report.expensesTotalUSD = roundMoney(report.expensesTotalUSD)
  report.expensesVESEquivalentUSD = roundMoney(
    Math.max(report.expensesTotalUSD - report.expensesCashUSD, 0)
  )
  report.netEstimatedUSD = roundMoney(report.realCollectedUSD - report.expensesTotalUSD)

  report.productsSold = getProductsSoldFromOrders(billableOrders)
  report.deliveryByZone = summaryMapToArray(deliveryByZoneMap)
  report.paymentByStatus = summaryMapToArray(paymentByStatusMap)
  report.paymentByUSDMethod = summaryMapToArray(paymentByUSDMethodMap)
  report.paymentByVESMethod = summaryMapToArray(paymentByVESMethodMap)
  report.deliveryByPaymentIn = summaryMapToArray(deliveryByPaymentInMap)

  return report
}

function normalizeSummaryArray(value: unknown): SummaryItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const source = item as Partial<DayCloseSummaryItem>

      return {
        label: String(source.label || "Sin dato").trim() || "Sin dato",
        count: toNumber(source.count),
        totalUSD: toNumber(source.totalUSD),
        totalVES: toNumber(source.totalVES),
        deliveryCostUSD: toNumber(source.deliveryCostUSD),
      }
    })
    .sort((a, b) => {
      if (b.totalUSD !== a.totalUSD) return b.totalUSD - a.totalUSD
      return b.count - a.count
    })
}

function normalizeProductsSold(value: unknown): ProductSold[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const source = item as Partial<DayCloseProductSold>

      return {
        name: String(source.name || "Producto").trim() || "Producto",
        quantity: toNumber(source.quantity),
        totalUSD: toNumber(source.totalUSD),
        totalVES: toNumber(source.totalVES),
        onlyCurrency: Boolean(source.onlyCurrency),
      }
    })
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return b.totalUSD - a.totalUSD
    })
}

function getCloseNetEstimatedUSD(close: SavedDayClose) {
  const savedNet = toNumber(close.netEstimatedUSD)
  const calculatedNet = toNumber(close.realCollectedUSD) - toNumber(close.expensesTotalUSD)

  if (savedNet !== 0 || toNumber(close.expensesTotalUSD) > 0) {
    return savedNet
  }

  return calculatedNet
}

function getReportFromClose(close: SavedDayClose): DashboardReport {
  const closeWithDeliveryAudit = close as SavedDayCloseWithDeliveryAudit
  const report = createEmptyReport(close.dateLabel || formatDate(close.createdAt))

  report.sourceCount = 1

  report.ordersRegistered = toNumber(close.ordersRegistered)
  report.activeOrders = toNumber(close.activeOrders)
  report.deliveredOrders = toNumber(close.deliveredOrders)
  report.canceledOrders = toNumber(close.canceledOrders)

  report.deliveryRegistered = toNumber(close.deliveryRegistered)
  report.deliveryDelivered = toNumber(close.deliveryDelivered)
  report.deliveryPending = toNumber(close.deliveryActive)
  report.deliveryReportedToConfirm = 0

  report.readyWithoutDelivered = 0

  report.totalSoldUSD = toNumber(close.totalSoldUSD)
  report.realCollectedUSD = toNumber(close.realCollectedUSD)
  report.realCashUSD = toNumber(close.realCashUSD)
  report.realVES = toNumber(close.realVES)
  report.realVESEquivalentUSD = toNumber(close.realVESEquivalentUSD)
  report.realPendingUSD = toNumber(close.realPendingUSD)

  report.paidOrders = toNumber(close.paidOrders)
  report.partialPaymentOrders = toNumber(close.partialPaymentOrders)
  report.pendingPaymentOrders = toNumber(close.pendingPaymentOrders)

  report.deliveryTotalRegisteredUSD = toNumber(
    closeWithDeliveryAudit.deliveryTotalRegisteredUSD || close.deliveryCollectedUSD
  )
  report.deliveryWithPaymentMethodUSD = toNumber(
    closeWithDeliveryAudit.deliveryWithPaymentMethodUSD
  )
  report.deliveryWithoutPaymentMethodUSD = toNumber(
    closeWithDeliveryAudit.deliveryWithoutPaymentMethodUSD
  )
  report.deliveryPaidInUSD = toNumber(close.deliveryPaidInUSD)
  report.deliveryPaidInVES = toNumber(close.deliveryPaidInVES)
  report.deliveryPaidInVESEquivalentUSD = toNumber(
    close.deliveryPaidInVESEquivalentUSD
  )
  report.deliveryPaidMixedUSD = toNumber(close.deliveryPaidMixedUSD)
  report.pendingDeliveryUSD = toNumber(close.pendingDeliveryUSD)

  report.expensesCount = toNumber(close.expensesCount)
  report.expensesTotalUSD = toNumber(close.expensesTotalUSD)
  report.expensesCashUSD = toNumber(close.expensesCashUSD)
  report.expensesVES = toNumber(close.expensesVES)
  report.expensesVESEquivalentUSD = toNumber(close.expensesVESEquivalentUSD)
  report.netEstimatedUSD = getCloseNetEstimatedUSD(close)

  const closeExpenses = Array.isArray((close as { expenses?: unknown }).expenses)
    ? ((close as { expenses?: unknown[] }).expenses || [])
    : []

  addExpensesToDashboardReport(report, closeExpenses)

  report.productsSold = normalizeProductsSold(close.productsSold)
  report.deliveryByZone = normalizeSummaryArray(close.deliveryByZone)
  report.paymentByStatus = normalizeSummaryArray(close.paymentByStatus)
  report.paymentByUSDMethod = normalizeSummaryArray(close.paymentByUSDMethod)
  report.paymentByVESMethod = normalizeSummaryArray(close.paymentByVESMethod)
  report.deliveryByPaymentIn = normalizeSummaryArray(close.deliveryByPaymentIn)

  return report
}

function combineProducts(products: ProductSold[]) {
  const productMap = new Map<string, ProductSold>()

  products.forEach((product) => {
    const name = product.name.trim() || "Producto"
    const current = productMap.get(name) || {
      name,
      quantity: 0,
      totalUSD: 0,
      totalVES: 0,
      onlyCurrency: true,
    }

    current.quantity += toNumber(product.quantity)
    current.totalUSD += toNumber(product.totalUSD)
    current.totalVES += toNumber(product.totalVES)
    current.onlyCurrency = current.onlyCurrency && product.onlyCurrency

    productMap.set(name, current)
  })

  return Array.from(productMap.values())
    .map((product) => ({
      ...product,
      quantity: toNumber(product.quantity),
      totalUSD: toNumber(product.totalUSD),
      totalVES: toNumber(product.totalVES),
    }))
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return b.totalUSD - a.totalUSD
    })
}

function combineSummaryItems(items: SummaryItem[]) {
  const summaryMap = new Map<string, SummaryItem>()

  items.forEach((item) => {
    addSummaryToMap(
      summaryMap,
      item.label,
      item.count,
      item.totalUSD,
      item.totalVES || 0,
      item.deliveryCostUSD || 0
    )
  })

  return summaryMapToArray(summaryMap)
}

function combineReports(label: string, reports: DashboardReport[]): DashboardReport {
  const combined = createEmptyReport(label)

  combined.sourceCount = reports.reduce((total, report) => total + report.sourceCount, 0)

  reports.forEach((report) => {
    combined.ordersRegistered += report.ordersRegistered
    combined.activeOrders += report.activeOrders
    combined.deliveredOrders += report.deliveredOrders
    combined.canceledOrders += report.canceledOrders

    combined.deliveryRegistered += report.deliveryRegistered
    combined.deliveryDelivered += report.deliveryDelivered
    combined.deliveryPending += report.deliveryPending
    combined.deliveryReportedToConfirm += report.deliveryReportedToConfirm

    combined.readyWithoutDelivered += report.readyWithoutDelivered

    combined.totalSoldUSD += report.totalSoldUSD
    combined.realCollectedUSD += report.realCollectedUSD
    combined.realCashUSD += report.realCashUSD
    combined.realVES += report.realVES
    combined.realVESEquivalentUSD += report.realVESEquivalentUSD
    combined.realPendingUSD += report.realPendingUSD

    combined.paidOrders += report.paidOrders
    combined.partialPaymentOrders += report.partialPaymentOrders
    combined.pendingPaymentOrders += report.pendingPaymentOrders

    combined.deliveryTotalRegisteredUSD += report.deliveryTotalRegisteredUSD
    combined.deliveryWithPaymentMethodUSD += report.deliveryWithPaymentMethodUSD
    combined.deliveryWithoutPaymentMethodUSD += report.deliveryWithoutPaymentMethodUSD
    combined.deliveryPaidInUSD += report.deliveryPaidInUSD
    combined.deliveryPaidInVES += report.deliveryPaidInVES
    combined.deliveryPaidInVESEquivalentUSD += report.deliveryPaidInVESEquivalentUSD
    combined.deliveryPaidMixedUSD += report.deliveryPaidMixedUSD
    combined.pendingDeliveryUSD += report.pendingDeliveryUSD

    combined.expensesCount += report.expensesCount
    combined.expensesTotalUSD += report.expensesTotalUSD
    combined.expensesCashUSD += report.expensesCashUSD
    combined.expensesVES += report.expensesVES
    combined.expensesVESEquivalentUSD += report.expensesVESEquivalentUSD
    combined.netEstimatedUSD += report.netEstimatedUSD
    combined.inventoryPurchaseCount += report.inventoryPurchaseCount
    combined.inventoryPurchaseTotalUSD += report.inventoryPurchaseTotalUSD
  })

  combined.ordersRegistered = toNumber(combined.ordersRegistered)
  combined.totalSoldUSD = roundMoney(combined.totalSoldUSD)
  combined.realCollectedUSD = roundMoney(combined.realCollectedUSD)
  combined.realCashUSD = roundMoney(combined.realCashUSD)
  combined.realVES = roundMoney(combined.realVES)
  combined.realVESEquivalentUSD = roundMoney(combined.realVESEquivalentUSD)
  combined.realPendingUSD = roundMoney(combined.realPendingUSD)
  combined.deliveryTotalRegisteredUSD = roundMoney(combined.deliveryTotalRegisteredUSD)
  combined.deliveryWithPaymentMethodUSD = roundMoney(
    combined.deliveryWithPaymentMethodUSD
  )
  combined.deliveryWithoutPaymentMethodUSD = roundMoney(
    combined.deliveryWithoutPaymentMethodUSD
  )
  combined.deliveryPaidInUSD = roundMoney(combined.deliveryPaidInUSD)
  combined.deliveryPaidInVES = roundMoney(combined.deliveryPaidInVES)
  combined.deliveryPaidInVESEquivalentUSD = roundMoney(
    combined.deliveryPaidInVESEquivalentUSD
  )
  combined.deliveryPaidMixedUSD = roundMoney(combined.deliveryPaidMixedUSD)
  combined.pendingDeliveryUSD = roundMoney(combined.pendingDeliveryUSD)
  combined.expensesTotalUSD = roundMoney(combined.expensesTotalUSD)
  combined.expensesCashUSD = roundMoney(combined.expensesCashUSD)
  combined.expensesVES = roundMoney(combined.expensesVES)
  combined.expensesVESEquivalentUSD = roundMoney(combined.expensesVESEquivalentUSD)
  combined.netEstimatedUSD = roundMoney(combined.realCollectedUSD - combined.expensesTotalUSD)
  combined.inventoryPurchaseCount = toNumber(combined.inventoryPurchaseCount)
  combined.inventoryPurchaseTotalUSD = roundMoney(combined.inventoryPurchaseTotalUSD)

  combined.expensesByProvider = combineSummaryItems(
    reports.flatMap((report) => report.expensesByProvider)
  )
  combined.expensesByType = combineSummaryItems(
    reports.flatMap((report) => report.expensesByType)
  )
  combined.productsSold = combineProducts(reports.flatMap((report) => report.productsSold))
  combined.deliveryByZone = combineSummaryItems(
    reports.flatMap((report) => report.deliveryByZone)
  )
  combined.paymentByStatus = combineSummaryItems(
    reports.flatMap((report) => report.paymentByStatus)
  )
  combined.paymentByUSDMethod = combineSummaryItems(
    reports.flatMap((report) => report.paymentByUSDMethod)
  )
  combined.paymentByVESMethod = combineSummaryItems(
    reports.flatMap((report) => report.paymentByVESMethod)
  )
  combined.deliveryByPaymentIn = combineSummaryItems(
    reports.flatMap((report) => report.deliveryByPaymentIn)
  )

  return combined
}

function isCloseInsideDateRange(close: SavedDayClose, startDate: string, endDate: string) {
  const closeDateKey = getDateKeyInCaracas(close.createdAt)

  if (!closeDateKey) return false
  if (startDate && closeDateKey < startDate) return false
  if (endDate && closeDateKey > endDate) return false

  return true
}

function isTodayInsideDateRange(startDate: string, endDate: string) {
  const today = getTodayDateInputValue()

  if (startDate && today < startDate) return false
  if (endDate && today > endDate) return false

  return true
}

function getRangeLabel(mode: DashboardRangeMode, startDate: string, endDate: string) {
  if (mode === "today") return "Hoy"
  if (mode === "last7") return "Últimos 7 días"

  if (startDate || endDate) {
    return `${startDate ? formatShortDateKey(startDate) : "Inicio"} - ${
      endDate ? formatShortDateKey(endDate) : "Hoy"
    }`
  }

  return "Rango completo"
}

function getDashboardAlerts(report: DashboardReport): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const pendingRate =
    report.totalSoldUSD > 0
      ? Math.round((report.realPendingUSD / report.totalSoldUSD) * 100)
      : 0

  if (report.pendingPaymentOrders > 0) {
    alerts.push({
      title: "Hay pagos pendientes",
      description:
        "Caja debe revisar pedidos que todavía no tienen cobro real registrado.",
      value: `${report.pendingPaymentOrders} pedido(s)`,
      tone: pendingRate >= 25 ? "danger" : "warning",
    })
  }

  if (report.partialPaymentOrders > 0) {
    alerts.push({
      title: "Hay pedidos con pago parcial",
      description:
        "Hay pedidos con abono registrado, pero todavía falta completar el cobro.",
      value: `${report.partialPaymentOrders} pedido(s)`,
      tone: "warning",
    })
  }

  if (report.readyWithoutDelivered > 0) {
    alerts.push({
      title: "Hay pedidos listos sin entregar",
      description:
        "Estos pedidos ya están listos y todavía necesitan confirmación final.",
      value: `${report.readyWithoutDelivered} pedido(s)`,
      tone: "warning",
    })
  }

  if (report.deliveryReportedToConfirm > 0) {
    alerts.push({
      title: "Hay delivery reportados por confirmar",
      description:
        "Delivery indicó entrega, pero Caja todavía debe confirmar el pedido como entregado.",
      value: `${report.deliveryReportedToConfirm} reporte(s)`,
      tone: "warning",
    })
  }

  if (report.deliveryPending > 0) {
    alerts.push({
      title: "Hay delivery pendiente",
      description:
        "Existen pedidos a domicilio que siguen activos o sin cierre operativo.",
      value: `${report.deliveryPending} delivery(s)`,
      tone: "info",
    })
  }

  if (report.canceledOrders > 0) {
    alerts.push({
      title: "Hay pedidos cancelados",
      description:
        "Conviene revisar si las cancelaciones fueron normales o si hubo problemas de operación.",
      value: `${report.canceledOrders} cancelado(s)`,
      tone: "info",
    })
  }

  if (report.deliveryWithoutPaymentMethodUSD > 0) {
    alerts.push({
      title: "Hay delivery sin forma de cobro",
      description:
        "Hay costo de delivery registrado, pero falta indicar si se cobró en divisas, bolívares o mixto.",
      value: formatUSD(report.deliveryWithoutPaymentMethodUSD),
      tone: "warning",
    })
  }

  const usdWithoutMethod = report.paymentByUSDMethod.find((item) =>
    normalizeComparableText(item.label).includes("sin metodo")
  )

  if (usdWithoutMethod && usdWithoutMethod.totalUSD > 0) {
    alerts.push({
      title: "Hay divisas sin método",
      description:
        "Hay cobros en divisas sin indicar si fueron efectivo, Zelle, Binance / USDT u otro método.",
      value: formatUSD(usdWithoutMethod.totalUSD),
      tone: "warning",
    })
  }

  const vesWithoutMethod = report.paymentByVESMethod.find((item) =>
    normalizeComparableText(item.label).includes("sin metodo")
  )

  if (vesWithoutMethod && (vesWithoutMethod.totalVES || 0) > 0) {
    alerts.push({
      title: "Hay bolívares sin método",
      description:
        "Hay cobros en bolívares sin indicar pago móvil, punto, transferencia, efectivo Bs u otro método.",
      value: `Bs ${formatVES(vesWithoutMethod.totalVES || 0)}`,
      tone: "warning",
    })
  }

  if (report.expensesTotalUSD > 0 && report.realCollectedUSD > 0) {
    const expenseRate = Math.round(
      (report.expensesTotalUSD / report.realCollectedUSD) * 100
    )

    if (expenseRate >= 60) {
      alerts.push({
        title: "Hay gastos altos",
        description:
          "Los gastos representan una parte alta del cobro real. Revisa compras, pagos o salidas de caja.",
        value: `${expenseRate}% de lo cobrado`,
        tone: "warning",
      })
    }
  }

  const expensesWithoutProvider = report.expensesByProvider.find((item) =>
    normalizeComparableText(item.label).includes("sin proveedor")
  )

  if (expensesWithoutProvider && expensesWithoutProvider.count > 0) {
    alerts.push({
      title: "Hay gastos sin proveedor",
      description:
        "Conviene completar el proveedor para que compras, materia prima y salidas de caja queden mejor justificadas.",
      value: `${expensesWithoutProvider.count} gasto(s)`,
      tone: "info",
    })
  }

  if (report.inventoryPurchaseCount > 0) {
    alerts.push({
      title: "Compras de inventario registradas",
      description:
        "El resumen incluye gastos relacionados con insumos o materia prima. Revisa que el inventario haya quedado actualizado.",
      value: `${report.inventoryPurchaseCount} compra(s) · ${formatUSD(report.inventoryPurchaseTotalUSD)}`,
      tone: "info",
    })
  }

  if (report.totalSoldUSD > 0 && report.realPendingUSD <= 0.01) {
    alerts.unshift({
      title: "Cobro al día",
      description:
        "No se detecta pendiente de cobro en el resumen actual.",
      value: formatUSD(report.realCollectedUSD),
      tone: "good",
    })
  }

  if (!alerts.length) {
    alerts.push({
      title: "Sin alertas por ahora",
      description:
        "No hay pedidos, pagos o gastos que requieran revisión inmediata.",
      value: "Todo en orden",
      tone: "good",
    })
  }

  return alerts.slice(0, 9)
}

function getAttentionOrders(orders: LocalOrder[]) {
  const todayKey = getTodayDateInputValue()

  return orders
    .filter((order) => getDateKeyInCaracas(order.createdAt) === todayKey)
    .filter((order) => {
      if (order.status === "Cancelado") return true
      if (order.status === "Listo") return true

      if (
        order.deliveryReportStatus === "Entrega reportada" &&
        order.status !== "Entregado"
      ) {
        return true
      }

      const payment = getOrderPayment(order)

      return payment.status !== "Pagado"
    })
    .slice(0, 8)
}

function getDisplayOrderNumber(order: LocalOrder) {
  if (order.rowNumber && order.rowNumber > 1) {
    return `#${String(order.rowNumber - 1).padStart(2, "0")}`
  }

  const parts = order.id.split("-")
  const lastPart = parts[parts.length - 1] || order.id

  return `#${lastPart.slice(-3)}`
}

export default function OwnerDashboardPage() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [dayExpenses, setDayExpenses] = useState<DayExpense[]>([])
  const [dayCloses, setDayCloses] = useState<SavedDayClose[]>([])
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchase[]>([])
  // Consolidado: dueño ve todas las sedes juntas (scope=all) en vez de solo la
  // sede actual. El resto de roles nunca puede consolidar (lo bloquea el API).
  const [consolidated, setConsolidated] = useState(false)

  const [rangeMode, setRangeMode] = useState<DashboardRangeMode>("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [searchText, setSearchText] = useState("")
  const [areControlsVisible, setAreControlsVisible] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isLoggedIn = adminPassword.length > 0

  async function loadDashboardData(
    password = adminPassword,
    scopeAll = consolidated,
  ) {
    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const todayKey = getTodayDateInputValue()
      // scope=all pide el consolidado de todas las sedes; el API solo lo permite
      // a dueño/soporte y lo ignora para el resto.
      const scopeQuery = scopeAll ? "?scope=all" : ""
      const scopeAmp = scopeAll ? "&scope=all" : ""
      const headers = { "x-admin-password": password }

      const [
        ordersResponse,
        expensesResponse,
        closesResponse,
        purchasesResponse,
      ] = await Promise.all([
        fetch(`/api/orders${scopeQuery}`, { headers, cache: "no-store" }),
        fetch(`/api/day-expenses?dateValue=${todayKey}${scopeAmp}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/day-closes${scopeQuery}`, { headers, cache: "no-store" }),
        // Compras a proveedores: no-fatal. Si el módulo está apagado (403) o
        // falla, la sección de compras/deudas queda vacía sin romper el panel.
        fetch(`/api/supplier-purchases${scopeQuery}`, {
          headers,
          cache: "no-store",
        }).catch(() => null),
      ])

      const [ordersData, expensesData, closesData] = await Promise.all([
        readApiResponse(ordersResponse),
        readApiResponse(expensesResponse),
        readApiResponse(closesResponse),
      ])

      if (!ordersResponse.ok) {
        throw new Error(ordersData.error || "No se pudieron cargar los pedidos")
      }

      if (!expensesResponse.ok) {
        throw new Error(expensesData.error || "No se pudieron cargar los gastos")
      }

      if (!closesResponse.ok) {
        throw new Error(closesData.error || "No se pudieron cargar los cierres")
      }

      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
      setDayExpenses(
        Array.isArray(expensesData.dayExpenses) ? expensesData.dayExpenses : []
      )
      setDayCloses(
        Array.isArray(closesData.dayCloses) ? closesData.dayCloses : []
      )

      if (purchasesResponse && purchasesResponse.ok) {
        const purchasesData = await readApiResponse(purchasesResponse)
        setSupplierPurchases(
          Array.isArray(purchasesData.purchases) ? purchasesData.purchases : []
        )
      } else {
        setSupplierPurchases([])
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el resumen del negocio"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
    setAdminPassword(password)
    loadDashboardData(password)
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    setOrders([])
    setDayExpenses([])
    setDayCloses([])
    setSupplierPurchases([])
    setErrorMessage(null)
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

    if (savedPassword) {
      setAdminPassword(savedPassword)
      setPasswordInput(savedPassword)
      loadDashboardData(savedPassword)
    }
  })

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0)
    return () => clearTimeout(timer)
  }, [])

  const liveReport = useMemo(() => {
    return getReportFromCurrentDay(orders, dayExpenses, "Operación de hoy")
  }, [dayExpenses, orders])

  const selectedRange = useMemo(() => {
    if (rangeMode === "today") {
      return {
        label: "Hoy",
        startDate: getTodayDateInputValue(),
        endDate: getTodayDateInputValue(),
      }
    }

    if (rangeMode === "last7") {
      return {
        label: "Últimos 7 días",
        startDate: getDateInputValueDaysAgo(6),
        endDate: getTodayDateInputValue(),
      }
    }

    return {
      label: getRangeLabel("custom", customStartDate, customEndDate),
      startDate: customStartDate,
      endDate: customEndDate,
    }
  }, [customEndDate, customStartDate, rangeMode])

  const visibleDayCloses = useMemo(() => {
    if (rangeMode === "today") return []

    return dayCloses.filter((close) =>
      isCloseInsideDateRange(
        close,
        selectedRange.startDate,
        selectedRange.endDate
      )
    )
  }, [dayCloses, rangeMode, selectedRange.endDate, selectedRange.startDate])

  const report = useMemo(() => {
    if (rangeMode === "today") {
      return liveReport
    }

    const closeReports = visibleDayCloses.map(getReportFromClose)
    const shouldIncludeToday =
      isTodayInsideDateRange(selectedRange.startDate, selectedRange.endDate) &&
      (liveReport.ordersRegistered > 0 || liveReport.expensesCount > 0)

    const reports = shouldIncludeToday ? [...closeReports, liveReport] : closeReports

    if (!reports.length) {
      return createEmptyReport(selectedRange.label)
    }

    return combineReports(selectedRange.label, reports)
  }, [
    liveReport,
    rangeMode,
    selectedRange.endDate,
    selectedRange.label,
    selectedRange.startDate,
    visibleDayCloses,
  ])

  // Compras a proveedores y deudas por pagar. Las compras del período usan el
  // mismo rango de fechas del panel; las deudas (payables) son el saldo vivo
  // de TODAS las compras sin pagar, no dependen del rango.
  const purchasesReport = useMemo(() => {
    const { startDate, endDate } = selectedRange
    const inRange = (date: string) =>
      Boolean(date) &&
      (!startDate || date >= startDate) &&
      (!endDate || date <= endDate)

    let periodCount = 0
    let periodTotalUSD = 0
    let payableUSD = 0
    let payableCount = 0
    let overdueUSD = 0
    let overdueCount = 0

    for (const purchase of supplierPurchases) {
      if (inRange(purchase.purchaseDate)) {
        periodCount += 1
        periodTotalUSD += toNumber(purchase.totalUSD)
      }

      const pending = toNumber(purchase.pendingUSD)
      if (pending > 0.01) {
        payableUSD += pending
        payableCount += 1
        if (purchase.isOverdue) {
          overdueUSD += pending
          overdueCount += 1
        }
      }
    }

    return {
      hasData: supplierPurchases.length > 0,
      periodCount,
      periodTotalUSD: roundMoney(periodTotalUSD),
      payableUSD: roundMoney(payableUSD),
      payableCount,
      overdueUSD: roundMoney(overdueUSD),
      overdueCount,
    }
  }, [supplierPurchases, selectedRange])

  const alerts = useMemo(() => getDashboardAlerts(report), [report])
  const attentionOrders = useMemo(() => getAttentionOrders(orders), [orders])

  const filteredAttentionOrders = useMemo(() => {
    const query = normalizeComparableText(searchText)

    if (!query) return attentionOrders

    return attentionOrders.filter((order) => {
      const payment = getOrderPayment(order)
      const searchableText = normalizeComparableText(
        [
          order.id,
          getDisplayOrderNumber(order),
          order.customerName,
          order.customerPhone,
          order.tableNumber,
          order.deliveryZone,
          order.deliveryAddress,
          order.status,
          payment.status,
          payment.paymentMethodUSD,
          payment.paymentMethodVES,
          order.items?.map((item) => item.name).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
      )

      return searchableText.includes(query)
    })
  }, [attentionOrders, searchText])

  const topProduct = report.productsSold[0]
  const topDeliveryZone = report.deliveryByZone[0]
  const topUSDMethod = report.paymentByUSDMethod[0]
  const topExpenseProvider = report.expensesByProvider[0]
  const topExpenseType = report.expensesByType[0]

  if (!isLoggedIn) {
    return (
      <LoginBox
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        handleLogin={handleLogin}
        errorMessage={errorMessage}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/local-santo"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <button
                    type="button"
                    onClick={() => loadDashboardData()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {BRAND.name}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Resumen del dueño
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Vista rápida para revisar ventas, cobros, gastos, delivery y puntos que necesitan atención.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard
                  label="Vendido"
                  value={formatUSD(report.totalSoldUSD)}
                />
                <MetricCard
                  label="Cobrado real"
                  value={formatUSD(report.realCollectedUSD)}
                  tone="good"
                />
                <MetricCard
                  label="Pendiente"
                  value={formatUSD(report.realPendingUSD)}
                  tone={report.realPendingUSD > 0 ? "warning" : "soft"}
                />
                <MetricCard
                  label="Neto estimado"
                  value={formatUSD(report.netEstimatedUSD)}
                  tone={report.netEstimatedUSD < 0 ? "warning" : "soft"}
                />
              </div>
            </div>
          </div>
        </header>

        <section className="sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Vista del resumen
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                {report.label} · {report.ordersRegistered} pedido(s) · Cobrado {formatUSD(report.realCollectedUSD)} · Gastos {formatUSD(report.expensesTotalUSD)} · Pendiente {formatUSD(report.realPendingUSD)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAreControlsVisible((currentValue) => !currentValue)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
            >
              {areControlsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {areControlsVisible ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
          </div>

          {areControlsVisible && (
            <>
              <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <RangeButton
                  active={rangeMode === "today"}
                  onClick={() => setRangeMode("today")}
                >
                  Hoy
                </RangeButton>

                <RangeButton
                  active={rangeMode === "last7"}
                  onClick={() => setRangeMode("last7")}
                >
                  Últimos 7 días
                </RangeButton>

                <RangeButton
                  active={rangeMode === "custom"}
                  onClick={() => setRangeMode("custom")}
                >
                  Rango personalizado
                </RangeButton>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-ink-2)]/60">
                  Alcance
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextConsolidated = !consolidated
                    setConsolidated(nextConsolidated)
                    loadDashboardData(adminPassword, nextConsolidated)
                  }}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                    consolidated
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                  }`}
                >
                  <Building2 size={15} />
                  {consolidated
                    ? "Consolidado: todas las sedes"
                    : "Solo esta sucursal"}
                </button>
              </div>

              {rangeMode === "custom" && (
                <div className="mt-3 grid gap-3 rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 sm:grid-cols-2">
                  <DateFilterInput
                    label="Desde"
                    value={customStartDate}
                    onChange={setCustomStartDate}
                  />

                  <DateFilterInput
                    label="Hasta"
                    value={customEndDate}
                    onChange={setCustomEndDate}
                  />
                </div>
              )}

              <div className="relative mt-3">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Buscar en pedidos que requieren revisión"
                  className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />
              </div>
            </>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-red-800">
                {errorMessage}
              </p>
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BigMetricCard
            icon={<WalletCards size={24} />}
            title="Cobros reales"
            mainValue={formatUSD(report.realCollectedUSD)}
            helper={`Divisas ${formatUSD(report.realCashUSD)} · Bs ${formatVES(report.realVES)}`}
          />

          <BigMetricCard
            icon={<AlertTriangle size={24} />}
            title="Pendiente por cobrar"
            mainValue={formatUSD(report.realPendingUSD)}
            helper={`${report.pendingPaymentOrders} pendiente(s) · ${report.partialPaymentOrders} parcial(es)`}
            tone={report.realPendingUSD > 0 ? "warning" : "good"}
          />

          <BigMetricCard
            icon={<BarChart3 size={24} />}
            title="Gastos y neto"
            mainValue={formatUSD(report.netEstimatedUSD)}
            helper={`Gastos ${formatUSD(report.expensesTotalUSD)} · ${report.expensesCount} registro(s) · Inventario ${formatUSD(report.inventoryPurchaseTotalUSD)}`}
            tone={report.netEstimatedUSD < 0 ? "warning" : "soft"}
          />

          <BigMetricCard
            icon={<Truck size={24} />}
            title="Delivery"
            mainValue={`${report.deliveryRegistered}`}
            helper={`${report.deliveryDelivered} entregado(s) · ${report.deliveryPending} pendiente(s)`}
          />
        </section>

        {purchasesReport.hasData && (
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <BigMetricCard
              icon={<PackageCheck size={24} />}
              title="Compras del período"
              mainValue={formatUSD(purchasesReport.periodTotalUSD)}
              helper={`${purchasesReport.periodCount} compra(s) · ${report.label}`}
            />

            <BigMetricCard
              icon={<WalletCards size={24} />}
              title="Deudas por pagar"
              mainValue={formatUSD(purchasesReport.payableUSD)}
              helper={`${purchasesReport.payableCount} compra(s) con saldo · proveedores`}
              tone={purchasesReport.payableUSD > 0 ? "warning" : "good"}
            />

            <BigMetricCard
              icon={<AlertTriangle size={24} />}
              title="Deudas vencidas"
              mainValue={formatUSD(purchasesReport.overdueUSD)}
              helper={`${purchasesReport.overdueCount} compra(s) vencida(s)`}
              tone={purchasesReport.overdueUSD > 0 ? "warning" : "soft"}
            />
          </section>
        )}

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <PanelCard
            title="Alertas operativas"
            description="Puntos que el dueño debería revisar primero."
          >
            <div className="grid gap-3">
              {alerts.map((alert, index) => (
                <AlertCard key={`${alert.title}-${index}`} alert={alert} />
              ))}
            </div>
          </PanelCard>

          <PanelCard
            title="Estado del negocio"
            description="Resumen sencillo de pedidos, cobros y gastos."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Pedidos registrados" value={String(report.ordersRegistered)} />
              <InfoBox label="Pedidos activos" value={String(report.activeOrders)} />
              <InfoBox label="Entregados" value={String(report.deliveredOrders)} />
              <InfoBox label="Cancelados" value={String(report.canceledOrders)} />
              <InfoBox label="Pagados" value={String(report.paidOrders)} />
              <InfoBox label="Pago parcial" value={String(report.partialPaymentOrders)} />
              <InfoBox label="Pendientes de pago" value={String(report.pendingPaymentOrders)} />
              <InfoBox label="Listos sin entregar" value={String(report.readyWithoutDelivered)} />
              <InfoBox
                label="Delivery reportado por confirmar"
                value={String(report.deliveryReportedToConfirm)}
              />
              <InfoBox
                label="Delivery sin forma de cobro"
                value={formatUSD(report.deliveryWithoutPaymentMethodUSD)}
              />
              <InfoBox
                label="Compras inventario"
                value={`${report.inventoryPurchaseCount} · ${formatUSD(report.inventoryPurchaseTotalUSD)}`}
              />
              <InfoBox
                label="Proveedor principal"
                value={topExpenseProvider ? `${topExpenseProvider.label} · ${formatUSD(topExpenseProvider.totalUSD)}` : "Sin proveedor destacado"}
              />
            </div>
          </PanelCard>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <RankingList
            title="Productos con más movimiento"
            emptyText="Todavía no hay productos para mostrar en este rango."
            items={report.productsSold.slice(0, 7).map((product) => ({
              label: product.name,
              detail: `${product.quantity} unidad(es)`,
              value: formatUSD(product.totalUSD),
              subValue:
                product.totalVES > 0 ? `Bs ${formatVES(product.totalVES)}` : "Base en divisas",
            }))}
          />

          <RankingList
            title="Zonas delivery"
            emptyText="Todavía no hay zonas delivery para mostrar."
            items={report.deliveryByZone.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} registro(s)`,
              value: formatUSD(item.totalUSD),
              subValue:
                item.deliveryCostUSD && item.deliveryCostUSD > 0
                  ? `Delivery ${formatUSD(item.deliveryCostUSD)}`
                  : undefined,
            }))}
          />

          <RankingList
            title="Cobros en divisas"
            emptyText="Todavía no hay cobros en divisas registrados."
            items={report.paymentByUSDMethod.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} pago(s)`,
              value: formatUSD(item.totalUSD),
            }))}
          />

          <RankingList
            title="Cobros en bolívares"
            emptyText="Todavía no hay cobros en bolívares registrados."
            items={report.paymentByVESMethod.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} pago(s)`,
              value: `Bs ${formatVES(item.totalVES || 0)}`,
              subValue: `Equiv. ${formatUSD(item.totalUSD)}`,
            }))}
          />

          <RankingList
            title="Gastos por proveedor"
            emptyText="Todavía no hay gastos con proveedor para mostrar."
            items={report.expensesByProvider.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} gasto(s)`,
              value: formatUSD(item.totalUSD),
              subValue:
                item.totalVES && item.totalVES > 0
                  ? `Bs ${formatVES(item.totalVES)}`
                  : undefined,
            }))}
          />

          <RankingList
            title="Gastos por tipo"
            emptyText="Todavía no hay tipos de gasto para mostrar."
            items={report.expensesByType.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} gasto(s)`,
              value: formatUSD(item.totalUSD),
              subValue:
                item.totalVES && item.totalVES > 0
                  ? `Bs ${formatVES(item.totalVES)}`
                  : undefined,
            }))}
          />

          <RankingList
            title="Delivery por forma de cobro"
            emptyText="Todavía no hay formas de cobro de delivery registradas."
            items={report.deliveryByPaymentIn.slice(0, 7).map((item) => ({
              label: item.label,
              detail: `${item.count} delivery(s)`,
              value: formatUSD(item.deliveryCostUSD || item.totalUSD),
              subValue:
                item.totalVES && item.totalVES > 0
                  ? `Bs ${formatVES(item.totalVES)}`
                  : undefined,
            }))}
          />

          <PanelCard
            title="Lectura rápida"
            description="Interpretación ejecutiva del rango actual."
          >
            <div className="space-y-3">
              <QuickReadLine
                icon={<TrendingUp size={18} />}
                label="Producto líder"
                value={
                  topProduct
                    ? `${topProduct.name} · ${topProduct.quantity} unidad(es)`
                    : "Sin producto líder todavía"
                }
              />

              <QuickReadLine
                icon={<Truck size={18} />}
                label="Zona fuerte"
                value={
                  topDeliveryZone
                    ? `${topDeliveryZone.label} · ${topDeliveryZone.count} registro(s)`
                    : "Sin zona destacada todavía"
                }
              />

              <QuickReadLine
                icon={<WalletCards size={18} />}
                label="Método en divisas"
                value={
                  topUSDMethod
                    ? `${topUSDMethod.label} · ${formatUSD(topUSDMethod.totalUSD)}`
                    : "Sin método destacado todavía"
                }
              />

              <QuickReadLine
                icon={<BarChart3 size={18} />}
                label="Proveedor de gasto"
                value={
                  topExpenseProvider
                    ? `${topExpenseProvider.label} · ${formatUSD(topExpenseProvider.totalUSD)}`
                    : "Sin proveedor destacado todavía"
                }
              />

              <QuickReadLine
                icon={<PackageCheck size={18} />}
                label="Tipo de gasto"
                value={
                  topExpenseType
                    ? `${topExpenseType.label} · ${topExpenseType.count} registro(s)`
                    : "Sin tipo destacado todavía"
                }
              />

              <QuickReadLine
                icon={<BarChart3 size={18} />}
                label="Resultado estimado"
                value={
                  report.netEstimatedUSD >= 0
                    ? `Quedan ${formatUSD(report.netEstimatedUSD)} después de gastos.`
                    : `Faltan ${formatUSD(Math.abs(report.netEstimatedUSD))} para cubrir gastos.`
                }
              />
            </div>
          </PanelCard>
        </section>

        <section className="mt-4">
          <PanelCard
            title="Pedidos que requieren revisión hoy"
            description="Lista rápida de pedidos con pago pendiente, pago parcial, listos sin entregar, cancelados o delivery reportado."
          >
            {filteredAttentionOrders.length === 0 ? (
              <div className="rounded-[1.2rem] border-2 border-green-500 bg-green-50 p-4 text-green-800">
                <p className="text-sm font-black uppercase tracking-[0.14em]">
                  Sin pedidos pendientes de revisión
                </p>
                <p className="mt-2 text-sm font-bold leading-6">
                  No hay pedidos del día marcados como problema operativo en este momento.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredAttentionOrders.map((order) => (
                  <AttentionOrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </PanelCard>
        </section>
      </div>
    </main>
  )
}

function LoginBox({
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  handleLogin,
  errorMessage,
}: {
  passwordInput: string
  setPasswordInput: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  handleLogin: () => void
  errorMessage: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

        <div className="px-6 py-6">
          <a
            href="/local-santo"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} />
            Volver
          </a>

          <Image
            src={BRAND.logoUrl || "/logoremovebg.png"}
            alt={BRAND.name}
            width={112}
            height={112}
            unoptimized
            className="mx-auto mt-6 h-28 w-28 object-contain"
          />

          <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
            Acceso privado
          </p>

          <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
            Resumen del dueño
          </h1>

          <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
            Ingresa la clave autorizada para revisar ventas, cobros, gastos y operación del negocio.
          </p>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              Clave de acceso
            </label>

            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleLogin()
                }}
                placeholder="Ingresa la clave del local"
                className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-red-800">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02]"
          >
            <LogIn size={21} />
            Entrar al resumen
          </button>
        </div>
      </div>
    </main>
  )
}

function RangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.1em] transition ${
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
      }`}
    >
      {children}
    </button>
  )
}

function DateFilterInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-black text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
      />
    </label>
  )
}

function MetricCard({
  label,
  value,
  tone = "soft",
}: {
  label: string
  value: string | number
  tone?: "soft" | "good" | "warning"
}) {
  const toneClass =
    tone === "good"
      ? "border-green-500/40 bg-green-50"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)]"
        : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]"

  return (
    <div className={`rounded-[1.2rem] border-2 px-4 py-3 ${toneClass}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-xl font-black text-[var(--brand-ink-3)]">
        {value}
      </p>
    </div>
  )
}

function BigMetricCard({
  icon,
  title,
  mainValue,
  helper,
  tone = "soft",
}: {
  icon: ReactNode
  title: string
  mainValue: string
  helper: string
  tone?: "soft" | "good" | "warning"
}) {
  const toneClass =
    tone === "good"
      ? "border-green-500/40 bg-green-50"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)]"
        : "border-[var(--brand-primary)] bg-white"

  return (
    <article className={`rounded-[1.5rem] border-2 p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            {title}
          </p>
          <p className="mt-2 break-words text-3xl font-black leading-none text-[var(--brand-ink-3)]">
            {mainValue}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
            {helper}
          </p>
        </div>
      </div>
    </article>
  )
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          {title}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
          {description}
        </p>
      </div>

      {children}
    </section>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value || "—"}
      </p>
    </div>
  )
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  const toneClass =
    alert.tone === "danger"
      ? "border-red-500 bg-red-50 text-red-800"
      : alert.tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
        : alert.tone === "good"
          ? "border-green-500 bg-green-50 text-green-700"
          : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]"

  const iconClass =
    alert.tone === "good"
      ? "bg-green-500 text-white"
      : alert.tone === "danger"
        ? "bg-red-600 text-white"
        : alert.tone === "warning"
          ? "bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          : "bg-white text-[var(--brand-primary)]"

  return (
    <div className={`rounded-2xl border-2 p-4 ${toneClass}`}>
      <div className="flex gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-current ${iconClass}`}>
          {alert.tone === "good" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm font-black uppercase leading-5">
              {alert.title}
            </p>
            {alert.value && (
              <p className="shrink-0 text-sm font-black text-[var(--brand-primary)]">
                {alert.value}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
            {alert.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function RankingList({
  title,
  emptyText,
  items,
}: {
  title: string
  emptyText: string
  items: Array<{
    label: string
    detail: string
    value: string
    subValue?: string
  }>
}) {
  return (
    <PanelCard title={title} description="Ranking del rango seleccionado.">
      {items.length === 0 ? (
        <p className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black uppercase text-[var(--brand-ink-3)]">
                    {index + 1}. {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    {item.detail}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-base font-black text-[var(--brand-primary)]">
                    {item.value}
                  </p>
                  {item.subValue && (
                    <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
                      {item.subValue}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  )
}

function QuickReadLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
      <div className="flex gap-3">
        <div className="mt-0.5 text-[var(--brand-primary)]">{icon}</div>
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            {label}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-3)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function AttentionOrderCard({ order }: { order: LocalOrder }) {
  const payment = getOrderPayment(order)
  const totals = getOrderTotals(order)
  const isReportedDelivery =
    order.deliveryReportStatus === "Entrega reportada" &&
    order.status !== "Entregado"

  const statusIcon =
    order.status === "Entregado" ? (
      <CheckCircle2 size={18} />
    ) : order.status === "Cancelado" ? (
      <XCircle size={18} />
    ) : order.status === "Listo" ? (
      <PackageCheck size={18} />
    ) : (
      <Clock size={18} />
    )

  return (
    <article className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-1 text-xs font-black uppercase text-[var(--brand-primary)]">
              {statusIcon}
              {getDisplayOrderNumber(order)}
            </span>

            <span className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1 text-xs font-black uppercase text-[var(--brand-ink-2)]">
              {payment.status}
            </span>

            {isReportedDelivery && (
              <span className="rounded-full border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-3 py-1 text-xs font-black uppercase text-[var(--brand-amber)]">
                Delivery reportado
              </span>
            )}
          </div>

          <h3 className="mt-3 text-xl font-black uppercase text-[var(--brand-ink-3)]">
            {order.customerName || "Cliente"}
          </h3>

          <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
            {isDeliveryOrder(order) ? "Delivery" : order.orderType} · {getDisplayTableNumber(order)} · {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-right">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            Total
          </p>
          <p className="mt-1 text-xl font-black text-[var(--brand-ink-3)]">
            {formatUSD(totals.totalUSD)}
          </p>
          <p className="mt-1 text-xs font-black text-[var(--brand-ink-2)]/65">
            Pendiente {formatUSD(payment.pendingUSD)}
          </p>
        </div>
      </div>
    </article>
  )
}
