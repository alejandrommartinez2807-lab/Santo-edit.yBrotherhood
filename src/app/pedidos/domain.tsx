import { BRAND } from "@/lib/brand"
import { CheckCircle2, Clock, CookingPot, PackageCheck, XCircle } from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import {
  getModulePlanAccess,
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  normalizeLocalPlanMode,
  type LocalModuleKey,
  type LocalPlanKey,
  type LocalPlanMode,
} from "@/lib/localPlans"
import { formatMoneyForInput, parseMoneyInput, roundMoney } from "@/lib/localOrderMoney"
import { getOrderPaymentLegs } from "@/lib/orderPaymentLegs"
import type { LocalTable } from "@/lib/orders"
import type { OpenAccount, OrderFiscalSnapshot } from "@/types/localOrders"
import {
  getOrderStaffConfirmationSummary,
  getStaffConfirmationStatusLabel,
} from "@/lib/localOrderHelpers"

export type ProductPaymentMode = "divisa" | "mixto"

export type CartSelectionOption = {
  id?: string
  name: string
  groupName?: string
  priceDelta?: number
  quantity?: number
}

export type StaffConfirmationStatus = "pending" | "confirmed"

export type CartItem = {
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
  productType?: string
  selectedVariation?: CartSelectionOption | null
  selectedAddons?: CartSelectionOption[]
  removedIngredients?: CartSelectionOption[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  staffConfirmationStatus?: StaffConfirmationStatus
  staffConfirmedAt?: string
  staffConfirmedBy?: string
  staffConfirmedRole?: string
}

export type OrderStatus = "Nuevo" | "Preparando" | "Listo" | "Entregado" | "Cancelado"
export type PaymentStatus = "Pendiente" | "Pago parcial" | "Pagado"
export type DeliveryPaymentIn = "Divisas" | "Bolívares" | "Mixto" | "Sin registrar"
export type StatusFilter = OrderStatus | "Activos" | "Todos"
export type PanelPaymentFilter = "Todos los cobros" | "Pendiente de pago" | "Pago parcial" | "Pagado"
export type PanelOrderScopeFilter = "Todos los tipos" | "Delivery" | "Local / llevar"
export type OrderType = "Comer aquí" | "Para llevar" | "Delivery"

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
  branchNumber?: number
  branchCode?: string
  id: string
  createdAt: string
  customerName: string
  customerPhone?: string
  tableNumber: string
  orderType: OrderType
  customerNote: string
  openAccountId?: string
  openAccountTable?: string
  openAccountStatus?: "Abierta" | "Cerrada" | "Cancelada"
  attachmentImageUrl?: string
  deliveryAddress?: string
  deliveryReference?: string
  deliveryZone?: string
  paymentMethod?: string
  deliveryCostUSD?: number
  totalBeforeDeliveryUSD?: number
  items: CartItem[]
  itemsText: string
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

  // Atribución de ventas (0022): quién registró y quién cobró el pedido.
  registeredById?: string
  registeredByName?: string
  registeredByRole?: string
  chargedById?: string
  chargedByName?: string
  chargedByRole?: string

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

export type ProductSold = {
  name: string
  quantity: number
  totalUSD: number
  totalVES: number
  onlyCurrency: boolean
}

export type NewOrderToast = {
  id: string
  number: string
  customerName: string
  tableNumber: string
  totalUSD: number
  orderType: OrderType
}

export type DeliveryZone = {
  name: string
  costUSD: number
  isActive?: boolean
}

export type DaySummaryTotals = {
  count: number
  totalUSD: number
  totalCombosUSD: number
  totalRegularUSD: number
  totalRegularVES: number
  deliveryCostUSD: number
}

export type DaySummaryItem = DaySummaryTotals & {
  label: string
}

export type PaymentSummaryItem = {
  label: string
  count: number
  totalUSD: number
  totalVES?: number
  deliveryCostUSD?: number
}

export type PaymentSummaryTotals = {
  count: number
  totalUSD: number
  totalVES: number
  deliveryCostUSD: number
}

export type FiscalIvaBucket = {
  rate: number
  baseUSD: number
  ivaUSD: number
}

export type FiscalCloseTotals = {
  fiscalOrders: number
  fiscalSubtotalUSD: number
  fiscalIvaTotalUSD: number
  fiscalIgtfBaseUSD: number
  fiscalIgtfUSD: number
  fiscalTotalUSD: number
  fiscalIvaByRate: FiscalIvaBucket[]
}

export type ExpenseSummaryItem = {
  label: string
  count: number
  totalUSD: number
  amountUSD: number
  amountVES: number
}

export type CloseReviewTone = "danger" | "warning" | "success" | "info"

export type CloseReviewItem = {
  title: string
  description: string
  value: string
  tone: CloseReviewTone
}

export type DayExpense = {
  id: string
  dateLabel: string
  dateValue: string
  concept: string
  category: string
  amountUSD: number
  amountVES: number
  equivalentUSD: number
  method: string
  note: string
  createdAt: string
  provider?: string
  expenseType?: string
  inventoryLinked?: boolean
  inventoryItemId?: string
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

export type ExpenseForm = {
  concept: string
  category: string
  provider: string
  expenseType: string
  amountUSD: string
  amountVES: string
  equivalentUSD: string
  method: string
  note: string
}

export type InventoryItemForExpense = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minimumStock: number
  costUSD: number
  costVES?: number
  equivalentCostUSD?: number
  note: string
  isActive: boolean
  updatedAt: string
}

export type ExpenseInventoryForm = {
  mode: "existing" | "new"
  itemId: string
  name: string
  category: string
  quantity: string
  unit: string
  minimumStock: string
  note: string
}

export type ExpenseQuickConcept = {
  id: string
  name: string
  category: string
  unit: string
  relatedInventory: boolean
}

export type BusinessViewMode = "simple" | "negocio" | "avanzado"
export type ExchangeRateMode = "automatic" | "automaticEur" | "manual"
export type PanelSoundKind =
  | "new-order"
  | "sent-kitchen"
  | "ready"
  | "delivery"
  | "payment"
  | "success"
  | "warning"

export type LocalAccessRole = "owner" | "manager" | "cashier" | "waiter" | "kitchen" | "delivery" | "promoter" | "support"

export type LocalAccessData = {
  ok?: boolean
  error?: string
  access?: {
    role?: LocalAccessRole | null
    roleLabel?: string
    allowed?: boolean
    canAccessRole?: boolean
    moduleEnabled?: boolean
  }
  businessConfig?: {
    businessName?: string
  }
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
  proofImageUrl2: string
  proofFileId2: string
  proofFileName2: string
  status: PaymentProofStatus
  reviewedBy: string
  reviewedAt: string
  internalNote: string
}

export type OpenAccountsApiResponse = {
  ok?: boolean
  openAccounts?: OpenAccount[]
  error?: string
}

export const LOCAL_ROLE_HOME_PATHS: Record<LocalAccessRole, string> = {
  owner: "/local-santo",
  manager: "/local-santo",
  cashier: "/local-santo/caja",
  waiter: "/local-santo/mesonero",
  kitchen: "/local-santo/cocina",
  delivery: "/local-santo/delivery",
  promoter: "/local-santo/caja",
  support: "/local-santo/soporte",
}

export const LOCAL_ROLE_LABELS: Record<LocalAccessRole, string> = {
  owner: "Dueño",
  manager: "Encargado",
  cashier: "Caja",
  waiter: "Mesonero",
  kitchen: "Cocina",
  delivery: "Delivery",
  promoter: "Promotor",
  support: "Soporte",
}

export function isWorkerOnlyRole(role: LocalAccessRole | null) {
  return (
    role === "cashier" ||
    role === "waiter" ||
    role === "kitchen" ||
    role === "delivery" ||
    role === "promoter" ||
    role === "support"
  )
}

export type BusinessConfig = {
  businessName: string
  businessShortDescription: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  exchangeRateMode: ExchangeRateMode
  manualExchangeRate: number
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
  deliveryEnabled: boolean
  // Botones de aviso al cliente por WhatsApp (Confirmar/Preparación/Salida…)
  // en las tarjetas de delivery del panel; el dueño puede apagarlos.
  orderWhatsappStageButtonsEnabled: boolean
  // Encuesta post-venta por WhatsApp en pedidos entregados (configurable).
  postSaleSurveyEnabled: boolean
  postSaleSurveyMessage: string
  // Alarma de anulación (toast rojo + push), apagable por el dueño.
  cancellationAlertsEnabled: boolean
  ownerDashboardModuleEnabled: boolean
  cashierModuleEnabled: boolean
  kitchenModuleEnabled: boolean
  deliveryModuleEnabled: boolean
  historyModuleEnabled: boolean
  expensesModuleEnabled: boolean
  menuProductsModuleEnabled: boolean
  featuredProductsModuleEnabled: boolean
  customersModuleEnabled: boolean
  inventoryModuleEnabled: boolean
  paymentProofsModuleEnabled: boolean
  openAccountsModuleEnabled: boolean
  tablesModuleEnabled: boolean
  qrTablesModuleEnabled: boolean
  localTables: LocalTable[]
  defaultViewMode: BusinessViewMode
  soundEnabled: boolean
  filtersOpenByDefault: boolean
  allowCloseWithPendingOrders: boolean
  allowCloseWithPendingPayments: boolean
  updatedAt?: string
}

export const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"
export const LOCATIONS_STORAGE_KEY = "santo_perrito_order_locations"
export const SOUND_STORAGE_KEY = "santo_perrito_panel_sound_enabled"
export const EXPENSE_CONCEPTS_STORAGE_KEY = "santo_perrito_expense_concepts_v1"
export const CUSTOM_EXPENSE_CONCEPT_ID = "__custom_expense_concept__"

export const DEFAULT_LOCAL_TABLES: LocalTable[] = [
  { id: "mesa-1", name: "Mesa 1", area: "Principal", sortOrder: 1, isActive: true },
  { id: "mesa-2", name: "Mesa 2", area: "Principal", sortOrder: 2, isActive: true },
  { id: "mesa-3", name: "Mesa 3", area: "Principal", sortOrder: 3, isActive: true },
  { id: "mesa-4", name: "Mesa 4", area: "Principal", sortOrder: 4, isActive: true },
  { id: "barra", name: "Barra", area: "Barra", sortOrder: 5, isActive: true },
  { id: "afuera", name: "Afuera", area: "Exterior", sortOrder: 6, isActive: true },
]

export const DEFAULT_ORDER_LOCATIONS = DEFAULT_LOCAL_TABLES.map((table) => table.name)

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: "Menú y pedidos",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  exchangeRateMode: "automatic",
  manualExchangeRate: 0,
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
  deliveryEnabled: true,
  orderWhatsappStageButtonsEnabled: true,
  postSaleSurveyEnabled: true,
  postSaleSurveyMessage: "",
  cancellationAlertsEnabled: true,
  ownerDashboardModuleEnabled: true,
  cashierModuleEnabled: true,
  kitchenModuleEnabled: true,
  deliveryModuleEnabled: true,
  historyModuleEnabled: true,
  expensesModuleEnabled: true,
  menuProductsModuleEnabled: true,
  featuredProductsModuleEnabled: true,
  customersModuleEnabled: true,
  inventoryModuleEnabled: true,
  paymentProofsModuleEnabled: false,
  openAccountsModuleEnabled: true,
  tablesModuleEnabled: false,
  qrTablesModuleEnabled: false,
  localTables: DEFAULT_LOCAL_TABLES,
  defaultViewMode: "negocio",
  soundEnabled: true,
  filtersOpenByDefault: false,
  allowCloseWithPendingOrders: true,
  allowCloseWithPendingPayments: true,
}

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { name: "La Trigaleña", costUSD: 2, isActive: true },
  { name: "Centro", costUSD: 1, isActive: true },
  { name: "Prebo", costUSD: 2.5, isActive: true },
  { name: "Naguanagua", costUSD: 3, isActive: true },
  { name: "Los Samanes", costUSD: 3, isActive: true },
  { name: "San Diego", costUSD: 4, isActive: true },
]

// Catálogos compartidos con caja y cuentas abiertas (una sola fuente).
export {
  DELIVERY_PAYMENT_OPTIONS,
  PAYMENT_METHOD_USD_OPTIONS,
  PAYMENT_METHOD_VES_OPTIONS,
} from "@/lib/paymentOptions"

export const EMPTY_PAYMENT_FORM: PaymentForm = {
  amountReceivedUSD: "",
  amountReceivedVES: "",
  paymentMethodUSD: "",
  paymentMethodVES: "",
  deliveryPaymentIn: "Sin registrar",
  paymentNote: "",
}

export const filterOptions: StatusFilter[] = [
  "Activos",
  "Nuevo",
  "Preparando",
  "Listo",
  "Entregado",
  "Cancelado",
  "Todos",
]

export const panelPaymentFilterOptions: PanelPaymentFilter[] = [
  "Todos los cobros",
  "Pendiente de pago",
  "Pago parcial",
  "Pagado",
]

export const panelOrderScopeFilterOptions: PanelOrderScopeFilter[] = [
  "Todos los tipos",
  "Delivery",
  "Local / llevar",
]

export const EXPENSE_CATEGORIES = [
  "Materia prima",
  "Compra de productos",
  "Pago motorizado",
  "Pago empleado",
  "Servicios",
  "Transporte",
  "Mantenimiento",
  "Otros",
]

export const EXPENSE_TYPES = [
  "Compra de inventario",
  "Gasto operativo",
  "Pago trabajador",
  "Pago delivery",
  "Servicio",
  "Mantenimiento",
  "Otro",
]

export const EXPENSE_METHODS = [
  "Sin registrar",
  "Efectivo divisas",
  "Zelle",
  "Binance / USDT",
  "Pago móvil",
  "Punto",
  "Transferencia",
  "Efectivo Bs",
  "Mixto",
  "Otro",
]

export const EMPTY_EXPENSE_FORM: ExpenseForm = {
  concept: "",
  category: "Materia prima",
  provider: "",
  expenseType: "Compra de inventario",
  amountUSD: "",
  amountVES: "",
  equivalentUSD: "",
  method: "Sin registrar",
  note: "",
}

export const EMPTY_EXPENSE_INVENTORY_FORM: ExpenseInventoryForm = {
  mode: "new",
  itemId: "",
  name: "",
  category: "Materia prima",
  quantity: "",
  unit: "unidades",
  minimumStock: "",
  note: "",
}

export const EXPENSE_INVENTORY_UNIT_OPTIONS = [
  "unidades",
  "paquetes",
  "cajas",
  "latas",
  "botellas",
  "kg",
  "gramos",
  "litros",
  "ml",
  "bolsas",
  "porciones",
]

export const DEFAULT_EXPENSE_QUICK_CONCEPTS: ExpenseQuickConcept[] = [
  {
    id: "pan-perro",
    name: "Pan de perro",
    category: "Materia prima",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "salchichas",
    name: "Salchichas",
    category: "Materia prima",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "papas",
    name: "Papas",
    category: "Materia prima",
    unit: "kg",
    relatedInventory: true,
  },
  {
    id: "queso-amarillo",
    name: "Queso amarillo",
    category: "Materia prima",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "tocineta",
    name: "Tocineta",
    category: "Materia prima",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "salsas",
    name: "Salsas",
    category: "Materia prima",
    unit: "unidades",
    relatedInventory: true,
  },
  {
    id: "maiz",
    name: "Maíz",
    category: "Materia prima",
    unit: "latas",
    relatedInventory: true,
  },
  {
    id: "ensalada",
    name: "Ensalada",
    category: "Materia prima",
    unit: "porciones",
    relatedInventory: true,
  },
  {
    id: "refrescos",
    name: "Refrescos",
    category: "Compra de productos",
    unit: "unidades",
    relatedInventory: true,
  },
  {
    id: "malta",
    name: "Malta",
    category: "Compra de productos",
    unit: "unidades",
    relatedInventory: true,
  },
  {
    id: "nestea",
    name: "Nestea",
    category: "Compra de productos",
    unit: "unidades",
    relatedInventory: true,
  },
  {
    id: "empaques",
    name: "Empaques",
    category: "Compra de productos",
    unit: "unidades",
    relatedInventory: true,
  },
  {
    id: "bolsas",
    name: "Bolsas",
    category: "Compra de productos",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "servilletas",
    name: "Servilletas",
    category: "Compra de productos",
    unit: "paquetes",
    relatedInventory: true,
  },
  {
    id: "pago-motorizado",
    name: "Pago motorizado",
    category: "Pago motorizado",
    unit: "unidades",
    relatedInventory: false,
  },
  {
    id: "pago-empleado",
    name: "Pago empleado",
    category: "Pago empleado",
    unit: "unidades",
    relatedInventory: false,
  },
  {
    id: "servicios",
    name: "Servicios",
    category: "Servicios",
    unit: "unidades",
    relatedInventory: false,
  },
  {
    id: "mantenimiento",
    name: "Mantenimiento",
    category: "Mantenimiento",
    unit: "unidades",
    relatedInventory: false,
  },
]

export function isComboItem(item: CartItem) {
  return item.paymentMode === "divisa"
}

export function isDeliveryOrder(order: LocalOrder) {
  const orderType = String(order.orderType || "").trim().toLowerCase()
  const tableNumber = String(order.tableNumber || "").trim().toLowerCase()
  const deliveryCostUSD = Number(order.deliveryCostUSD || 0)

  return (
    orderType === "delivery" ||
    tableNumber.startsWith("delivery") ||
    Boolean(
      order.deliveryAddress ||
        order.deliveryReference ||
        order.deliveryZone ||
        deliveryCostUSD > 0
    )
  )
}

export function getDisplayOrderType(order: LocalOrder): OrderType {
  if (isDeliveryOrder(order)) return "Delivery"
  if (order.orderType === "Para llevar") return "Para llevar"
  return "Comer aquí"
}

export function cleanDeliveryLocation(value: string) {
  return value
    .replace(/^delivery\s*-\s*/i, "")
    .trim()
}

export function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}


export function getDefaultExpenseTypeFromCategory(category: string, relatedInventory = false) {
  const normalizedCategory = normalizeComparableText(category)

  if (relatedInventory || normalizedCategory === "materia prima" || normalizedCategory === "compra de productos") {
    return "Compra de inventario"
  }

  if (normalizedCategory === "pago motorizado") return "Pago delivery"
  if (normalizedCategory === "pago empleado") return "Pago trabajador"
  if (normalizedCategory === "servicios") return "Servicio"
  if (normalizedCategory === "mantenimiento") return "Mantenimiento"

  return "Gasto operativo"
}

export function createExpenseQuickConceptId(name: string) {
  const base = normalizeComparableText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${base || "concepto"}-${Date.now()}`
}

export function normalizeExpenseQuickConcept(value: unknown): ExpenseQuickConcept | null {
  const source = (value || {}) as Partial<ExpenseQuickConcept>
  const name = String(source.name || "").trim()

  if (!name) {
    return null
  }

  const category = String(source.category || "Otros").trim() || "Otros"
  const unit = String(source.unit || "unidades").trim() || "unidades"

  return {
    id: String(source.id || "").trim() || createExpenseQuickConceptId(name),
    name,
    category,
    unit,
    relatedInventory: Boolean(source.relatedInventory),
  }
}

export function normalizeExpenseQuickConcepts(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const concepts: ExpenseQuickConcept[] = []

  source.forEach((item) => {
    const normalized = normalizeExpenseQuickConcept(item)
    const key = normalizeComparableText(normalized?.name || "")

    if (!normalized || !key || seen.has(key)) {
      return
    }

    seen.add(key)
    concepts.push(normalized)
  })

  return concepts
}


export function inventoryItemToExpenseQuickConcept(
  item: InventoryItemForExpense
): ExpenseQuickConcept {
  return {
    id: `inventory-${item.id}`,
    name: item.name,
    category: item.category || "Materia prima",
    unit: item.unit || "unidades",
    relatedInventory: true,
  }
}

export function mergeExpenseQuickConceptsWithInventory(
  concepts: ExpenseQuickConcept[],
  inventoryItems: InventoryItemForExpense[]
) {
  const merged = normalizeExpenseQuickConcepts(concepts)
  const seenNames = new Set(
    merged.map((concept) => normalizeComparableText(concept.name))
  )

  inventoryItems.forEach((item) => {
    const key = normalizeComparableText(item.name)

    if (!item.id || !item.name || !key || seenNames.has(key)) {
      return
    }

    merged.push(inventoryItemToExpenseQuickConcept(item))
    seenNames.add(key)
  })

  return merged
}

export function findExpenseInventoryItemByName(
  items: InventoryItemForExpense[],
  name: string
) {
  const target = normalizeComparableText(name)

  if (!target) return undefined

  return items.find((item) => normalizeComparableText(item.name) === target)
}

export function normalizeDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const zones: DeliveryZone[] = []

  value.forEach((zone) => {
    const name = String(zone?.name || "").trim()
    const costUSD = Number(zone?.costUSD || 0)
    const key = normalizeComparableText(name)

    if (!name || !key || seen.has(key) || !Number.isFinite(costUSD) || costUSD < 0) {
      return
    }

    seen.add(key)

    zones.push({
      name,
      costUSD,
      isActive: zone?.isActive !== false,
    })
  })

  return zones
}

export function getDisplayTableNumber(order: LocalOrder) {
  if (isDeliveryOrder(order)) {
    const cleanZone = String(order.deliveryZone || "").trim()
    const cleanTableNumber = cleanDeliveryLocation(String(order.tableNumber || ""))

    return cleanZone || cleanTableNumber || "Delivery"
  }

  return order.tableNumber || "Sin ubicación"
}

export function getOrderDeliveryCost(order: LocalOrder) {
  const savedCost = Number(order.deliveryCostUSD || 0)

  if (savedCost > 0) return savedCost

  if (!isDeliveryOrder(order)) return 0

  const normalizedZone = String(order.deliveryZone || order.tableNumber || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (normalizedZone.includes("trigalena")) return 2
  if (normalizedZone.includes("centro")) return 1
  if (normalizedZone.includes("prebo")) return 2.5
  if (normalizedZone.includes("naguanagua")) return 3
  if (normalizedZone.includes("samanes")) return 3
  if (normalizedZone.includes("san diego")) return 4

  return 0
}

export function getOrderTotals(order: LocalOrder) {
  const exchangeRate = Number(order.exchangeRate || 0)
  const deliveryCostUSD = getOrderDeliveryCost(order)

  const itemTotals = order.items.reduce(
    (totals, item) => {
      const subtotal = Number(item.price || 0) * Number(item.quantity || 0)

      if (isComboItem(item)) {
        totals.totalCombosUSD += subtotal
      } else {
        totals.totalRegularUSD += subtotal
      }

      return totals
    },
    {
      totalCombosUSD: 0,
      totalRegularUSD: 0,
    }
  )

  const hasReadableItems = Array.isArray(order.items) && order.items.length > 0

  const savedCombosUSD = Number(order.totalCombosUSD ?? 0)
  const savedRegularUSD = Number(order.totalRegularUSD ?? 0)

  const totalCombosUSD = hasReadableItems
    ? itemTotals.totalCombosUSD
    : savedCombosUSD

  const totalRegularUSD = hasReadableItems
    ? itemTotals.totalRegularUSD
    : savedRegularUSD

  const totalRegularVES = hasReadableItems
    ? totalRegularUSD * exchangeRate
    : Number(order.totalRegularVES ?? order.totalVES ?? totalRegularUSD * exchangeRate)

  const totalBeforeDeliveryUSD = totalCombosUSD + totalRegularUSD
  const totalUSD = totalBeforeDeliveryUSD + deliveryCostUSD

  return {
    totalUSD,
    totalCombosUSD,
    totalRegularUSD,
    totalRegularVES,
    deliveryCostUSD,
    totalBeforeDeliveryUSD,
  }
}

// Aritmética de dinero compartida: la implementación vive en localOrderMoney.
export { formatMoneyForInput, parseMoneyInput, roundMoney }


export function calculatePaymentStatus(
  receivedEquivalentUSD: number,
  totalOrderUSD: number
): PaymentStatus {
  const received = roundMoney(receivedEquivalentUSD)
  const total = roundMoney(totalOrderUSD)

  if (received <= 0) return "Pendiente"
  if (received >= total - 0.01) return "Pagado"

  return "Pago parcial"
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === "Pago parcial" || value === "Pagado") return value

  return "Pendiente"
}

export function normalizeDeliveryPaymentIn(value: unknown): DeliveryPaymentIn {
  const normalized = normalizeComparableText(String(value || ""))

  if (normalized === "divisas" || normalized === "divisa") {
    return "Divisas"
  }

  if (
    normalized === "bolivares" ||
    normalized === "bolivar" ||
    normalized === "bs" ||
    normalized === "ves"
  ) {
    return "Bolívares"
  }

  if (normalized === "mixto" || normalized === "mixta") {
    return "Mixto"
  }

  return "Sin registrar"
}

export function normalizePaymentMethodUSD(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "divisas sin metodo"
  ) {
    return ""
  }

  if (
    normalized === "efectivo divisas" ||
    normalized === "efectivo en divisas" ||
    normalized === "divisas" ||
    normalized === "divisa" ||
    normalized === "dolares" ||
    normalized === "dolares efectivo" ||
    normalized === "usd" ||
    normalized === "cash" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo divisas"
  }

  if (normalized.includes("zelle")) return "Zelle"
  if (
    normalized.includes("binance") ||
    normalized.includes("usdt") ||
    normalized.includes("tether")
  ) {
    return "Binance / USDT"
  }

  if (
    normalized.includes("transferencia internacional") ||
    normalized.includes("transferencia externa") ||
    normalized.includes("wire")
  ) {
    return "Transferencia internacional"
  }

  return "Otro"
}

export function normalizePaymentMethodVES(value: unknown) {
  const normalized = normalizeComparableText(String(value || ""))

  if (
    !normalized ||
    normalized === "sin registrar" ||
    normalized === "sin metodo" ||
    normalized === "bolivares sin metodo"
  ) {
    return ""
  }

  if (
    normalized === "pago movil" ||
    normalized === "pagomovil" ||
    normalized.includes("pago movil") ||
    normalized.includes("movil")
  ) {
    return "Pago móvil"
  }

  if (normalized.includes("punto")) return "Punto"
  if (normalized.includes("transferencia")) return "Transferencia"

  if (
    normalized === "efectivo bs" ||
    normalized === "efectivo bolivares" ||
    normalized === "bolivares" ||
    normalized === "bs" ||
    normalized.includes("efectivo")
  ) {
    return "Efectivo Bs"
  }

  if (normalized.includes("biopago") || normalized.includes("bio pago")) {
    return "Biopago"
  }

  return "Otro"
}

export function normalizeOrderIndicatedPaymentMethod(value: unknown) {
  const original = String(value || "").trim()
  const normalized = normalizeComparableText(original)

  if (!normalized || normalized === "sin metodo" || normalized === "sin registrar") {
    return "Sin método registrado"
  }

  if (normalized.includes("pago movil") || normalized.includes("pagomovil")) {
    return "Pago móvil"
  }

  if (normalized.includes("efectivo") && normalized.includes("divisa")) {
    return "Efectivo en divisas"
  }

  if (normalized === "divisas" || normalized === "divisa") {
    return "Efectivo en divisas"
  }

  if (normalized.includes("punto")) return "Punto"
  if (normalized.includes("transferencia")) return "Transferencia"
  if (normalized.includes("zelle")) return "Zelle"
  if (
    normalized.includes("binance") ||
    normalized.includes("usdt") ||
    normalized.includes("tether")
  ) {
    return "Binance / USDT"
  }

  return original
}

export function getOrderPayment(order: LocalOrder): OrderPayment {
  const orderTotals = getOrderTotals(order)
  const savedPayment = order.payment

  const totalOrderUSD = roundMoney(
    savedPayment?.totalOrderUSD ??
      order.paymentTotalOrderUSD ??
      orderTotals.totalUSD
  )

  const receivedEquivalentUSD = roundMoney(
    savedPayment?.receivedEquivalentUSD ??
      order.paymentReceivedEquivalentUSD ??
      0
  )

  const calculatedStatus = calculatePaymentStatus(
    receivedEquivalentUSD,
    totalOrderUSD
  )

  const status = normalizePaymentStatus(
    savedPayment?.status ?? order.paymentStatus ?? calculatedStatus
  )

  const pendingUSD =
    status === "Pagado"
      ? 0
      : roundMoney(
          savedPayment?.pendingUSD ??
            order.paymentPendingUSD ??
            Math.max(totalOrderUSD - receivedEquivalentUSD, 0)
        )

  return {
    status,
    amountReceivedUSD: roundMoney(
      savedPayment?.amountReceivedUSD ?? order.amountReceivedUSD ?? 0
    ),
    amountReceivedVES: roundMoney(
      savedPayment?.amountReceivedVES ?? order.amountReceivedVES ?? 0
    ),
    paymentMethodUSD: normalizePaymentMethodUSD(
      savedPayment?.paymentMethodUSD ?? order.paymentMethodUSD ?? ""
    ),
    paymentMethodVES: normalizePaymentMethodVES(
      savedPayment?.paymentMethodVES ?? order.paymentMethodVES ?? ""
    ),
    deliveryPaymentIn: normalizeDeliveryPaymentIn(
      savedPayment?.deliveryPaymentIn ?? order.deliveryPaymentIn
    ),
    paymentNote: String(savedPayment?.paymentNote ?? order.paymentNote ?? ""),
    totalOrderUSD,
    receivedEquivalentUSD,
    pendingUSD,
    updatedAt: String(savedPayment?.updatedAt ?? order.paymentUpdatedAt ?? ""),
  }
}

export function getPaymentStatusStyle(status: PaymentStatus) {
  if (status === "Pagado") return "bg-green-500 text-white"
  if (status === "Pago parcial") return "bg-[var(--brand-accent)] text-[var(--brand-ink-2)]"

  return "bg-red-100 text-red-700 border border-red-300"
}

// Lo que el cliente DIJO que iba a pagar, derivado de order.paymentMethod +
// totales (misma precarga que caja, lote v7: el fix v6 D.1 solo se había
// aplicado a /caja y en esta pantalla el cobro seguía arrancando vacío).
function derivePaymentPrefillFromOrder(order: LocalOrder): {
  amountReceivedUSD: string
  amountReceivedVES: string
  paymentMethodUSD: string
  paymentMethodVES: string
  deliveryPaymentIn: DeliveryPaymentIn
} | null {
  const legs = getOrderPaymentLegs({
    paymentMethod: order.paymentMethod,
    totalUSD: getOrderTotals(order).totalUSD,
    exchangeRate: Number(order.exchangeRate || 0),
  })
  if (!legs.length) return null

  const usdLegs = legs.filter((leg) => leg.currency === "USD")
  const vesLegs = legs.filter((leg) => leg.currency === "VES")
  const amountUSD = roundMoney(usdLegs.reduce((total, leg) => total + leg.amount, 0))
  const amountVES = roundMoney(vesLegs.reduce((total, leg) => total + leg.amount, 0))

  return {
    amountReceivedUSD: amountUSD > 0 ? String(amountUSD) : "",
    amountReceivedVES: amountVES > 0 ? String(amountVES) : "",
    paymentMethodUSD: usdLegs.length ? normalizePaymentMethodUSD(usdLegs[0].method) : "",
    paymentMethodVES: vesLegs.length ? normalizePaymentMethodVES(vesLegs[0].method) : "",
    deliveryPaymentIn:
      usdLegs.length && vesLegs.length ? "Mixto" : vesLegs.length ? "Bolívares" : "Divisas",
  }
}

export function createPaymentFormFromOrder(order: LocalOrder): PaymentForm {
  const payment = getOrderPayment(order)
  // Sin cobro previo ni métodos guardados: precargar lo que eligió el cliente
  // (métodos y montos, editable si al final pagó distinto).
  const nothingRegistered =
    payment.amountReceivedUSD <= 0 &&
    payment.amountReceivedVES <= 0 &&
    !payment.paymentMethodUSD &&
    !payment.paymentMethodVES
  const prefill = nothingRegistered ? derivePaymentPrefillFromOrder(order) : null

  return {
    amountReceivedUSD:
      payment.amountReceivedUSD > 0
        ? String(payment.amountReceivedUSD)
        : prefill?.amountReceivedUSD || "",
    amountReceivedVES:
      payment.amountReceivedVES > 0
        ? String(payment.amountReceivedVES)
        : prefill?.amountReceivedVES || "",
    paymentMethodUSD: prefill?.paymentMethodUSD || payment.paymentMethodUSD,
    paymentMethodVES: prefill?.paymentMethodVES || payment.paymentMethodVES,
    deliveryPaymentIn: isDeliveryOrder(order)
      ? payment.deliveryPaymentIn === "Sin registrar" && prefill
        ? prefill.deliveryPaymentIn
        : payment.deliveryPaymentIn
      : "Sin registrar",
    paymentNote: payment.paymentNote,
  }
}

export function calculatePaymentDraft(order: LocalOrder, form: PaymentForm) {
  const orderTotals = getOrderTotals(order)
  const totalOrderUSD = roundMoney(orderTotals.totalUSD)
  const exchangeRate = Number(order.exchangeRate || 0)
  const amountReceivedUSD = parseMoneyInput(form.amountReceivedUSD)
  const amountReceivedVES = parseMoneyInput(form.amountReceivedVES)
  const receivedFromVES =
    amountReceivedVES > 0 && exchangeRate > 0
      ? amountReceivedVES / exchangeRate
      : 0
  const receivedEquivalentUSD = roundMoney(amountReceivedUSD + receivedFromVES)
  const status = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const pendingUSD =
    status === "Pagado"
      ? 0
      : roundMoney(Math.max(totalOrderUSD - receivedEquivalentUSD, 0))

  return {
    totalOrderUSD,
    amountReceivedUSD,
    amountReceivedVES,
    receivedEquivalentUSD,
    pendingUSD,
    status,
  }
}

export function createEmptySummaryTotals(): DaySummaryTotals {
  return {
    count: 0,
    totalUSD: 0,
    totalCombosUSD: 0,
    totalRegularUSD: 0,
    totalRegularVES: 0,
    deliveryCostUSD: 0,
  }
}

export function addOrderToSummaryTotals(totals: DaySummaryTotals, order: LocalOrder) {
  const orderTotals = getOrderTotals(order)

  totals.count += 1
  totals.totalUSD += orderTotals.totalUSD
  totals.totalCombosUSD += orderTotals.totalCombosUSD
  totals.totalRegularUSD += orderTotals.totalRegularUSD
  totals.totalRegularVES += orderTotals.totalRegularVES
  totals.deliveryCostUSD += orderTotals.deliveryCostUSD
}

export function addOrderToSummaryMap(
  map: Map<string, DaySummaryTotals>,
  label: string,
  order: LocalOrder
) {
  const cleanLabel = label.trim() || "Sin dato"
  const current = map.get(cleanLabel) || createEmptySummaryTotals()

  addOrderToSummaryTotals(current, order)
  map.set(cleanLabel, current)
}

export function summaryMapToArray(map: Map<string, DaySummaryTotals>): DaySummaryItem[] {
  return Array.from(map.entries())
    .map(([label, totals]) => ({
      label,
      ...totals,
    }))
    .sort((a, b) => b.totalUSD - a.totalUSD)
}

export function createEmptyPaymentSummaryTotals(): PaymentSummaryTotals {
  return {
    count: 0,
    totalUSD: 0,
    totalVES: 0,
    deliveryCostUSD: 0,
  }
}

export function addPaymentToSummaryMap(
  map: Map<string, PaymentSummaryTotals>,
  label: string,
  totalUSD: number,
  totalVES = 0,
  deliveryCostUSD = 0
) {
  const cleanLabel = label.trim() || "Sin registrar"
  const current = map.get(cleanLabel) || createEmptyPaymentSummaryTotals()

  current.count += 1
  current.totalUSD += roundMoney(totalUSD)
  current.totalVES += roundMoney(totalVES)
  current.deliveryCostUSD += roundMoney(deliveryCostUSD)

  map.set(cleanLabel, current)
}

export function paymentSummaryMapToArray(
  map: Map<string, PaymentSummaryTotals>
): PaymentSummaryItem[] {
  return Array.from(map.entries())
    .map(([label, totals]) => ({
      label,
      count: totals.count,
      totalUSD: roundMoney(totals.totalUSD),
      totalVES: roundMoney(totals.totalVES),
      deliveryCostUSD: roundMoney(totals.deliveryCostUSD),
    }))
    .sort((a, b) => b.totalUSD - a.totalUSD)
}

export function getDeliveryPaymentLabel(order: LocalOrder) {
  return normalizeOrderIndicatedPaymentMethod(order.paymentMethod)
}

export async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      "El servidor respondió con una página HTML en vez de datos. Revisa que la API de pedidos y Supabase estén funcionando correctamente."
    )
  }
}

export function isPaymentProofPending(proof: PaymentProof) {
  return proof.status === "Comprobante enviado" || proof.status === "En revisión"
}

export function getPendingPaymentProofs(proofs: PaymentProof[]) {
  return proofs.filter(isPaymentProofPending)
}

export function formatPaymentProofDate(value: string) {
  if (!value) return "Sin fecha"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function getDateKeyInCaracas(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value || "0000"
  const month = parts.find((part) => part.type === "month")?.value || "00"
  const day = parts.find((part) => part.type === "day")?.value || "00"

  return `${year}-${month}-${day}`
}

export function formatCaracasLongDate(value: Date) {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Caracas",
    }).format(value)
  } catch {
    return "Hoy"
  }
}

export function getDisplayOrderNumber(order: LocalOrder) {
  if (order.branchNumber && order.branchNumber > 0) {
    return `#${String(order.branchNumber).padStart(2, "0")}${
      order.branchCode ? `-${order.branchCode}` : ""
    }`
  }

  if (order.rowNumber && order.rowNumber > 1) {
    return `#${String(order.rowNumber - 1).padStart(2, "0")}`
  }

  const parts = order.id.split("-")
  const lastPart = parts[parts.length - 1] || order.id

  return `#${lastPart.slice(-3)}`
}

export function getStatusStyle(status: OrderStatus) {
  if (status === "Nuevo") return "bg-red-500 text-white"
  if (status === "Preparando") return "bg-orange-400 text-[var(--brand-ink-2)]"
  if (status === "Listo") return "bg-[var(--brand-accent)] text-[var(--brand-ink-2)]"
  if (status === "Entregado") return "bg-green-500 text-white"

  return "bg-[var(--brand-ink-3)] text-white"
}

export function getStatusIcon(status: OrderStatus) {
  if (status === "Nuevo") return <Clock size={16} />
  if (status === "Preparando") return <CookingPot size={16} />
  if (status === "Listo") return <PackageCheck size={16} />
  if (status === "Entregado") return <CheckCircle2 size={16} />

  return <XCircle size={16} />
}

export function getPrimaryAction(status: OrderStatus):
  | {
      label: string
      nextStatus: OrderStatus
      className: string
    }
  | undefined {
  if (status === "Nuevo") {
    return {
      label: "Preparar",
      nextStatus: "Preparando",
      className: "bg-orange-400 text-[var(--brand-ink-2)] hover:bg-orange-300",
    }
  }

  if (status === "Preparando") {
    return {
      label: "Marcar listo",
      nextStatus: "Listo",
      className: "bg-[var(--brand-accent)] text-[var(--brand-ink-2)] hover:bg-[var(--brand-accent-200)]",
    }
  }

  if (status === "Listo") {
    return {
      label: "Entregado",
      nextStatus: "Entregado",
      className: "bg-green-500 text-white hover:bg-green-400",
    }
  }

  return undefined
}

export function shouldShowAsActive(order: LocalOrder) {
  return order.status !== "Entregado" && order.status !== "Cancelado"
}

export function getPanelSoundPattern(kind: PanelSoundKind) {
  if (kind === "new-order") {
    return [
      { frequency: 880, delay: 0, duration: 0.14, volume: 0.09 },
      { frequency: 1175, delay: 0.18, duration: 0.14, volume: 0.08 },
      { frequency: 988, delay: 0.36, duration: 0.18, volume: 0.08 },
    ]
  }

  if (kind === "sent-kitchen") {
    return [
      { frequency: 659, delay: 0, duration: 0.12, volume: 0.07 },
      { frequency: 784, delay: 0.16, duration: 0.16, volume: 0.07 },
    ]
  }

  if (kind === "ready") {
    return [
      { frequency: 784, delay: 0, duration: 0.14, volume: 0.08 },
      { frequency: 988, delay: 0.17, duration: 0.14, volume: 0.08 },
      { frequency: 1319, delay: 0.34, duration: 0.2, volume: 0.08 },
    ]
  }

  if (kind === "delivery") {
    return [
      { frequency: 523, delay: 0, duration: 0.14, volume: 0.07 },
      { frequency: 659, delay: 0.16, duration: 0.14, volume: 0.07 },
      { frequency: 784, delay: 0.32, duration: 0.16, volume: 0.07 },
    ]
  }

  if (kind === "payment") {
    // "Caja registradora": dos campanadas agudas y una nota larga de cierre,
    // distinta a los demás avisos para que el cobro se reconozca de oído.
    return [
      { frequency: 1047, delay: 0, duration: 0.1, volume: 0.09 },
      { frequency: 1319, delay: 0.12, duration: 0.1, volume: 0.09 },
      { frequency: 1568, delay: 0.24, duration: 0.3, volume: 0.09 },
    ]
  }

  if (kind === "warning") {
    return [
      { frequency: 330, delay: 0, duration: 0.18, volume: 0.08 },
      { frequency: 247, delay: 0.22, duration: 0.22, volume: 0.08 },
    ]
  }

  return [
    { frequency: 740, delay: 0, duration: 0.12, volume: 0.07 },
    { frequency: 988, delay: 0.16, duration: 0.16, volume: 0.07 },
  ]
}

export function playPanelSoundWithContext(
  audioContext: AudioContext,
  kind: PanelSoundKind
) {
  const pattern = getPanelSoundPattern(kind)

  // Timbre tipo "campanita de notificación" (pedido del dueño 2026-07-21):
  // cada nota lleva su octava suave encima y una cola de decaimiento larga,
  // como el "ding" de un teléfono, en vez del pitido seco de oscilador puro.
  pattern.forEach((note) => {
    const startTime = audioContext.currentTime + note.delay
    const tailDuration = Math.max(note.duration * 2.4, 0.35)
    const endTime = startTime + tailDuration

    const partials = [
      { ratio: 1, gain: note.volume },
      { ratio: 2, gain: note.volume * 0.35 },
      { ratio: 3, gain: note.volume * 0.12 },
    ]

    partials.forEach((partial) => {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(note.frequency * partial.ratio, startTime)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(partial.gain, startTime + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.start(startTime)
      oscillator.stop(endTime + 0.03)
    })
  })
}


export function getProductsSoldFromOrders(orders: LocalOrder[]) {
  const productMap = new Map<string, ProductSold>()

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const subtotalUSD = Number(item.price || 0) * Number(item.quantity || 0)
      const onlyCurrency = isComboItem(item)
      const subtotalVES = onlyCurrency
        ? 0
        : subtotalUSD * Number(order.exchangeRate || 0)

      const current = productMap.get(item.name) || {
        name: item.name,
        quantity: 0,
        totalUSD: 0,
        totalVES: 0,
        onlyCurrency,
      }

      current.quantity += item.quantity
      current.totalUSD += subtotalUSD
      current.totalVES += subtotalVES
      current.onlyCurrency = current.onlyCurrency && onlyCurrency

      productMap.set(item.name, current)
    })
  })

  return Array.from(productMap.values()).sort(
    (a, b) => b.quantity - a.quantity
  )
}


export type DeliveryWhatsAppMessageType = "confirm" | "preparing" | "onTheWay" | "arrived" | "ready"

export function normalizePhoneForWhatsApp(value: string) {
  const digits = String(value || "").replace(/\D/g, "")

  if (!digits) return ""

  // Venezuela: 0412xxxxxxx, 0414xxxxxxx, 0424xxxxxxx, etc.
  if (digits.startsWith("0") && digits.length === 11) {
    return `58${digits.slice(1)}`
  }

  // Venezuela sin cero inicial: 412xxxxxxx, 414xxxxxxx, etc.
  if (digits.startsWith("4") && digits.length === 10) {
    return `58${digits}`
  }

  // Venezuela con código internacional: 58412xxxxxxx
  if (digits.startsWith("58") && digits.length === 12) {
    return digits
  }

  // Otros números internacionales razonables. Evita abrir WhatsApp con pruebas como "4" o "123".
  if (!digits.startsWith("0") && digits.length >= 10 && digits.length <= 15) {
    return digits
  }

  return ""
}

export function getCustomerPhoneLabel(order: LocalOrder) {
  const phone = String(order.customerPhone || "").trim()

  return phone || "Sin teléfono registrado"
}

export function buildDeliveryProductsMessage(order: LocalOrder) {
  const exchangeRate = Number(order.exchangeRate || 0)

  if (!order.items.length) {
    return "- Sin productos detallados"
  }

  return order.items
    .map((item) => {
      const subtotalUSD = Number(item.price || 0) * Number(item.quantity || 0)
      const note = item.noteEnabled && item.note ? ` | Nota: ${item.note}` : ""

      if (isComboItem(item)) {
        return `- ${item.name} x${item.quantity} - ${formatUSD(subtotalUSD)} | Base en divisas${note}`
      }

      return `- ${item.name} x${item.quantity} - ${formatUSD(
        subtotalUSD
      )} / Ref. Bs ${formatVES(subtotalUSD * exchangeRate)}${note}`
    })
    .join("\n")
}

export function buildDeliveryWhatsAppMessage(
  order: LocalOrder,
  messageType: DeliveryWhatsAppMessageType
) {
  const orderTotals = getOrderTotals(order)
  const exchangeRate = Number(order.exchangeRate || 0)
  const displayNumber = getDisplayOrderNumber(order)
  const deliveryCostVES = orderTotals.deliveryCostUSD * exchangeRate
  const regularAndDeliveryVES = orderTotals.totalRegularVES + deliveryCostVES
  const customerName = order.customerName || "cliente"
  const customerPhone = getCustomerPhoneLabel(order)
  const zone = getDisplayTableNumber(order)
  const paymentMethod = order.paymentMethod || "Por confirmar"
  const deliveryAddress = order.deliveryAddress || "Sin dirección registrada"
  const deliveryReference = order.deliveryReference || "Sin referencia registrada"

  if (messageType === "preparing") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya está en preparación.`,
      "Te avisaremos cuando vaya saliendo hacia tu dirección.",
      "",
      `Zona: ${zone}`,
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
        deliveryCostVES
      )}`,
    ].join("\n")
  }

  if (messageType === "onTheWay") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya va saliendo hacia tu dirección.`,
      "Por favor mantente pendiente del teléfono para recibir el delivery.",
      "",
      `Dirección: ${deliveryAddress}`,
      `Referencia: ${deliveryReference}`,
      `Zona: ${zone}`,
      "",
      `Total final: ${formatUSD(orderTotals.totalUSD)}`,
      `Delivery incluido: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
        deliveryCostVES
      )}`,
    ].join("\n")
  }

  if (messageType === "arrived") {
    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, tu pedido ${displayNumber} ya llegó a la ubicación indicada.`,
      "Por favor recibe el delivery y verifica tu pedido con el repartidor.",
      "",
      `Dirección: ${deliveryAddress}`,
      `Referencia: ${deliveryReference}`,
      `Zona: ${zone}`,
      "",
      `Gracias por comprar en ${BRAND.name}.`,
    ].join("\n")
  }

  if (messageType === "ready") {
    // El builder corre en el navegador del staff: el link de seguimiento usa
    // el mismo host desde el que atiende (sirve en prod y en previews).
    const trackingUrl =
      typeof window !== "undefined" ? `${window.location.origin}/pedido/${order.id}` : ""

    return [
      `Hola, somos ${BRAND.name}.`,
      "",
      `${customerName}, ¡tu pedido ${displayNumber} ya está listo!`,
      "Puedes pasar a retirarlo indicando tu número de pedido.",
      "",
      `Pedido: ${displayNumber}`,
      `Total: ${formatUSD(orderTotals.totalUSD)}`,
      ...(trackingUrl ? ["", `Sigue tu pedido aquí: ${trackingUrl}`] : []),
      "",
      `Gracias por comprar en ${BRAND.name}.`,
    ].join("\n")
  }

  return [
    `Hola, somos ${BRAND.name}.`,
    "",
    `Confirmamos tu pedido ${displayNumber}.`,
    "",
    `Cliente: ${customerName}`,
    `Teléfono: ${customerPhone}`,
    `Zona: ${zone}`,
    `Dirección: ${deliveryAddress}`,
    `Referencia: ${deliveryReference}`,
    "",
    "Productos:",
    buildDeliveryProductsMessage(order),
    "",
    "Resumen:",
    `Combos/base divisa: ${formatUSD(orderTotals.totalCombosUSD)}`,
    `Productos normales: ${formatUSD(
      orderTotals.totalRegularUSD
    )} / Ref. Bs ${formatVES(orderTotals.totalRegularVES)}`,
    `Delivery: ${formatUSD(orderTotals.deliveryCostUSD)} / Ref. Bs ${formatVES(
      deliveryCostVES
    )}`,
    `Total final: ${formatUSD(orderTotals.totalUSD)}`,
    `Referencia en Bs de productos normales + delivery: Bs ${formatVES(
      regularAndDeliveryVES
    )}`,
    "",
    `Método indicado en el pedido: ${paymentMethod}`,
    "",
    "Por favor confírmanos cómo realizarás el pago:",
    "1. Productos en divisas, bolívares o mixto.",
    "2. Delivery en divisas o bolívares.",
    "",
    "Al confirmar la forma de pago, comenzamos a preparar tu pedido.",
  ].join("\n")
}

export function buildDeliveryWhatsAppUrl(
  order: LocalOrder,
  messageType: DeliveryWhatsAppMessageType
) {
  const phone = normalizePhoneForWhatsApp(order.customerPhone || "")
  const message = buildDeliveryWhatsAppMessage(order, messageType)

  if (!phone) return ""

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

// Encuesta post-venta: mensaje corto para pedidos ENTREGADOS. Si el dueño
// escribió su propio mensaje en Configuración se envía tal cual (el link de
// la encuesta se agrega igual); vacío = esta plantilla. Espejo del builder
// de caja/domain.
export function buildPostSaleSurveyWhatsAppUrl(
  order: LocalOrder,
  options: { customMessage?: string; reviewUrl?: string } = {}
) {
  const phone = normalizePhoneForWhatsApp(order.customerPhone || "")

  if (!phone) return ""

  const surveyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/encuesta/${order.id}`
      : ""

  const customMessage = String(options.customMessage || "").trim()
  const message = customMessage
    ? surveyUrl
      ? [customMessage, "", `Califícanos aquí (1 minuto): ${surveyUrl}`].join("\n")
      : customMessage
    : [
        `Hola ${order.customerName || "cliente"}, somos ${BRAND.name}. ¡Gracias por tu pedido ${getDisplayOrderNumber(order)}!`,
        "",
        "Queremos mejorar y tu opinión nos ayuda muchísimo. ¿Nos regalas 1 minuto?",
        ...(surveyUrl
          ? ["", `Califica tu pedido con estrellas aquí: ${surveyUrl}`]
          : [
              "",
              "1. Del 1 al 5, ¿qué tal estuvo tu pedido?",
              "2. ¿La entrega fue a tiempo?",
              "3. ¿Qué podemos mejorar?",
            ]),
        "",
        "También puedes respondernos por aquí, leemos todo.",
        ...(options.reviewUrl
          ? ["", `Y si quieres apoyarnos, déjanos tu reseña: ${options.reviewUrl}`]
          : []),
      ].join("\n")

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

// Texto para pasarle el pedido al repartidor por WhatsApp con UN solo copiado:
// teléfono del cliente, link de la dirección y un resumen corto de qué lleva.
// Sin montos ni estado de pago: al repartidor no le interesan (pedido del
// dueño 2026-07-12). Pensado para "lo marco listo y se lo mando al delivery".
export function buildCourierHandoffText(order: LocalOrder) {
  const displayNumber = getDisplayOrderNumber(order)
  // La dirección guarda el link de Maps dentro del texto ("Ubicación (Maps):
  // https://... · ~2.3 km"): se extrae el link limpio para que el repartidor
  // lo abra directo; si no hay link se manda la dirección tal cual.
  const rawAddress = String(order.deliveryAddress || "").trim()
  const mapsLink = rawAddress.match(/https?:\/\/[^\s·]+/)?.[0] || ""
  const itemsSummary = (order.items || [])
    .map((item) => `${Math.max(1, Number(item.quantity || 1))}x ${item.name}`)
    .join(", ")

  return [
    `Pedido ${displayNumber} · ${order.customerName || "Cliente"}`,
    `Teléfono: ${order.customerPhone || "Sin teléfono"}`,
    `Dirección: ${mapsLink || rawAddress || "Sin dirección registrada"}`,
    ...(order.deliveryReference
      ? [`Referencia: ${order.deliveryReference}`]
      : []),
    ...(itemsSummary ? [`Pedido: ${itemsSummary}`] : []),
  ].join("\n")
}

export function matchesPanelPaymentFilter(order: LocalOrder, filter: PanelPaymentFilter) {
  if (filter === "Todos los cobros") return true

  const payment = getOrderPayment(order)

  if (filter === "Pendiente de pago") return payment.status === "Pendiente"
  if (filter === "Pago parcial") return payment.status === "Pago parcial"
  if (filter === "Pagado") return payment.status === "Pagado"

  return true
}

export function matchesPanelScopeFilter(order: LocalOrder, filter: PanelOrderScopeFilter) {
  if (filter === "Todos los tipos") return true
  if (filter === "Delivery") return isDeliveryOrder(order)

  return !isDeliveryOrder(order)
}

export function matchesPanelSearch(order: LocalOrder, query: string) {
  const cleanQuery = normalizeComparableText(query)

  if (!cleanQuery) return true

  const payment = getOrderPayment(order)
  const staffConfirmationSummary = getOrderStaffConfirmationSummary(order)
  const productsText = order.items
    .map((item) =>
      [
        item.name,
        item.selectionSummary,
        item.selectedVariation?.name,
        item.selectedVariation?.groupName,
        ...(item.selectedAddons || []).map((option) => `${option.groupName || ""} ${option.name || ""}`),
        ...(item.removedIngredients || []).map((option) => `sin ${option.name || ""}`),
        item.requiresWaiterConfirmation ? "revisar confirmar personal mesonero" : "",
        item.staffConfirmationStatus === "confirmed" ? "confirmado revision confirmada" : "",
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
  const searchableText = normalizeComparableText(
    [
      order.id,
      getDisplayOrderNumber(order),
      order.customerName,
      order.customerPhone,
      order.tableNumber,
      order.deliveryZone,
      order.deliveryAddress,
      order.deliveryReference,
      order.paymentMethod,
      order.status,
      payment.status,
      payment.paymentMethodUSD,
      payment.paymentMethodVES,
      payment.deliveryPaymentIn,
      getStaffConfirmationStatusLabel(staffConfirmationSummary.status),
      staffConfirmationSummary.pendingText,
      staffConfirmationSummary.status === "pending" ? "por revisar pendiente confirmar personal" : "",
      staffConfirmationSummary.status === "partial" ? "revision parcial confirmar personal" : "",
      staffConfirmationSummary.status === "confirmed" ? "revision confirmada confirmado personal" : "",
      productsText,
    ]
      .filter(Boolean)
      .join(" ")
  )

  return searchableText.includes(cleanQuery)
}

export function normalizeDayExpense(value: unknown): DayExpense {
  const expense = (value || {}) as Partial<DayExpense>

  return {
    id: String(expense.id || ""),
    dateLabel: String(expense.dateLabel || ""),
    dateValue: String(expense.dateValue || ""),
    concept: String(expense.concept || ""),
    category: String(expense.category || "Otros"),
    amountUSD: roundMoney(expense.amountUSD || 0),
    amountVES: roundMoney(expense.amountVES || 0),
    equivalentUSD: roundMoney(expense.equivalentUSD || 0),
    method: String(expense.method || "Sin registrar"),
    note: String(expense.note || ""),
    createdAt: String(expense.createdAt || ""),
    provider: String(expense.provider || ""),
    expenseType: String(expense.expenseType || "Gasto operativo"),
    inventoryLinked: Boolean(expense.inventoryLinked),
    inventoryItemId: String(expense.inventoryItemId || ""),
    inventoryItemName: String(expense.inventoryItemName || ""),
    inventoryQuantity: roundMoney(expense.inventoryQuantity || 0),
    inventoryUnit: String(expense.inventoryUnit || "unidades"),
  }
}

export function normalizeInventoryItemForExpense(value: unknown): InventoryItemForExpense {
  const item = (value || {}) as Partial<InventoryItemForExpense>

  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    category: String(item.category || "Materia prima"),
    quantity: roundMoney(item.quantity || 0),
    unit: String(item.unit || "unidades"),
    minimumStock: roundMoney(item.minimumStock || 0),
    costUSD: roundMoney(item.costUSD || 0),
    costVES: roundMoney(item.costVES || 0),
    equivalentCostUSD: roundMoney(item.equivalentCostUSD || item.costUSD || 0),
    note: String(item.note || ""),
    isActive: item.isActive !== false,
    updatedAt: String(item.updatedAt || ""),
  }
}

export function getExpenseEquivalentUSDFromForm(
  form: ExpenseForm,
  exchangeRate: number
) {
  const amountUSD = parseMoneyInput(form.amountUSD)
  const amountVES = parseMoneyInput(form.amountVES)
  const manualEquivalentUSD = parseMoneyInput(form.equivalentUSD)
  const vesEquivalentUSD =
    amountVES > 0 && exchangeRate > 0 ? amountVES / exchangeRate : 0

  if (manualEquivalentUSD > 0) {
    return roundMoney(manualEquivalentUSD)
  }

  return roundMoney(amountUSD + vesEquivalentUSD)
}

export function normalizeBooleanConfig(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "activado", "activada"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "desactivado", "desactivada", "oculto", "oculta"].includes(normalized)) {
    return false
  }

  return fallback
}

export function normalizeBusinessViewMode(value: unknown): BusinessViewMode {
  const normalized = String(value || "").trim().toLowerCase()

  if (normalized === "simple") return "simple"
  if (normalized === "avanzado") return "avanzado"

  return "negocio"
}

export function normalizeExchangeRateMode(value: unknown): ExchangeRateMode {
  const normalized = String(value || "").trim().toLowerCase()

  if (normalized === "manual") return "manual"
  if (normalized === "automaticeur" || normalized === "euro") {
    return "automaticEur"
  }

  return "automatic"
}


export function createLocalTableId(value: string, index: number) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return base || `mesa-${index + 1}`
}

export function normalizeLocalTablesConfig(value: unknown): LocalTable[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue)
              ? parsedValue
              : cleanValue.split(/[;,|\n]/g)
          } catch {
            return cleanValue.split(/[;,|\n]/g)
          }
        })()
      : []
  const seen = new Set<string>()
  const normalizedTables: LocalTable[] = []

  source.forEach((item, index) => {
    const rawItem = item && typeof item === "object" ? item as Partial<LocalTable> : { name: String(item || "") }
    const name = String(rawItem.name || "").trim()

    if (!name) return

    const comparableName = normalizeComparableText(name)

    if (!comparableName || seen.has(comparableName)) return

    seen.add(comparableName)

    const sortOrder = Number(rawItem.sortOrder || index + 1)

    normalizedTables.push({
      id: String(rawItem.id || "").trim() || createLocalTableId(name, index),
      name,
      area: String(rawItem.area || "Principal").trim() || "Principal",
      sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? Math.round(sortOrder) : index + 1,
      isActive: normalizeBooleanConfig(rawItem.isActive, true),
      note: String(rawItem.note || "").trim(),
    })
  })

  normalizedTables.sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder
    return first.name.localeCompare(second.name)
  })

  return normalizedTables.length ? normalizedTables : DEFAULT_LOCAL_TABLES
}

export function getActiveLocalTableNames(tables: LocalTable[]) {
  const activeTables = normalizeLocalTablesConfig(tables)
    .filter((table) => table.isActive !== false)
    .map((table) => table.name)

  return activeTables.length ? activeTables : DEFAULT_ORDER_LOCATIONS
}

export function buildLocalTablesFromNames(names: string[], currentTables: LocalTable[]) {
  const currentTableByName = new Map(
    normalizeLocalTablesConfig(currentTables).map((table) => [normalizeComparableText(table.name), table])
  )

  return names.map((name, index) => {
    const currentTable = currentTableByName.get(normalizeComparableText(name))

    return {
      id: currentTable?.id || createLocalTableId(name, index),
      name,
      area: currentTable?.area || "Principal",
      sortOrder: index + 1,
      isActive: currentTable?.isActive !== false,
      note: currentTable?.note || "",
    }
  })
}

export type TableOperationalStatus = "free" | "active" | "pendingPayment"

export function isOpenAccountActive(account: OpenAccount) {
  return String(account.status || "Abierta").trim() === "Abierta"
}

export function getOpenAccountPendingUSD(account: OpenAccount) {
  const pending = Number(account.pendingUSD || 0)

  if (Number.isFinite(pending) && pending > 0) {
    return pending
  }

  const total = Number(account.totalEstimatedUSD || 0)
  const collected = Number(account.totalCollectedUSD || 0)
  const calculatedPending = total - collected

  return Number.isFinite(calculatedPending) && calculatedPending > 0
    ? calculatedPending
    : 0
}

export function getOpenAccountOrdersCount(account: OpenAccount) {
  if (Array.isArray(account.orders) && account.orders.length) {
    return account.orders.length
  }

  if (Array.isArray(account.orderIds) && account.orderIds.length) {
    return account.orderIds.length
  }

  return 0
}

export function getLocalTableOpenAccounts(tableName: string, openAccounts: OpenAccount[]) {
  const normalizedTable = normalizeComparableText(tableName)

  return openAccounts.filter((account) => {
    return (
      isOpenAccountActive(account) &&
      normalizeComparableText(account.tableNumber) === normalizedTable
    )
  })
}

export function getLocalTableOperationalSummary(
  tableName: string,
  orders: LocalOrder[],
  openAccounts: OpenAccount[] = []
) {
  const normalizedTable = normalizeComparableText(tableName)
  const activeOpenAccounts = getLocalTableOpenAccounts(tableName, openAccounts)
  const tableOrders = orders.filter((order) => {
    return (
      order.orderType === "Comer aquí" &&
      !isDeliveryOrder(order) &&
      normalizeComparableText(order.tableNumber) === normalizedTable &&
      order.status !== "Cancelado"
    )
  })
  const activeOrders = tableOrders.filter(
    (order) => order.status !== "Entregado"
  )
  const pendingPaymentOrders = tableOrders.filter(
    (order) => getOrderPayment(order).status !== "Pagado"
  )
  const ordersTotalUSD = tableOrders.reduce(
    (total, order) => total + getOrderTotals(order).totalUSD,
    0
  )
  const ordersPendingUSD = pendingPaymentOrders.reduce(
    (total, order) => total + getOrderPayment(order).pendingUSD,
    0
  )
  const accountsTotalUSD = activeOpenAccounts.reduce(
    (total, account) => total + Number(account.totalEstimatedUSD || 0),
    0
  )
  const accountsPendingUSD = activeOpenAccounts.reduce(
    (total, account) => total + getOpenAccountPendingUSD(account),
    0
  )
  const accountOrdersCount = activeOpenAccounts.reduce(
    (total, account) => total + getOpenAccountOrdersCount(account),
    0
  )
  const hasOpenAccount =
    activeOpenAccounts.length > 0 ||
    tableOrders.some(
      (order) => String(order.openAccountId || "").trim() && order.openAccountStatus === "Abierta"
    )
  const totalUSD = Math.max(ordersTotalUSD, accountsTotalUSD)
  const pendingUSD = Math.max(ordersPendingUSD, accountsPendingUSD)
  const status: TableOperationalStatus = activeOrders.length || activeOpenAccounts.length
    ? "active"
    : pendingPaymentOrders.length
      ? "pendingPayment"
      : "free"

  return {
    status,
    tableOrders,
    activeOrders,
    pendingPaymentOrders,
    totalUSD,
    pendingUSD,
    hasOpenAccount,
    activeOpenAccounts,
    accountOrdersCount,
  }
}

export function getLocalTableStatusLabel(status: TableOperationalStatus) {
  if (status === "active") return "Ocupada"
  if (status === "pendingPayment") return "Por cobrar"
  return "Libre"
}

export function getLocalTableStatusClass(status: TableOperationalStatus) {
  if (status === "active") return "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink)]"
  if (status === "pendingPayment") return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
  return "border-green-600 bg-green-50 text-green-800"
}

export function normalizeBusinessConfig(value: unknown): BusinessConfig {
  const source = (value || {}) as Record<string, unknown>
  const manualExchangeRate = Number(source.manualExchangeRate || 0)

  return {
    businessName:
      String(source.businessName || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessName,
    businessShortDescription:
      String(source.businessShortDescription || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessShortDescription,
    mainWhatsapp: String(source.mainWhatsapp || "").trim(),
    deliveryWhatsapp: String(source.deliveryWhatsapp || "").trim(),
    exchangeRateMode: normalizeExchangeRateMode(source.exchangeRateMode),
    manualExchangeRate:
      Number.isFinite(manualExchangeRate) && manualExchangeRate > 0
        ? manualExchangeRate
        : 0,
    membershipPlan: normalizeLocalPlanKey(source.membershipPlan),
    membershipPlanMode: normalizeLocalPlanMode(source.membershipPlanMode),
    customIncludedModules: normalizeLocalModuleList(source.customIncludedModules),
    customBlockedModules: normalizeLocalModuleList(source.customBlockedModules),
    orderWhatsappStageButtonsEnabled: normalizeBooleanConfig(
      source.orderWhatsappStageButtonsEnabled,
      DEFAULT_BUSINESS_CONFIG.orderWhatsappStageButtonsEnabled
    ),
    postSaleSurveyEnabled: normalizeBooleanConfig(
      source.postSaleSurveyEnabled,
      DEFAULT_BUSINESS_CONFIG.postSaleSurveyEnabled
    ),
    postSaleSurveyMessage: String(source.postSaleSurveyMessage || "").trim(),
    cancellationAlertsEnabled: normalizeBooleanConfig(
      source.cancellationAlertsEnabled,
      DEFAULT_BUSINESS_CONFIG.cancellationAlertsEnabled
    ),
    deliveryEnabled: normalizeBooleanConfig(
      source.deliveryEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryEnabled
    ),
    ownerDashboardModuleEnabled: normalizeBooleanConfig(
      source.ownerDashboardModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.ownerDashboardModuleEnabled
    ),
    cashierModuleEnabled: normalizeBooleanConfig(
      source.cashierModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.cashierModuleEnabled
    ),
    kitchenModuleEnabled: normalizeBooleanConfig(
      source.kitchenModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.kitchenModuleEnabled
    ),
    deliveryModuleEnabled: normalizeBooleanConfig(
      source.deliveryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryModuleEnabled
    ),
    historyModuleEnabled: normalizeBooleanConfig(
      source.historyModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.historyModuleEnabled
    ),
    expensesModuleEnabled: normalizeBooleanConfig(
      source.expensesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.expensesModuleEnabled
    ),
    menuProductsModuleEnabled: normalizeBooleanConfig(
      source.menuProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.menuProductsModuleEnabled
    ),
    featuredProductsModuleEnabled: normalizeBooleanConfig(
      source.featuredProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.featuredProductsModuleEnabled
    ),
    customersModuleEnabled: normalizeBooleanConfig(
      source.customersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.customersModuleEnabled
    ),
    inventoryModuleEnabled: normalizeBooleanConfig(
      source.inventoryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryModuleEnabled
    ),
    paymentProofsModuleEnabled: normalizeBooleanConfig(
      source.paymentProofsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.paymentProofsModuleEnabled
    ),
    openAccountsModuleEnabled: normalizeBooleanConfig(
      source.openAccountsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.openAccountsModuleEnabled
    ),
    tablesModuleEnabled: normalizeBooleanConfig(
      source.tablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.tablesModuleEnabled
    ),
    qrTablesModuleEnabled: normalizeBooleanConfig(
      source.qrTablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.qrTablesModuleEnabled
    ),
    localTables: normalizeLocalTablesConfig(source.localTables),
    defaultViewMode: normalizeBusinessViewMode(source.defaultViewMode),
    soundEnabled: normalizeBooleanConfig(
      source.soundEnabled,
      DEFAULT_BUSINESS_CONFIG.soundEnabled
    ),
    filtersOpenByDefault: normalizeBooleanConfig(
      source.filtersOpenByDefault,
      DEFAULT_BUSINESS_CONFIG.filtersOpenByDefault
    ),
    allowCloseWithPendingOrders: normalizeBooleanConfig(
      source.allowCloseWithPendingOrders,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingOrders
    ),
    allowCloseWithPendingPayments: normalizeBooleanConfig(
      source.allowCloseWithPendingPayments,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingPayments
    ),
    updatedAt: String(source.updatedAt || ""),
  }
}

export function isBusinessModuleEffective(
  config: BusinessConfig,
  moduleKey: LocalModuleKey
) {
  return getModulePlanAccess(config, moduleKey).effectiveEnabled
}
