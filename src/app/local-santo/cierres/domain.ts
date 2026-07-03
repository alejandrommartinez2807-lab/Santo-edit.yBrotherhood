import { formatUSD, formatVES } from "@/utils/formatCurrency"

export type SummaryItem = {
  label: string
  count: number
  totalUSD: number
  totalVES?: number
  deliveryCostUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number
}

export type ProductSold = {
  name: string
  quantity: number
  totalUSD: number
  totalVES: number
  onlyCurrency: boolean
}

export type FiscalIvaBucket = {
  rate: number
  baseUSD: number
  ivaUSD: number
}

export type DayCloseExpense = {
  id?: string
  dateLabel?: string
  dateValue?: string
  concept: string
  category: string
  amountUSD: number
  amountVES: number
  equivalentUSD: number
  method: string
  note?: string
  createdAt?: string

  provider?: string
  expenseType?: string
  inventoryLinked?: boolean
  inventoryItemId?: string
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

export type SavedDayClose = {
  id: string
  createdAt: string
  dateLabel: string
  summaryText: string

  ordersRegistered: number
  activeOrders: number
  deliveredOrders: number
  canceledOrders: number
  deliveryRegistered: number
  deliveryDelivered: number
  deliveryActive: number

  totalConfirmedUSD: number
  productSalesUSD: number
  combosUSD: number
  regularUSD: number
  regularVES: number
  deliveryCollectedUSD: number

  pendingTotalUSD: number
  pendingCombosUSD: number
  pendingRegularUSD: number
  pendingRegularVES: number
  pendingDeliveryUSD: number

  totalSoldUSD: number
  realCollectedUSD: number
  realCashUSD: number
  realVES: number
  realVESEquivalentUSD: number
  realPendingUSD: number
  paidOrders: number
  partialPaymentOrders: number
  pendingPaymentOrders: number
  deliveryPaidInUSD: number
  deliveryPaidInVES: number
  deliveryPaidInVESEquivalentUSD: number
  deliveryPaidMixedUSD: number

  fiscalOrders: number
  fiscalSubtotalUSD: number
  fiscalIvaTotalUSD: number
  fiscalIgtfBaseUSD: number
  fiscalIgtfUSD: number
  fiscalTotalUSD: number
  fiscalIvaByRate: FiscalIvaBucket[]

  expensesCount: number
  expensesTotalUSD: number
  expensesCashUSD: number
  expensesVES: number
  expensesVESEquivalentUSD: number
  netEstimatedUSD: number
  expenses: DayCloseExpense[]

  supplierPaymentsCount: number
  supplierPaymentsUSD: number
  supplierPaymentsVES: number
  supplierPaymentsEquivalentUSD: number
  netAfterPurchasesUSD: number

  salesByType: SummaryItem[]
  deliveryByPayment: SummaryItem[]
  deliveryByZone: SummaryItem[]
  paymentByStatus: SummaryItem[]
  paymentByUSDMethod: SummaryItem[]
  paymentByVESMethod: SummaryItem[]
  deliveryByPaymentIn: SummaryItem[]
  productsSold: ProductSold[]
}

export type LoginBoxProps = {
  passwordInput: string
  setPasswordInput: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  handleLogin: () => void
  errorMessage: string | null
}

export type PaymentFilter =
  | "Todos"
  | "Con cobro completo"
  | "Con pendiente"
  | "Con pago parcial"
  | "Sin cobros"

export const PAYMENT_FILTERS: PaymentFilter[] = [
  "Todos",
  "Con cobro completo",
  "Con pendiente",
  "Con pago parcial",
  "Sin cobros",
]

export type ReportViewMode = "Simple" | "Negocio" | "Avanzado"

export const REPORT_VIEW_MODES: {
  mode: ReportViewMode
  label: string
  description: string
}[] = [
  {
    mode: "Simple",
    label: "Simple",
    description: "Solo números clave, ranking principal y lista de cierres.",
  },
  {
    mode: "Negocio",
    label: "Negocio",
    description: "Agrega alertas y gráficas útiles para revisar el local.",
  },
  {
    mode: "Avanzado",
    label: "Avanzado",
    description: "Muestra auditoría completa, métodos, productos, zonas y texto guardado.",
  },
]

export function isReportViewMode(value: unknown): value is ReportViewMode {
  return value === "Simple" || value === "Negocio" || value === "Avanzado"
}

export type SmartAlertTone = "danger" | "warning" | "good" | "info"

export type SmartAlert = {
  title: string
  description: string
  tone: SmartAlertTone
  value?: string
}

export function readApiResponse(response: Response) {
  return response.text().then((text) => {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        "El servidor respondió con una página HTML en vez de datos. Revisa que la API de cierres y Supabase estén funcionando correctamente."
      )
    }
  })
}

export function toNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

export function toText(value: unknown) {
  return String(value || "")
}

export function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value

  const normalized = toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "si" ||
    normalized === "sí" ||
    normalized === "activo" ||
    normalized === "activa"
  )
}

export function normalizeSummaryItem(value: unknown): SummaryItem | null {
  if (!value || typeof value !== "object") return null

  const item = value as Record<string, unknown>
  const label = toText(item.label || item.name || "Sin dato")

  return {
    label: label.trim() || "Sin dato",
    count: toNumber(item.count),
    totalUSD: toNumber(item.totalUSD),
    totalVES: toNumber(item.totalVES),
    deliveryCostUSD: toNumber(item.deliveryCostUSD),
    totalCombosUSD: toNumber(item.totalCombosUSD),
    totalRegularUSD: toNumber(item.totalRegularUSD),
    totalRegularVES: toNumber(item.totalRegularVES),
  }
}

export function normalizeSummaryArray(value: unknown): SummaryItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeSummaryItem)
    .filter((item): item is SummaryItem => Boolean(item))
}

export function normalizeProductSold(value: unknown): ProductSold | null {
  if (!value || typeof value !== "object") return null

  const product = value as Record<string, unknown>
  const name = toText(product.name || "Producto")

  return {
    name: name.trim() || "Producto",
    quantity: toNumber(product.quantity),
    totalUSD: toNumber(product.totalUSD),
    totalVES: toNumber(product.totalVES),
    onlyCurrency: Boolean(product.onlyCurrency),
  }
}

export function normalizeFiscalIvaByRate(value: unknown): FiscalIvaBucket[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const bucket = item as Record<string, unknown>
    return {
      rate: toNumber(bucket.rate),
      baseUSD: toNumber(bucket.baseUSD),
      ivaUSD: toNumber(bucket.ivaUSD),
    }
  })
}

export function normalizeProductsSold(value: unknown): ProductSold[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeProductSold)
    .filter((product): product is ProductSold => Boolean(product))
}

export function normalizeDayCloseExpense(value: unknown): DayCloseExpense | null {
  if (!value || typeof value !== "object") return null

  const expense = value as Record<string, unknown>
  const concept = toText(expense.concept || expense.name || "Gasto")
  const category = toText(expense.category || "Sin categoría")
  const method = toText(expense.method || "Sin método")

  return {
    id: toText(expense.id),
    dateLabel: toText(expense.dateLabel),
    dateValue: toText(expense.dateValue),
    concept: concept.trim() || "Gasto",
    category: category.trim() || "Sin categoría",
    amountUSD: toNumber(expense.amountUSD),
    amountVES: toNumber(expense.amountVES),
    equivalentUSD: toNumber(expense.equivalentUSD),
    method: method.trim() || "Sin método",
    note: toText(expense.note),
    createdAt: toText(expense.createdAt),

    provider: toText(expense.provider || expense.supplier).trim(),
    expenseType:
      toText(expense.expenseType || expense.type).trim() || "Gasto operativo",
    inventoryLinked:
      toBoolean(expense.inventoryLinked) ||
      toBoolean(expense.relatedInventory) ||
      Boolean(
        toText(expense.inventoryItemId).trim() ||
          toText(expense.inventoryItemName).trim() ||
          toNumber(expense.inventoryQuantity) > 0
      ),
    inventoryItemId: toText(expense.inventoryItemId).trim(),
    inventoryItemName: toText(expense.inventoryItemName).trim(),
    inventoryQuantity: toNumber(expense.inventoryQuantity),
    inventoryUnit: toText(expense.inventoryUnit).trim() || "unidades",
  }
}

export function normalizeDayCloseExpenses(value: unknown): DayCloseExpense[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeDayCloseExpense)
    .filter((expense): expense is DayCloseExpense => Boolean(expense))
}

export function normalizeDayClose(value: unknown): SavedDayClose | null {
  if (!value || typeof value !== "object") return null

  const close = value as Record<string, unknown>
  const id = toText(close.id || close.closeId || "").trim()

  if (!id) return null

  return {
    id,
    createdAt: toText(close.createdAt),
    dateLabel: toText(close.dateLabel),
    summaryText: toText(close.summaryText),

    ordersRegistered: toNumber(close.ordersRegistered),
    activeOrders: toNumber(close.activeOrders),
    deliveredOrders: toNumber(close.deliveredOrders),
    canceledOrders: toNumber(close.canceledOrders),
    deliveryRegistered: toNumber(close.deliveryRegistered),
    deliveryDelivered: toNumber(close.deliveryDelivered),
    deliveryActive: toNumber(close.deliveryActive),

    totalConfirmedUSD: toNumber(close.totalConfirmedUSD),
    productSalesUSD: toNumber(close.productSalesUSD),
    combosUSD: toNumber(close.combosUSD),
    regularUSD: toNumber(close.regularUSD),
    regularVES: toNumber(close.regularVES),
    deliveryCollectedUSD: toNumber(close.deliveryCollectedUSD),

    pendingTotalUSD: toNumber(close.pendingTotalUSD),
    pendingCombosUSD: toNumber(close.pendingCombosUSD),
    pendingRegularUSD: toNumber(close.pendingRegularUSD),
    pendingRegularVES: toNumber(close.pendingRegularVES),
    pendingDeliveryUSD: toNumber(close.pendingDeliveryUSD),

    totalSoldUSD: toNumber(close.totalSoldUSD),
    realCollectedUSD: toNumber(close.realCollectedUSD),
    realCashUSD: toNumber(close.realCashUSD),
    realVES: toNumber(close.realVES),
    realVESEquivalentUSD: toNumber(close.realVESEquivalentUSD),
    realPendingUSD: toNumber(close.realPendingUSD),
    paidOrders: toNumber(close.paidOrders),
    partialPaymentOrders: toNumber(close.partialPaymentOrders),
    pendingPaymentOrders: toNumber(close.pendingPaymentOrders),
    deliveryPaidInUSD: toNumber(close.deliveryPaidInUSD),
    deliveryPaidInVES: toNumber(close.deliveryPaidInVES),
    deliveryPaidInVESEquivalentUSD: toNumber(close.deliveryPaidInVESEquivalentUSD),
    deliveryPaidMixedUSD: toNumber(close.deliveryPaidMixedUSD),

    fiscalOrders: toNumber(close.fiscalOrders),
    fiscalSubtotalUSD: toNumber(close.fiscalSubtotalUSD),
    fiscalIvaTotalUSD: toNumber(close.fiscalIvaTotalUSD),
    fiscalIgtfBaseUSD: toNumber(close.fiscalIgtfBaseUSD),
    fiscalIgtfUSD: toNumber(close.fiscalIgtfUSD),
    fiscalTotalUSD: toNumber(close.fiscalTotalUSD),
    fiscalIvaByRate: normalizeFiscalIvaByRate(close.fiscalIvaByRate),

    expensesCount: toNumber(close.expensesCount),
    expensesTotalUSD: toNumber(close.expensesTotalUSD),
    expensesCashUSD: toNumber(close.expensesCashUSD),
    expensesVES: toNumber(close.expensesVES),
    expensesVESEquivalentUSD: toNumber(close.expensesVESEquivalentUSD),
    netEstimatedUSD: toNumber(close.netEstimatedUSD),
    expenses: normalizeDayCloseExpenses(close.expenses),

    supplierPaymentsCount: toNumber(close.supplierPaymentsCount),
    supplierPaymentsUSD: toNumber(close.supplierPaymentsUSD),
    supplierPaymentsVES: toNumber(close.supplierPaymentsVES),
    supplierPaymentsEquivalentUSD: toNumber(close.supplierPaymentsEquivalentUSD),
    netAfterPurchasesUSD: toNumber(close.netAfterPurchasesUSD),

    salesByType: normalizeSummaryArray(close.salesByType),
    deliveryByPayment: normalizeSummaryArray(close.deliveryByPayment),
    deliveryByZone: normalizeSummaryArray(close.deliveryByZone),
    paymentByStatus: normalizeSummaryArray(close.paymentByStatus),
    paymentByUSDMethod: normalizeSummaryArray(close.paymentByUSDMethod),
    paymentByVESMethod: normalizeSummaryArray(close.paymentByVESMethod),
    deliveryByPaymentIn: normalizeSummaryArray(close.deliveryByPaymentIn),
    productsSold: normalizeProductsSold(close.productsSold),
  }
}

export function normalizeDayCloses(value: unknown): SavedDayClose[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeDayClose)
    .filter((close): close is SavedDayClose => Boolean(close))
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
      if (Number.isNaN(aTime)) return 1
      if (Number.isNaN(bTime)) return -1

      return bTime - aTime
    })
}

export function formatDate(value: string) {
  if (!value) return "Sin fecha guardada"

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

export function getCloseTitle(close: SavedDayClose) {
  return close.dateLabel || formatDate(close.createdAt) || close.id
}

export function getCloseNetEstimatedUSD(close: SavedDayClose) {
  const calculatedNet = close.realCollectedUSD - close.expensesTotalUSD

  if (close.expensesTotalUSD <= 0 && close.netEstimatedUSD <= 0) {
    return calculatedNet
  }

  return close.netEstimatedUSD || calculatedNet
}

// Neto después de compras = neto estimado − salidas a proveedores del día.
// Cae al neto estimado si el cierre es previo a esta función (sin datos).
export function getCloseNetAfterPurchasesUSD(close: SavedDayClose) {
  const net = getCloseNetEstimatedUSD(close)

  if (close.supplierPaymentsEquivalentUSD <= 0 && close.netAfterPurchasesUSD === 0) {
    return net
  }

  return close.netAfterPurchasesUSD || net - close.supplierPaymentsEquivalentUSD
}

export function getClosePaymentState(close: SavedDayClose) {
  const hasSoldAmount = close.totalSoldUSD > 0
  const hasCollectedAmount = close.realCollectedUSD > 0
  const hasPendingAmount = close.realPendingUSD > 0

  if (!hasSoldAmount && !hasCollectedAmount && !hasPendingAmount) {
    return {
      label: "Sin cobros",
      className: "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/70",
    }
  }

  if (!hasCollectedAmount && hasPendingAmount) {
    return {
      label: "Sin cobro",
      className: "border-red-500 bg-red-50 text-red-700",
    }
  }

  if (close.partialPaymentOrders > 0) {
    return {
      label: "Pago parcial",
      className: "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]",
    }
  }

  if (hasPendingAmount) {
    return {
      label: "Con pendiente",
      className: "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]",
    }
  }

  if (hasSoldAmount && hasCollectedAmount) {
    return {
      label: "Cobro completo",
      className: "border-green-500 bg-green-50 text-green-700",
    }
  }

  return {
    label: "Sin cobros",
    className: "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/70",
  }
}

export function matchesPaymentFilter(close: SavedDayClose, filter: PaymentFilter) {
  if (filter === "Todos") return true

  if (filter === "Con cobro completo") {
    return close.realPendingUSD <= 0 && close.realCollectedUSD > 0
  }

  if (filter === "Con pendiente") {
    return close.realPendingUSD > 0
  }

  if (filter === "Con pago parcial") {
    return close.partialPaymentOrders > 0
  }

  if (filter === "Sin cobros") {
    return close.realCollectedUSD <= 0
  }

  return true
}

export function getDayCloseTotals(dayCloses: SavedDayClose[]) {
  return dayCloses.reduce(
    (totals, close) => {
      totals.cierres += 1
      totals.totalSoldUSD += close.totalSoldUSD
      totals.realCollectedUSD += close.realCollectedUSD
      totals.realPendingUSD += close.realPendingUSD
      totals.realCashUSD += close.realCashUSD
      totals.realVES += close.realVES
      totals.realVESEquivalentUSD += close.realVESEquivalentUSD
      totals.deliveryCollectedUSD += close.deliveryCollectedUSD
      totals.expensesCount += close.expensesCount
      totals.expensesTotalUSD += close.expensesTotalUSD
      totals.expensesCashUSD += close.expensesCashUSD
      totals.expensesVES += close.expensesVES
      totals.expensesVESEquivalentUSD += close.expensesVESEquivalentUSD
      totals.netEstimatedUSD += getCloseNetEstimatedUSD(close)
      totals.paidOrders += close.paidOrders
      totals.partialPaymentOrders += close.partialPaymentOrders
      totals.pendingPaymentOrders += close.pendingPaymentOrders
      totals.fiscalOrders += close.fiscalOrders
      totals.fiscalSubtotalUSD += close.fiscalSubtotalUSD
      totals.fiscalIvaTotalUSD += close.fiscalIvaTotalUSD
      totals.fiscalIgtfBaseUSD += close.fiscalIgtfBaseUSD
      totals.fiscalIgtfUSD += close.fiscalIgtfUSD
      totals.fiscalTotalUSD += close.fiscalTotalUSD

      return totals
    },
    {
      cierres: 0,
      totalSoldUSD: 0,
      realCollectedUSD: 0,
      realPendingUSD: 0,
      realCashUSD: 0,
      realVES: 0,
      realVESEquivalentUSD: 0,
      deliveryCollectedUSD: 0,
      expensesCount: 0,
      expensesTotalUSD: 0,
      expensesCashUSD: 0,
      expensesVES: 0,
      expensesVESEquivalentUSD: 0,
      netEstimatedUSD: 0,
      paidOrders: 0,
      partialPaymentOrders: 0,
      pendingPaymentOrders: 0,
      fiscalOrders: 0,
      fiscalSubtotalUSD: 0,
      fiscalIvaTotalUSD: 0,
      fiscalIgtfBaseUSD: 0,
      fiscalIgtfUSD: 0,
      fiscalTotalUSD: 0,
    }
  )
}

export function getDateKeyInCaracas(value: string) {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

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

export function isCloseInsideDateRange(close: SavedDayClose, startDate: string, endDate: string) {
  if (!startDate && !endDate) return true

  const closeDateKey = getDateKeyInCaracas(close.createdAt)

  if (!closeDateKey) return false
  if (startDate && closeDateKey < startDate) return false
  if (endDate && closeDateKey > endDate) return false

  return true
}

export function getTodayDateInputValue() {
  return getDateKeyInCaracas(new Date().toISOString())
}

export function getDateInputValueDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  return getDateKeyInCaracas(date.toISOString())
}

export function combineSummaryItems(items: SummaryItem[]) {
  const summaryMap = new Map<string, SummaryItem>()

  items.forEach((item) => {
    const label = item.label.trim() || "Sin dato"
    const current = summaryMap.get(label) || {
      label,
      count: 0,
      totalUSD: 0,
      totalVES: 0,
      deliveryCostUSD: 0,
      totalCombosUSD: 0,
      totalRegularUSD: 0,
      totalRegularVES: 0,
    }

    current.count += toNumber(item.count)
    current.totalUSD += toNumber(item.totalUSD)
    current.totalVES = toNumber(current.totalVES) + toNumber(item.totalVES)
    current.deliveryCostUSD =
      toNumber(current.deliveryCostUSD) + toNumber(item.deliveryCostUSD)
    current.totalCombosUSD =
      toNumber(current.totalCombosUSD) + toNumber(item.totalCombosUSD)
    current.totalRegularUSD =
      toNumber(current.totalRegularUSD) + toNumber(item.totalRegularUSD)
    current.totalRegularVES =
      toNumber(current.totalRegularVES) + toNumber(item.totalRegularVES)

    summaryMap.set(label, current)
  })

  return Array.from(summaryMap.values())
    .map((item) => ({
      ...item,
      count: toNumber(item.count),
      totalUSD: toNumber(item.totalUSD),
      totalVES: toNumber(item.totalVES),
      deliveryCostUSD: toNumber(item.deliveryCostUSD),
      totalCombosUSD: toNumber(item.totalCombosUSD),
      totalRegularUSD: toNumber(item.totalRegularUSD),
      totalRegularVES: toNumber(item.totalRegularVES),
    }))
    .sort((a, b) => {
      if (b.totalUSD !== a.totalUSD) return b.totalUSD - a.totalUSD
      return b.count - a.count
    })
}

export function combineProductsSold(products: ProductSold[]) {
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
    current.onlyCurrency = current.onlyCurrency && Boolean(product.onlyCurrency)

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

export function combineExpensesByField(
  expenses: DayCloseExpense[],
  field: "category" | "method" | "provider" | "expenseType"
) {
  const summaryMap = new Map<string, SummaryItem>()

  expenses.forEach((expense) => {
    const fallbackLabel =
      field === "provider"
        ? "Sin proveedor"
        : field === "expenseType"
          ? "Sin tipo"
          : "Sin dato"
    const label = (expense[field] || fallbackLabel).trim() || fallbackLabel
    const current = summaryMap.get(label) || {
      label,
      count: 0,
      totalUSD: 0,
      totalVES: 0,
      deliveryCostUSD: 0,
      totalCombosUSD: 0,
      totalRegularUSD: 0,
      totalRegularVES: 0,
    }

    current.count += 1
    current.totalUSD += toNumber(expense.equivalentUSD)
    current.totalVES = toNumber(current.totalVES) + toNumber(expense.amountVES)

    summaryMap.set(label, current)
  })

  return Array.from(summaryMap.values())
    .map((item) => ({
      ...item,
      count: toNumber(item.count),
      totalUSD: toNumber(item.totalUSD),
      totalVES: toNumber(item.totalVES),
    }))
    .sort((a, b) => {
      if (b.totalUSD !== a.totalUSD) return b.totalUSD - a.totalUSD
      return b.count - a.count
    })
}

export function getInventoryExpenseTotals(expenses: DayCloseExpense[]) {
  return expenses.reduce(
    (totals, expense) => {
      const isInventoryLinked =
        Boolean(expense.inventoryLinked) ||
        Boolean(expense.inventoryItemId) ||
        Boolean(expense.inventoryItemName) ||
        toNumber(expense.inventoryQuantity) > 0

      if (!isInventoryLinked) {
        return totals
      }

      totals.count += 1
      totals.totalUSD += toNumber(expense.equivalentUSD)
      totals.totalVES += toNumber(expense.amountVES)

      return totals
    },
    {
      count: 0,
      totalUSD: 0,
      totalVES: 0,
    }
  )
}

export function getRangeReport(dayCloses: SavedDayClose[]) {
  const allProducts = combineProductsSold(
    dayCloses.flatMap((close) => close.productsSold)
  )
  const deliveryByZone = combineSummaryItems(
    dayCloses.flatMap((close) => close.deliveryByZone)
  )
  const paymentByUSDMethod = combineSummaryItems(
    dayCloses.flatMap((close) => close.paymentByUSDMethod)
  )
  const paymentByVESMethod = combineSummaryItems(
    dayCloses.flatMap((close) => close.paymentByVESMethod)
  )
  const paymentByStatus = combineSummaryItems(
    dayCloses.flatMap((close) => close.paymentByStatus)
  )
  const deliveryByPaymentIn = combineSummaryItems(
    dayCloses.flatMap((close) => close.deliveryByPaymentIn)
  )
  const salesByType = combineSummaryItems(
    dayCloses.flatMap((close) => close.salesByType)
  )
  const allExpenses = dayCloses.flatMap((close) => close.expenses)
  const expensesByCategory = combineExpensesByField(allExpenses, "category")
  const expensesByMethod = combineExpensesByField(allExpenses, "method")
  const expensesByProvider = combineExpensesByField(allExpenses, "provider")
  const expensesByType = combineExpensesByField(allExpenses, "expenseType")
  const inventoryExpenses = getInventoryExpenseTotals(allExpenses)

  const operationalTotals = dayCloses.reduce(
    (totals, close) => {
      totals.ordersRegistered += close.ordersRegistered
      totals.deliveredOrders += close.deliveredOrders
      totals.activeOrders += close.activeOrders
      totals.canceledOrders += close.canceledOrders
      totals.deliveryRegistered += close.deliveryRegistered
      totals.deliveryDelivered += close.deliveryDelivered
      totals.deliveryActive += close.deliveryActive
      totals.totalConfirmedUSD += close.totalConfirmedUSD
      totals.productSalesUSD += close.productSalesUSD
      totals.combosUSD += close.combosUSD
      totals.regularUSD += close.regularUSD
      totals.regularVES += close.regularVES
      totals.deliveryCollectedUSD += close.deliveryCollectedUSD
      totals.pendingTotalUSD += close.pendingTotalUSD
      totals.pendingCombosUSD += close.pendingCombosUSD
      totals.pendingRegularUSD += close.pendingRegularUSD
      totals.pendingRegularVES += close.pendingRegularVES
      totals.pendingDeliveryUSD += close.pendingDeliveryUSD

      return totals
    },
    {
      ordersRegistered: 0,
      deliveredOrders: 0,
      activeOrders: 0,
      canceledOrders: 0,
      deliveryRegistered: 0,
      deliveryDelivered: 0,
      deliveryActive: 0,
      totalConfirmedUSD: 0,
      productSalesUSD: 0,
      combosUSD: 0,
      regularUSD: 0,
      regularVES: 0,
      deliveryCollectedUSD: 0,
      pendingTotalUSD: 0,
      pendingCombosUSD: 0,
      pendingRegularUSD: 0,
      pendingRegularVES: 0,
      pendingDeliveryUSD: 0,
    }
  )

  return {
    allProducts,
    topProduct: allProducts[0],
    deliveryByZone,
    topDeliveryZone: deliveryByZone[0],
    paymentByUSDMethod,
    topUSDMethod: paymentByUSDMethod[0],
    paymentByVESMethod,
    topVESMethod: paymentByVESMethod[0],
    paymentByStatus,
    deliveryByPaymentIn,
    topDeliveryPaymentIn: deliveryByPaymentIn[0],
    salesByType,
    allExpenses,
    expensesByCategory,
    topExpenseCategory: expensesByCategory[0],
    expensesByMethod,
    topExpenseMethod: expensesByMethod[0],
    expensesByProvider,
    topExpenseProvider: expensesByProvider[0],
    expensesByType,
    topExpenseType: expensesByType[0],
    inventoryExpenses: {
      count: toNumber(inventoryExpenses.count),
      totalUSD: toNumber(inventoryExpenses.totalUSD),
      totalVES: toNumber(inventoryExpenses.totalVES),
    },
    operationalTotals,
  }
}

export function normalizeAlertText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function findSummaryItemByLabel(items: SummaryItem[], keywords: string[]) {
  return items.find((item) => {
    const label = normalizeAlertText(item.label)

    return keywords.some((keyword) => label.includes(normalizeAlertText(keyword)))
  })
}

export function getRangeAlerts(
  dayCloses: SavedDayClose[],
  totals: ReturnType<typeof getDayCloseTotals>,
  report: ReturnType<typeof getRangeReport>
): SmartAlert[] {
  if (!dayCloses.length) {
    return [
      {
        title: "Sin cierres en pantalla",
        description:
          "Ajusta los filtros o carga cierres nuevos para que el sistema pueda analizar el rango.",
        tone: "info",
      },
    ]
  }

  const alerts: SmartAlert[] = []
  const collectionRate =
    totals.totalSoldUSD > 0
      ? Math.round((totals.realCollectedUSD / totals.totalSoldUSD) * 100)
      : 0
  const pendingRate =
    totals.totalSoldUSD > 0
      ? Math.round((totals.realPendingUSD / totals.totalSoldUSD) * 100)
      : 0

  if (totals.totalSoldUSD > 0 && pendingRate >= 60) {
    alerts.push({
      title: "Pendiente de cobro muy alto",
      description:
        "Más de la mitad de lo vendido en este rango sigue pendiente. Conviene revisar caja antes de cerrar la operación.",
      tone: "danger",
      value: `${pendingRate}% pendiente`,
    })
  } else if (totals.totalSoldUSD > 0 && pendingRate >= 25) {
    alerts.push({
      title: "Pendiente de cobro importante",
      description:
        "Hay una parte relevante de las ventas todavía sin cobrar. Revisa los pedidos pendientes o parciales.",
      tone: "warning",
      value: `${pendingRate}% pendiente`,
    })
  }

  if (totals.totalSoldUSD > 0 && totals.realPendingUSD <= 0.01 && totals.realCollectedUSD > 0) {
    alerts.push({
      title: "Cobro completo en el rango",
      description:
        "Todo lo vendido en los cierres filtrados aparece cubierto como cobrado real.",
      tone: "good",
      value: `${collectionRate}% cobrado`,
    })
  }

  if (totals.pendingPaymentOrders > 0) {
    alerts.push({
      title: "Pedidos pendientes de pago",
      description:
        "Existen pedidos registrados como pendientes. Esta es la primera revisión que debería hacer caja.",
      tone: "warning",
      value: `${totals.pendingPaymentOrders} pedido(s)`,
    })
  }

  if (totals.partialPaymentOrders > 0) {
    alerts.push({
      title: "Pagos parciales detectados",
      description:
        "Hay pedidos con abono parcial. Conviene confirmar si fueron completados antes del cierre definitivo.",
      tone: "warning",
      value: `${totals.partialPaymentOrders} pedido(s)`,
    })
  }

  const closesWithSalesButNoDelivered = dayCloses.filter(
    (close) => close.totalSoldUSD > 0 && close.deliveredOrders <= 0
  )

  if (closesWithSalesButNoDelivered.length > 0) {
    alerts.push({
      title: "Ventas con pedidos no entregados",
      description:
        "Hay cierres con venta registrada, pero sin pedidos entregados. Puede ser normal si eran pedidos activos, pero vale la pena revisarlo.",
      tone: "info",
      value: `${closesWithSalesButNoDelivered.length} cierre(s)`,
    })
  }

  if (report.operationalTotals.pendingDeliveryUSD > 0.01) {
    alerts.push({
      title: "Delivery pendiente",
      description:
        "El rango tiene costos de delivery pendientes. Revisa si esos pedidos siguen activos o si falta marcar la forma de cobro.",
      tone: "warning",
      value: formatUSD(report.operationalTotals.pendingDeliveryUSD),
    })
  }

  if (totals.expensesTotalUSD > 0) {
    alerts.push({
      title: "Gastos registrados en el rango",
      description:
        "Estos cierres ya incluyen salidas de caja. Revisa el neto estimado para entender cuánto quedó después de gastos.",
      tone: totals.netEstimatedUSD < 0 ? "warning" : "info",
      value: `${formatUSD(totals.expensesTotalUSD)} · Neto ${formatUSD(totals.netEstimatedUSD)}`,
    })
  }

  if (totals.expensesTotalUSD > totals.realCollectedUSD && totals.expensesTotalUSD > 0) {
    alerts.push({
      title: "Gastos por encima de lo cobrado",
      description:
        "El rango muestra más gastos que cobro real. Puede ser normal si se registraron compras sin ventas, pero conviene revisarlo.",
      tone: "warning",
      value: `Neto ${formatUSD(totals.netEstimatedUSD)}`,
    })
  }

  const usdWithoutMethod = findSummaryItemByLabel(report.paymentByUSDMethod, [
    "sin metodo",
    "sin método",
  ])

  if (usdWithoutMethod && usdWithoutMethod.totalUSD > 0) {
    alerts.push({
      title: "Divisas sin método registrado",
      description:
        "Hay cobros en divisas sin método claro. Para auditoría, conviene marcar si fue efectivo, Zelle, Binance, USDT u otro.",
      tone: "warning",
      value: formatUSD(usdWithoutMethod.totalUSD),
    })
  }

  const vesWithoutMethod = findSummaryItemByLabel(report.paymentByVESMethod, [
    "sin metodo",
    "sin método",
  ])

  if (vesWithoutMethod && (vesWithoutMethod.totalVES || vesWithoutMethod.totalUSD) > 0) {
    alerts.push({
      title: "Bolívares sin método registrado",
      description:
        "Hay cobros en bolívares sin método claro. Para control interno, conviene registrar si fue pago móvil, punto, transferencia o efectivo.",
      tone: "warning",
      value: `Bs ${formatVES(vesWithoutMethod.totalVES || 0)}`,
    })
  }

  const unregisteredDeliveryPayment = findSummaryItemByLabel(
    report.deliveryByPaymentIn,
    ["sin registrar", "sin dato"]
  )

  if (
    unregisteredDeliveryPayment &&
    (unregisteredDeliveryPayment.totalUSD > 0 ||
      (unregisteredDeliveryPayment.deliveryCostUSD || 0) > 0)
  ) {
    alerts.push({
      title: "Delivery sin forma de cobro",
      description:
        "Hay delivery cobrado o registrado sin forma de cobro clara. Revisa si fue divisas, bolívares o mixto.",
      tone: "warning",
      value: formatUSD(
        unregisteredDeliveryPayment.deliveryCostUSD ||
          unregisteredDeliveryPayment.totalUSD
      ),
    })
  }

  if (report.topProduct && report.topProduct.quantity > 0) {
    alerts.push({
      title: "Producto fuerte del rango",
      description:
        "Este producto lidera por unidades vendidas dentro de los cierres filtrados.",
      tone: "good",
      value: `${report.topProduct.name} · ${report.topProduct.quantity} unidad(es)`,
    })
  }

  if (report.topDeliveryZone && report.topDeliveryZone.count > 0) {
    alerts.push({
      title: "Zona delivery con más movimiento",
      description:
        "Esta zona concentra la mayor actividad de delivery dentro del rango filtrado.",
      tone: "info",
      value: `${report.topDeliveryZone.label} · ${report.topDeliveryZone.count} registro(s)`,
    })
  }

  const hasRiskAlert = alerts.some(
    (alert) => alert.tone === "danger" || alert.tone === "warning"
  )

  if (!hasRiskAlert && totals.totalSoldUSD > 0) {
    alerts.unshift({
      title: "Sin alertas críticas",
      description:
        "No se detectaron pendientes altos, pagos parciales ni métodos faltantes en el rango actual.",
      tone: "good",
      value: `${collectionRate}% cobrado`,
    })
  }

  return alerts.slice(0, 8)
}

export function getSingleCloseAlerts(close: SavedDayClose) {
  const closes = [close]

  return getRangeAlerts(closes, getDayCloseTotals(closes), getRangeReport(closes))
}

export function createSafeFileName(value: string) {
  const cleanValue = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  return cleanValue || "cierre-santo-perrito"
}

export function escapeCsvValue(value: unknown) {
  const text = String(value ?? "")

  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function buildDayClosesCsv(dayCloses: SavedDayClose[]) {
  const headers = [
    "ID cierre",
    "Fecha guardado",
    "Fecha cierre",
    "Estado visual",
    "Pedidos registrados",
    "Pedidos entregados",
    "Pedidos activos",
    "Pedidos cancelados",
    "Total vendido USD",
    "Total cobrado real USD",
    "Divisas recibidas USD",
    "Bolívares recibidos Bs",
    "Equiv. Bs USD",
    "Pendiente cobro USD",
    "Pedidos con fiscal",
    "Base fiscal USD",
    "IVA fiscal USD",
    "Base IGTF USD",
    "IGTF USD",
    "Total fiscal USD",
    "Delivery cobrado USD",
    "Gastos registrados",
    "Gastos total USD",
    "Gastos divisas USD",
    "Gastos bolívares Bs",
    "Gastos bolívares equiv USD",
    "Neto estimado USD",
    "Abonos proveedores registros",
    "Salidas a proveedores USD",
    "Neto después de compras USD",
    "Proveedor principal",
    "Tipo gasto principal",
    "Compras inventario USD",
    "Compras inventario registros",
    "Pedidos pagados",
    "Pedidos pago parcial",
    "Pedidos pendientes",
  ]

  const rows = dayCloses.map((close) => {
    const topExpenseProvider = combineExpensesByField(close.expenses, "provider")[0]
    const topExpenseType = combineExpensesByField(close.expenses, "expenseType")[0]
    const inventoryExpenses = getInventoryExpenseTotals(close.expenses)

    return [
    close.id,
    formatDate(close.createdAt),
    getCloseTitle(close),
    getClosePaymentState(close).label,
    close.ordersRegistered,
    close.deliveredOrders,
    close.activeOrders,
    close.canceledOrders,
    close.totalSoldUSD,
    close.realCollectedUSD,
    close.realCashUSD,
    close.realVES,
    close.realVESEquivalentUSD,
    close.realPendingUSD,
    close.fiscalOrders,
    close.fiscalSubtotalUSD,
    close.fiscalIvaTotalUSD,
    close.fiscalIgtfBaseUSD,
    close.fiscalIgtfUSD,
    close.fiscalTotalUSD,
    close.deliveryCollectedUSD,
    close.expensesCount,
    close.expensesTotalUSD,
    close.expensesCashUSD,
    close.expensesVES,
    close.expensesVESEquivalentUSD,
    getCloseNetEstimatedUSD(close),
    toNumber(close.supplierPaymentsCount),
    toNumber(close.supplierPaymentsEquivalentUSD),
    getCloseNetAfterPurchasesUSD(close),
    topExpenseProvider?.label || "",
    topExpenseType?.label || "",
    toNumber(inventoryExpenses.totalUSD),
    toNumber(inventoryExpenses.count),
    close.paidOrders,
    close.partialPaymentOrders,
    close.pendingPaymentOrders,
  ]
  })

  const csvRows = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\r\n")

  return `sep=;\r\n${csvRows}`
}
