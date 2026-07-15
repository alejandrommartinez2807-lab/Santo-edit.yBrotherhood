import type {
  LocalOrder,
  OrderStatus,
} from "@/types/localOrders"
import type { CreateOrderInput, UpdateOrderPaymentInput } from "./ordersCoreTypes"
import { createOrderInStore } from "./ordersStoreCreate"
import {
  confirmOrderStaffItemsInStore,
  resetOrderStaffItemsInStore,
  setOrderItemDeliveredInStore,
} from "./ordersStoreStaff"
import { updateOrderPaymentInStore } from "./ordersStorePayments"
import {
  findOrderByClientOrderId as findOrderByClientOrderIdInStore,
  getOrdersFromStore,
  loadOrderWithItems,
} from "./ordersStoreQueries"
import {
  clearOrdersInStore,
  deleteOrderInStore,
  updateOrderDeliveryReportInStore,
  updateOrderStatusInStore,
} from "./ordersStoreLifecycle"

// ============================================================
// Backend de pedidos y pagos sobre Supabase.
// Reemplaza las llamadas al backend externo heredado para el núcleo
// del POS. La lógica de negocio que antes corría en el script (numeración,
// estado de pago y confirmación de personal) vive aquí.
// ============================================================
// PEDIDOS
// ============================================================

export async function getOrders(branchId?: string | null): Promise<LocalOrder[]> {
  return getOrdersFromStore(branchId)
}

export async function findOrderByClientOrderId(
  clientOrderId: string,
  branchId?: string | null,
): Promise<LocalOrder | null> {
  return findOrderByClientOrderIdInStore(clientOrderId, branchId)
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

export async function setOrderItemDelivered(
  orderId: string,
  input: {
    lineId?: string
    productId?: number
    itemName?: string
    delivered: boolean
    deliveredBy?: string
  },
  branchId?: string | null,
): Promise<LocalOrder> {
  return setOrderItemDeliveredInStore(orderId, input, branchId, loadOrderWithItems)
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
