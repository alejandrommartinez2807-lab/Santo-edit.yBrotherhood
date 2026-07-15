import type { OrderStatus } from "@/types/localOrders"
import type {
  ConfirmStaffItemsInput,
  CreateOrderInput,
  ResetStaffItemsInput,
  UpdateOrderPaymentInput,
} from "./ordersCoreTypes"

import * as ordersStore from "./ordersStore"
import { getBusinessConfig, isTrainingModeActive } from "./ordersBusinessConfig"
import { isInventoryAutoDeductActuallyEnabled } from "./businessComplexity"
import { applyInventoryConsumption, getInventoryRecipes } from "./ordersInventory"
import { getMenuProducts } from "./ordersMenu"
import { computeInventoryConsumption } from "./inventoryConsumption"
import { captureError } from "./monitoring"

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
  // Modo entrenamiento global: mientras esté activo, el pedido nace como
  // práctica (is_training) y NO afecta inventario ni reportes reales. El flag lo
  // decide el servidor por config, no el cliente.
  const training = isTrainingModeActive(await getBusinessConfig())

  const order = await ordersStore.createOrder(
    training ? { ...input, isTraining: true } : input,
    branchId,
  )

  // Cierre del lazo de inventario: descuenta stock según recetas (o vínculos de
  // ingredientes del producto) cuando el dueño activó el descuento automático.
  // Es "mejor esfuerzo": cualquier fallo se registra pero NUNCA tumba el pedido
  // ya creado ni la respuesta al cliente. Los pedidos de práctica no descuentan.
  if (!training) {
    await deductInventoryForOrder(order, branchId).catch((error) => {
      captureError(error, { route: "ordersCore.createOrder", action: "deductInventory" })
    })
  }

  return order
}

async function deductInventoryForOrder(
  order: Awaited<ReturnType<typeof ordersStore.createOrder>>,
  branchId?: string | null,
) {
  const items = order?.items ?? []
  if (!items.length) return

  const config = await getBusinessConfig()
  // Sin módulo de inventario o sin el interruptor global no se hace nada.
  if (!config.inventoryModuleEnabled || !config.inventoryAutoDeductEnabled) return

  // isInventoryAutoDeductActuallyEnabled = activado Y sin modo de prueba.
  // En modo de prueba (dry-run) se calcula el consumo pero no se toca el stock.
  const dryRun = !isInventoryAutoDeductActuallyEnabled(config)

  const [recipes, products] = await Promise.all([
    getInventoryRecipes(branchId),
    getMenuProducts({ includeInactive: true }, branchId),
  ])

  const lines = computeInventoryConsumption({
    items: items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })),
    recipes,
    products: products.map((product) => ({
      id: product.id,
      inventoryDiscountEnabled: product.inventoryDiscountEnabled,
      includedIngredients: product.includedIngredients,
    })),
  })

  if (!lines.length) return

  await applyInventoryConsumption(lines, branchId, { dryRun })
}

export async function confirmOrderStaffItems(
  orderId: string,
  input: ConfirmStaffItemsInput = {},
  branchId?: string | null,
) {
  return ordersStore.confirmOrderStaffItems(orderId, input, branchId)
}

export type SetOrderItemDeliveredInput = {
  lineId?: string
  productId?: number
  itemName?: string
  delivered: boolean
  deliveredBy?: string
}

export async function setOrderItemDelivered(
  orderId: string,
  input: SetOrderItemDeliveredInput,
  branchId?: string | null,
) {
  return ordersStore.setOrderItemDelivered(orderId, input, branchId)
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
