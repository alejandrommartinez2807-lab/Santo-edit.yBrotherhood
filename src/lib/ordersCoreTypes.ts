import type {
  DeliveryPaymentIn,
  OrderItem,
  OrderType,
} from "@/types/localOrders"

export type CreateOrderInput = {
  customerName: string
  customerPhone?: string
  tableNumber: string
  orderType: OrderType
  customerNote?: string
  openAccountId?: string

  // Clave de idempotencia generada por el cliente (uuid). Permite reenviar un
  // pedido encolado offline sin crear duplicados. Ver 0018_order_idempotency.
  clientOrderId?: string

  // Pedido de práctica (Modo entrenamiento). Lo decide el servidor según el
  // flag global del negocio; no se toma del cliente. Ver 0021_training_mode.
  isTraining?: boolean

  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  paymentMethod?: string
  deliveryCostUSD?: number
  totalBeforeDeliveryUSD?: number

  items: OrderItem[]
  exchangeRate: number
  exchangeSource?: string
  exchangeValueDate?: string

  totalUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number

  // Imagen opcional adjunta por el cliente al registrar el pedido
  attachmentDataUrl?: string
  attachmentFileName?: string
  attachmentMimeType?: string
}

export type UpdateOrderPaymentInput = {
  amountReceivedUSD: number
  amountReceivedVES: number
  paymentMethodUSD?: string
  paymentMethodVES?: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote?: string
}

export type ConfirmStaffItemsInput = {
  confirmedBy?: string
  confirmedRole?: string
}

export type ResetStaffItemsInput = {
  resetBy?: string
  resetRole?: string
}
