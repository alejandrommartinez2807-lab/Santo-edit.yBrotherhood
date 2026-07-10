import type {
  DeliveryPaymentIn,
  OrderItem,
  OrderType,
} from "@/types/localOrders"

// Atribución de ventas: staff que registró/cobró el pedido (ver migración
// 0022_order_attribution). name vacío = sin atribución (cliente web).
export type OrderActorInput = {
  id?: string | null
  name?: string | null
  role?: string | null
}

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

  // Staff que registró el pedido. Lo decide el servidor según la sesión;
  // ausente en pedidos hechos por el cliente desde la web/QR.
  registeredBy?: OrderActorInput

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

  // Staff que registró el cobro. Lo decide el servidor según la sesión.
  chargedBy?: OrderActorInput
}

export type ConfirmStaffItemsInput = {
  confirmedBy?: string
  confirmedRole?: string
}

export type ResetStaffItemsInput = {
  resetBy?: string
  resetRole?: string
}
