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
