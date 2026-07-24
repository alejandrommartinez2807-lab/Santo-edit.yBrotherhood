import { formatUSD, formatVES } from "@/utils/formatCurrency"
import { BRAND } from "@/lib/brand"
import type {
  DeliveryWhatsAppMessageType,
  DeliveryZone,
  LocalOrder,
  OrderItem,
  OrderProductType,
  OrderStaffConfirmationStatus,
  StaffConfirmationStatus,
  OrderSelectionOption,
  OrderTotals,
  OrderType,
} from "@/types/localOrders"

type OrderItemLike = {
  id?: unknown
  name?: unknown
  category?: unknown
  price?: unknown
  basePrice?: unknown
  unitOptionsPrice?: unknown
  image?: unknown
  quantity?: unknown
  note?: unknown
  noteEnabled?: unknown
  paymentMode?: unknown
  productType?: unknown
  selectedVariation?: unknown
  selectedAddons?: unknown
  removedIngredients?: unknown
  selectionSummary?: unknown
  requiresWaiterConfirmation?: unknown
  staffConfirmationStatus?: unknown
  staffConfirmedAt?: unknown
  staffConfirmedBy?: unknown
  staffConfirmedRole?: unknown
}

type OrderWithItemsLike = {
  items?: OrderItemLike[]
}

export function normalizeComparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function cleanText(value: unknown) {
  return String(value || "").trim()
}

export function cleanNumber(value: unknown) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

export function cleanBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0

  const normalized = normalizeComparableText(cleanText(value))

  return ["true", "1", "si", "yes", "activo", "activa"].includes(normalized)
}

export function isComboItem(item: OrderItemLike) {
  return item.paymentMode === "divisa"
}

export function isDeliveryOrder(order: LocalOrder) {
  const orderType = String(order.orderType || "").trim().toLowerCase()
  const tableNumber = String(order.tableNumber || "").trim().toLowerCase()
  const deliveryCostUSD = Number(order.deliveryCostUSD || 0)

  return (
    orderType === "delivery" ||
    tableNumber.startsWith("delivery") ||
    Boolean(
      order.deliveryAddress ||
        order.deliveryReference ||
        order.deliveryZone ||
        deliveryCostUSD > 0
    )
  )
}

export function cleanDeliveryLocation(value: string) {
  return String(value || "")
    .replace(/^delivery\s*-\s*/i, "")
    .trim()
}

export function isDeliveryReported(order: LocalOrder) {
  return order.deliveryReportStatus === "Entrega reportada"
}

export function getDisplayOrderType(order: LocalOrder): OrderType {
  if (isDeliveryOrder(order)) return "Delivery"
  if (order.orderType === "Para llevar") return "Para llevar"
  return "Comer aquí"
}

export function getDisplayTableNumber(order: LocalOrder) {
  if (isDeliveryOrder(order)) {
    const cleanZone = String(order.deliveryZone || "").trim()
    const cleanTableNumber = cleanDeliveryLocation(String(order.tableNumber || ""))

    return cleanZone || cleanTableNumber || "Delivery"
  }

  return order.tableNumber || "Sin ubicación"
}

export function getDisplayLocation(order: LocalOrder) {
  return getDisplayTableNumber(order)
}

export function isOrderAttachedToOpenAccount(order: Pick<LocalOrder, "openAccountId" | "openAccountTable">) {
  return Boolean(cleanText(order.openAccountId) || cleanText(order.openAccountTable))
}

export function getOrderOpenAccountLabel(
  order: Pick<LocalOrder, "openAccountId" | "openAccountTable" | "openAccountStatus" | "tableNumber">
) {
  if (!isOrderAttachedToOpenAccount(order)) return ""

  const tableLabel = cleanText(order.openAccountTable) || cleanText(order.tableNumber) || "mesa"
  const status = cleanText(order.openAccountStatus)

  if (status === "Cerrada") return `Cuenta cerrada: ${tableLabel}`
  if (status === "Cancelada") return `Cuenta cancelada: ${tableLabel}`

  return `Agregado a cuenta abierta: ${tableLabel}`
}

export function getOrderOpenAccountOperationalText(
  order: Pick<LocalOrder, "openAccountId" | "openAccountTable" | "openAccountStatus" | "tableNumber">
) {
  if (!isOrderAttachedToOpenAccount(order)) return ""

  const tableLabel = cleanText(order.openAccountTable) || cleanText(order.tableNumber) || "esta mesa"
  const status = cleanText(order.openAccountStatus)

  if (status === "Cerrada") {
    return `Este pedido quedó asociado a la cuenta de ${tableLabel}. La cuenta ya fue cerrada; revisa el cobro real en caja.`
  }

  if (status === "Cancelada") {
    return `Este pedido quedó asociado a la cuenta de ${tableLabel}, pero la cuenta aparece cancelada. Revisa la operación antes de cobrar o entregar.`
  }

  return `Este pedido forma parte de la cuenta abierta de ${tableLabel}. No registra cobro por sí solo; caja debe confirmar el pago real.`
}

export function getOrderDeliveryCost(order: LocalOrder) {
  // Solo la cotización GUARDADA del pedido (el servidor la calcula por sede
  // al registrar). La vieja tabla fija por zonas (Santo Perrito) se retiró:
  // hacía que dueño/pantalla sumaran un envío distinto al de caja para el
  // mismo pedido (auditoría 2026-07-23, P3 — mismo patrón que el bug
  // histórico de isDeliveryOrder duplicado).
  const savedCost = Number(order.deliveryCostUSD || 0)
  return savedCost > 0 ? savedCost : 0
}

function calculateDeliveryMessageOrderTotals(order: LocalOrder): OrderTotals {
  const exchangeRate = Number(order.exchangeRate || 0)
  const deliveryCostUSD = getOrderDeliveryCost(order)
  const itemTotals = order.items.reduce(
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

  return {
    totalUSD: totalBeforeDeliveryUSD + deliveryCostUSD,
    totalCombosUSD,
    totalRegularUSD,
    totalRegularVES,
    deliveryCostUSD,
    totalBeforeDeliveryUSD,
  }
}

export function getDisplayOrderNumber(order: LocalOrder) {
  // Número por sede (#40-s): correlativo propio de la sede + inicial. Si aún no
  // se aplicó la migración 0025, cae al número global (rowNumber/seq).
  if (order.branchNumber && order.branchNumber > 0) {
    return `#${String(order.branchNumber).padStart(2, "0")}${
      order.branchCode ? `-${order.branchCode}` : ""
    }`
  }

  if (order.rowNumber && order.rowNumber > 1) {
    return `#${String(order.rowNumber - 1).padStart(2, "0")}`
  }

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

  if (!order.items.length) {
    return "- Sin productos detallados"
  }

  return order.items
    .map((item) => {
      const subtotalUSD = Number(item.price || 0) * Number(item.quantity || 0)
      const detailLines = getOrderItemDetailLines(item).map((line) => `  ${line}`)
      const details = detailLines.length ? `\n${detailLines.join("\n")}` : ""

      if (isComboItem(item)) {
        return `- ${item.name} x${item.quantity} - ${formatUSD(subtotalUSD)} | Base en divisas${details}`
      }

      return `- ${item.name} x${item.quantity} - ${formatUSD(
        subtotalUSD
      )} / Ref. Bs ${formatVES(subtotalUSD * exchangeRate)}${details}`
    })
    .join("\n")
}

export function buildDeliveryWhatsAppMessage(
  order: LocalOrder,
  messageType: DeliveryWhatsAppMessageType
) {
  const orderTotals = calculateDeliveryMessageOrderTotals(order)
  const exchangeRate = Number(order.exchangeRate || 0)
  const displayNumber = getDisplayOrderNumber(order)
  const deliveryCostVES = orderTotals.deliveryCostUSD * exchangeRate
  const regularAndDeliveryVES = orderTotals.totalRegularVES + deliveryCostVES
  const customerName = order.customerName || "cliente"
  const customerPhone = getCustomerPhoneLabel(order)
  const zone = getDisplayTableNumber(order)
  const paymentMethod = order.paymentMethod || "Por confirmar"
  const deliveryAddress = order.deliveryAddress || "Sin dirección registrada"
  const deliveryReference = order.deliveryReference || "Sin referencia registrada"

  if (messageType === "preparing") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya está en preparación.`,
      "Te avisaremos cuando el repartidor llegue a la ubicación indicada.",
      "",
      `Zona: ${zone}`,
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
        deliveryCostVES
      )}`,
    ].join("\n")
  }

  if (messageType === "onTheWay") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya fue despachado hacia tu dirección.`,
      "Por favor mantente pendiente del teléfono para recibir el delivery.",
      "",
      `Dirección: ${deliveryAddress}`,
      `Referencia: ${deliveryReference}`,
      `Zona: ${zone}`,
      "",
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
        deliveryCostVES
      )}`,
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
    `Productos normales: ${formatUSD(
      orderTotals.totalRegularUSD
    )} / Ref. Bs ${formatVES(orderTotals.totalRegularVES)}`,
    `Delivery: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
      deliveryCostVES
    )}`,
    `Total final: ${formatUSD(orderTotals.totalUSD)}`,
    `Referencia en Bs de productos normales + delivery: Bs ${formatVES(
      regularAndDeliveryVES
    )}`,
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

export function buildDeliveryWhatsAppUrl(
  order: LocalOrder,
  messageType: DeliveryWhatsAppMessageType
) {
  const phone = normalizePhoneForWhatsApp(order.customerPhone || "")
  const message = buildDeliveryWhatsAppMessage(order, messageType)

  if (!phone) return ""

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export function getDeliveryZoneOption(value: string, deliveryZones: DeliveryZone[]) {
  const comparableValue = normalizeComparableText(value)

  return deliveryZones.find(
    (zone) =>
      zone.isActive !== false &&
      normalizeComparableText(zone.name) === comparableValue
  )
}

export function isValidOrderType(value: unknown): value is OrderType {
  return value === "Comer aquí" || value === "Para llevar" || value === "Delivery"
}

export function normalizeProductType(value: unknown): OrderProductType {
  if (
    value === "normal" ||
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value
  }

  return "normal"
}

export function normalizeSelectionOption(value: unknown): OrderSelectionOption | null {
  if (!value || typeof value !== "object") return null

  const source = value as Record<string, unknown>
  const name = cleanText(source.name)

  if (!name) return null

  return {
    id: cleanText(source.id) || undefined,
    name,
    groupName: cleanText(source.groupName) || undefined,
    priceDelta: cleanNumber(source.priceDelta),
    quantity: Math.max(1, Math.round(cleanNumber(source.quantity) || 1)),
  }
}

export function normalizeSelectionOptions(value: unknown): OrderSelectionOption[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeSelectionOption)
    .filter((option): option is OrderSelectionOption => Boolean(option?.name))
    .slice(0, 30)
}

export function formatOption(option: OrderSelectionOption) {
  const quantityLabel = option.quantity && option.quantity > 1 ? ` x${option.quantity}` : ""
  const priceDelta = Number(option.priceDelta || 0)
  const priceLabel = priceDelta > 0 ? ` (+$${priceDelta.toFixed(2)})` : ""

  return `${option.groupName ? `${option.groupName}: ` : ""}${option.name}${quantityLabel}${priceLabel}`
}

export function buildSelectionSummary(item: {
  selectedVariation?: OrderSelectionOption | null
  selectedAddons?: OrderSelectionOption[]
  removedIngredients?: OrderSelectionOption[]
  selectionSummary?: unknown
  requiresWaiterConfirmation?: unknown
  staffConfirmationStatus?: unknown
  staffConfirmedAt?: unknown
  staffConfirmedBy?: unknown
  staffConfirmedRole?: unknown
}) {
  const manualSummary = cleanText(item.selectionSummary)

  if (manualSummary) return manualSummary

  const parts: string[] = []

  if (item.selectedVariation) {
    parts.push(`Variación: ${formatOption(item.selectedVariation)}`)
  }

  if (item.selectedAddons?.length) {
    parts.push(`Adicionales: ${item.selectedAddons.map(formatOption).join(", ")}`)
  }

  if (item.removedIngredients?.length) {
    parts.push(`Sin: ${item.removedIngredients.map((option) => option.name).join(", ")}`)
  }

  if (cleanBoolean(item.requiresWaiterConfirmation)) {
    parts.push("Requiere confirmación del personal")
  }

  return parts.join(" · ")
}

export function getOrderItemSelectionSummary(item: OrderItemLike) {
  const selectedVariation = normalizeSelectionOption(item.selectedVariation)
  const selectedAddons = normalizeSelectionOptions(item.selectedAddons)
  const removedIngredients = normalizeSelectionOptions(item.removedIngredients)
  const requiresWaiterConfirmation = cleanBoolean(item.requiresWaiterConfirmation)

  return buildSelectionSummary({
    selectionSummary: item.selectionSummary,
    selectedVariation,
    selectedAddons,
    removedIngredients,
    requiresWaiterConfirmation,
  })
}


export function normalizeStaffConfirmationStatus(
  value: unknown,
  requiresWaiterConfirmation = false
): StaffConfirmationStatus {
  const normalized = normalizeComparableText(cleanText(value))

  if (
    normalized === "confirmed" ||
    normalized === "confirmado" ||
    normalized === "confirmada"
  ) {
    return "confirmed"
  }

  return requiresWaiterConfirmation ? "pending" : "pending"
}

export function isStaffConfirmationItemRequired(item: OrderItemLike) {
  return cleanBoolean(item.requiresWaiterConfirmation)
}

export function isStaffConfirmationItemConfirmed(item: OrderItemLike) {
  return (
    isStaffConfirmationItemRequired(item) &&
    normalizeStaffConfirmationStatus(item.staffConfirmationStatus, true) === "confirmed"
  )
}

export function getRequiredStaffConfirmationItems(order: OrderWithItemsLike) {
  return (Array.isArray(order.items) ? order.items : []).filter(
    isStaffConfirmationItemRequired
  )
}

export function getPendingStaffConfirmationItems(order: OrderWithItemsLike) {
  return getRequiredStaffConfirmationItems(order).filter(
    (item) => !isStaffConfirmationItemConfirmed(item)
  )
}

export function getConfirmedStaffConfirmationItems(order: OrderWithItemsLike) {
  return getRequiredStaffConfirmationItems(order).filter(
    isStaffConfirmationItemConfirmed
  )
}

export function getStaffConfirmationItems(order: OrderWithItemsLike) {
  return getPendingStaffConfirmationItems(order)
}

export function hasStaffConfirmationItems(order: OrderWithItemsLike) {
  return getPendingStaffConfirmationItems(order).length > 0
}

export function hasConfirmedStaffConfirmationItems(order: OrderWithItemsLike) {
  return getConfirmedStaffConfirmationItems(order).length > 0
}

export function getStaffConfirmationItemLabels(order: OrderWithItemsLike) {
  return getPendingStaffConfirmationItems(order).map((item) => {
    const quantity = Number(item.quantity || 0)
    const quantityLabel = quantity > 1 ? ` x${quantity}` : ""

    return `${item.name}${quantityLabel}`
  })
}

export function buildStaffConfirmationText(order: OrderWithItemsLike) {
  const labels = getStaffConfirmationItemLabels(order)

  return labels.length ? labels.join(", ") : ""
}

export function getOrderStaffConfirmationSummary(order: OrderWithItemsLike) {
  const requiredItems = getRequiredStaffConfirmationItems(order)
  const confirmedItems = getConfirmedStaffConfirmationItems(order)
  const pendingItems = getPendingStaffConfirmationItems(order)
  let status: OrderStaffConfirmationStatus = "not_required"

  if (requiredItems.length > 0 && confirmedItems.length === 0) {
    status = "pending"
  } else if (requiredItems.length > 0 && pendingItems.length > 0) {
    status = "partial"
  } else if (requiredItems.length > 0) {
    status = "confirmed"
  }

  return {
    status,
    requiredCount: requiredItems.length,
    confirmedCount: confirmedItems.length,
    pendingCount: pendingItems.length,
    pendingText: buildStaffConfirmationText(order),
  }
}

export function getStaffConfirmationStatusLabel(status: unknown) {
  if (status === "confirmed") return "Confirmado por el personal"
  if (status === "partial") return "Confirmación parcial"
  if (status === "pending") return "Por confirmar"

  return "Sin revisión requerida"
}

export type OrderItemDetailLineOptions = {
  // false = sin precios en los detalles (cocina no cobra: solo necesita saber
  // QUÉ preparar, los "(+$1.00)" de variaciones/adicionales estorban).
  includePrices?: boolean
}

// Quita las etiquetas de precio "(+$1.00)" de un resumen de selección.
export function stripPricesFromSelectionSummary(summary: string) {
  return String(summary || "")
    .replace(/\s*\(\+\s*\$\s*[\d.,]+\)/g, "")
    .trim()
}

export function getOrderItemDetailLines(
  item: OrderItemLike,
  options: OrderItemDetailLineOptions = {},
) {
  const includePrices = options.includePrices !== false
  const lines: string[] = []
  const selectionSummary = getOrderItemSelectionSummary(item)
  const unitOptionsPrice = cleanNumber(item.unitOptionsPrice)
  const basePrice = cleanNumber(item.basePrice) || cleanNumber(item.price)
  const note = cleanText(item.note)

  if (selectionSummary) {
    // Una línea por sección (Variación / Adicionales / Sin…): leído junto con
    // "·" se vuelve un choclo difícil de seguir en las tarjetas.
    const cleanSummary = includePrices
      ? selectionSummary
      : stripPricesFromSelectionSummary(selectionSummary)

    cleanSummary
      .split(" · ")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => lines.push(part))
  }

  if (includePrices && unitOptionsPrice > 0) {
    lines.push(`Base ${formatUSD(basePrice)} + extras`)
  }

  if (isStaffConfirmationItemConfirmed(item)) {
    const confirmedBy = cleanText(item.staffConfirmedBy)
    lines.push(
      confirmedBy
        ? `Confirmado por ${confirmedBy}`
        : "Confirmado por el personal"
    )
  }

  if (item.noteEnabled && note) {
    lines.push(`Nota: ${note}`)
  }

  return lines
}

export function normalizeItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((rawItem) => {
      const item = rawItem && typeof rawItem === "object"
        ? (rawItem as Record<string, unknown>)
        : {}
      const category = cleanText(item.category)
      const paymentMode =
        item.paymentMode === "divisa" || category === "Combos"
          ? "divisa"
          : "mixto"
      const price = cleanNumber(item.price)
      const basePrice = cleanNumber(item.basePrice) || price
      const selectedVariation = normalizeSelectionOption(item.selectedVariation)
      const selectedAddons = normalizeSelectionOptions(item.selectedAddons)
      const removedIngredients = normalizeSelectionOptions(item.removedIngredients)
      const requiresWaiterConfirmation = cleanBoolean(item.requiresWaiterConfirmation)
      const staffConfirmationStatus = normalizeStaffConfirmationStatus(
        item.staffConfirmationStatus,
        requiresWaiterConfirmation
      )
      const normalizedItem = {
        cartLineId: cleanText(item.cartLineId) || undefined,
        id: cleanNumber(item.id),
        name: cleanText(item.name),
        category,
        price,
        basePrice,
        unitOptionsPrice: cleanNumber(item.unitOptionsPrice) || Math.max(0, price - basePrice),
        image: cleanText(item.image),
        quantity: cleanNumber(item.quantity),
        note: cleanText(item.note),
        noteEnabled: Boolean(item.noteEnabled),
        paymentMode,
        productType: normalizeProductType(item.productType),
        selectedVariation,
        selectedAddons,
        removedIngredients,
        requiresWaiterConfirmation,
        staffConfirmationStatus: requiresWaiterConfirmation
          ? staffConfirmationStatus
          : undefined,
        staffConfirmedAt: cleanText(item.staffConfirmedAt) || undefined,
        staffConfirmedBy: cleanText(item.staffConfirmedBy) || undefined,
        staffConfirmedRole: cleanText(item.staffConfirmedRole) || undefined,
        ivaRate: (() => {
          const raw = item.ivaRate
          if (raw == null || raw === "") return null
          const n = Number(raw)
          return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
        })(),
        selectionSummary: "",
      } satisfies OrderItem

      return {
        ...normalizedItem,
        selectionSummary: buildSelectionSummary(normalizedItem),
      } satisfies OrderItem
    })
    .filter((item) => item.name && item.quantity > 0 && item.price >= 0)
}
