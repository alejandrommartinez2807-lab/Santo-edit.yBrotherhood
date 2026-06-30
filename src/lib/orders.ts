export type {
  DeliveryPaymentIn,
  DeliveryReportStatus,
  DeliveryZone,
  LocalOrder,
  OrderItem,
  OrderPayment,
  OrderProductType,
  OrderSelectionOption,
  OrderStaffConfirmationStatus,
  OrderStatus,
  StaffConfirmationStatus,
  OpenAccount,
  CreateOpenAccountInput,
  UpdateOpenAccountInput,
  OpenAccountStatus,
  OpenAccountOrderSummary,
  OrderType,
  PaymentProof,
  PaymentProofStatus,
  PaymentStatus,
  ProductPaymentMode,
} from "@/types/localOrders"

// Migración a Supabase: los dominios operativos delegan en módulos internos que
// mantienen los mismos nombres/firmas para no tocar las API routes ni paneles.
// Este archivo funciona como fachada estable para los imports existentes.

export type {
  BusinessConfig,
  BusinessViewMode,
  ExchangeRateMode,
  LocalTable,
  SaveBusinessConfigInput,
} from "./ordersBusinessConfig"

export type {
  BusinessComplexityBooleanKey,
  BusinessComplexityProfile,
  BusinessComplexitySettings,
} from "./businessComplexity"

export {
  BUSINESS_COMPLEXITY_BOOLEAN_KEYS,
  BUSINESS_COMPLEXITY_PROFILE_DEFINITIONS,
  DEFAULT_BUSINESS_COMPLEXITY_SETTINGS,
  getBusinessComplexityProfilePatch,
  isInventoryAutoDeductActuallyEnabled,
  normalizeBusinessComplexityProfile,
  normalizeBusinessComplexitySettings,
} from "./businessComplexity"

export {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_LOCAL_TABLES,
  getActiveLocalTableNames,
  getBusinessConfig,
  getRawBusinessConfig,
  normalizeBusinessConfig,
  normalizeLocalTablesConfig,
  saveBusinessConfig,
} from "./ordersBusinessConfig"

export type {
  MenuProduct,
  MenuProductAddon,
  MenuProductIngredient,
  MenuProductOptionGroup,
  MenuProductOptionValue,
  MenuProductSalesChannel,
  MenuProductSelectionRules,
  MenuProductType,
  SaveMenuProductInput,
  UploadedMenuProductImage,
  UploadMenuProductImageInput,
} from "./ordersMenu"

export {
  deleteMenuProduct,
  getMenuProducts,
  saveMenuProduct,
  uploadMenuProductImage,
} from "./ordersMenu"

export type {
  InventoryItem,
  InventoryMovement,
  InventoryRecipe,
  InventoryRecipeIngredient,
  SaveInventoryItemInput,
  SaveInventoryRecipeInput,
} from "./ordersInventory"

export type { Supplier, SupplierPurchase } from "@/types/localOrders"
export type { SaveSupplierInput } from "./ordersSuppliers"
export type {
  SaveSupplierPurchaseInput,
  UpdateSupplierPurchaseInput,
  SaveSupplierPurchasePaymentInput,
  SupplierPurchasePayment,
} from "./ordersSupplierPurchases"

export type {
  CreatePaymentProofInput,
  ReviewPaymentProofInput,
} from "./ordersPaymentProofs"

export type {
  DayCloseExpense,
  DayCloseInventoryAlert,
  DayCloseInventoryProduct,
  DayCloseProductSold,
  DayCloseSummaryItem,
  DayExpense,
  DayExpenseFilters,
  SaveDayCloseInput,
  SaveDayExpenseInput,
  SavedDayClose,
} from "./ordersDayClose"

export type {
  ConfirmStaffItemsInput,
  CreateOrderInput,
  ResetStaffItemsInput,
  UpdateOrderPaymentInput,
  UpdateOrderNotesInput,
} from "./ordersCore"

// Migración a Supabase completa para el flujo de pedidos.
// (Se eliminaron los helpers getWebAppUrl/getSecret/readJsonResponse.)

export {
  clearOrders,
  confirmOrderStaffItems,
  createOrder,
  deleteOrder,
  getOrders,
  resetOrderStaffItems,
  updateOrderDeliveryReport,
  updateOrderNotes,
  updateOrderPayment,
  updateOrderStatus,
} from "./ordersCore"

export {
  getDeliveryZones,
  saveDeliveryZones,
} from "./ordersDeliveryZones"

export {
  deleteSupplier,
  getSuppliers,
  saveSupplier,
} from "./ordersSuppliers"

export {
  deleteSupplierPurchase,
  getSupplierPurchases,
  getSupplierPurchasePayments,
  saveSupplierPurchase,
  saveSupplierPurchasePayment,
  updateSupplierPurchase,
} from "./ordersSupplierPurchases"

export {
  attachOrderToOpenAccount,
  closeOpenAccount,
  createOpenAccount,
  getOpenAccounts,
} from "./ordersOpenAccounts"

export {
  clearDayCloses,
  deleteDayExpense,
  getDayCloses,
  getDayExpenses,
  saveDayClose,
  saveDayExpense,
} from "./ordersDayClose"

export {
  deleteInventoryItem,
  deleteInventoryRecipe,
  getInventory,
  getInventoryMovements,
  getInventoryRecipes,
  saveInventoryItem,
  saveInventoryRecipe,
} from "./ordersInventory"

export {
  createPaymentProof,
  getPaymentProofs,
  reviewPaymentProof,
} from "./ordersPaymentProofs"
