import type { SupplierPaymentStatus } from "@/lib/supplierPayables"

export type ProductPaymentMode = "divisa" | "mixto"

export type OrderStatus =
  | "Nuevo"
  | "Preparando"
  | "Listo"
  | "Entregado"
  | "Cancelado"

export type PaymentStatus = "Pendiente" | "Pago parcial" | "Pagado"

export type DeliveryPaymentIn =
  | "Divisas"
  | "Bolívares"
  | "Mixto"
  | "Sin registrar"

export type DeliveryReportStatus = "Sin reportar" | "Entrega reportada"

export type StaffConfirmationStatus = "pending" | "confirmed"

export type OrderStaffConfirmationStatus =
  | "not_required"
  | "pending"
  | "partial"
  | "confirmed"

export type OrderType = "Comer aquí" | "Para llevar" | "Delivery"

export type OrderSelectionOption = {
  id?: string
  name: string
  groupName?: string
  priceDelta?: number
  quantity?: number
}

export type OrderProductType =
  | "normal"
  | "variations"
  | "addons"
  | "buildable"
  | "combo"

export type OrderItem = {
  cartLineId?: string
  id: number
  name: string
  category: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  quantity: number
  note?: string
  noteEnabled?: boolean
  paymentMode?: ProductPaymentMode
  productType?: OrderProductType
  selectedVariation?: OrderSelectionOption | null
  selectedAddons?: OrderSelectionOption[]
  removedIngredients?: OrderSelectionOption[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  staffConfirmationStatus?: StaffConfirmationStatus
  staffConfirmedAt?: string
  staffConfirmedBy?: string
  staffConfirmedRole?: string
  /** Tasa de IVA fijada en la venta (16 / 8 / 0). null = se usó la default. */
  ivaRate?: number | null
}

// Desglose fiscal FIJADO en la orden al momento de cobrar (no se recalcula).
export type OrderFiscalSnapshot = {
  subtotalUSD: number
  ivaByRate: { rate: number; baseUSD: number; ivaUSD: number }[]
  ivaTotalUSD: number
  totalBeforeIgtfUSD: number
  igtfUSD: number
  igtfBaseUSD: number
  totalUSD: number
  // Snapshot de la config con la que se calculó (para el ticket).
  pricesIncludeIva: boolean
  igtfRate: number
  rifNumber?: string
  razonSocial?: string
}

export type CartItem = OrderItem

export type OrderPayment = {
  status: PaymentStatus
  amountReceivedUSD: number
  amountReceivedVES: number
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote: string
  totalOrderUSD: number
  receivedEquivalentUSD: number
  pendingUSD: number
  updatedAt?: string
}

export type PaymentForm = {
  amountReceivedUSD: string
  amountReceivedVES: string
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
  paymentNote: string
}

export type LocalOrder = {
  rowNumber?: number
  id: string
  createdAt: string
  customerName: string
  customerPhone?: string
  tableNumber: string
  orderType: OrderType
  customerNote: string
  openAccountId?: string
  openAccountTable?: string
  openAccountStatus?: OpenAccountStatus

  attachmentImageUrl?: string

  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  paymentMethod?: string
  deliveryCostUSD?: number
  totalBeforeDeliveryUSD?: number

  items: OrderItem[]
  itemsText: string

  /** Desglose fiscal fijado al cobrar (solo si el negocio factura). */
  fiscal?: OrderFiscalSnapshot | null

  totalPrice: number
  totalVES: number

  totalUSD?: number
  totalCombosUSD?: number
  totalRegularUSD?: number
  totalRegularVES?: number

  exchangeRate: number
  exchangeSource?: string
  exchangeValueDate?: string
  status: OrderStatus
  // Pedido de práctica (Modo entrenamiento): excluido de reportes/inventario/cierre.
  isTraining?: boolean

  deliveryReportStatus?: DeliveryReportStatus
  deliveryReportedAt?: string
  deliveryReportedBy?: string

  inventoryProcessed?: boolean
  inventoryProcessedAt?: string
  inventorySummary?: string
  inventoryWarnings?: string
  inventoryMovements?: unknown[]

  staffConfirmationStatus?: OrderStaffConfirmationStatus
  staffConfirmationRequiredCount?: number
  staffConfirmationConfirmedCount?: number
  staffConfirmationPendingCount?: number
  staffConfirmationUpdatedAt?: string
  staffConfirmationUpdatedBy?: string

  payment?: OrderPayment
  paymentStatus?: PaymentStatus
  amountReceivedUSD?: number
  amountReceivedVES?: number
  paymentMethodUSD?: string
  paymentMethodVES?: string
  deliveryPaymentIn?: DeliveryPaymentIn
  paymentNote?: string
  paymentTotalOrderUSD?: number
  paymentReceivedEquivalentUSD?: number
  paymentPendingUSD?: number
  paymentUpdatedAt?: string
}

export type DeliveryZone = {
  name: string
  costUSD: number
  isActive?: boolean
}

export type ReservationStatus = "activa" | "completada" | "cancelada" | "no_show"

export type Reservation = {
  id: string
  tableId: string
  tableName: string
  customerName: string
  customerPhone: string
  partySize: number
  reservationDate: string // YYYY-MM-DD
  startTime: string // HH:MM (24h)
  endTime: string // HH:MM (24h)
  status: ReservationStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type Supplier = {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  note: string
  isActive: boolean
  sortOrder: number
}

export type SupplierPurchase = {
  id: string
  supplierId: string | null
  supplierName: string
  purchaseDate: string // YYYY-MM-DD
  documentNumber: string
  totalUSD: number
  totalVES: number
  note: string
  createdAt: string
  // Relación opcional con inventario (Fase 2b). Si la compra sumó stock a un
  // insumo, estos campos quedan poblados (snapshot + movimiento generado).
  inventoryItemId: string | null
  inventoryItemName: string
  inventoryQuantity: number
  inventoryUnit: string
  inventoryMovementId: string
  // Cuentas por pagar (Fase 2b): vencimiento + estado de pago calculado a
  // partir de los abonos registrados. paid/pending derivan del historial.
  dueDate: string
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  paymentStatus: SupplierPaymentStatus
  isOverdue: boolean
}

export type PaymentProofStatus =
  | "Comprobante enviado"
  | "En revisión"
  | "Confirmado por caja"
  | "Rechazado"
  | "Necesita corrección"

export type PaymentProof = {
  id: string
  orderId: string
  createdAt: string
  customerName: string
  customerPhone: string
  orderType: string
  orderTotalUSD: number
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
  customerNote: string
  proofImageUrl: string
  proofFileId: string
  proofFileName: string
  status: PaymentProofStatus
  reviewedBy: string
  reviewedAt: string
  internalNote: string
}

export type OrderTotals = {
  totalUSD: number
  totalCombosUSD: number
  totalRegularUSD: number
  totalRegularVES: number
  deliveryCostUSD: number
  totalBeforeDeliveryUSD: number
}

export type PaymentDraft = {
  totalOrderUSD: number
  amountReceivedUSD: number
  amountReceivedVES: number
  receivedEquivalentUSD: number
  pendingUSD: number
  status: PaymentStatus
}

export type DeliveryWhatsAppMessageType =
  | "confirm"
  | "preparing"
  | "onTheWay"
  | "arrived"


export type OpenAccountStatus = "Abierta" | "Cerrada" | "Cancelada"

export type OpenAccountOrderSummary = {
  id: string
  displayNumber?: string
  customerName: string
  tableNumber: string
  orderType: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalUSD: number
  totalVES?: number
  exchangeRate?: number
  receivedEquivalentUSD: number
  pendingUSD: number
  createdAt?: string
  itemsText?: string
  items?: OrderItem[]
}

export type OpenAccount = {
  id: string
  createdAt: string
  tableNumber: string
  customerName: string
  customerPhone?: string
  status: OpenAccountStatus
  orderIds: string[]
  orders?: OpenAccountOrderSummary[]
  totalEstimatedUSD: number
  totalCollectedUSD: number
  pendingUSD: number
  note?: string
  openedBy?: string
  closedBy?: string
  closedAt?: string
  updatedAt?: string
}

export type CreateOpenAccountInput = {
  tableNumber: string
  customerName: string
  customerPhone?: string
  note?: string
  openedBy?: string
}

export type UpdateOpenAccountInput = {
  customerName?: string
  customerPhone?: string
  note?: string
  status?: OpenAccountStatus
  closedBy?: string
}
