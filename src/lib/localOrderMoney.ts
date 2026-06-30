import type {
  DeliveryPaymentIn,
  LocalOrder,
  OrderItem,
  OrderPayment,
  OrderTotals,
  PaymentDraft,
  PaymentForm,
  PaymentStatus,
} from "@/types/localOrders"
import {
  getOrderDeliveryCost,
  isComboItem,
  normalizeComparableText,
} from "@/lib/localOrderHelpers"

export function roundMoney(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

export function parseMoneyInput(value: string) {
  const rawValue = String(value || "")
    .trim()
    .replace(/\s/g, "")

  if (!rawValue) {
    return 0
  }

  const hasComma = rawValue.includes(",")
  const hasDot = rawValue.includes(".")
  const lastCommaIndex = rawValue.lastIndexOf(",")
  const lastDotIndex = rawValue.lastIndexOf(".")

  let normalizedValue = rawValue

  if (hasComma && hasDot) {
    if (lastCommaIndex > lastDotIndex) {
      normalizedValue = rawValue.replace(/\./g, "").replace(",", ".")
    } else {
      normalizedValue = rawValue.replace(/,/g, "")
    }
  } else if (hasComma) {
    normalizedValue = rawValue.replace(",", ".")
  }

  const numberValue = Number(normalizedValue)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0
  }

  return roundMoney(numberValue)
}

export function formatMoneyForInput(value: number) {
  const moneyValue = roundMoney(value)

  if (moneyValue <= 0) {
    return ""
  }

  return moneyValue.toFixed(2)
}

export function calculatePaymentStatus(
  receivedEquivalentUSD: number,
  totalOrderUSD: number
): PaymentStatus {
  const received = roundMoney(receivedEquivalentUSD)
  const total = roundMoney(totalOrderUSD)

  if (received <= 0) return "Pendiente"
  if (received >= total - 0.01) return "Pagado"

  return "Pago parcial"
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === "Pago parcial" || value === "Pagado") return value

  return "Pendiente"
}

export function normalizeDeliveryPaymentIn(value: unknown): DeliveryPaymentIn {
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

export function normalizePaymentMethodUSD(value: unknown) {
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
    normalized.includes("efectivo") ||
    normalized === "divisas" ||
    normalized === "divisa" ||
    normalized === "usd" ||
    normalized === "cash"
  ) {
    return "Efectivo divisas"
  }

  if (normalized.includes("zelle")) return "Zelle"
  if (normalized.includes("binance")) return "Binance"
  if (normalized.includes("usdt") || normalized.includes("tether")) return "USDT"
  if (
    normalized.includes("transferencia internacional") ||
    normalized.includes("transferencia externa") ||
    normalized.includes("wire")
  ) {
    return "Transferencia internacional"
  }

  return "Otro"
}

export function normalizePaymentMethodVES(value: unknown) {
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
    normalized.includes("pago movil") ||
    normalized.includes("pagomovil") ||
    normalized.includes("movil")
  ) {
    return "Pago móvil"
  }

  if (normalized.includes("punto")) return "Punto"
  if (normalized.includes("transferencia")) return "Transferencia"
  if (normalized.includes("efectivo") || normalized === "bolivares" || normalized === "bs") {
    return "Efectivo Bs"
  }
  if (normalized.includes("biopago") || normalized.includes("bio pago")) return "Biopago"

  return "Otro"
}

export function calculateOrderTotalsFromItems(
  items: OrderItem[],
  exchangeRate: number,
  deliveryCostUSD = 0
): OrderTotals {
  const totals = items.reduce(
    (currentTotals, item) => {
      const subtotal = Number(item.price || 0) * Number(item.quantity || 0)

      if (isComboItem(item)) {
        currentTotals.totalCombosUSD += subtotal
      } else {
        currentTotals.totalRegularUSD += subtotal
      }

      return currentTotals
    },
    {
      totalCombosUSD: 0,
      totalRegularUSD: 0,
    }
  )

  const totalBeforeDeliveryUSD = totals.totalCombosUSD + totals.totalRegularUSD
  const totalRegularVES = totals.totalRegularUSD * Number(exchangeRate || 0)
  const totalUSD = totalBeforeDeliveryUSD + Number(deliveryCostUSD || 0)

  return {
    totalUSD,
    totalCombosUSD: totals.totalCombosUSD,
    totalRegularUSD: totals.totalRegularUSD,
    totalRegularVES,
    deliveryCostUSD: Number(deliveryCostUSD || 0),
    totalBeforeDeliveryUSD,
  }
}

export function getOrderTotals(order: LocalOrder): OrderTotals {
  const exchangeRate = Number(order.exchangeRate || 0)
  const deliveryCostUSD = getOrderDeliveryCost(order)
  const calculatedTotals = calculateOrderTotalsFromItems(
    Array.isArray(order.items) ? order.items : [],
    exchangeRate,
    deliveryCostUSD
  )

  const hasReadableItems = Array.isArray(order.items) && order.items.length > 0
  const totalCombosUSD = hasReadableItems
    ? calculatedTotals.totalCombosUSD
    : Number(order.totalCombosUSD ?? 0)
  const totalRegularUSD = hasReadableItems
    ? calculatedTotals.totalRegularUSD
    : Number(order.totalRegularUSD ?? 0)
  const totalRegularVES = hasReadableItems
    ? calculatedTotals.totalRegularVES
    : Number(order.totalRegularVES ?? order.totalVES ?? totalRegularUSD * exchangeRate)
  const totalBeforeDeliveryUSD = totalCombosUSD + totalRegularUSD

  return {
    totalUSD: totalBeforeDeliveryUSD + deliveryCostUSD,
    totalCombosUSD,
    totalRegularUSD,
    totalRegularVES,
    deliveryCostUSD,
    totalBeforeDeliveryUSD,
  }
}

export function getOrderPayment(order: LocalOrder): OrderPayment {
  const orderTotals = getOrderTotals(order)
  const savedPayment = order.payment
  const totalOrderUSD = roundMoney(
    savedPayment?.totalOrderUSD ?? order.paymentTotalOrderUSD ?? orderTotals.totalUSD
  )
  const receivedEquivalentUSD = roundMoney(
    savedPayment?.receivedEquivalentUSD ?? order.paymentReceivedEquivalentUSD ?? 0
  )
  const calculatedStatus = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const status = normalizePaymentStatus(savedPayment?.status ?? order.paymentStatus ?? calculatedStatus)
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
    amountReceivedUSD: roundMoney(savedPayment?.amountReceivedUSD ?? order.amountReceivedUSD ?? 0),
    amountReceivedVES: roundMoney(savedPayment?.amountReceivedVES ?? order.amountReceivedVES ?? 0),
    paymentMethodUSD: normalizePaymentMethodUSD(savedPayment?.paymentMethodUSD ?? order.paymentMethodUSD ?? ""),
    paymentMethodVES: normalizePaymentMethodVES(savedPayment?.paymentMethodVES ?? order.paymentMethodVES ?? ""),
    deliveryPaymentIn: normalizeDeliveryPaymentIn(savedPayment?.deliveryPaymentIn ?? order.deliveryPaymentIn),
    paymentNote: String(savedPayment?.paymentNote ?? order.paymentNote ?? ""),
    totalOrderUSD,
    receivedEquivalentUSD,
    pendingUSD,
    updatedAt: String(savedPayment?.updatedAt ?? order.paymentUpdatedAt ?? ""),
  }
}

export function createPaymentFormFromOrder(order: LocalOrder): PaymentForm {
  const payment = getOrderPayment(order)

  return {
    amountReceivedUSD: payment.amountReceivedUSD > 0 ? String(payment.amountReceivedUSD) : "",
    amountReceivedVES: payment.amountReceivedVES > 0 ? String(payment.amountReceivedVES) : "",
    paymentMethodUSD: payment.paymentMethodUSD,
    paymentMethodVES: payment.paymentMethodVES,
    deliveryPaymentIn: payment.deliveryPaymentIn,
    paymentNote: payment.paymentNote,
  }
}

export function calculatePaymentDraft(order: LocalOrder, form: PaymentForm): PaymentDraft {
  const orderTotals = getOrderTotals(order)
  const totalOrderUSD = roundMoney(orderTotals.totalUSD)
  const exchangeRate = Number(order.exchangeRate || 0)
  const amountReceivedUSD = parseMoneyInput(form.amountReceivedUSD)
  const amountReceivedVES = parseMoneyInput(form.amountReceivedVES)
  const receivedFromVES = amountReceivedVES > 0 && exchangeRate > 0 ? amountReceivedVES / exchangeRate : 0
  const receivedEquivalentUSD = roundMoney(amountReceivedUSD + receivedFromVES)
  const status = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const pendingUSD =
    status === "Pagado"
      ? 0
      : roundMoney(Math.max(totalOrderUSD - receivedEquivalentUSD, 0))

  return {
    totalOrderUSD,
    amountReceivedUSD,
    amountReceivedVES,
    receivedEquivalentUSD,
    pendingUSD,
    status,
  }
}
