import { cleanText } from "@/lib/localOrderHelpers"
import {
  normalizeDeliveryPaymentIn,
  normalizePaymentStatus,
} from "@/lib/localOrderMoney"
import type {
  LocalOrder,
  OpenAccountStatus,
  OrderItem,
  OrderStatus,
} from "@/types/localOrders"

export type Row = Record<string, unknown>

export function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function iso(value: unknown): string {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

// ---------- Mapeo de ítems ----------

export function itemRowToOrderItem(row: Row): OrderItem {
  return {
    cartLineId: (cleanText(row.line_id) || undefined) as string | undefined,
    id: num(row.product_id),
    name: cleanText(row.name),
    category: cleanText(row.category),
    price: num(row.price),
    basePrice: num(row.base_price),
    unitOptionsPrice: num(row.unit_options_price),
    image: cleanText(row.image),
    quantity: num(row.quantity),
    note: cleanText(row.note),
    noteEnabled: Boolean(row.note_enabled),
    paymentMode: row.payment_mode === "divisa" ? "divisa" : "mixto",
    productType: (cleanText(row.product_type) || "normal") as OrderItem["productType"],
    selectedVariation: (row.selected_variation as OrderItem["selectedVariation"]) ?? null,
    selectedAddons: (row.selected_addons as OrderItem["selectedAddons"]) ?? [],
    removedIngredients: (row.removed_ingredients as OrderItem["removedIngredients"]) ?? [],
    selectionSummary: cleanText(row.selection_summary),
    requiresWaiterConfirmation: Boolean(row.requires_waiter_confirmation),
    staffConfirmationStatus: row.requires_waiter_confirmation
      ? ((cleanText(row.staff_confirmation_status) || "pending") as OrderItem["staffConfirmationStatus"])
      : undefined,
    staffConfirmedAt: cleanText(row.staff_confirmed_at) || undefined,
    staffConfirmedBy: cleanText(row.staff_confirmed_by) || undefined,
    staffConfirmedRole: cleanText(row.staff_confirmed_role) || undefined,
    ivaRate: row.iva_rate == null ? null : num(row.iva_rate),
  }
}

export function orderItemToRow(item: OrderItem, orderId: string, sortOrder: number): Row {
  return {
    order_id: orderId,
    line_id: item.cartLineId ?? null,
    product_id: num(item.id),
    name: item.name,
    category: item.category ?? "",
    product_type: item.productType ?? "normal",
    payment_mode: item.paymentMode ?? "mixto",
    price: num(item.price),
    base_price: num(item.basePrice),
    unit_options_price: num(item.unitOptionsPrice),
    quantity: num(item.quantity),
    image: item.image ?? "",
    note: item.note ?? "",
    note_enabled: Boolean(item.noteEnabled),
    selection_summary: item.selectionSummary ?? "",
    selected_variation: item.selectedVariation ?? null,
    selected_addons: item.selectedAddons ?? [],
    removed_ingredients: item.removedIngredients ?? [],
    requires_waiter_confirmation: Boolean(item.requiresWaiterConfirmation),
    staff_confirmation_status: item.staffConfirmationStatus ?? null,
    staff_confirmed_at: item.staffConfirmedAt ?? null,
    staff_confirmed_by: item.staffConfirmedBy ?? null,
    staff_confirmed_role: item.staffConfirmedRole ?? null,
    iva_rate: item.ivaRate ?? null,
    sort_order: sortOrder,
  }
}

export function buildItemsText(items: OrderItem[]): string {
  return items
    .map((item) => {
      const detail = cleanText(item.selectionSummary)
      const base = `${item.name} x${num(item.quantity)}`
      return detail ? `${base} (${detail})` : base
    })
    .join(" | ")
}

// ---------- Mapeo de pedidos ----------

export function orderRowToLocalOrder(row: Row, items: OrderItem[]): LocalOrder {
  const seq = num(row.seq)
  return {
    rowNumber: seq > 0 ? seq + 1 : undefined,
    id: cleanText(row.id),
    createdAt: iso(row.created_at),
    customerName: cleanText(row.customer_name),
    customerPhone: cleanText(row.customer_phone) || undefined,
    tableNumber: cleanText(row.table_number),
    orderType: (cleanText(row.order_type) || "Comer aquí") as LocalOrder["orderType"],
    customerNote: cleanText(row.customer_note),

    openAccountId: cleanText(row.open_account_id) || undefined,
    openAccountTable: cleanText(row.open_account_table) || undefined,
    openAccountStatus: (row.open_account_status as OpenAccountStatus) || undefined,

    attachmentImageUrl: cleanText(row.attachment_image_url) || undefined,

    deliveryAddress: cleanText(row.delivery_address) || undefined,
    deliveryReference: cleanText(row.delivery_reference) || undefined,
    deliveryZone: cleanText(row.delivery_zone) || undefined,
    paymentMethod: cleanText(row.payment_method_usd) || undefined,
    deliveryCostUSD: num(row.delivery_cost_usd),
    totalBeforeDeliveryUSD: num(row.total_before_delivery_usd),

    items,
    itemsText: cleanText(row.items_text),
    fiscal: (row.fiscal as LocalOrder["fiscal"]) ?? null,

    totalPrice: num(row.total_price),
    totalVES: num(row.total_ves),
    totalUSD: num(row.total_usd),
    totalCombosUSD: num(row.total_combos_usd),
    totalRegularUSD: num(row.total_regular_usd),
    totalRegularVES: num(row.total_regular_ves),

    exchangeRate: num(row.exchange_rate),
    exchangeSource: cleanText(row.exchange_source) || undefined,
    exchangeValueDate: cleanText(row.exchange_value_date) || undefined,
    status: (cleanText(row.status) || "Nuevo") as OrderStatus,
    isTraining: row.is_training === true,

    deliveryReportStatus: (row.delivery_report_status as LocalOrder["deliveryReportStatus"]) || undefined,
    deliveryReportedAt: cleanText(row.delivery_reported_at) || undefined,
    deliveryReportedBy: cleanText(row.delivery_reported_by) || undefined,

    inventoryProcessed: Boolean(row.inventory_processed),
    inventoryProcessedAt: cleanText(row.inventory_processed_at) || undefined,
    inventorySummary: cleanText(row.inventory_summary) || undefined,
    inventoryWarnings: cleanText(row.inventory_warnings) || undefined,
    inventoryMovements: (row.inventory_movements as unknown[]) ?? [],

    staffConfirmationStatus: (row.staff_confirmation_status as LocalOrder["staffConfirmationStatus"]) || undefined,
    staffConfirmationRequiredCount: num(row.staff_confirmation_required_count),
    staffConfirmationConfirmedCount: num(row.staff_confirmation_confirmed_count),
    staffConfirmationPendingCount: num(row.staff_confirmation_pending_count),
    staffConfirmationUpdatedAt: cleanText(row.staff_confirmation_updated_at) || undefined,
    staffConfirmationUpdatedBy: cleanText(row.staff_confirmation_updated_by) || undefined,

    paymentStatus: normalizePaymentStatus(row.payment_status),
    amountReceivedUSD: num(row.amount_received_usd),
    amountReceivedVES: num(row.amount_received_ves),
    paymentMethodUSD: cleanText(row.payment_method_usd) || undefined,
    paymentMethodVES: cleanText(row.payment_method_ves) || undefined,
    deliveryPaymentIn: normalizeDeliveryPaymentIn(row.delivery_payment_in),
    paymentNote: cleanText(row.payment_note) || undefined,
    paymentTotalOrderUSD: num(row.payment_total_order_usd),
    paymentReceivedEquivalentUSD: num(row.payment_received_equiv_usd),
    paymentPendingUSD: num(row.payment_pending_usd),
    paymentUpdatedAt: cleanText(row.payment_updated_at) || undefined,
  }
}

