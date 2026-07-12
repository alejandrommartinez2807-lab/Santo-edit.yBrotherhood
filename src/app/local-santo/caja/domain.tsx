import { CheckCircle2, Clock, CookingPot, PackageCheck, XCircle } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import type { OpenAccount } from "@/types/localOrders"
import { normalizeLocalTableText } from "@/components/local/LocalTablesMap"
import { formatMoneyForInput, parseMoneyInput, roundMoney } from "@/lib/localOrderMoney"

export const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

export type ProductPaymentMode = "divisa" | "mixto"
export type OrderStatus = "Nuevo" | "Preparando" | "Listo" | "Entregado" | "Cancelado"
export type PaymentStatus = "Pendiente" | "Pago parcial" | "Pagado"
export type DeliveryPaymentIn = "Divisas" | "Bolívares" | "Mixto" | "Sin registrar"
export type DeliveryReportStatus = "Sin reportar" | "Entrega reportada"
export type OrderType = "Comer aquí" | "Para llevar" | "Delivery"
export type CashFilter =
  | "Por confirmar"
  | "Por revisar"
  | "Delivery por confirmar"
  | "Pendientes"
  | "Pago parcial"
  | "Listos"
  | "Completos"
  | "Delivery"
  | "Pagados"
  | "Cancelados"
  | "Todos"

export type PaymentProofStatus =
  | "Comprobante enviado"
  | "En revisión"
  | "Confirmado por caja"
  | "Rechazado"
  | "Necesita corrección"

export type PaymentProof = {
  id: string
  orderId: string
  createdAt: string
  customerName: string
  customerPhone: string
  orderType: string
  orderTotalUSD: number
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
  customerNote: string
  proofImageUrl: string
  proofFileId: string
  proofFileName: string
  status: PaymentProofStatus
  reviewedBy: string
  reviewedAt: string
  internalNote: string
}

export type OrderSelectionOption = {
  id?: string
  name: string
  groupName?: string
  priceDelta?: number
  quantity?: number
}

export type StaffConfirmationStatus = "pending" | "confirmed"

export type CartItem = {
  cartLineId?: string
  id: number
  name: string
  category: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  quantity: number
  note?: string
  noteEnabled?: boolean
  paymentMode?: ProductPaymentMode
  productType?: string
  selectedVariation?: OrderSelectionOption | null
  selectedAddons?: OrderSelectionOption[]
  removedIngredients?: OrderSelectionOption[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  staffConfirmationStatus?: StaffConfirmationStatus
  staffConfirmedAt?: string
  staffConfirmedBy?: string
  staffConfirmedRole?: string
}

export type OrderPayment = {
  status: PaymentStatus
  amountReceivedUSD: number
  amountReceivedVES: number
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote: string
  totalOrderUSD: number
  receivedEquivalentUSD: number
  pendingUSD: number
  updatedAt?: string
}

export type PaymentForm = {
  amountReceivedUSD: string
  amountReceivedVES: string
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote: string
}

export type LocalOrder = {
  rowNumber?: number
  id: string
  createdAt: string
  customerName: string
  customerPhone?: string
  tableNumber: string
  orderType: OrderType
  customerNote: string
  openAccountId?: string
  openAccountTable?: string
  openAccountStatus?: OpenAccount["status"]
  attachmentImageUrl?: string
  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  paymentMethod?: string
  deliveryCostUSD?: number
  totalBeforeDeliveryUSD?: number
  items: CartItem[]
  itemsText: string
  totalPrice: number
  totalVES: number
  totalUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number
  exchangeRate: number
  exchangeSource?: string
  exchangeValueDate?: string
  status: OrderStatus
  deliveryReportStatus?: DeliveryReportStatus
  deliveryReportedAt?: string
  deliveryReportedBy?: string
  payment?: OrderPayment
  paymentStatus?: PaymentStatus
  amountReceivedUSD?: number
  amountReceivedVES?: number
  paymentMethodUSD?: string
  paymentMethodVES?: string
  deliveryPaymentIn?: DeliveryPaymentIn
  paymentNote?: string
  paymentTotalOrderUSD?: number
  paymentReceivedEquivalentUSD?: number
  paymentPendingUSD?: number
  paymentUpdatedAt?: string
  staffConfirmationStatus?: "not_required" | "pending" | "partial" | "confirmed"
  staffConfirmationRequiredCount?: number
  staffConfirmationConfirmedCount?: number
  staffConfirmationPendingCount?: number
  staffConfirmationUpdatedAt?: string
  staffConfirmationUpdatedBy?: string
}

export const CASH_FILTERS: CashFilter[] = [
  "Por confirmar",
  "Por revisar",
  "Delivery por confirmar",
  "Pendientes",
  "Pago parcial",
  "Listos",
  "Completos",
  "Delivery",
  "Pagados",
  "Cancelados",
  "Todos",
]

// Catálogos compartidos con pedidos y cuentas abiertas (una sola fuente).
export {
  DELIVERY_PAYMENT_OPTIONS,
  PAYMENT_METHOD_USD_OPTIONS,
  PAYMENT_METHOD_VES_OPTIONS,
} from "@/lib/paymentOptions"

export const EMPTY_PAYMENT_FORM: PaymentForm = {
  amountReceivedUSD: "",
  amountReceivedVES: "",
  paymentMethodUSD: "",
  paymentMethodVES: "",
  deliveryPaymentIn: "Sin registrar",
  paymentNote: "",
}

export type DeliveryWhatsAppMessageType = "confirm" | "preparing" | "onTheWay" | "arrived" | "ready"

export function readApiResponse(response: Response) {
  return response.text().then((text) => {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        "El servidor respondió con una página HTML en vez de datos. Revisa que la API de pedidos esté funcionando correctamente."
      )
    }
  })
}

export function isPaymentProofPending(proof: PaymentProof) {
  return proof.status === "Comprobante enviado" || proof.status === "En revisión"
}

export function getPendingPaymentProofs(proofs: PaymentProof[]) {
  return proofs.filter(isPaymentProofPending)
}

export function formatPaymentProofDate(value: string) {
  if (!value) return "Sin fecha"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

// Aritmética de dinero compartida: la implementación vive en localOrderMoney.
export { formatMoneyForInput, parseMoneyInput, roundMoney }

export function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

export function isComboItem(item: CartItem) {
  return item.paymentMode === "divisa"
}

export function isDeliveryOrder(order: LocalOrder) {
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

export function getOrderOpenAccountId(order: LocalOrder) {
  return String(order.openAccountId || "").trim()
}

export function isOpenAccountEligibleLocalOrder(order: LocalOrder) {
  return (
    order.orderType === "Comer aquí" &&
    !isDeliveryOrder(order) &&
    order.status !== "Cancelado"
  )
}

export function findSuggestedOpenAccountForOrder(order: LocalOrder, accounts: OpenAccount[]) {
  if (getOrderOpenAccountId(order)) return null
  if (!isOpenAccountEligibleLocalOrder(order)) return null

  const orderTable = normalizeLocalTableText(order.tableNumber)

  if (!orderTable) return null

  return (
    accounts.find(
      (account) =>
        account.status === "Abierta" &&
        normalizeLocalTableText(account.tableNumber) === orderTable
    ) || null
  )
}

export function findOpenAccountForOrder(order: LocalOrder | null | undefined, accounts: OpenAccount[]) {
  if (!order) return null

  const accountId = getOrderOpenAccountId(order)

  if (accountId) {
    const accountById = accounts.find(
      (account) => String(account.id || "").trim() === accountId
    )

    if (accountById) return accountById
  }

  if (!isOpenAccountEligibleLocalOrder(order)) return null

  const accountTable = normalizeLocalTableText(order.openAccountTable || order.tableNumber)

  if (!accountTable) return null

  return (
    accounts.find(
      (account) =>
        account.status === "Abierta" &&
        normalizeLocalTableText(account.tableNumber) === accountTable
    ) || null
  )
}

export function getOpenAccountOrderCount(account: OpenAccount | null) {
  if (!account) return 0

  if (Array.isArray(account.orders) && account.orders.length > 0) {
    return account.orders.length
  }

  if (Array.isArray(account.orderIds)) {
    return account.orderIds.length
  }

  return 0
}

export function getOpenAccountPendingUSD(account: OpenAccount | null) {
  if (!account) return 0

  const pending = Number(account.pendingUSD || 0)

  if (Number.isFinite(pending) && pending > 0) return pending

  const total = Number(account.totalEstimatedUSD || 0)
  const collected = Number(account.totalCollectedUSD || 0)
  const calculated = total - collected

  return Number.isFinite(calculated) && calculated > 0 ? calculated : 0
}

export function getOpenAccountTotalUSD(account: OpenAccount | null) {
  if (!account) return 0

  const total = Number(account.totalEstimatedUSD || 0)

  return Number.isFinite(total) && total > 0 ? total : 0
}

export function cleanDeliveryLocation(value: string) {
  return value.replace(/^delivery\s*-\s*/i, "").trim()
}

export function isDeliveryReported(order: LocalOrder) {
  return order.deliveryReportStatus === "Entrega reportada"
}

export function getDisplayOrderType(order: LocalOrder): OrderType {
  if (isDeliveryOrder(order)) return "Delivery"
  if (order.orderType === "Para llevar") return "Para llevar"
  return "Comer aquí"
}

export function getDisplayLocation(order: LocalOrder) {
  if (isDeliveryOrder(order)) {
    const cleanZone = String(order.deliveryZone || "").trim()
    const cleanTableNumber = cleanDeliveryLocation(String(order.tableNumber || ""))
    return cleanZone || cleanTableNumber || "Delivery"
  }
  return order.tableNumber || "Sin ubicación"
}

export function getOrderDeliveryCost(order: LocalOrder) {
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

export function getOrderTotals(order: LocalOrder) {
  const exchangeRate = Number(order.exchangeRate || 0)
  const deliveryCostUSD = getOrderDeliveryCost(order)
  const itemTotals = order.items.reduce(
    (totals, item) => {
      const subtotal = Number(item.price || 0) * Number(item.quantity || 0)
      if (isComboItem(item)) totals.totalCombosUSD += subtotal
      else totals.totalRegularUSD += subtotal
      return totals
    },
    { totalCombosUSD: 0, totalRegularUSD: 0 }
  )

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

  return {
    totalUSD: totalCombosUSD + totalRegularUSD + deliveryCostUSD,
    totalCombosUSD,
    totalRegularUSD,
    totalRegularVES,
    deliveryCostUSD,
  }
}

export function calculatePaymentStatus(receivedEquivalentUSD: number, totalOrderUSD: number): PaymentStatus {
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
  if (normalized === "bolivares" || normalized === "bolivar" || normalized === "bs" || normalized === "ves") return "Bolívares"
  if (normalized === "mixto" || normalized === "mixta") return "Mixto"
  return "Sin registrar"
}

export function normalizePaymentMethodUSD(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))
  if (!normalized || normalized === "sin registrar" || normalized === "sin metodo" || normalized === "divisas sin metodo") return ""
  if (normalized.includes("efectivo") || normalized === "divisas" || normalized === "divisa" || normalized === "usd" || normalized === "cash") return "Efectivo divisas"
  if (normalized.includes("zelle")) return "Zelle"
  if (normalized.includes("binance")) return "Binance"
  if (normalized.includes("usdt") || normalized.includes("tether")) return "USDT"
  if (normalized.includes("transferencia internacional") || normalized.includes("transferencia externa") || normalized.includes("wire")) return "Transferencia internacional"
  return "Otro"
}

export function normalizePaymentMethodVES(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))
  if (!normalized || normalized === "sin registrar" || normalized === "sin metodo" || normalized === "bolivares sin metodo") return ""
  if (normalized.includes("pago movil") || normalized.includes("pagomovil") || normalized.includes("movil")) return "Pago móvil"
  if (normalized.includes("punto")) return "Punto"
  if (normalized.includes("transferencia")) return "Transferencia"
  if (normalized.includes("efectivo") || normalized === "bolivares" || normalized === "bs") return "Efectivo Bs"
  if (normalized.includes("biopago") || normalized.includes("bio pago")) return "Biopago"
  return "Otro"
}

export function getOrderPayment(order: LocalOrder): OrderPayment {
  const orderTotals = getOrderTotals(order)
  const savedPayment = order.payment
  const totalOrderUSD = roundMoney(savedPayment?.totalOrderUSD ?? order.paymentTotalOrderUSD ?? orderTotals.totalUSD)
  const receivedEquivalentUSD = roundMoney(savedPayment?.receivedEquivalentUSD ?? order.paymentReceivedEquivalentUSD ?? 0)
  const calculatedStatus = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const status = normalizePaymentStatus(savedPayment?.status ?? order.paymentStatus ?? calculatedStatus)
  const pendingUSD = status === "Pagado" ? 0 : roundMoney(savedPayment?.pendingUSD ?? order.paymentPendingUSD ?? Math.max(totalOrderUSD - receivedEquivalentUSD, 0))

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

export function calculatePaymentDraft(order: LocalOrder, form: PaymentForm) {
  const orderTotals = getOrderTotals(order)
  const totalOrderUSD = roundMoney(orderTotals.totalUSD)
  const exchangeRate = Number(order.exchangeRate || 0)
  const amountReceivedUSD = parseMoneyInput(form.amountReceivedUSD)
  const amountReceivedVES = parseMoneyInput(form.amountReceivedVES)
  const receivedFromVES = amountReceivedVES > 0 && exchangeRate > 0 ? amountReceivedVES / exchangeRate : 0
  const receivedEquivalentUSD = roundMoney(amountReceivedUSD + receivedFromVES)
  const status = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const pendingUSD = status === "Pagado" ? 0 : roundMoney(Math.max(totalOrderUSD - receivedEquivalentUSD, 0))
  return { totalOrderUSD, amountReceivedUSD, amountReceivedVES, receivedEquivalentUSD, pendingUSD, status }
}

export function getDisplayOrderNumber(order: LocalOrder) {
  if (order.rowNumber && order.rowNumber > 1) return `#${String(order.rowNumber - 1).padStart(2, "0")}`
  const parts = order.id.split("-")
  const lastPart = parts[parts.length - 1] || order.id
  return `#${lastPart.slice(-3)}`
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function getStatusStyle(status: OrderStatus) {
  if (status === "Nuevo") return "bg-red-500 text-white"
  if (status === "Preparando") return "bg-orange-400 text-[var(--brand-ink-2)]"
  if (status === "Listo") return "bg-[var(--brand-accent)] text-[var(--brand-ink-2)]"
  if (status === "Entregado") return "bg-green-500 text-white"
  return "bg-[var(--brand-ink-3)] text-white"
}

export function getPaymentStatusStyle(status: PaymentStatus) {
  if (status === "Pagado") return "bg-green-500 text-white"
  if (status === "Pago parcial") return "bg-[var(--brand-accent)] text-[var(--brand-ink-2)]"
  return "bg-red-100 text-red-700 border border-red-300"
}

export function getStatusIcon(status: OrderStatus) {
  if (status === "Nuevo") return <Clock size={16} />
  if (status === "Preparando") return <CookingPot size={16} />
  if (status === "Listo") return <PackageCheck size={16} />
  if (status === "Entregado") return <CheckCircle2 size={16} />
  return <XCircle size={16} />
}

export function normalizePhoneForWhatsApp(value: string) {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0") && digits.length === 11) return `58${digits.slice(1)}`
  if (digits.startsWith("4") && digits.length === 10) return `58${digits}`
  if (digits.startsWith("58") && digits.length === 12) return digits
  if (!digits.startsWith("0") && digits.length >= 10 && digits.length <= 15) return digits
  return ""
}

export function getCustomerPhoneLabel(order: LocalOrder) {
  const phone = String(order.customerPhone || "").trim()
  return phone || "Sin teléfono registrado"
}

export function buildDeliveryProductsMessage(order: LocalOrder) {
  const exchangeRate = Number(order.exchangeRate || 0)
  if (!order.items.length) return "- Sin productos detallados"

  return order.items
    .map((item) => {
      const subtotalUSD = Number(item.price || 0) * Number(item.quantity || 0)
      const note = item.noteEnabled && item.note ? ` | Nota: ${item.note}` : ""
      if (isComboItem(item)) return `- ${item.name} x${item.quantity} - ${formatUSD(subtotalUSD)} | Base en divisas${note}`
      return `- ${item.name} x${item.quantity} - ${formatUSD(subtotalUSD)} / Ref. Bs ${formatVES(subtotalUSD * exchangeRate)}${note}`
    })
    .join("\n")
}

export function buildDeliveryWhatsAppMessage(order: LocalOrder, messageType: DeliveryWhatsAppMessageType) {
  const orderTotals = getOrderTotals(order)
  const exchangeRate = Number(order.exchangeRate || 0)
  const displayNumber = getDisplayOrderNumber(order)
  const deliveryCostVES = orderTotals.deliveryCostUSD * exchangeRate
  const regularAndDeliveryVES = orderTotals.totalRegularVES + deliveryCostVES
  const customerName = order.customerName || "cliente"
  const customerPhone = getCustomerPhoneLabel(order)
  const zone = getDisplayLocation(order)
  const paymentMethod = order.paymentMethod || "Por confirmar"
  const deliveryAddress = order.deliveryAddress || "Sin dirección registrada"
  const deliveryReference = order.deliveryReference || "Sin referencia registrada"

  if (messageType === "preparing") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya está en preparación.`,
      "Te avisaremos cuando vaya saliendo hacia tu dirección.",
      "",
      `Zona: ${zone}`,
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(deliveryCostVES)}`,
    ].join("\n")
  }

  if (messageType === "onTheWay") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya va saliendo hacia tu dirección.`,
      "Por favor mantente pendiente del teléfono para recibir el delivery.",
      "",
      `Dirección: ${deliveryAddress}`,
      `Referencia: ${deliveryReference}`,
      `Zona: ${zone}`,
      "",
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(deliveryCostVES)}`,
    ].join("\n")
  }

  if (messageType === "arrived") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya llegó a la ubicación indicada.`,
      "Por favor recibe el delivery y verifica tu pedido con el repartidor.",
      "",
      `Dirección: ${deliveryAddress}`,
      `Referencia: ${deliveryReference}`,
      `Zona: ${zone}`,
      "",
      `Gracias por comprar en ${BRAND.name}.`,
    ].join("\n")
  }

  if (messageType === "ready") {
    // El builder corre en el navegador del staff: el link de seguimiento usa
    // el mismo host desde el que atiende (sirve en prod y en previews).
    const trackingUrl =
      typeof window !== "undefined" ? `${window.location.origin}/pedido/${order.id}` : ""

    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, ¡tu pedido ${displayNumber} ya está listo!`,
      "Puedes pasar a retirarlo indicando tu número de pedido.",
      "",
      `Pedido: ${displayNumber}`,
      `Total: ${formatUSD(orderTotals.totalUSD)}`,
      ...(trackingUrl ? ["", `Sigue tu pedido aquí: ${trackingUrl}`] : []),
      "",
      `Gracias por comprar en ${BRAND.name}.`,
    ].join("\n")
  }

  return [
    `Hola, somos ${BRAND.name}.`,
    "",
    `Confirmamos tu pedido ${displayNumber}.`,
    "",
    `Cliente: ${customerName}`,
    `Teléfono: ${customerPhone}`,
    `Zona: ${zone}`,
    `Dirección: ${deliveryAddress}`,
    `Referencia: ${deliveryReference}`,
    "",
    "Productos:",
    buildDeliveryProductsMessage(order),
    "",
    "Resumen:",
    `Combos/base divisa: ${formatUSD(orderTotals.totalCombosUSD)}`,
    `Productos normales: ${formatUSD(orderTotals.totalRegularUSD)} / Ref. Bs ${formatVES(orderTotals.totalRegularVES)}`,
    `Delivery: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(deliveryCostVES)}`,
    `Total final: ${formatUSD(orderTotals.totalUSD)}`,
    `Referencia en Bs de productos normales + delivery: Bs ${formatVES(regularAndDeliveryVES)}`,
    "",
    `Método indicado en el pedido: ${paymentMethod}`,
    "",
    "Por favor confírmanos cómo realizarás el pago:",
    "1. Productos en divisas, bolívares o mixto.",
    "2. Delivery en divisas o bolívares.",
    "",
    "Al confirmar la forma de pago, comenzamos a preparar tu pedido.",
  ].join("\n")
}

export function buildDeliveryWhatsAppUrl(order: LocalOrder, messageType: DeliveryWhatsAppMessageType) {
  const phone = normalizePhoneForWhatsApp(order.customerPhone || "")
  const message = buildDeliveryWhatsAppMessage(order, messageType)
  if (!phone) return ""
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
