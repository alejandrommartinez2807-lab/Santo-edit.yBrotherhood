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
  KitchenFlowMode,
  LocalTable,
  SaveBusinessConfigInput,
} from "./ordersBusinessConfig"

export {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_LOCAL_TABLES,
  getActiveLocalTableNames,
  getBusinessConfig,
  getRawBusinessConfig,
  isTrainingModeActive,
  normalizeBusinessConfig,
  normalizeKitchenFlowMode,
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

export type { Reservation, ReservationStatus, Supplier, SupplierPurchase } from "@/types/localOrders"
export type { GetReservationsFilters, SaveReservationInput } from "./ordersReservations"
export type { SaveSupplierInput } from "./ordersSuppliers"
export type { SaveSupplierPurchaseInput, UpdateSupplierPurchaseInput, SaveSupplierPurchasePaymentInput, SupplierPurchasePayment } from "./ordersSupplierPurchases"

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
} from "./ordersCore"

// Migración a Supabase COMPLETA: ya no se usan servicios externos heredados.
// (Se eliminaron los helpers getWebAppUrl/getSecret/readJsonResponse.)

export {
  clearOrders,
  confirmOrderStaffItems,
  createOrder,
  deleteOrder,
  findOrderByClientOrderId,
  getOrders,
  resetOrderStaffItems,
  updateOrderDeliveryReport,
  updateOrderPayment,
  updateOrderStatus,
} from "./ordersCore"

export {
  getDeliveryZones,
  saveDeliveryZones,
} from "./ordersDeliveryZones"

export {
  getDeliveryDistanceSettings,
  saveDeliveryDistanceSettings,
} from "./ordersStoreDeliveryDistance"

export {
  deleteReservation,
  getReservations,
  saveReservation,
  updateReservationStatus,
} from "./ordersReservations"

export {
  deleteSupplier,
  getSuppliers,
  saveSupplier,
} from "./ordersSuppliers"

export {
  deleteSubrecipe,
  getSubrecipes,
  saveSubrecipe,
} from "./ordersSubrecipes"
export type { SaveSubrecipeInput, Subrecipe, SubrecipeIngredient } from "./ordersSubrecipes"

export {
  deleteSupplierPurchase,
  getSupplierPurchases,
  saveSupplierPurchase,
  updateSupplierPurchase,
  getSupplierPurchasePayments,
  getSupplierPurchasePaymentsInRange,
  saveSupplierPurchasePayment,
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
  clearPaymentProofs,
  createPaymentProof,
  getPaymentProofs,
  reviewPaymentProof,
} from "./ordersPaymentProofs"
