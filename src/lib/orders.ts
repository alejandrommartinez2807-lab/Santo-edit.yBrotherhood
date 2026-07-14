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

export {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_LOCAL_TABLES,
  getActiveLocalTableNames,
  getBusinessConfig,
  getRawBusinessConfig,
  isTrainingModeActive,
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

export type {
  Room,
  RoomType,
  RoomHousekeepingStatus,
  SaveRoomInput,
  SaveRoomTypeInput,
} from "./ordersRooms"
export {
  ROOM_HOUSEKEEPING_STATUSES,
  deleteRoom,
  deleteRoomType,
  getRooms,
  getRoomTypes,
  normalizeHousekeepingStatus,
  saveRoom,
  saveRoomType,
  updateRoomHousekeeping,
  uploadRoomTypePhoto,
} from "./ordersRooms"

export type {
  HotelReservation,
  SaveHotelReservationInput,
  GetHotelReservationsFilters,
} from "./ordersHotelReservations"
export {
  deleteHotelReservation,
  getHotelReservationByCode,
  getHotelReservationById,
  getHotelReservations,
  saveHotelReservation,
  updateHotelReservationGuest,
  updateHotelReservationStatus,
} from "./ordersHotelReservations"

export type {
  AddFolioItemInput,
  Folio,
  FolioItem,
  Guest,
  SaveGuestInput,
} from "./ordersFolios"
export {
  addFolioItem,
  closeFolio,
  deleteFolioItem,
  folioBalance,
  getChargedOrderIds,
  getFolioByReservation,
  getFolioItems,
  getGuest,
  hasRoomCharge,
  openFolio,
  saveGuest,
} from "./ordersFolios"

export type {
  CreateHousekeepingTaskInput,
  HousekeepingTask,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  UpdateHousekeepingTaskInput,
} from "./ordersHousekeeping"
export {
  HOUSEKEEPING_TASK_STATUSES,
  HOUSEKEEPING_TASK_TYPES,
  createHousekeepingTask,
  deleteHousekeepingTask,
  getHousekeepingTasks,
  normalizeTaskStatus,
  normalizeTaskType,
  queueCheckoutCleaning,
  updateHousekeepingTask,
} from "./ordersHousekeeping"

export type { RateSeason, SaveRateSeasonInput } from "./ordersRateSeasons"
export {
  deleteRateSeason,
  getRateSeasons,
  saveRateSeason,
} from "./ordersRateSeasons"

export type { GetRoomBlocksFilters, RoomBlock, SaveRoomBlockInput } from "./ordersRoomBlocks"
export {
  deleteRoomBlock,
  getRoomBlocks,
  saveRoomBlock,
} from "./ordersRoomBlocks"

export type { RateRestriction, SaveRateRestrictionInput } from "./ordersRateRestrictions"
export {
  deleteRateRestriction,
  getRateRestrictions,
  saveRateRestriction,
} from "./ordersRateRestrictions"

export type {
  CreateServiceBookingInput,
  ResortService,
  SaveResortServiceInput,
  ServiceBooking,
} from "./ordersResortServices"
export {
  createServiceBooking,
  deleteResortService,
  deleteServiceBooking,
  getResortServices,
  getServiceBookings,
  saveResortService,
  updateServiceBookingStatus,
} from "./ordersResortServices"

export type { CreateReviewInput, Review } from "./ordersReviews"
export {
  createReview,
  deleteReview,
  getReviews,
  setReviewPublished,
} from "./ordersReviews"

export type { GuestProfile, SaveGuestProfileInput } from "./ordersGuestProfiles"
export {
  deleteGuestProfile,
  getGuestProfiles,
  saveGuestProfile,
} from "./ordersGuestProfiles"

export type { HotelProfile, SaveHotelProfileInput } from "./ordersHotelProfile"
export { getHotelProfile, saveHotelProfile } from "./ordersHotelProfile"

export type { HotelPackage, SavePackageInput } from "./ordersPackages"
export {
  deletePackage,
  getPackages,
  savePackage,
} from "./ordersPackages"

export type { BusinessDay, CloseBusinessDayInput } from "./ordersBusinessDays"
export { closeBusinessDay, getBusinessDays } from "./ordersBusinessDays"

export type { CreateInvoiceInput, Invoice } from "./ordersInvoices"
export { createInvoice, getInvoices } from "./ordersInvoices"

export type { CreateReservationPaymentInput, ReservationPayment } from "./ordersReservationPayments"
export {
  createReservationPayment,
  getReservationPayments,
  updateReservationPaymentStatus,
} from "./ordersReservationPayments"

export type { NotificationEntry } from "./ordersNotifications"
export { getNotificationLog, logNotification } from "./ordersNotifications"

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
  createPaymentProof,
  getPaymentProofs,
  reviewPaymentProof,
} from "./ordersPaymentProofs"
