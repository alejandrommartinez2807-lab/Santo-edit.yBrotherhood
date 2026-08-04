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
  UploadedMenuProductModel,
  UploadMenuProductModelInput,
} from "./ordersMenu"

export {
  deleteMenuProduct,
  getMenuProducts,
  saveMenuProduct,
  uploadMenuProductImage,
  uploadMenuProductModel,
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
  getOrdersFreshness,
  resetOrderStaffItems,
  setOrderItemDelivered,
  updateOrderDeliveryReport,
  updateOrderPayment,
  updateOrderStatus,
} from "./ordersCore"

// Carrera de cobros: otro registro entró entre la lectura y la escritura. Lo
// distingue quien calcula montos a partir de una lectura previa (confirmar un
// comprobante) para recalcular y reintentar en vez de pisar el cobro ajeno.
export { OrderPaymentConflictError } from "./ordersStorePayments"

export {
  getDeliveryZones,
  saveDeliveryZones,
} from "./ordersDeliveryZones"

export {
  getDeliveryDistanceSettings,
  getDeliveryDistanceSettingsWithMeta,
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
  getOpenAccountStatus,
  getOpenAccounts,
  setOpenAccountBillRequested,
} from "./ordersOpenAccounts"

export {
  clearDayCloses,
  deleteDayExpense,
  findRecentDayClose,
  getDayCloses,
  getDayExpenses,
  markDayExpensesClosed,
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
