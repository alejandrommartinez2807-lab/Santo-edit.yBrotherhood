import { cleanText } from "@/lib/localOrderHelpers"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import type {
  LocalOrder,
  OrderStatus,
} from "@/types/localOrders"
import type {
  CreateOrderInput,
  UpdateOrderNotesInput,
  UpdateOrderPaymentInput,
} from "./ordersCoreTypes"
import { createOrderInStore } from "./ordersStoreCreate"
import {
  confirmOrderStaffItemsInStore,
  resetOrderStaffItemsInStore,
} from "./ordersStoreStaff"
import { updateOrderPaymentInStore } from "./ordersStorePayments"
import { getOrdersFromStore, loadOrderWithItems } from "./ordersStoreQueries"
import {
  clearOrdersInStore,
  deleteOrderInStore,
  updateOrderDeliveryReportInStore,
  updateOrderStatusInStore,
} from "./ordersStoreLifecycle"

// ============================================================
// Backend de pedidos y pagos sobre Supabase.
// Centraliza las operaciones del núcleo de pedidos sobre Supabase
// del POS. La lógica de negocio que antes estaba en otro backend (numeración,
// estado de pago y confirmación de personal) vive aquí.
// ============================================================
// PEDIDOS
// ============================================================

export async function getOrders(branchId?: string | null): Promise<LocalOrder[]> {
  return getOrdersFromStore(branchId)
}

export async function createOrder(
  input: CreateOrderInput,
  branchId?: string | null,
): Promise<LocalOrder> {
  return createOrderInStore(input, branchId, loadOrderWithItems)
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  branchId?: string | null,
): Promise<LocalOrder> {
  return updateOrderStatusInStore(orderId, status, branchId, loadOrderWithItems)
}

export async function updateOrderDeliveryReport(
  orderId: string,
  branchId?: string | null,
): Promise<LocalOrder> {
  return updateOrderDeliveryReportInStore(orderId, branchId, loadOrderWithItems)
}

export async function updateOrderPayment(
  orderId: string,
  payment: UpdateOrderPaymentInput,
  branchId?: string | null,
): Promise<LocalOrder> {
  return updateOrderPaymentInStore(orderId, payment, branchId, loadOrderWithItems)
}

export async function confirmOrderStaffItems(
  orderId: string,
  input: { confirmedBy?: string; confirmedRole?: string } = {},
  branchId?: string | null,
): Promise<LocalOrder> {
  return confirmOrderStaffItemsInStore(orderId, input, branchId, loadOrderWithItems)
}

export async function resetOrderStaffItems(
  orderId: string,
  input: { resetBy?: string; resetRole?: string } = {},
  branchId?: string | null,
): Promise<LocalOrder> {
  return resetOrderStaffItemsInStore(orderId, input, branchId, loadOrderWithItems)
}

export async function deleteOrder(
  orderId: string,
  branchId?: string | null,
): Promise<{ ok: boolean }> {
  return deleteOrderInStore(orderId, branchId)
}

export async function clearOrders(
  branchId?: string | null,
): Promise<{ ok: boolean; deleted: number; message: string }> {
  return clearOrdersInStore(branchId)
}


export async function updateOrderNotes(
  orderId: string,
  input: UpdateOrderNotesInput = {},
  branchId?: string | null,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  const patch: Record<string, unknown> = {}

  if (input.customerNote !== undefined || input.note !== undefined) {
    patch.customer_note = cleanText(input.customerNote ?? input.note)
  }

  if (input.attachmentImageUrl !== undefined) {
    patch.attachment_image_url = cleanText(input.attachmentImageUrl) || null
  }

  if (Object.keys(patch).length === 0) {
    return loadOrderWithItems(orderId, branchId)
  }

  let query = supabase.from("orders").update(patch).eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)

  const { error } = await query
  if (error) throw new Error(error.message)

  return loadOrderWithItems(orderId, branchId)
}
