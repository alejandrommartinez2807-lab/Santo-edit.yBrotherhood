import type { OrderStatus } from "@/types/localOrders"
import type {
  ConfirmStaffItemsInput,
  CreateOrderInput,
  ResetStaffItemsInput,
  UpdateOrderPaymentInput,
} from "./ordersCoreTypes"

import * as ordersStore from "./ordersStore"

export type {
  ConfirmStaffItemsInput,
  CreateOrderInput,
  ResetStaffItemsInput,
  UpdateOrderPaymentInput,
} from "./ordersCoreTypes"

export async function getOrders(branchId?: string | null) {
  return ordersStore.getOrders(branchId)
}

export async function findOrderByClientOrderId(
  clientOrderId: string,
  branchId?: string | null,
) {
  return ordersStore.findOrderByClientOrderId(clientOrderId, branchId)
}

export async function createOrder(input: CreateOrderInput, branchId?: string | null) {
  return ordersStore.createOrder(input, branchId)
}

export async function confirmOrderStaffItems(
  orderId: string,
  input: ConfirmStaffItemsInput = {},
  branchId?: string | null,
) {
  return ordersStore.confirmOrderStaffItems(orderId, input, branchId)
}

export async function resetOrderStaffItems(
  orderId: string,
  input: ResetStaffItemsInput = {},
  branchId?: string | null,
) {
  return ordersStore.resetOrderStaffItems(orderId, input, branchId)
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  branchId?: string | null,
) {
  return ordersStore.updateOrderStatus(orderId, status, branchId)
}

export async function updateOrderDeliveryReport(
  orderId: string,
  branchId?: string | null,
) {
  return ordersStore.updateOrderDeliveryReport(orderId, branchId)
}

export async function updateOrderPayment(
  orderId: string,
  payment: UpdateOrderPaymentInput,
  branchId?: string | null,
) {
  return ordersStore.updateOrderPayment(orderId, payment, branchId)
}

export async function deleteOrder(orderId: string, branchId?: string | null) {
  return ordersStore.deleteOrder(orderId, branchId)
}

export async function clearOrders(branchId?: string | null) {
  return ordersStore.clearOrders(branchId)
}
