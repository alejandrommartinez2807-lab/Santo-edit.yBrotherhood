// Tipos del modelo de carrito, extraídos de CartDrawer (sin runtime).

export type ProductPaymentMode = "divisa" | "mixto";
export type CartSalesChannel = "local" | "takeaway" | "delivery";
export type OrderType = "Comer aquí" | "Para llevar" | "Delivery";

export type CartProductType =
  | "normal"
  | "variations"
  | "addons"
  | "buildable"
  | "combo";

export type CartSelectionOption = {
  id?: string;
  name: string;
  groupName?: string;
  priceDelta?: number;
  quantity?: number;
};

export type CartItem = {
  cartLineId?: string;
  id: number;
  name: string;
  category: string;
  price: number;
  basePrice?: number;
  unitOptionsPrice?: number;
  image: string;
  quantity: number;
  note?: string;
  noteEnabled?: boolean;
  paymentMode?: ProductPaymentMode;
  productType?: CartProductType;
  selectedVariation?: CartSelectionOption | null;
  selectedAddons?: CartSelectionOption[];
  removedIngredients?: CartSelectionOption[];
  selectionSummary?: string;
  requiresWaiterConfirmation?: boolean;
  salesChannels?: CartSalesChannel[];
  ivaRate?: number | null;
};

export type PublicLocalTable = {
  id?: string;
  name: string;
  area?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type CreatedOrderSummary = {
  id: string;
  customerName: string;
  customerPhone: string;
  totalUSD: number;
  hasStaffConfirmationItems?: boolean;
  staffConfirmationProductNames?: string[];
  offline?: boolean;
  attachedToOpenAccount?: boolean;
  openAccountTable?: string;
};

export type MembershipPlan =
  | "menuDigital"
  | "basic"
  | "operational"
  | "pro"
  | "complete";

export type PublicBusinessConfig = {
  businessName: string;
  businessShortDescription: string;
  publicMenuEyebrow?: string;
  publicMenuTitle?: string;
  publicMenuText?: string;
  publicMenuSearchPlaceholder?: string;
  publicComboTitle?: string;
  publicComboText?: string;
  publicComboButtonText?: string;
  publicCustomizeButtonText?: string;
  publicCustomizerTitle?: string;
  themePrimaryColor?: string;
  themeAccentColor?: string;
  themeCreamColor?: string;
  productCardBackgroundColor?: string;
  productCardTextColor?: string;
  productCardBorderColor?: string;
  productCardButtonColor?: string;
  mainWhatsapp: string;
  deliveryWhatsapp: string;
  deliveryEnabled: boolean;
  deliveryModuleEnabled: boolean;
  paymentProofsEnabled: boolean;
  businessComplexityProfile?: "simple" | "standard" | "advanced" | "custom";
  publicOrdersEnabled?: boolean;
  publicLocalOrdersEnabled?: boolean;
  publicTakeawayOrdersEnabled?: boolean;
  publicDeliveryOrdersEnabled?: boolean;
  publicOpenAccountEnabled?: boolean;
  publicPaymentProofsEnabled?: boolean;
  publicPaymentProofUploadEnabled?: boolean;
  publicIngredientCustomizationEnabled?: boolean;
  publicAddonsEnabled?: boolean;
  publicNotesEnabled?: boolean;
  publicCustomerNotesEnabled?: boolean;
  publicAttachmentsEnabled?: boolean;
  publicCustomerAttachmentsEnabled?: boolean;
  publicCustomerImageAttachmentEnabled?: boolean;
  publicPhoneRequired?: boolean;
  membershipPlan: MembershipPlan;
  localTables: PublicLocalTable[];
  locationLabel: string;
  onlinePaymentsEnabled: boolean;
  fiscalEnabled: boolean;
  ivaDefaultRate: number;
  pricesIncludeIva: boolean;
  igtfEnabled: boolean;
  igtfRate: number;
};

export type RequestedLocalTableContext = {
  requestedTable: string;
  isQrLink: boolean;
};

export type QrTableNotice = {
  requestedTable: string;
  tableName: string;
  isQrLink: boolean;
  status: "valid" | "invalid";
} | null;


export type PublicOpenAccountOrderItem = {
  id?: number;
  name: string;
  category?: string;
  quantity: number;
  selectionSummary?: string;
  note?: string;
};

export type PublicOpenAccountOrderSummary = {
  id: string;
  displayNumber?: string;
  status: string;
  paymentStatus: string;
  totalUSD: number;
  receivedEquivalentUSD: number;
  pendingUSD: number;
  createdAt?: string;
  itemsText?: string;
  items?: PublicOpenAccountOrderItem[];
};

export type PublicOpenAccountSummary = {
  id: string;
  tableNumber: string;
  customerName?: string;
  status: string;
  totalEstimatedUSD: number;
  totalCollectedUSD: number;
  pendingUSD: number;
  createdAt?: string;
  updatedAt?: string;
  orders: PublicOpenAccountOrderSummary[];
};

export type PublicTableAccountNotice = {
  requestedTable: string;
  tableName: string;
  hasOpenAccount: boolean;
  openAccountsAvailable: boolean;
  status: "open" | "free" | "unavailable";
  openAccount?: PublicOpenAccountSummary | null;
} | null;
