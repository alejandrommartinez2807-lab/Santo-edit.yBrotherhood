import { getSupabaseAdmin } from "@/lib/supabaseServer"
import {
  cleanText,
  getOrderStaffConfirmationSummary,
  normalizeItems,
} from "@/lib/localOrderHelpers"
import { calculateOrderTotalsFromItems } from "@/lib/localOrderMoney"
import type { LocalOrder } from "@/types/localOrders"
import type { CreateOrderInput } from "./ordersCoreTypes"
import {
  buildItemsText,
  num,
  orderItemToRow,
  type Row,
} from "./ordersStoreMappers"
import { attachOrderToOpenAccount } from "./ordersStoreOpenAccounts"
import { uploadOrderAttachmentImage } from "./ordersStoreAttachments"
import { buildOrderFiscalSnapshot } from "./ordersStoreFiscal"
import { findOrderByClientOrderId } from "./ordersStoreQueries"

type LoadOrderWithItems = (
  orderId: string,
  branchId?: string | null,
) => Promise<LocalOrder>

function generateOrderId(): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `ord-${stamp}-${rand}`
}

export async function createOrderInStore(
  input: CreateOrderInput,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  const clientOrderId = cleanText(input.clientOrderId)

  // Idempotencia: si este pedido (mismo client_order_id) ya se creó en un
  // intento previo, devolvemos el existente sin duplicar. Ver 0018.
  if (clientOrderId) {
    const existing = await findOrderByClientOrderId(clientOrderId, branchId)
    if (existing) return existing
  }

  const items = normalizeItems(input.items)
  const exchangeRate = num(input.exchangeRate)
  const deliveryCostUSD = num(input.deliveryCostUSD)
  const totals = calculateOrderTotalsFromItems(items, exchangeRate, deliveryCostUSD)
  const staff = getOrderStaffConfirmationSummary({ items })
  const orderId = generateOrderId()
  const itemsText = buildItemsText(items)
  const fiscalSnapshot = await buildOrderFiscalSnapshot(items)

  const attachmentImageUrl = await uploadOrderAttachmentImage(orderId, input)

  const orderRow: Row = {
    id: orderId,
    branch_id: branchId ?? null,
    client_order_id: clientOrderId || null,
    customer_name: input.customerName,
    customer_phone: cleanText(input.customerPhone) || null,
    table_number: input.tableNumber,
    order_type: input.orderType,
    customer_note: cleanText(input.customerNote),

    delivery_address: cleanText(input.deliveryAddress) || null,
    delivery_reference: cleanText(input.deliveryReference) || null,
    delivery_zone: cleanText(input.deliveryZone) || null,
    delivery_cost_usd: deliveryCostUSD,
    total_before_delivery_usd: totals.totalBeforeDeliveryUSD,

    items_text: itemsText,
    fiscal: fiscalSnapshot,

    total_price: totals.totalUSD,
    total_ves: totals.totalRegularVES,
    total_usd: totals.totalUSD,
    total_combos_usd: totals.totalCombosUSD,
    total_regular_usd: totals.totalRegularUSD,
    total_regular_ves: totals.totalRegularVES,

    exchange_rate: exchangeRate,
    exchange_source: cleanText(input.exchangeSource) || null,
    exchange_value_date: cleanText(input.exchangeValueDate) || null,
    attachment_image_url: attachmentImageUrl || null,
    status: "Nuevo",

    staff_confirmation_status: staff.status,
    staff_confirmation_required_count: staff.requiredCount,
    staff_confirmation_confirmed_count: staff.confirmedCount,
    staff_confirmation_pending_count: staff.pendingCount,

    payment_status: "Pendiente",
    payment_total_order_usd: totals.totalUSD,
    payment_received_equiv_usd: 0,
    payment_pending_usd: totals.totalUSD,
    delivery_payment_in: "Sin registrar",
  }

  // branch-exempt: orderRow incluye branch_id (asignado arriba).
  const { error: insertError } = await supabase.from("orders").insert(orderRow)
  if (insertError) {
    // Carrera de idempotencia: otro reintento concurrente ganó la inserción
    // (viola el índice único de client_order_id). Devolvemos el ya creado.
    if (clientOrderId && insertError.code === "23505") {
      const existing = await findOrderByClientOrderId(clientOrderId, branchId)
      if (existing) return existing
    }
    throw new Error(insertError.message)
  }

  if (items.length) {
    const itemRows = items.map((item, index) => orderItemToRow(item, orderId, index))
    const { error: itemsError } = await supabase.from("order_items").insert(itemRows)
    if (itemsError) throw new Error(itemsError.message)
  }

  // Asociar a cuenta abierta si corresponde
  if (cleanText(input.openAccountId)) {
    await attachOrderToOpenAccount(cleanText(input.openAccountId), orderId, branchId)
  }

  return loadOrderWithItems(orderId, branchId)
}
