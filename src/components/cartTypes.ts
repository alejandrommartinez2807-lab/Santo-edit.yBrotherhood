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
  // Tipo con el que se registró (la confirmación decide qué avisos mostrar).
  orderType?: string;
  hasStaffConfirmationItems?: boolean;
  staffConfirmationProductNames?: string[];
  offline?: boolean;
  attachedToOpenAccount?: boolean;
  openAccountTable?: string;
  // Métodos con los que va a pagar (2 si fue mixto): filtra los "Datos
  // para pagar" de la confirmación a lo que realmente eligió.
  paymentMethods?: string[];
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
  // Textos del carrito editables por el dueño (Configuración → textos).
  publicCartTitle?: string;
  publicCartEmptyTitle?: string;
  publicCartEmptyText?: string;
  publicCartEmptyButtonText?: string;
  publicCartTotalLabel?: string;
  publicCartTotalHint?: string;
  publicCartLocalOrderButtonText?: string;
  publicCartWhatsappButtonText?: string;
  publicDivisaGroupTitle?: string;
  publicDivisaOnlyNote?: string;
  publicDivisaOnlyBadge?: string;
  publicRegularGroupTitle?: string;
  publicAvailabilityLabel?: string;
  // Métodos de pago del carrito editables por el dueño (Configuración).
  publicPaymentMethods: string[];
  // Datos de cada método (pago móvil, Zelle…) que el cliente ve y copia.
  publicPaymentMethodDetails?: Record<string, string>;
  themePrimaryColor?: string;
  themeAccentColor?: string;
  themeCreamColor?: string;
  productCardBackgroundColor?: string;
  productCardTextColor?: string;
  productCardBorderColor?: string;
  productCardButtonColor?: string;
  mainWhatsapp: string;
  deliveryWhatsapp: string;
  // Botón "¿Dudas con tu pedido? Escríbenos" (WhatsApp), apagable por el dueño.
  orderHelpWhatsappEnabled: boolean;
  // Guía paso a paso del checkout (qué botones tocar y qué sigue), apagable.
  publicOrderStepsEnabled: boolean;
  // Advertencia visible "paga antes de que tu pedido se procese" en
  // delivery/pick up. Texto editable por el dueño (vacío = texto estándar).
  publicPrepayNoticeEnabled: boolean;
  publicPrepayNoticeText: string;
  // Resalta el aviso "si ya abriste cuenta no repitas tus datos" en mesa.
  publicOpenAccountHintHighlighted: boolean;
  deliveryEnabled: boolean;
  deliveryModuleEnabled: boolean;
  paymentProofsEnabled: boolean;
  // Cuentas abiertas por mesa: si el módulo está apagado, el carrito no
  // muestra avisos de cuenta y todo fluye como pedidos sueltos.
  openAccountsEnabled: boolean;
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

export type PublicBranch = {
  id: string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
  publicName?: string;
  address?: string;
  zone?: string;
  estimatedTimeText?: string;
  mainWhatsapp?: string;
  config?: Record<string, unknown>;
  branchConfig?: Record<string, unknown>;
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
  // Reserva vigente ahora para esta mesa (módulo Reservas): solo la franja.
  reservedNow?: boolean;
  reservationStart?: string;
  reservationEnd?: string;
} | null;
