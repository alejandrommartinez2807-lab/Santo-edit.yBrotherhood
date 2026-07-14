"use client";

import { BRAND } from "@/lib/brand";
import { BUSINESS_TYPE_PRESETS } from "@/lib/businessTypes";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Eye,
  EyeOff,
  Grid2X2,
  ImageIcon,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Phone,
  Plus,
  RefreshCw,
  Receipt,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Table2,
  Trash2,
  Truck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  LOCAL_PLAN_DEFINITIONS,
  getLocalPlanDefinition,
  getModulePlanAccess,
  getVisibleOwnerSettingModules,
  getVisibleSupportModules,
  type LocalModuleKey,
  type LocalModulePlanAccess,
  type LocalPlanKey,
  type LocalPlanMode,
} from "@/lib/localPlans";
import { products as fallbackProducts, type Product } from "@/data/products";
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  DEFAULT_PUBLIC_NAV_BUTTONS,
  DEFAULT_PUBLIC_PAYMENT_METHODS,
  normalizePublicCategoryList,
  normalizePublicCoupons,
  normalizePublicHiddenCategoryList,
  normalizePublicNavButtons,
  normalizePublicPaymentMethodDetails,
  normalizePublicPaymentMethods,
  normalizePublicProductCardSize,
  type PublicNavButton,
  type PublicNavButtonKind,
} from "@/lib/publicPageConfig";
import DeliveryDistanceConfigCard from "@/components/config/DeliveryDistanceConfigCard";
import {
  DEFAULT_LOCAL_TABLES as DEFAULT_CONFIG_LOCAL_TABLES,
  normalizeLocalTablesForMap,
  type LocalTableMapItem,
} from "@/components/local/LocalTablesMap";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type BusinessViewMode = "simple" | "negocio" | "avanzado";
type ExchangeRateMode = "automatic" | "automaticEur" | "manual";
type ConfigAccessRole = "owner" | "support";

type BusinessConfig = {
  businessName: string;
  businessShortDescription: string;
  businessType: string;
  locationLabel: string;
  fiscalEnabled: boolean;
  rifNumber: string;
  razonSocial: string;
  fiscalAddress: string;
  ivaDefaultRate: number;
  pricesIncludeIva: boolean;
  igtfEnabled: boolean;
  igtfRate: number;
  themePrimaryColor: string;
  themeCreamColor: string;
  themeAccentColor: string;
  productCardBackgroundColor: string;
  productCardTextColor: string;
  productCardBorderColor: string;
  productCardButtonColor: string;
  publicTagline: string;
  publicInfoTitle: string;
  publicInfoText: string;
  scheduleTitle: string;
  scheduleLine1: string;
  scheduleLine2: string;
  reviewsTitle: string;
  reviewsText: string;
  quickOrderTitle: string;
  quickOrderText: string;
  publicMenuEyebrow: string;
  publicMenuTitle: string;
  publicMenuText: string;
  publicMenuSearchPlaceholder: string;
  publicComboTitle: string;
  publicComboText: string;
  publicComboButtonText: string;
  publicCustomizeButtonText: string;
  publicCustomizerTitle: string;
  publicCartTitle: string;
  publicCartEmptyTitle: string;
  publicCartEmptyText: string;
  publicCartEmptyButtonText: string;
  publicCartTotalLabel: string;
  publicCartTotalHint: string;
  publicCartLocalOrderButtonText: string;
  publicCartWhatsappButtonText: string;
  publicDivisaGroupTitle: string;
  publicDivisaOnlyNote: string;
  publicDivisaOnlyBadge: string;
  publicRegularGroupTitle: string;
  publicAvailabilityLabel: string;
  // Métodos de pago del carrito público (uno por línea en el editor).
  publicPaymentMethods: string[];
  // Datos de cada método (pago móvil, Zelle…) que el cliente ve y copia.
  publicPaymentMethodDetails: Record<string, string>;
  // Tamaño de las tarjetas del menú público (grande | media | compacta).
  publicProductCardSize: string;
  // Cupones del carrito: "CODIGO 10" por línea (código + % de descuento).
  publicCoupons: string[];
  locationButtonText: string;
  googleMapsUrl: string;
  googleReviewUrl: string;
  instagramUrl: string;
  mainWhatsapp: string;
  deliveryWhatsapp: string;
  // Botón público "¿Dudas con tu pedido? Escríbenos" (WhatsApp), apagable.
  orderHelpWhatsappEnabled: boolean;
  // Botones de aviso al cliente por WhatsApp en el panel privado, apagables.
  orderWhatsappStageButtonsEnabled: boolean;
  exchangeRateMode: ExchangeRateMode;
  manualExchangeRate: number;
  deliveryEnabled: boolean;
  membershipPlan: LocalPlanKey;
  membershipPlanMode: LocalPlanMode;
  customIncludedModules: LocalModuleKey[];
  customBlockedModules: LocalModuleKey[];
  ownerDashboardModuleEnabled: boolean;
  cashierModuleEnabled: boolean;
  kitchenModuleEnabled: boolean;
  deliveryModuleEnabled: boolean;
  historyModuleEnabled: boolean;
  expensesModuleEnabled: boolean;
  promotionModuleEnabled: boolean;
  promotionActive: boolean;
  promotionTitle: string;
  promotionText: string;
  promotionHighlight: string;
  promotionButtonText: string;
  promotionButtonHref: string;
  promotionProductId: number;
  promotionProductName: string;
  promotionPriceUSD: number;
  promotionImage: string;
  menuProductsModuleEnabled: boolean;
  featuredProductsModuleEnabled: boolean;
  featuredProductsActive: boolean;
  featuredProductsTitle: string;
  featuredProductsText: string;
  featuredProductIds: number[];
  publicCategoryOrder: string[];
  publicHiddenCategories: string[];
  publicNavButtons: PublicNavButton[];
  customersModuleEnabled: boolean;
  inventoryModuleEnabled: boolean;
  inventoryAlertsModuleEnabled: boolean;
  advancedMenuModuleEnabled: boolean;
  productVariationsModuleEnabled: boolean;
  productAddonsModuleEnabled: boolean;
  productBuilderModuleEnabled: boolean;
  productCombosModuleEnabled: boolean;
  productAvailabilityModuleEnabled: boolean;
  salesChannelsModuleEnabled: boolean;
  paymentProofsModuleEnabled: boolean;
  openAccountsModuleEnabled: boolean;
  tablesModuleEnabled: boolean;
  localTables: LocalTableMapItem[];
  qrTablesModuleEnabled: boolean;
  reservationsModuleEnabled: boolean;
  roomsModuleEnabled: boolean;
  hotelReservationsModuleEnabled: boolean;
  folioModuleEnabled: boolean;
  housekeepingModuleEnabled: boolean;
  rateSeasonsModuleEnabled: boolean;
  hotelReportsModuleEnabled: boolean;
  bookingEngineModuleEnabled: boolean;
  tapeChartModuleEnabled: boolean;
  groupBookingsModuleEnabled: boolean;
  advancedRatesModuleEnabled: boolean;
  resortServicesModuleEnabled: boolean;
  resortChargesModuleEnabled: boolean;
  guestReviewsModuleEnabled: boolean;
  guestCrmModuleEnabled: boolean;
  hotelLandingModuleEnabled: boolean;
  hotelPackagesModuleEnabled: boolean;
  guestPortalModuleEnabled: boolean;
  onlinePaymentsModuleEnabled: boolean;
  guestNotificationsModuleEnabled: boolean;
  nightAuditModuleEnabled: boolean;
  fiscalInvoicingModuleEnabled: boolean;
  channelManagerModuleEnabled: boolean;
  waiterConfirmationModuleEnabled: boolean;
  kitchenItemsModuleEnabled: boolean;
  ticketsModuleEnabled: boolean;
  splitBillModuleEnabled: boolean;
  serviceChargeTipsModuleEnabled: boolean;
  suppliersModuleEnabled: boolean;
  supplierPurchasesModuleEnabled: boolean;
  accountsPayableModuleEnabled: boolean;
  subrecipesModuleEnabled: boolean;
  auditLogModuleEnabled: boolean;
  visualEditorModuleEnabled: boolean;
  trainingModeModuleEnabled: boolean;
  branchesModuleEnabled: boolean;
  defaultViewMode: BusinessViewMode;
  soundEnabled: boolean;
  filtersOpenByDefault: boolean;
  allowCloseWithPendingOrders: boolean;
  allowCloseWithPendingPayments: boolean;
  updatedAt?: string;
};

type PublicProductsResponse = {
  ok?: boolean;
  products?: Product[];
  warning?: string;
  error?: string;
  fallback?: boolean;
};

type BranchSummary = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type BranchesResponse = {
  ok?: boolean;
  branches?: BranchSummary[];
  error?: string;
};

const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: "Menú y pedidos",
  businessType: "",
  locationLabel: "Mesa",
  fiscalEnabled: false,
  rifNumber: "",
  razonSocial: "",
  fiscalAddress: "",
  ivaDefaultRate: 16,
  pricesIncludeIva: true,
  igtfEnabled: true,
  igtfRate: 3,
  themePrimaryColor: "#f5a623",
  themeCreamColor: "#0d0d0d",
  themeAccentColor: "#ffb340",
  productCardBackgroundColor: "#141414",
  productCardTextColor: "#ffffff",
  productCardBorderColor: "#f5a623",
  productCardButtonColor: "#f5a623",
  publicTagline: "Smash Burgers, Combos y Sides",
  publicInfoTitle: `Visita ${BRAND.name}`,
  publicInfoText:
    "Somos simples: porque nos gustan las buenas burgers. Ingredientes de calidad y mucho sabor. Abre nuestra ubicación en Google Maps o escribe por WhatsApp para coordinar tu pedido. Delivery & Pick Up en Valencia y San Diego.",
  scheduleTitle: "Horario",
  scheduleLine1: "Martes a domingo: 5:00 p.m. a 11:30 p.m.",
  scheduleLine2: "Lunes: cerrado",
  reviewsTitle: "Reseñas",
  reviewsText:
    "Después de probar tu pedido, puedes apoyar el negocio dejando tu reseña o compartiendo la página. Gracias por el apoyo, frater.",
  quickOrderTitle: "Pedido rápido",
  quickOrderText:
    "Agrega productos al carrito y registra el pedido en el local o envíalo directamente por WhatsApp.",
  publicMenuEyebrow: `Menú ${BRAND.name}`,
  publicMenuTitle: "Elige tu pedido",
  publicMenuText:
    "Combos en divisas y productos normales con referencia en bolívares según la tasa activa del negocio.",
  publicMenuSearchPlaceholder: "Buscar productos, combos o adicionales",
  publicComboTitle: "Combos disponibles",
  publicComboText:
    "Los combos se manejan en divisas para mantener precios claros.",
  publicComboButtonText: "Ver combos",
  publicCustomizeButtonText: "Elige tus ingredientes",
  publicCustomizerTitle: "Elige tus ingredientes",
  publicCartTitle: "Tu pedido",
  publicCartEmptyTitle: "Tu carrito está vacío",
  publicCartEmptyText: "Agrega productos del menú para preparar tu pedido.",
  publicCartEmptyButtonText: "Ver menú",
  publicCartTotalLabel: "Total a cobrar",
  publicCartTotalHint: "Total general en divisas",
  publicCartLocalOrderButtonText: "Registrar pedido local",
  publicCartWhatsappButtonText: "Enviar por WhatsApp",
  publicDivisaGroupTitle: "Combos",
  publicDivisaOnlyNote: "Pago solo en divisas",
  publicDivisaOnlyBadge: "Solo divisas",
  publicRegularGroupTitle: "Productos normales",
  publicAvailabilityLabel: "Disponible",
  publicPaymentMethods: [...DEFAULT_PUBLIC_PAYMENT_METHODS],
  publicPaymentMethodDetails: {},
  publicProductCardSize: "grande",
  publicCoupons: [],
  locationButtonText: "Abrir ubicación",
  googleMapsUrl: "",
  googleReviewUrl: "",
  instagramUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  orderHelpWhatsappEnabled: true,
  orderWhatsappStageButtonsEnabled: true,
  exchangeRateMode: "automatic",
  manualExchangeRate: 0,
  deliveryEnabled: true,
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
  ownerDashboardModuleEnabled: true,
  cashierModuleEnabled: true,
  kitchenModuleEnabled: true,
  deliveryModuleEnabled: true,
  historyModuleEnabled: true,
  expensesModuleEnabled: true,
  promotionModuleEnabled: true,
  promotionActive: false,
  promotionTitle: "Promoción especial",
  promotionText: `Aprovecha una oferta preparada para disfrutar en ${BRAND.name}.`,
  promotionHighlight: "Disponible por tiempo limitado.",
  promotionButtonText: "Ver menú",
  promotionButtonHref: "#menu",
  promotionProductId: 0,
  promotionProductName: "",
  promotionPriceUSD: 0,
  promotionImage: "",
  menuProductsModuleEnabled: true,
  featuredProductsModuleEnabled: true,
  featuredProductsActive: false,
  featuredProductsTitle: "Favoritos de la casa",
  featuredProductsText:
    "Una selección rápida para pedir lo más recomendado del menú.",
  featuredProductIds: [1, 2, 5],
  publicCategoryOrder: DEFAULT_PUBLIC_CATEGORY_ORDER,
  publicHiddenCategories: [],
  publicNavButtons: DEFAULT_PUBLIC_NAV_BUTTONS,
  customersModuleEnabled: true,
  inventoryModuleEnabled: true,
  inventoryAlertsModuleEnabled: true,
  advancedMenuModuleEnabled: true,
  productVariationsModuleEnabled: true,
  productAddonsModuleEnabled: true,
  productBuilderModuleEnabled: true,
  productCombosModuleEnabled: true,
  productAvailabilityModuleEnabled: true,
  salesChannelsModuleEnabled: true,
  paymentProofsModuleEnabled: true,
  openAccountsModuleEnabled: true,
  tablesModuleEnabled: true,
  localTables: DEFAULT_CONFIG_LOCAL_TABLES,
  qrTablesModuleEnabled: true,
  reservationsModuleEnabled: false,
  roomsModuleEnabled: true,
  hotelReservationsModuleEnabled: true,
  folioModuleEnabled: true,
  housekeepingModuleEnabled: true,
  rateSeasonsModuleEnabled: true,
  hotelReportsModuleEnabled: true,
  bookingEngineModuleEnabled: true,
  tapeChartModuleEnabled: true,
  groupBookingsModuleEnabled: true,
  advancedRatesModuleEnabled: true,
  resortServicesModuleEnabled: true,
  resortChargesModuleEnabled: true,
  guestReviewsModuleEnabled: true,
  guestCrmModuleEnabled: true,
  hotelLandingModuleEnabled: true,
  hotelPackagesModuleEnabled: true,
  guestPortalModuleEnabled: true,
  onlinePaymentsModuleEnabled: true,
  guestNotificationsModuleEnabled: true,
  nightAuditModuleEnabled: true,
  fiscalInvoicingModuleEnabled: true,
  channelManagerModuleEnabled: true,
  waiterConfirmationModuleEnabled: true,
  kitchenItemsModuleEnabled: true,
  ticketsModuleEnabled: true,
  splitBillModuleEnabled: false,
  serviceChargeTipsModuleEnabled: false,
  suppliersModuleEnabled: false,
  supplierPurchasesModuleEnabled: false,
  accountsPayableModuleEnabled: false,
  subrecipesModuleEnabled: false,
  auditLogModuleEnabled: true,
  visualEditorModuleEnabled: true,
  trainingModeModuleEnabled: false,
  branchesModuleEnabled: true,
  defaultViewMode: "negocio",
  soundEnabled: true,
  filtersOpenByDefault: false,
  allowCloseWithPendingOrders: true,
  allowCloseWithPendingPayments: true,
};

const AVAILABLE_MODULES_PATCH: Partial<BusinessConfig> = {
  ownerDashboardModuleEnabled: true,
  cashierModuleEnabled: true,
  kitchenModuleEnabled: true,
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  historyModuleEnabled: true,
  expensesModuleEnabled: true,
  promotionModuleEnabled: true,
  menuProductsModuleEnabled: true,
  featuredProductsModuleEnabled: true,
  customersModuleEnabled: true,
  inventoryModuleEnabled: true,
  inventoryAlertsModuleEnabled: true,
  advancedMenuModuleEnabled: true,
  productVariationsModuleEnabled: true,
  productAddonsModuleEnabled: true,
  productBuilderModuleEnabled: true,
  productCombosModuleEnabled: true,
  productAvailabilityModuleEnabled: true,
  salesChannelsModuleEnabled: true,
  paymentProofsModuleEnabled: true,
  openAccountsModuleEnabled: true,
  tablesModuleEnabled: true,
  qrTablesModuleEnabled: true,
  reservationsModuleEnabled: true,
  waiterConfirmationModuleEnabled: true,
  kitchenItemsModuleEnabled: true,
  ticketsModuleEnabled: true,
  suppliersModuleEnabled: true,
  supplierPurchasesModuleEnabled: true,
  branchesModuleEnabled: true,
  auditLogModuleEnabled: true,
  visualEditorModuleEnabled: true,
  soundEnabled: true,
};

const VIEW_MODE_OPTIONS: Array<{
  value: BusinessViewMode;
  label: string;
  description: string;
}> = [
  {
    value: "simple",
    label: "Simple",
    description:
      "Pantallas más limpias para negocios que quieren ver solo lo básico.",
  },
  {
    value: "negocio",
    label: "Negocio",
    description: "Balance recomendado entre control, alertas y reportes.",
  },
  {
    value: "avanzado",
    label: "Avanzado",
    description:
      "Más datos visibles para auditoría, análisis y revisión completa.",
  },
];

const MODULE_ICON_BY_KEY: Partial<Record<LocalModuleKey, ReactNode>> = {
  ownerDashboard: <BarChart3 size={18} />,
  cashier: <ShieldCheck size={18} />,
  kitchen: <Settings2 size={18} />,
  delivery: <Truck size={18} />,
  history: <SlidersHorizontal size={18} />,
  expenses: <DollarSign size={18} />,
  sounds: <Settings2 size={18} />,
  reports: <BarChart3 size={18} />,
  roles: <ShieldCheck size={18} />,
  advancedPublicConfig: <Store size={18} />,
  promotions: <Grid2X2 size={18} />,
  menuProducts: <Store size={18} />,
  featuredProducts: <Store size={18} />,
  customers: <Phone size={18} />,
  inventory: <Store size={18} />,
  advancedReports: <BarChart3 size={18} />,
  futureModules: <SlidersHorizontal size={18} />,
};

const VISUAL_COLOR_PRESETS = [
  {
    id: "santo-classic",
    label: "Santo clásico",
    description: "Rojo, crema y amarillo como base actual.",
    values: {
      themePrimaryColor: "#a00000",
      themeAccentColor: "#ffd23c",
      themeCreamColor: "#fff7e8",
      productCardBackgroundColor: "#ffffff",
      productCardTextColor: "#4a0000",
      productCardBorderColor: "#a00000",
      productCardButtonColor: "#ffd23c",
    },
  },
  {
    id: "clean-light",
    label: "Claro limpio",
    description: "Cards blancas, borde suave y botón cálido.",
    values: {
      themePrimaryColor: "#8b1a1a",
      themeAccentColor: "#ffd166",
      themeCreamColor: "#fff8ec",
      productCardBackgroundColor: "#ffffff",
      productCardTextColor: "#3a1111",
      productCardBorderColor: "#c84727",
      productCardButtonColor: "#ffd166",
    },
  },
  {
    id: "premium-dark",
    label: "Oscuro premium",
    description: "Tarjeta oscura con acento dorado.",
    values: {
      themePrimaryColor: "#4a0000",
      themeAccentColor: "#f6c453",
      themeCreamColor: "#fff3dd",
      productCardBackgroundColor: "#220000",
      productCardTextColor: "#fff7e8",
      productCardBorderColor: "#f6c453",
      productCardButtonColor: "#f6c453",
    },
  },
  {
    id: "fresh-green",
    label: "Verde fresco",
    description: "Alternativa para clientes con marca verde.",
    values: {
      themePrimaryColor: "#14532d",
      themeAccentColor: "#facc15",
      themeCreamColor: "#f7fee7",
      productCardBackgroundColor: "#ffffff",
      productCardTextColor: "#12351f",
      productCardBorderColor: "#16a34a",
      productCardButtonColor: "#facc15",
    },
  },
] as const;

type VisualColorPreset = (typeof VISUAL_COLOR_PRESETS)[number];
type VisualColorPresetValues = VisualColorPreset["values"];

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "si", "sí", "activo", "activa"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactivo", "inactiva"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeViewMode(value: unknown): BusinessViewMode {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "simple") return "simple";
  if (normalized === "avanzado") return "avanzado";

  return "negocio";
}

function normalizeExchangeRateMode(value: unknown): ExchangeRateMode {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "manual") return "manual";
  if (normalized === "automaticeur" || normalized === "euro") {
    return "automaticEur";
  }

  return "automatic";
}

function isKnownPlan(value: unknown): value is LocalPlanKey {
  return (
    value === "menuDigital" ||
    value === "basic" ||
    value === "operational" ||
    value === "pro" ||
    value === "complete"
  );
}

function normalizeModuleList(value: unknown): LocalModuleKey[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean) as LocalModuleKey[];
  }

  if (typeof value === "string") {
    const clean = value.trim();

    if (!clean) return [];

    try {
      const parsed = JSON.parse(clean);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean) as LocalModuleKey[];
      }
    } catch {
      return clean
        .split(/[;,|]/g)
        .map((item) => item.trim())
        .filter(Boolean) as LocalModuleKey[];
    }
  }

  return [];
}

function normalizeNumberList(value: unknown, fallback: number[]) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim();

          if (!cleanValue) return [];

          try {
            const parsedValue = JSON.parse(cleanValue);

            return Array.isArray(parsedValue)
              ? parsedValue
              : cleanValue.split(/[;,|]/g);
          } catch {
            return cleanValue.split(/[;,|]/g);
          }
        })()
      : fallback;
  const seen = new Set<number>();

  return rawList
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function mergeNumberLists(firstList: number[], secondList: number[]) {
  return normalizeNumberList([...firstList, ...secondList], []);
}

function areNumberListsEqual(firstList: number[], secondList: number[]) {
  if (firstList.length !== secondList.length) return false;

  return firstList.every((item, index) => item === secondList[index]);
}

function getProductFeaturedIds(productsList: Product[]) {
  return normalizeNumberList(
    productsList
      .filter(
        (product) => product.isActive !== false && product.isFeatured === true,
      )
      .map((product) => product.id),
    [],
  );
}

function normalizePublicProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const source = (item || {}) as Partial<Product>;
      const id = Number(source.id || 0);
      const name = String(source.name || "").trim();
      const price = Number(source.price || 0);

      if (!Number.isFinite(id) || id <= 0 || !name) return null;

      return {
        id: Math.round(id),
        name,
        category: source.category || "Perritos",
        description: String(source.description || "").trim(),
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        image:
          String(source.image || BRAND.logoUrl || "/logoremovebg.png").trim() ||
          "/logoremovebg.png",
        paymentMode: source.paymentMode || "mixto",
        isActive: source.isActive !== false,
        isFeatured: source.isFeatured === true,
        sortOrder: Number(source.sortOrder || 999),
      } as Product;
    })
    .filter((product): product is Product => Boolean(product))
    .sort((a, b) => {
      const orderA = Number(a.sortOrder || 999);
      const orderB = Number(b.sortOrder || 999);

      if (orderA !== orderB) return orderA - orderB;

      return a.name.localeCompare(b.name, "es");
    });
}

function normalizePlanMode(value: unknown): LocalPlanMode {
  return value === "custom" ? "custom" : "plan";
}

function normalizePositiveNumber(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeHexColor(value: unknown) {
  const text = String(value || "").trim();
  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(text);

  if (shortHexMatch) {
    return `#${shortHexMatch[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toLowerCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text.toLowerCase();
  }

  return "";
}

function getHexColorRgb(value: unknown) {
  const color = normalizeHexColor(value);

  if (!color) return null;

  return {
    red: parseInt(color.slice(1, 3), 16),
    green: parseInt(color.slice(3, 5), 16),
    blue: parseInt(color.slice(5, 7), 16),
  };
}

function getRelativeLuminance(value: unknown) {
  const rgb = getHexColorRgb(value);

  if (!rgb) return null;

  const toLinear = (channel: number) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * toLinear(rgb.red) +
    0.7152 * toLinear(rgb.green) +
    0.0722 * toLinear(rgb.blue)
  );
}

function getContrastRatio(foreground: unknown, background: unknown) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);

  if (foregroundLuminance === null || backgroundLuminance === null) return 0;

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastStatus(ratio: number) {
  if (ratio >= 4.5) {
    return {
      label: "Buen contraste",
      description: "La combinación debería leerse bien en tarjetas y botones.",
      className: "border-green-500/25 bg-green-50 text-green-800",
    };
  }

  if (ratio >= 3) {
    return {
      label: "Contraste justo",
      description:
        "Puede funcionar en títulos grandes, pero conviene revisarlo en teléfono.",
      className: "border-yellow-500/30 bg-yellow-50 text-yellow-900",
    };
  }

  return {
    label: "Contraste bajo",
    description:
      "Cambia fondo, texto o botón para evitar que la tarjeta se vea ilegible.",
    className: "border-red-500/25 bg-red-50 text-red-800",
  };
}

function normalizeBusinessConfig(value: unknown): BusinessConfig {
  const source = (value || {}) as Partial<BusinessConfig>;
  const manualExchangeRate = Number(source.manualExchangeRate || 0);

  return {
    businessName:
      String(source.businessName || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessName,
    businessShortDescription:
      String(source.businessShortDescription || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessShortDescription,
    businessType: String(source.businessType || "").trim(),
    locationLabel:
      String(source.locationLabel || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.locationLabel,
    fiscalEnabled: source.fiscalEnabled === true,
    rifNumber: String(source.rifNumber || "").trim(),
    razonSocial: String(source.razonSocial || "").trim(),
    fiscalAddress: String(source.fiscalAddress || "").trim(),
    ivaDefaultRate: Number.isFinite(Number(source.ivaDefaultRate))
      ? Math.min(100, Math.max(0, Number(source.ivaDefaultRate)))
      : DEFAULT_BUSINESS_CONFIG.ivaDefaultRate,
    pricesIncludeIva: source.pricesIncludeIva !== false,
    igtfEnabled: source.igtfEnabled !== false,
    igtfRate: Number.isFinite(Number(source.igtfRate))
      ? Math.min(100, Math.max(0, Number(source.igtfRate)))
      : DEFAULT_BUSINESS_CONFIG.igtfRate,
    themePrimaryColor:
      normalizeHexColor(source.themePrimaryColor) ||
      DEFAULT_BUSINESS_CONFIG.themePrimaryColor,
    themeCreamColor:
      normalizeHexColor(source.themeCreamColor) ||
      DEFAULT_BUSINESS_CONFIG.themeCreamColor,
    themeAccentColor:
      normalizeHexColor(source.themeAccentColor) ||
      DEFAULT_BUSINESS_CONFIG.themeAccentColor,
    productCardBackgroundColor:
      normalizeHexColor(source.productCardBackgroundColor) ||
      DEFAULT_BUSINESS_CONFIG.productCardBackgroundColor,
    productCardTextColor:
      normalizeHexColor(source.productCardTextColor) ||
      DEFAULT_BUSINESS_CONFIG.productCardTextColor,
    productCardBorderColor:
      normalizeHexColor(source.productCardBorderColor) ||
      DEFAULT_BUSINESS_CONFIG.productCardBorderColor,
    productCardButtonColor:
      normalizeHexColor(source.productCardButtonColor) ||
      DEFAULT_BUSINESS_CONFIG.productCardButtonColor,
    publicTagline:
      String(source.publicTagline || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicTagline,
    publicInfoTitle:
      String(source.publicInfoTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicInfoTitle,
    publicInfoText:
      String(source.publicInfoText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicInfoText,
    scheduleTitle:
      String(source.scheduleTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleTitle,
    scheduleLine1:
      String(source.scheduleLine1 || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleLine1,
    scheduleLine2:
      String(source.scheduleLine2 || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.scheduleLine2,
    reviewsTitle:
      String(source.reviewsTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.reviewsTitle,
    reviewsText:
      String(source.reviewsText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.reviewsText,
    quickOrderTitle:
      String(source.quickOrderTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.quickOrderTitle,
    quickOrderText:
      String(source.quickOrderText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.quickOrderText,
    publicMenuEyebrow:
      String(source.publicMenuEyebrow || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuEyebrow,
    publicMenuTitle:
      String(source.publicMenuTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuTitle,
    publicMenuText:
      String(source.publicMenuText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuText,
    publicMenuSearchPlaceholder:
      String(source.publicMenuSearchPlaceholder || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicMenuSearchPlaceholder,
    publicComboTitle:
      String(source.publicComboTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboTitle,
    publicComboText:
      String(source.publicComboText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboText,
    publicComboButtonText:
      String(source.publicComboButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicComboButtonText,
    publicCustomizeButtonText:
      String(source.publicCustomizeButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCustomizeButtonText,
    publicCustomizerTitle:
      String(source.publicCustomizerTitle || "").trim() ||
      String(source.publicCustomizeButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCustomizerTitle,
    publicCartTitle:
      String(source.publicCartTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTitle,
    publicCartEmptyTitle:
      String(source.publicCartEmptyTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyTitle,
    publicCartEmptyText:
      String(source.publicCartEmptyText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyText,
    publicCartEmptyButtonText:
      String(source.publicCartEmptyButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartEmptyButtonText,
    publicCartTotalLabel:
      String(source.publicCartTotalLabel || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTotalLabel,
    publicCartTotalHint:
      String(source.publicCartTotalHint || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartTotalHint,
    publicCartLocalOrderButtonText:
      String(source.publicCartLocalOrderButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartLocalOrderButtonText,
    publicCartWhatsappButtonText:
      String(source.publicCartWhatsappButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicCartWhatsappButtonText,
    publicPaymentMethods: normalizePublicPaymentMethods(source.publicPaymentMethods),
    publicPaymentMethodDetails: normalizePublicPaymentMethodDetails(
      source.publicPaymentMethodDetails,
    ),
    publicProductCardSize: normalizePublicProductCardSize(
      source.publicProductCardSize,
    ),
    publicCoupons: normalizePublicCoupons(source.publicCoupons),
    publicDivisaGroupTitle:
      String(source.publicDivisaGroupTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaGroupTitle,
    publicDivisaOnlyNote:
      String(source.publicDivisaOnlyNote || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaOnlyNote,
    publicDivisaOnlyBadge:
      String(source.publicDivisaOnlyBadge || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicDivisaOnlyBadge,
    publicRegularGroupTitle:
      String(source.publicRegularGroupTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicRegularGroupTitle,
    publicAvailabilityLabel:
      String(source.publicAvailabilityLabel || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.publicAvailabilityLabel,
    locationButtonText:
      String(source.locationButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.locationButtonText,
    googleMapsUrl: String(source.googleMapsUrl || "").trim(),
    googleReviewUrl: String(source.googleReviewUrl || "").trim(),
    instagramUrl: String(source.instagramUrl || "").trim(),
    mainWhatsapp: String(source.mainWhatsapp || "").trim(),
    deliveryWhatsapp: String(source.deliveryWhatsapp || "").trim(),
    orderHelpWhatsappEnabled: normalizeBoolean(
      source.orderHelpWhatsappEnabled,
      DEFAULT_BUSINESS_CONFIG.orderHelpWhatsappEnabled,
    ),
    orderWhatsappStageButtonsEnabled: normalizeBoolean(
      source.orderWhatsappStageButtonsEnabled,
      DEFAULT_BUSINESS_CONFIG.orderWhatsappStageButtonsEnabled,
    ),
    exchangeRateMode: normalizeExchangeRateMode(source.exchangeRateMode),
    manualExchangeRate:
      Number.isFinite(manualExchangeRate) && manualExchangeRate > 0
        ? manualExchangeRate
        : 0,
    deliveryEnabled: normalizeBoolean(
      source.deliveryEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryEnabled,
    ),
    membershipPlan: isKnownPlan(source.membershipPlan)
      ? source.membershipPlan
      : DEFAULT_BUSINESS_CONFIG.membershipPlan,
    membershipPlanMode: normalizePlanMode(source.membershipPlanMode),
    customIncludedModules: normalizeModuleList(source.customIncludedModules),
    customBlockedModules: normalizeModuleList(source.customBlockedModules),
    ownerDashboardModuleEnabled: normalizeBoolean(
      source.ownerDashboardModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.ownerDashboardModuleEnabled,
    ),
    cashierModuleEnabled: normalizeBoolean(
      source.cashierModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.cashierModuleEnabled,
    ),
    kitchenModuleEnabled: normalizeBoolean(
      source.kitchenModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.kitchenModuleEnabled,
    ),
    deliveryModuleEnabled: normalizeBoolean(
      source.deliveryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.deliveryModuleEnabled,
    ),
    historyModuleEnabled: normalizeBoolean(
      source.historyModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.historyModuleEnabled,
    ),
    expensesModuleEnabled: normalizeBoolean(
      source.expensesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.expensesModuleEnabled,
    ),
    promotionModuleEnabled: normalizeBoolean(
      source.promotionModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.promotionModuleEnabled,
    ),
    promotionActive: normalizeBoolean(
      source.promotionActive,
      DEFAULT_BUSINESS_CONFIG.promotionActive,
    ),
    promotionTitle:
      String(source.promotionTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionTitle,
    promotionText:
      String(source.promotionText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionText,
    promotionHighlight:
      String(source.promotionHighlight || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionHighlight,
    promotionButtonText:
      String(source.promotionButtonText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionButtonText,
    promotionButtonHref:
      String(source.promotionButtonHref || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.promotionButtonHref,
    promotionProductId: Math.round(
      normalizePositiveNumber(source.promotionProductId),
    ),
    promotionProductName: String(source.promotionProductName || "").trim(),
    promotionPriceUSD: normalizePositiveNumber(source.promotionPriceUSD),
    promotionImage: String(source.promotionImage || "").trim(),
    menuProductsModuleEnabled: normalizeBoolean(
      source.menuProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.menuProductsModuleEnabled,
    ),
    featuredProductsModuleEnabled: normalizeBoolean(
      source.featuredProductsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.featuredProductsModuleEnabled,
    ),
    featuredProductsActive: normalizeBoolean(
      source.featuredProductsActive,
      DEFAULT_BUSINESS_CONFIG.featuredProductsActive,
    ),
    featuredProductsTitle:
      String(source.featuredProductsTitle || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.featuredProductsTitle,
    featuredProductsText:
      String(source.featuredProductsText || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.featuredProductsText,
    featuredProductIds: normalizeNumberList(
      source.featuredProductIds,
      DEFAULT_BUSINESS_CONFIG.featuredProductIds,
    ),
    publicCategoryOrder: normalizePublicCategoryList(source.publicCategoryOrder).length
      ? normalizePublicCategoryList(source.publicCategoryOrder)
      : DEFAULT_BUSINESS_CONFIG.publicCategoryOrder,
    publicHiddenCategories: normalizePublicHiddenCategoryList(
      source.publicHiddenCategories,
    ),
    publicNavButtons: normalizePublicNavButtons(source.publicNavButtons),
    customersModuleEnabled: normalizeBoolean(
      source.customersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.customersModuleEnabled,
    ),
    inventoryModuleEnabled: normalizeBoolean(
      source.inventoryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryModuleEnabled,
    ),
    inventoryAlertsModuleEnabled: normalizeBoolean(
      source.inventoryAlertsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryAlertsModuleEnabled,
    ),
    advancedMenuModuleEnabled: normalizeBoolean(
      source.advancedMenuModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.advancedMenuModuleEnabled,
    ),
    productVariationsModuleEnabled: normalizeBoolean(
      source.productVariationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productVariationsModuleEnabled,
    ),
    productAddonsModuleEnabled: normalizeBoolean(
      source.productAddonsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productAddonsModuleEnabled,
    ),
    productBuilderModuleEnabled: normalizeBoolean(
      source.productBuilderModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productBuilderModuleEnabled,
    ),
    productCombosModuleEnabled: normalizeBoolean(
      source.productCombosModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productCombosModuleEnabled,
    ),
    productAvailabilityModuleEnabled: normalizeBoolean(
      source.productAvailabilityModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.productAvailabilityModuleEnabled,
    ),
    salesChannelsModuleEnabled: normalizeBoolean(
      source.salesChannelsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.salesChannelsModuleEnabled,
    ),
    paymentProofsModuleEnabled: normalizeBoolean(
      source.paymentProofsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.paymentProofsModuleEnabled,
    ),
    openAccountsModuleEnabled: normalizeBoolean(
      source.openAccountsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.openAccountsModuleEnabled,
    ),
    tablesModuleEnabled: normalizeBoolean(
      source.tablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.tablesModuleEnabled,
    ),
    localTables: normalizeLocalTablesForMap(
      source.localTables,
      DEFAULT_BUSINESS_CONFIG.localTables,
    ),
    qrTablesModuleEnabled: normalizeBoolean(
      source.qrTablesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.qrTablesModuleEnabled,
    ),
    reservationsModuleEnabled: normalizeBoolean(
      source.reservationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.reservationsModuleEnabled,
    ),
    roomsModuleEnabled: normalizeBoolean(
      source.roomsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.roomsModuleEnabled,
    ),
    hotelReservationsModuleEnabled: normalizeBoolean(
      source.hotelReservationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.hotelReservationsModuleEnabled,
    ),
    folioModuleEnabled: normalizeBoolean(
      source.folioModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.folioModuleEnabled,
    ),
    housekeepingModuleEnabled: normalizeBoolean(
      source.housekeepingModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.housekeepingModuleEnabled,
    ),
    rateSeasonsModuleEnabled: normalizeBoolean(
      source.rateSeasonsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.rateSeasonsModuleEnabled,
    ),
    hotelReportsModuleEnabled: normalizeBoolean(
      source.hotelReportsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.hotelReportsModuleEnabled,
    ),
    bookingEngineModuleEnabled: normalizeBoolean(
      source.bookingEngineModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.bookingEngineModuleEnabled,
    ),
    tapeChartModuleEnabled: normalizeBoolean(
      source.tapeChartModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.tapeChartModuleEnabled,
    ),
    groupBookingsModuleEnabled: normalizeBoolean(
      source.groupBookingsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.groupBookingsModuleEnabled,
    ),
    advancedRatesModuleEnabled: normalizeBoolean(
      source.advancedRatesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.advancedRatesModuleEnabled,
    ),
    resortServicesModuleEnabled: normalizeBoolean(
      source.resortServicesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.resortServicesModuleEnabled,
    ),
    resortChargesModuleEnabled: normalizeBoolean(
      source.resortChargesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.resortChargesModuleEnabled,
    ),
    guestReviewsModuleEnabled: normalizeBoolean(
      source.guestReviewsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.guestReviewsModuleEnabled,
    ),
    guestCrmModuleEnabled: normalizeBoolean(
      source.guestCrmModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.guestCrmModuleEnabled,
    ),
    hotelLandingModuleEnabled: normalizeBoolean(
      source.hotelLandingModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.hotelLandingModuleEnabled,
    ),
    hotelPackagesModuleEnabled: normalizeBoolean(
      source.hotelPackagesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.hotelPackagesModuleEnabled,
    ),
    guestPortalModuleEnabled: normalizeBoolean(
      source.guestPortalModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.guestPortalModuleEnabled,
    ),
    onlinePaymentsModuleEnabled: normalizeBoolean(
      source.onlinePaymentsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.onlinePaymentsModuleEnabled,
    ),
    guestNotificationsModuleEnabled: normalizeBoolean(
      source.guestNotificationsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.guestNotificationsModuleEnabled,
    ),
    nightAuditModuleEnabled: normalizeBoolean(
      source.nightAuditModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.nightAuditModuleEnabled,
    ),
    fiscalInvoicingModuleEnabled: normalizeBoolean(
      source.fiscalInvoicingModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.fiscalInvoicingModuleEnabled,
    ),
    channelManagerModuleEnabled: normalizeBoolean(
      source.channelManagerModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.channelManagerModuleEnabled,
    ),
    waiterConfirmationModuleEnabled: normalizeBoolean(
      source.waiterConfirmationModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.waiterConfirmationModuleEnabled,
    ),
    kitchenItemsModuleEnabled: normalizeBoolean(
      source.kitchenItemsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.kitchenItemsModuleEnabled,
    ),
    ticketsModuleEnabled: normalizeBoolean(
      source.ticketsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.ticketsModuleEnabled,
    ),
    splitBillModuleEnabled: normalizeBoolean(
      source.splitBillModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.splitBillModuleEnabled,
    ),
    serviceChargeTipsModuleEnabled: normalizeBoolean(
      source.serviceChargeTipsModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.serviceChargeTipsModuleEnabled,
    ),
    suppliersModuleEnabled: normalizeBoolean(
      source.suppliersModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.suppliersModuleEnabled,
    ),
    supplierPurchasesModuleEnabled: normalizeBoolean(
      source.supplierPurchasesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.supplierPurchasesModuleEnabled,
    ),
    accountsPayableModuleEnabled: normalizeBoolean(
      source.accountsPayableModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.accountsPayableModuleEnabled,
    ),
    subrecipesModuleEnabled: normalizeBoolean(
      source.subrecipesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.subrecipesModuleEnabled,
    ),
    auditLogModuleEnabled: normalizeBoolean(
      source.auditLogModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.auditLogModuleEnabled,
    ),
    visualEditorModuleEnabled: normalizeBoolean(
      source.visualEditorModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.visualEditorModuleEnabled,
    ),
    trainingModeModuleEnabled: normalizeBoolean(
      source.trainingModeModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.trainingModeModuleEnabled,
    ),
    branchesModuleEnabled: normalizeBoolean(
      source.branchesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.branchesModuleEnabled,
    ),
    defaultViewMode: normalizeViewMode(source.defaultViewMode),
    soundEnabled: normalizeBoolean(
      source.soundEnabled,
      DEFAULT_BUSINESS_CONFIG.soundEnabled,
    ),
    filtersOpenByDefault: normalizeBoolean(
      source.filtersOpenByDefault,
      DEFAULT_BUSINESS_CONFIG.filtersOpenByDefault,
    ),
    allowCloseWithPendingOrders: normalizeBoolean(
      source.allowCloseWithPendingOrders,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingOrders,
    ),
    allowCloseWithPendingPayments: normalizeBoolean(
      source.allowCloseWithPendingPayments,
      DEFAULT_BUSINESS_CONFIG.allowCloseWithPendingPayments,
    ),
    updatedAt: source.updatedAt ? String(source.updatedAt) : undefined,
  };
}

function formatDateTime(value?: string) {
  if (!value) return "Sin cambios guardados";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isBusinessConfigKey(value: unknown): value is keyof BusinessConfig {
  return typeof value === "string" && value in DEFAULT_BUSINESS_CONFIG;
}

function getModuleCheckedValue(
  config: BusinessConfig,
  moduleItem: LocalModulePlanAccess,
) {
  if (!moduleItem.includedInPlan) return false;

  if (moduleItem.moduleKey === "delivery") {
    return config.deliveryEnabled && config.deliveryModuleEnabled;
  }

  const configKey = moduleItem.ownerConfigKey;

  if (isBusinessConfigKey(configKey)) {
    return Boolean(config[configKey]);
  }

  return moduleItem.effectiveEnabled;
}

function countIncludedOwnerModules(config: BusinessConfig) {
  return getVisibleOwnerSettingModules()
    .map((moduleDefinition) =>
      getModulePlanAccess(config, moduleDefinition.key),
    )
    .filter((moduleItem) => moduleItem.includedInPlan).length;
}

function getOwnerModuleLabel(moduleItem: LocalModulePlanAccess) {
  if (moduleItem.moduleKey === "menuProducts") {
    return "Productos del menú";
  }

  return moduleItem.label;
}

function getOwnerModuleDescription(moduleItem: LocalModulePlanAccess) {
  if (moduleItem.moduleKey === "featuredProducts") {
    return "Permite crear, editar, activar, pausar y destacar productos visibles en la página pública.";
  }

  return moduleItem.description;
}

export default function BusinessConfigPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessRole, setAccessRole] = useState<ConfigAccessRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(
    DEFAULT_BUSINESS_CONFIG,
  );
  const [availableProducts, setAvailableProducts] =
    useState<Product[]>(fallbackProducts);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsWarning, setProductsWarning] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [branchesWarning, setBranchesWarning] = useState<string | null>(null);
  const [branchesMessage, setBranchesMessage] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSavingBranches, setIsSavingBranches] = useState(false);
  const [isUploadingPromotionImage, setIsUploadingPromotionImage] =
    useState(false);
  const promotionImageInputRef = useRef<HTMLInputElement | null>(null);
  const hasMergedMenuFeaturedStateRef = useRef(false);

  const activePlan = getLocalPlanDefinition(businessConfig.membershipPlan);
  const includedModulesCount = useMemo(
    () => countIncludedOwnerModules(businessConfig),
    [businessConfig],
  );
  const visibleOwnerModules = useMemo(
    () =>
      getVisibleOwnerSettingModules()
        .filter((moduleDefinition) => !moduleDefinition.comingSoon)
        .map((moduleDefinition) =>
          getModulePlanAccess(businessConfig, moduleDefinition.key),
        ),
    [businessConfig],
  );
  const visibleSupportModules = useMemo(
    () =>
      getVisibleSupportModules()
        .filter(
          (moduleDefinition) => moduleDefinition.minimumPlan !== "internal",
        )
        .map((moduleDefinition) =>
          getModulePlanAccess(businessConfig, moduleDefinition.key),
        ),
    [businessConfig],
  );
  const canEditPlan = accessRole === "support";
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.is_active !== false),
    [branches],
  );
  const inactiveBranchesCount = Math.max(
    0,
    branches.length - activeBranches.length,
  );
  const canEditBranches = accessRole === "owner";
  const deliveryAccess = getModulePlanAccess(businessConfig, "delivery");
  const canEditDeliveryZones =
    accessRole === "owner" && deliveryAccess.effectiveEnabled;
  const activeLocalTables = useMemo(
    () =>
      normalizeLocalTablesForMap(
        businessConfig.localTables,
        DEFAULT_CONFIG_LOCAL_TABLES,
      ).filter((table) => table.isActive !== false),
    [businessConfig.localTables],
  );
  const inactiveLocalTablesCount = Math.max(
    0,
    businessConfig.localTables.length - activeLocalTables.length,
  );
  const advancedPublicAccess = getModulePlanAccess(
    businessConfig,
    "advancedPublicConfig",
  );
  const canEditAdvancedPublic = advancedPublicAccess.includedInPlan;
  const promotionAccess = getModulePlanAccess(businessConfig, "promotions");
  const canEditPromotion = promotionAccess.includedInPlan;
  const selectedPromotionProduct = useMemo(
    () =>
      availableProducts.find(
        (product) => product.id === businessConfig.promotionProductId,
      ) || null,
    [availableProducts, businessConfig.promotionProductId],
  );
  const promotionPreviewImage =
    businessConfig.promotionImage ||
    selectedPromotionProduct?.image ||
    "/logoremovebg.png";
  const menuProductsAccess = getModulePlanAccess(
    businessConfig,
    "menuProducts",
  );
  const canEditMenuProducts = menuProductsAccess.effectiveEnabled;
  const tablesAccess = getModulePlanAccess(businessConfig, "tables");
  const canEditTables = tablesAccess.includedInPlan;
  const featuredProductsAccess = getModulePlanAccess(
    businessConfig,
    "featuredProducts",
  );
  const canEditFeaturedProducts = featuredProductsAccess.includedInPlan;
  const publicCategoryOptions = useMemo(() => {
    const productCategories = availableProducts
      .map((product) => String(product.category || "").trim())
      .filter(Boolean)
    return normalizePublicCategoryList([
      ...businessConfig.publicCategoryOrder,
      ...productCategories,
      ...DEFAULT_PUBLIC_CATEGORY_ORDER,
    ])
  }, [availableProducts, businessConfig.publicCategoryOrder]);
  const hiddenPublicCategoryKeys = useMemo(
    () => new Set(businessConfig.publicHiddenCategories.map(normalizeComparableText)),
    [businessConfig.publicHiddenCategories],
  );
  const cardTextContrastRatio = useMemo(
    () =>
      getContrastRatio(
        businessConfig.productCardTextColor,
        businessConfig.productCardBackgroundColor,
      ),
    [
      businessConfig.productCardBackgroundColor,
      businessConfig.productCardTextColor,
    ],
  );
  const cardButtonContrastRatio = useMemo(
    () =>
      getContrastRatio(
        businessConfig.productCardTextColor,
        businessConfig.productCardButtonColor,
      ),
    [
      businessConfig.productCardButtonColor,
      businessConfig.productCardTextColor,
    ],
  );
  const cardTextContrastStatus = getContrastStatus(cardTextContrastRatio);
  const cardButtonContrastStatus = getContrastStatus(cardButtonContrastRatio);

  function updateConfig<K extends keyof BusinessConfig>(
    key: K,
    value: BusinessConfig[K],
  ) {
    setBusinessConfig((current) => ({
      ...current,
      [key]: value,
    }));
    setSuccessMessage(null);
  }

  function updatePublicNavButton(
    index: number,
    patch: Partial<PublicNavButton>,
  ) {
    setBusinessConfig((current) => {
      const nextButtons = normalizePublicNavButtons(current.publicNavButtons).map(
        (button, buttonIndex) =>
          buttonIndex === index ? { ...button, ...patch } : button,
      );

      return {
        ...current,
        publicNavButtons: normalizePublicNavButtons(nextButtons),
      };
    });
    setSuccessMessage(null);
  }

  function resetPublicNavButtons() {
    updateConfig("publicNavButtons", DEFAULT_PUBLIC_NAV_BUTTONS);
  }

  function togglePublicCategoryVisibility(category: string, isVisible: boolean) {
    const cleanCategory = String(category || "").trim();
    if (!cleanCategory) return;

    setBusinessConfig((current) => {
      const currentHidden = normalizePublicHiddenCategoryList(
        current.publicHiddenCategories,
      );
      const nextHidden = isVisible
        ? currentHidden.filter(
            (item) => normalizeComparableText(item) !== normalizeComparableText(cleanCategory),
          )
        : normalizePublicHiddenCategoryList([...currentHidden, cleanCategory]);

      return {
        ...current,
        publicHiddenCategories: nextHidden,
      };
    });
    setSuccessMessage(null);
  }

  function updatePublicCategoryOrder(category: string, orderValue: number) {
    const cleanCategory = String(category || "").trim();
    if (!cleanCategory) return;

    setBusinessConfig((current) => {
      const categories = normalizePublicCategoryList([
        ...current.publicCategoryOrder,
        ...publicCategoryOptions,
      ]);
      const withoutCategory = categories.filter(
        (item) => normalizeComparableText(item) !== normalizeComparableText(cleanCategory),
      );
      const nextIndex = Math.min(
        withoutCategory.length,
        Math.max(0, Math.round(orderValue || 1) - 1),
      );
      const nextCategories = [...withoutCategory];
      nextCategories.splice(nextIndex, 0, cleanCategory);

      return {
        ...current,
        publicCategoryOrder: normalizePublicCategoryList(nextCategories),
      };
    });
    setSuccessMessage(null);
  }

  function resetPublicCategoryOrder() {
    updateConfig("publicCategoryOrder", DEFAULT_PUBLIC_CATEGORY_ORDER);
    updateConfig("publicHiddenCategories", []);
  }

  function applyVisualColorPreset(values: VisualColorPresetValues) {
    setBusinessConfig((current) => ({
      ...current,
      ...values,
    }));
    setSuccessMessage(null);
  }

  function updatePlanForSupport(plan: LocalPlanKey) {
    if (!canEditPlan) return;

    setBusinessConfig((current) => ({
      ...current,
      membershipPlan: plan,
    }));
    setSuccessMessage(null);
  }

  function updatePlanModeForSupport(planMode: LocalPlanMode) {
    if (!canEditPlan) return;

    setBusinessConfig((current) => ({
      ...current,
      membershipPlanMode: planMode,
      customIncludedModules:
        planMode === "custom" ? current.customIncludedModules : [],
      customBlockedModules:
        planMode === "custom" ? current.customBlockedModules : [],
    }));
    setSuccessMessage(null);
  }

  function toggleCustomModuleForSupport(
    moduleKey: LocalModuleKey,
    listKey: "customIncludedModules" | "customBlockedModules",
  ) {
    if (!canEditPlan || businessConfig.membershipPlanMode !== "custom") return;

    const oppositeListKey =
      listKey === "customIncludedModules"
        ? "customBlockedModules"
        : "customIncludedModules";

    setBusinessConfig((current) => {
      const currentList = new Set(current[listKey]);
      const oppositeList = new Set(current[oppositeListKey]);

      if (currentList.has(moduleKey)) {
        currentList.delete(moduleKey);
      } else {
        currentList.add(moduleKey);
        oppositeList.delete(moduleKey);
      }

      return {
        ...current,
        [listKey]: Array.from(currentList),
        [oppositeListKey]: Array.from(oppositeList),
      };
    });
    setSuccessMessage(null);
  }

  function updateLocalTableConfig(
    tableIndex: number,
    patch: Partial<LocalTableMapItem>,
  ) {
    if (!canEditTables) return;

    setBusinessConfig((current) => {
      const tables = [
        ...(current.localTables.length
          ? current.localTables
          : DEFAULT_CONFIG_LOCAL_TABLES),
      ];
      const currentTable = tables[tableIndex];

      if (!currentTable) return current;

      tables[tableIndex] = {
        ...currentTable,
        ...patch,
      };

      return {
        ...current,
        localTables: tables,
      };
    });
    setSuccessMessage(null);
  }

  function addLocalTableConfig() {
    if (!canEditTables) return;

    setBusinessConfig((current) => {
      const tables = [
        ...(current.localTables.length
          ? current.localTables
          : DEFAULT_CONFIG_LOCAL_TABLES),
      ];
      const nextNumber = tables.length + 1;

      return {
        ...current,
        localTables: [
          ...tables,
          {
            id: `mesa-${nextNumber}`,
            name: `Mesa ${nextNumber}`,
            area: "Principal",
            sortOrder: nextNumber,
            isActive: true,
            note: "",
          },
        ],
      };
    });
    setSuccessMessage(null);
  }

  function removeLocalTableConfig(tableIndex: number) {
    if (!canEditTables) return;

    setBusinessConfig((current) => {
      const tables = current.localTables.length
        ? current.localTables
        : DEFAULT_CONFIG_LOCAL_TABLES;

      if (tables.length <= 1) {
        return current;
      }

      return {
        ...current,
        localTables: tables.filter((_, index) => index !== tableIndex),
      };
    });
    setSuccessMessage(null);
  }

  function restoreDefaultLocalTables() {
    if (!canEditTables) return;

    setBusinessConfig((current) => ({
      ...current,
      localTables: DEFAULT_CONFIG_LOCAL_TABLES,
    }));
    setSuccessMessage(null);
  }

  async function loadAvailableProducts(quiet = false) {
    if (!quiet) {
      setIsLoadingProducts(true);
      setProductsWarning(null);
    }

    try {
      const response = await fetch("/api/public/products", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as PublicProductsResponse;
      const loadedProducts = normalizePublicProducts(data.products);

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "No se pudieron cargar los productos del menú editable",
        );
      }

      if (loadedProducts.length > 0) {
        hasMergedMenuFeaturedStateRef.current = false;
        setAvailableProducts(loadedProducts);
        setProductsWarning(data.warning || null);
        return;
      }

      setAvailableProducts(fallbackProducts);
      setProductsWarning(
        data.warning ||
          "No se encontraron productos activos del menú editable. Se muestra el menú base como respaldo.",
      );
    } catch (error) {
      setAvailableProducts(fallbackProducts);
      setProductsWarning(
        error instanceof Error
          ? `No se pudo cargar el menú editable. Se muestra el menú base. Detalle: ${error.message}`
          : "No se pudo cargar el menú editable. Se muestra el menú base.",
      );
    } finally {
      if (!quiet) {
        setIsLoadingProducts(false);
      }
    }
  }

  function applyPromotionProduct(productId: number) {
    if (!canEditPromotion) return;

    const product = availableProducts.find((item) => item.id === productId);

    if (!product) {
      updateConfig("promotionProductId", 0);
      updateConfig("promotionProductName", "");
      updateConfig("promotionImage", "");
      return;
    }

    setBusinessConfig((current) => ({
      ...current,
      promotionProductId: product.id,
      promotionProductName: product.name,
      promotionImage: product.image || current.promotionImage,
      promotionTitle:
        current.promotionTitle &&
        current.promotionTitle !== DEFAULT_BUSINESS_CONFIG.promotionTitle
          ? current.promotionTitle
          : product.name,
      promotionButtonText:
        current.promotionButtonText &&
        current.promotionButtonText !==
          DEFAULT_BUSINESS_CONFIG.promotionButtonText
          ? current.promotionButtonText
          : "Pedir promoción",
      promotionButtonHref: current.promotionButtonHref || "#menu",
    }));
    setSuccessMessage(null);
  }

  function readImageAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(new Error("No se pudo leer la imagen seleccionada."));
      reader.readAsDataURL(file);
    });
  }

  function buildPromotionImageFileName(file: File) {
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase() || "jpg"
      : "jpg";
    const baseName =
      businessConfig.promotionTitle ||
      businessConfig.promotionProductName ||
      selectedPromotionProduct?.name ||
      "promocion";
    const safeName = baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return `${safeName || "promocion"}-${Date.now()}.${extension}`;
  }

  async function uploadPromotionImage(file: File) {
    if (!canEditPromotion) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecciona una imagen válida para la promoción.");
      return;
    }

    if (file.size > 3_600_000) {
      setErrorMessage(
        "La imagen es muy pesada. Recórtala o reduce su tamaño antes de subirla.",
      );
      return;
    }

    const cleanPassword = String(adminPassword || "").trim();

    if (!cleanPassword) {
      setErrorMessage("No hay clave privada activa. Vuelve a iniciar sesión.");
      return;
    }

    setIsUploadingPromotionImage(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const dataUrl = await readImageAsDataUrl(file);
      const response = await fetch("/api/menu-products/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        body: JSON.stringify({
          dataUrl,
          fileName: buildPromotionImageFileName(file),
          mimeType: file.type || "image/jpeg",
          productName:
            businessConfig.promotionTitle ||
            businessConfig.promotionProductName ||
            selectedPromotionProduct?.name ||
            "promocion",
        }),
      });

      const data = await response.json();
      const imageUrl = String(
        data.image?.imageUrl || data.image?.thumbnailUrl || "",
      ).trim();

      if (!response.ok || data.error || !imageUrl) {
        throw new Error(
          data.error || "No se recibió un enlace válido para la imagen subida.",
        );
      }

      setBusinessConfig((current) => ({
        ...current,
        promotionImage: imageUrl,
      }));
      setSuccessMessage(
        "Imagen de promoción subida correctamente. Guarda la configuración para aplicarla en la página pública.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo subir la imagen de la promoción.",
      );
    } finally {
      setIsUploadingPromotionImage(false);
    }
  }

  function handlePromotionImageInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (file) {
      void uploadPromotionImage(file);
    }

    event.target.value = "";
  }

  function useSelectedProductImageForPromotion() {
    if (!selectedPromotionProduct?.image) return;

    updateConfig("promotionImage", selectedPromotionProduct.image);
  }

  function updateModuleValue(
    moduleItem: LocalModulePlanAccess,
    value: boolean,
  ) {
    if (!moduleItem.includedInPlan || moduleItem.comingSoon) return;

    if (moduleItem.moduleKey === "delivery") {
      setBusinessConfig((current) => ({
        ...current,
        deliveryEnabled: value,
        deliveryModuleEnabled: value,
      }));
      setSuccessMessage(null);
      return;
    }

    const configKey = moduleItem.ownerConfigKey;

    if (!isBusinessConfigKey(configKey)) return;

    setBusinessConfig((current) => ({
      ...current,
      [configKey]: value,
    }));
    setSuccessMessage(null);
  }

  function activateAvailablePlanModules() {
    setBusinessConfig((current) => {
      const nextConfig = {
        ...current,
        ...AVAILABLE_MODULES_PATCH,
      };

      // Respeta el plan activo: si un módulo no está incluido, no se fuerza.
      getVisibleOwnerSettingModules().forEach((moduleDefinition) => {
        const moduleAccess = getModulePlanAccess(nextConfig, moduleDefinition.key);

        if (!moduleAccess.ownerConfigKey || moduleAccess.comingSoon) return;

        if (!moduleAccess.includedInPlan && isBusinessConfigKey(moduleAccess.ownerConfigKey)) {
          (nextConfig as Record<string, unknown>)[moduleAccess.ownerConfigKey] = false;
        }
      });

      return normalizeBusinessConfig(nextConfig);
    });
    setSuccessMessage(
      "Módulos disponibles del plan activados en pantalla. Guarda para aplicarlos al negocio.",
    );
  }

  async function syncMenuProductFeaturedState(
    productId: number,
    nextFeaturedState: boolean,
  ) {
    const product = availableProducts.find((item) => item.id === productId);

    if (!product || !adminPassword) return;

    const response = await fetch("/api/menu-products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPassword,
      },
      body: JSON.stringify({
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price,
        image: product.image,
        paymentMode: product.paymentMode,
        isActive: product.isActive !== false,
        isFeatured: nextFeaturedState,
        sortOrder: Number(product.sortOrder || product.id || 999),
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error ||
          "No se pudo sincronizar el destacado con Productos del menú.",
      );
    }
  }

  async function toggleFeaturedProduct(productId: number) {
    if (!canEditFeaturedProducts) return;

    const product = availableProducts.find((item) => item.id === productId);
    const currentIds = Array.isArray(businessConfig.featuredProductIds)
      ? businessConfig.featuredProductIds
      : [];
    const isCurrentlySelected =
      currentIds.includes(productId) || product?.isFeatured === true;
    const nextFeaturedState = !isCurrentlySelected;
    const nextIds = nextFeaturedState
      ? mergeNumberLists(currentIds, [productId])
      : currentIds.filter((id) => id !== productId);

    setBusinessConfig((current) => ({
      ...current,
      featuredProductIds: nextIds,
    }));
    setAvailableProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === productId
          ? {
              ...item,
              isFeatured: nextFeaturedState,
            }
          : item,
      ),
    );
    setSuccessMessage(null);
    setProductsWarning(null);

    try {
      await syncMenuProductFeaturedState(productId, nextFeaturedState);
    } catch (error) {
      setProductsWarning(
        error instanceof Error
          ? error.message
          : "La selección quedó guardada en Configuración, pero no se pudo actualizar el estado en Productos del menú.",
      );
    }
  }

  async function loadBranches(password: string, quiet = false) {
    const cleanPassword = password.trim();

    if (!cleanPassword) return;

    if (!quiet) {
      setIsLoadingBranches(true);
      setBranchesWarning(null);
    }

    try {
      const response = await fetch("/api/branches", {
        method: "GET",
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as BranchesResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudieron cargar las sucursales");
      }

      const loadedBranches = Array.isArray(data.branches)
        ? data.branches
            .map((branch) => ({
              id: String(branch.id || "").trim(),
              name: String(branch.name || "").trim(),
              is_active: branch.is_active !== false,
              sort_order: Number.isFinite(Number(branch.sort_order))
                ? Number(branch.sort_order)
                : 999,
            }))
            .filter((branch) => branch.id && branch.name)
            .sort((first, second) => {
              if (first.sort_order !== second.sort_order) {
                return first.sort_order - second.sort_order;
              }

              return first.name.localeCompare(second.name);
            })
        : [];

      setBranches(loadedBranches);
      setBranchesWarning(null);
    } catch (error) {
      setBranchesWarning(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las sucursales.",
      );
    } finally {
      if (!quiet) {
        setIsLoadingBranches(false);
      }
    }
  }

  async function createBranchFromConfig() {
    const cleanPassword = String(adminPassword || "").trim();
    const name = newBranchName.trim();

    if (!canEditBranches) {
      setBranchesMessage(
        "Solo el dueño puede crear o editar sucursales desde Configuración.",
      );
      return;
    }

    if (!cleanPassword) {
      setBranchesMessage(
        "No hay clave privada activa. Vuelve a iniciar sesión.",
      );
      return;
    }

    if (!name) {
      setBranchesMessage("Escribe el nombre de la nueva sucursal.");
      return;
    }

    setIsSavingBranches(true);
    setBranchesWarning(null);
    setBranchesMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as BranchesResponse & {
        branch?: BranchSummary;
      };

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo crear la sucursal");
      }

      setNewBranchName("");
      setBranchesMessage("Sucursal creada correctamente.");
      await loadBranches(cleanPassword, true);
    } catch (error) {
      setBranchesMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la sucursal.",
      );
    } finally {
      setIsSavingBranches(false);
    }
  }

  async function updateBranchFromConfig(
    branchId: string,
    patch: Partial<Pick<BranchSummary, "name" | "is_active">>,
  ) {
    const cleanPassword = String(adminPassword || "").trim();

    if (!canEditBranches) {
      setBranchesMessage(
        "Solo el dueño puede crear o editar sucursales desde Configuración.",
      );
      return;
    }

    if (!cleanPassword) {
      setBranchesMessage(
        "No hay clave privada activa. Vuelve a iniciar sesión.",
      );
      return;
    }

    if (patch.name !== undefined && !patch.name.trim()) {
      setBranchesMessage("El nombre de la sucursal no puede quedar vacío.");
      return;
    }

    setIsSavingBranches(true);
    setBranchesWarning(null);
    setBranchesMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as BranchesResponse & {
        branch?: BranchSummary;
      };

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo actualizar la sucursal");
      }

      setBranchesMessage("Sucursal actualizada correctamente.");
      await loadBranches(cleanPassword, true);
    } catch (error) {
      setBranchesMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la sucursal.",
      );
    } finally {
      setIsSavingBranches(false);
    }
  }

  async function loadBusinessConfig(password: string, quiet = false) {
    const cleanPassword = password.trim();

    if (!cleanPassword) return;

    if (!quiet) {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
    }

    try {
      const response = await fetch("/api/business-config", {
        method: "GET",
        headers: {
          "x-admin-password": cleanPassword,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo cargar la configuración");
      }

      hasMergedMenuFeaturedStateRef.current = false;
      setBusinessConfig(
        normalizeBusinessConfig(data.businessConfig || data.config || {}),
      );
      setAccessRole(data.access?.role === "support" ? "support" : "owner");
      setIsAuthenticated(true);
      setAdminPassword(cleanPassword);
      setPasswordInput(cleanPassword);
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, cleanPassword);
      void loadBranches(cleanPassword, true);

      if (!quiet) {
        setSuccessMessage("Configuración cargada correctamente.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la configuración del negocio",
      );
      setIsAuthenticated(false);
      setAccessRole(null);
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }

  async function saveBusinessConfig() {
    const cleanPassword = String(adminPassword || "").trim();

    if (!cleanPassword) {
      setErrorMessage("No hay clave privada activa. Vuelve a iniciar sesión.");
      setIsAuthenticated(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/business-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": cleanPassword,
        },
        body: JSON.stringify({
          businessConfig,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudo guardar la configuración");
      }

      setBusinessConfig(
        normalizeBusinessConfig(
          data.businessConfig || data.config || businessConfig,
        ),
      );
      setAccessRole(data.access?.role === "support" ? "support" : accessRole);
      setSuccessMessage("Configuración guardada correctamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración del negocio",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadBusinessConfig(passwordInput);
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminPassword("");
    setPasswordInput("");
    setIsAuthenticated(false);
    setAccessRole(null);
    setBusinessConfig(DEFAULT_BUSINESS_CONFIG);
    setBranches([]);
    setBranchesWarning(null);
    setBranchesMessage(null);
    setNewBranchName("");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  const restoreSession = useEffectEvent(() => {
    const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);

    if (savedPassword) {
      loadBusinessConfig(savedPassword, true);
    }
  });

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(restoreSession, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setTimeout(() => loadAvailableProducts(true), 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || hasMergedMenuFeaturedStateRef.current) return;

    const productFeaturedIds = getProductFeaturedIds(availableProducts);

    hasMergedMenuFeaturedStateRef.current = true;

    if (!productFeaturedIds.length) return;

    const timer = setTimeout(() => {
      setBusinessConfig((current) => {
        const currentIds = Array.isArray(current.featuredProductIds)
          ? current.featuredProductIds
          : [];
        const mergedIds = mergeNumberLists(currentIds, productFeaturedIds);

        if (areNumberListsEqual(currentIds, mergedIds)) {
          return current;
        }

        return {
          ...current,
          featuredProductIds: mergedIds,
        };
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [availableProducts, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]"
        >
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="px-6 py-6">
            <Link
              href="/local-santo"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
            >
              <ArrowLeft size={16} />
              Volver
            </Link>

            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.14)]">
              <Settings2 size={42} />
            </div>

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Configuración privada
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Negocio
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave del dueño para ajustar datos y módulos permitidos
              por el plan activo.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Clave del dueño
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  placeholder="Ingresa la clave privada"
                  className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02] disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <LogIn size={21} />
              )}
              {isLoading ? "Cargando" : "Entrar a configuración"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/local-santo"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </Link>

                  <button
                    type="button"
                    onClick={() => loadBusinessConfig(adminPassword)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {businessConfig.businessName}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Configuración del negocio
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Ajusta datos del local y activa o desactiva los módulos
                  incluidos en tu plan. Las funciones no incluidas se muestran
                  con candado para que sepas que están disponibles en planes
                  superiores.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard label="Plan activo" value={activePlan.shortLabel} />
                <MetricCard
                  label="Módulos incluidos"
                  value={`${includedModulesCount}/${visibleOwnerModules.length}`}
                />
                <MetricCard
                  label="Modo"
                  value={
                    businessConfig.membershipPlanMode === "custom"
                      ? "Personalizado"
                      : "Plan fijo"
                  }
                />
                <MetricCard
                  label="Sucursales activas"
                  value={branches.length ? activeBranches.length : "Sin cargar"}
                />
                <MetricCard
                  label="Actualizado"
                  value={formatDateTime(businessConfig.updatedAt)}
                />
              </div>
            </div>
          </div>
        </header>

        {(errorMessage || successMessage) && (
          <section
            className={`mt-4 rounded-[1.4rem] border-2 p-4 ${
              errorMessage
                ? "border-red-500/45 bg-red-50 text-red-800"
                : "border-green-500/45 bg-green-50 text-green-800"
            }`}
          >
            <p className="text-sm font-black leading-6">
              {errorMessage || successMessage}
            </p>
          </section>
        )}

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <SectionCard
            icon={<Store size={22} />}
            title="Datos básicos"
            description="Información principal del negocio. Estos datos se pueden ajustar en todos los planes."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Nombre del negocio"
                value={businessConfig.businessName}
                onChange={(value) => updateConfig("businessName", value)}
                placeholder={BRAND.name}
              />
              <TextInput
                label="Descripción corta"
                value={businessConfig.businessShortDescription}
                onChange={(value) =>
                  updateConfig("businessShortDescription", value)
                }
                placeholder="Menú y pedidos"
              />
              <TextInput
                label="WhatsApp principal"
                value={businessConfig.mainWhatsapp}
                onChange={(value) => updateConfig("mainWhatsapp", value)}
                placeholder="Ej: 58412xxxxxxx"
              />
              <TextInput
                label="WhatsApp delivery"
                value={businessConfig.deliveryWhatsapp}
                onChange={(value) => updateConfig("deliveryWhatsapp", value)}
                placeholder="Ej: 58412xxxxxxx"
              />
              <TextInput
                label="Nombre de ubicación en pedidos"
                value={businessConfig.locationLabel}
                onChange={(value) => updateConfig("locationLabel", value)}
                placeholder="Mesa, sede, local, dirección..."
                helper="Cambia cómo se llama la ubicación en los pedidos públicos e internos."
              />
            </div>

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={businessConfig.orderHelpWhatsappEnabled}
                onChange={(e) =>
                  setBusinessConfig((c) => ({
                    ...c,
                    orderHelpWhatsappEnabled: e.target.checked,
                  }))
                }
                className="mt-0.5 h-5 w-5 accent-[var(--brand-primary)]"
              />
              <span>
                <span className="block text-sm font-black uppercase tracking-[0.06em] text-[var(--brand-ink)]">
                  Botón “¿Dudas con tu pedido? Escríbenos”
                </span>
                <span className="mt-0.5 block text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                  Aparece junto a los pedidos recientes del cliente y en su
                  página de seguimiento: abre tu WhatsApp con un mensaje listo
                  que incluye el número de su pedido.
                </span>
              </span>
            </label>

            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={businessConfig.orderWhatsappStageButtonsEnabled}
                onChange={(e) =>
                  setBusinessConfig((c) => ({
                    ...c,
                    orderWhatsappStageButtonsEnabled: e.target.checked,
                  }))
                }
                className="mt-0.5 h-5 w-5 accent-[var(--brand-primary)]"
              />
              <span>
                <span className="block text-sm font-black uppercase tracking-[0.06em] text-[var(--brand-ink)]">
                  Botones de aviso por WhatsApp en el panel
                </span>
                <span className="mt-0.5 block text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                  Los botones Confirmar / Preparación / Avisar salida / Llegué
                  de las tarjetas del panel de Pedidos. Apágalos si tu equipo
                  no avisa por WhatsApp (el módulo Delivery los conserva).
                </span>
              </span>
            </label>
          </SectionCard>

          <SectionCard
            icon={<Store size={22} />}
            title="Tipo de negocio"
            defaultCollapsed
            description="Elige un preset y activamos los módulos recomendados para tu rubro. Puedes ajustar cada módulo abajo después."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_TYPE_PRESETS.map((preset) => {
                const selected = businessConfig.businessType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setBusinessConfig((current) => ({
                        ...current,
                        ...(preset.config as Partial<BusinessConfig>),
                        businessType: preset.id,
                        locationLabel: preset.locationLabel,
                      }))
                    }
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      selected
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink)] hover:border-[var(--brand-primary)]/50"
                    }`}
                  >
                    <p className="text-sm font-black uppercase tracking-[0.06em]">
                      {preset.label}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-bold text-[var(--brand-ink-2)]/55">
              La ubicación de los pedidos se llamará:{" "}
              <strong>{businessConfig.locationLabel}</strong>.
            </p>
          </SectionCard>

          <SectionCard
            icon={<Receipt size={22} />}
            title="Facturación fiscal (Venezuela)"
            defaultCollapsed
            description="IVA por producto e IGTF en divisas. El documento fiscal oficial lo emite tu máquina fiscal; aquí calculamos el desglose para el ticket."
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={businessConfig.fiscalEnabled}
                onChange={(e) =>
                  setBusinessConfig((c) => ({
                    ...c,
                    fiscalEnabled: e.target.checked,
                  }))
                }
                className="h-5 w-5 accent-[var(--brand-primary)]"
              />
              <span className="text-sm font-black uppercase tracking-[0.06em] text-[var(--brand-ink)]">
                Activar cálculo fiscal (IVA / IGTF)
              </span>
            </label>

            {businessConfig.fiscalEnabled && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="RIF">
                  <input
                    value={businessConfig.rifNumber}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        rifNumber: e.target.value,
                      }))
                    }
                    placeholder="J-12345678-9"
                    className={`w-full rounded-xl border-2 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)] ${
                      businessConfig.rifNumber &&
                      !isValidRif(businessConfig.rifNumber)
                        ? "border-red-400"
                        : "border-[var(--brand-primary)]/25"
                    }`}
                  />
                  {businessConfig.rifNumber &&
                    !isValidRif(businessConfig.rifNumber) && (
                      <p className="text-xs font-bold text-red-600">
                        Formato inválido. Ej: J-12345678-9 (una letra V/E/J/P/G
                        + 9 dígitos).
                      </p>
                    )}
                </Field>
                <Field label="Razón social">
                  <input
                    value={businessConfig.razonSocial}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        razonSocial: e.target.value,
                      }))
                    }
                    placeholder="Nombre fiscal del negocio"
                    className="w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                  />
                </Field>
                <Field label="Dirección fiscal">
                  <input
                    value={businessConfig.fiscalAddress}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        fiscalAddress: e.target.value,
                      }))
                    }
                    placeholder="Dirección registrada en el RIF"
                    className="w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                  />
                </Field>
                <Field label="IVA por defecto (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={businessConfig.ivaDefaultRate}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        ivaDefaultRate: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                  />
                </Field>

                <label className="flex items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={businessConfig.pricesIncludeIva}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        pricesIncludeIva: e.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[var(--brand-primary)]"
                  />
                  <span className="text-sm font-bold text-[var(--brand-ink)]">
                    Los precios del menú ya incluyen IVA (precio final al
                    público)
                  </span>
                </label>

                <label className="flex items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={businessConfig.igtfEnabled}
                    onChange={(e) =>
                      setBusinessConfig((c) => ({
                        ...c,
                        igtfEnabled: e.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[var(--brand-primary)]"
                  />
                  <span className="text-sm font-bold text-[var(--brand-ink)]">
                    Cobrar IGTF en pagos con divisas (efectivo USD)
                  </span>
                </label>

                {businessConfig.igtfEnabled && (
                  <Field label="Tasa de IGTF (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={businessConfig.igtfRate}
                      onChange={(e) =>
                        setBusinessConfig((c) => ({
                          ...c,
                          igtfRate: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                    />
                  </Field>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<Store size={22} />}
            title="Colores y vista previa"
            defaultCollapsed
            description="Edita colores y textos visibles desde el mismo lugar. La vista previa se actualiza en vivo y los cambios se publican cuando guardas."
          >
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-5">
                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Paletas rápidas
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                        Aplica una base completa y luego ajusta colores y textos.
                        La vista previa de la derecha cambia antes de guardar.
                      </p>
                    </div>
                    <span className="w-fit rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      Guardar publica
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
                    {VISUAL_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyVisualColorPreset(preset.values)}
                        className="rounded-[1.15rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3 text-left transition hover:border-[var(--brand-primary)]/60"
                      >
                        <span className="flex items-center gap-1.5">
                          {Object.values(preset.values)
                            .slice(0, 4)
                            .map((color) => (
                              <span
                                key={`${preset.id}-${color}`}
                                className="h-5 w-5 rounded-full border border-black/10"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                        </span>
                        <span className="mt-3 block text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/65">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Contenido conectado
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Los textos, títulos, descripciones, botones y categorías se editan
                    abajo en Información pública avanzada. Esta vista previa usa esos
                    mismos valores en vivo para que no existan textos fijos duplicados.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <a
                      href="#informacion-publica-avanzada"
                      className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                    >
                      Editar textos públicos
                    </a>
                    <a
                      href="#informacion-publica-avanzada"
                      className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                    >
                      Editar barra y categorías
                    </a>
                  </div>
                </div>

                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Colores principales
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Controlan la marca pública: bordes, botones, fondos y acentos.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
                    {(
                      [
                        ["themePrimaryColor", "Color principal"],
                        ["themeAccentColor", "Color de acento"],
                        ["themeCreamColor", "Color de fondo"],
                      ] as const
                    ).map(([key, label]) => (
                      <ColorField
                        key={key}
                        label={label}
                        value={businessConfig[key]}
                        onChange={(value) => updateConfig(key, value)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Colores de productos
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Cambian las tarjetas reales del menú público. La vista previa
                    ya no usa una tarjeta inventada para evitar confusión.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
                    {(
                      [
                        ["productCardBackgroundColor", "Fondo tarjeta"],
                        ["productCardTextColor", "Texto tarjeta"],
                        ["productCardBorderColor", "Borde y etiqueta"],
                        ["productCardButtonColor", "Botón y precio"],
                      ] as const
                    ).map(([key, label]) => (
                      <ColorField
                        key={key}
                        label={label}
                        value={businessConfig[key]}
                        onChange={(value) => updateConfig(key, value)}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className={`rounded-[1.2rem] border-2 p-3 ${cardTextContrastStatus.className}`}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em]">
                      Legibilidad de tarjetas
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {cardTextContrastStatus.label}
                    </p>
                    <p className="mt-1 text-[0.7rem] font-bold leading-4 opacity-80">
                      Ratio {cardTextContrastRatio.toFixed(1)}:1 · {cardTextContrastStatus.description}
                    </p>
                  </div>
                  <div className={`rounded-[1.2rem] border-2 p-3 ${cardButtonContrastStatus.className}`}>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em]">
                      Legibilidad de botones
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {cardButtonContrastStatus.label}
                    </p>
                    <p className="mt-1 text-[0.7rem] font-bold leading-4 opacity-80">
                      Ratio {cardButtonContrastRatio.toFixed(1)}:1 · {cardButtonContrastStatus.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4 2xl:sticky 2xl:top-24 2xl:self-start">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Vista previa en vivo
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                      Muestra portada, buscador y categorías con los textos y
                      colores actuales. No incluye bloques fijos de ejemplo.
                    </p>
                  </div>
                  <span className="w-fit rounded-full border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    Público
                  </span>
                </div>

                <div
                  className="mt-4 overflow-hidden rounded-[1.6rem] border-2 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]"
                  style={{
                    backgroundColor: businessConfig.themeCreamColor,
                    borderColor: businessConfig.themePrimaryColor,
                    color: businessConfig.productCardTextColor,
                  }}
                >
                  <div
                    className="border-b-2 bg-white px-4 py-4"
                    style={{ borderColor: `${businessConfig.themePrimaryColor}22` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-[0.58rem] font-black uppercase"
                        style={{
                          backgroundColor: businessConfig.themeAccentColor,
                          borderColor: businessConfig.themePrimaryColor,
                          color: businessConfig.themePrimaryColor,
                        }}
                      >
                        Logo
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate text-lg font-black uppercase leading-none"
                          style={{ color: businessConfig.themePrimaryColor }}
                        >
                          {businessConfig.businessName || BRAND.name}
                        </p>
                        <p className="mt-1 truncate text-xs font-black opacity-75">
                          Menú y pedidos
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex overflow-hidden rounded-[1.2rem] border-2 bg-white">
                      {normalizePublicNavButtons(businessConfig.publicNavButtons)
                        .filter((button) => button.isVisible !== false)
                        .slice(0, 5)
                        .map((button) => (
                          <span
                            key={button.id}
                            className="min-w-0 flex-1 border-r-2 px-1 py-3 text-center text-[0.54rem] font-black uppercase tracking-[0.05em] last:border-r-0"
                            style={{
                              borderColor: `${businessConfig.themePrimaryColor}22`,
                              color: businessConfig.themePrimaryColor,
                            }}
                          >
                            <span className="block truncate">{button.label}</span>
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div
                      className="rounded-[1.35rem] border-2 p-4"
                      style={{
                        backgroundColor: businessConfig.productCardBackgroundColor,
                        borderColor: businessConfig.themePrimaryColor,
                        color: businessConfig.productCardTextColor,
                      }}
                    >
                      <span
                        className="inline-flex max-w-full rounded-full border-2 px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.12em]"
                        style={{
                          backgroundColor: businessConfig.themeAccentColor,
                          borderColor: businessConfig.themePrimaryColor,
                          color: businessConfig.themePrimaryColor,
                        }}
                      >
                        <span className="truncate">
                          {businessConfig.publicTagline || "Página pública"}
                        </span>
                      </span>
                      <h3
                        className="mt-3 text-2xl font-black uppercase leading-none"
                        style={{ color: businessConfig.themePrimaryColor }}
                      >
                        {businessConfig.publicMenuTitle || "Elige tu pedido"}
                      </h3>
                      <p className="mt-2 text-xs font-bold leading-5 opacity-80">
                        {businessConfig.publicMenuText || businessConfig.businessShortDescription}
                      </p>
                    </div>

                    <div
                      className="rounded-[1.2rem] border-2 bg-white p-3"
                      style={{ borderColor: `${businessConfig.themePrimaryColor}22` }}
                    >
                      <div
                        className="rounded-full border-2 px-4 py-3 text-xs font-bold opacity-70"
                        style={{
                          borderColor: `${businessConfig.themePrimaryColor}55`,
                          color: businessConfig.productCardTextColor,
                        }}
                      >
                        {businessConfig.publicMenuSearchPlaceholder ||
                          "Buscar productos, combos o adicionales"}
                      </div>
                    </div>

                    <div
                      className="rounded-[1.2rem] border-2 bg-white p-3"
                      style={{ borderColor: `${businessConfig.themePrimaryColor}22` }}
                    >
                      <p
                        className="text-[0.62rem] font-black uppercase tracking-[0.16em]"
                        style={{ color: businessConfig.themePrimaryColor }}
                      >
                        Categorías
                      </p>
                      <div className="mt-3 flex gap-2 overflow-hidden">
                        {[
                          "Todos",
                          "Favoritos",
                          ...publicCategoryOptions
                            .filter(
                              (category) =>
                                !hiddenPublicCategoryKeys.has(
                                  normalizeComparableText(category),
                                ),
                            )
                            .slice(0, 3),
                        ].map((label, index) => (
                          <span
                            key={`${label}-${index}`}
                            className="shrink-0 rounded-full border-2 px-3 py-2 text-[0.58rem] font-black uppercase tracking-[0.08em]"
                            style={{
                              backgroundColor:
                                index === 0
                                  ? businessConfig.themeAccentColor
                                  : businessConfig.productCardBackgroundColor,
                              borderColor:
                                index === 0
                                  ? businessConfig.themePrimaryColor
                                  : `${businessConfig.productCardBorderColor}55`,
                              color:
                                index === 0
                                  ? businessConfig.productCardTextColor
                                  : businessConfig.themePrimaryColor,
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className="rounded-[1.2rem] border-2 p-3"
                      style={{
                        backgroundColor: businessConfig.productCardBackgroundColor,
                        borderColor: `${businessConfig.productCardBorderColor}66`,
                        color: businessConfig.productCardTextColor,
                      }}
                    >
                      <p
                        className="text-[0.62rem] font-black uppercase tracking-[0.16em]"
                        style={{ color: businessConfig.productCardBorderColor }}
                      >
                        Textos conectados
                      </p>
                      <div className="mt-2 space-y-2 text-xs font-bold leading-5 opacity-85">
                        <p>
                          <span className="font-black">{businessConfig.publicComboTitle || "Combos disponibles"}</span>
                          {" · "}
                          {businessConfig.publicComboButtonText || "Ver combos"}
                        </p>
                        <p>
                          {businessConfig.publicComboText ||
                            "Los combos se manejan en divisas para mantener precios claros."}
                        </p>
                        <p>
                          <span className="font-black">{businessConfig.publicInfoTitle || "Información final"}</span>
                          {" · "}
                          {businessConfig.scheduleTitle || "Horario"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<ShieldCheck size={22} />}
            title="Plan activo"
            defaultCollapsed
            description="El dueño ve su plan. Soporte puede cambiar el plan o activar una combinación personalizada de módulos."
          >
            <div className="grid gap-4">
              <div className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black uppercase text-[var(--brand-primary)]">
                    {activePlan.label}
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    {canEditPlan ? "Soporte" : "Dueño"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  {activePlan.description}
                </p>
                <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]/70">
                  {businessConfig.membershipPlanMode === "custom"
                    ? "Configuración personalizada por soporte"
                    : "Plan fijo configurado por soporte"}
                </p>
              </div>

              {canEditPlan ? (
                <div className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Control de soporte
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Estos cambios se guardan solo cuando entras con clave de
                    soporte. El dueño no puede subir ni bajar su plan desde esta
                    pantalla.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Plan del cliente
                      </label>
                      <select
                        value={businessConfig.membershipPlan}
                        onChange={(event) =>
                          updatePlanForSupport(
                            event.target.value as LocalPlanKey,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-black text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                      >
                        {LOCAL_PLAN_DEFINITIONS.map((plan) => (
                          <option key={plan.key} value={plan.key}>
                            {plan.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Modo de módulos
                      </label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <ModeButton
                          label="Plan fijo"
                          description="Usa exactamente el plan seleccionado."
                          active={businessConfig.membershipPlanMode === "plan"}
                          onClick={() => updatePlanModeForSupport("plan")}
                        />
                        <ModeButton
                          label="Personalizado"
                          description="Permite incluir o bloquear módulos puntuales."
                          active={
                            businessConfig.membershipPlanMode === "custom"
                          }
                          onClick={() => updatePlanModeForSupport("custom")}
                        />
                      </div>
                    </div>
                  </div>

                  {businessConfig.membershipPlanMode === "custom" && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[1.2rem] border-2 border-green-500/25 bg-green-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-green-800">
                          Incluir además
                        </p>
                        <div className="mt-3 grid max-h-[340px] gap-2 overflow-auto pr-1">
                          {visibleSupportModules.map((moduleItem) => (
                            <button
                              key={`include-${moduleItem.moduleKey}`}
                              type="button"
                              onClick={() =>
                                toggleCustomModuleForSupport(
                                  moduleItem.moduleKey,
                                  "customIncludedModules",
                                )
                              }
                              className={`rounded-2xl border-2 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.08em] transition ${
                                businessConfig.customIncludedModules.includes(
                                  moduleItem.moduleKey,
                                )
                                  ? "border-green-600 bg-white text-green-800"
                                  : "border-green-500/20 bg-white/65 text-[var(--brand-ink)]/65 hover:border-green-500"
                              }`}
                            >
                              {moduleItem.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border-2 border-red-500/25 bg-red-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-red-800">
                          Bloquear del plan
                        </p>
                        <div className="mt-3 grid max-h-[340px] gap-2 overflow-auto pr-1">
                          {visibleSupportModules.map((moduleItem) => (
                            <button
                              key={`block-${moduleItem.moduleKey}`}
                              type="button"
                              onClick={() =>
                                toggleCustomModuleForSupport(
                                  moduleItem.moduleKey,
                                  "customBlockedModules",
                                )
                              }
                              className={`rounded-2xl border-2 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.08em] transition ${
                                businessConfig.customBlockedModules.includes(
                                  moduleItem.moduleKey,
                                )
                                  ? "border-red-600 bg-white text-red-800"
                                  : "border-red-500/20 bg-white/65 text-[var(--brand-ink)]/65 hover:border-red-500"
                              }`}
                            >
                              {moduleItem.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3">
                  <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Para cambiar el plan o desbloquear módulos personalizados,
                    entra con la clave de soporte.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Building2 size={22} />}
            title="Sedes y sucursales"
            description="Revisa y edita lo básico de las sucursales conectadas al sistema sin tocar pedidos, caja ni cierres."
            locked={!canEditBranches}
            lockedText="Soporte puede revisar las sedes, pero solo el dueño puede crear, renombrar o activar sucursales."
          >
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {activeBranches.length} activas
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {inactiveBranchesCount} inactivas
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {branches.length} registradas
                    </span>
                  </div>

                  {branchesWarning && (
                    <p className="mt-3 text-sm font-black leading-6 text-[var(--brand-amber)]">
                      {branchesWarning}
                    </p>
                  )}

                  {branchesMessage && (
                    <p className="mt-3 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-sm font-black leading-5 text-[var(--brand-amber)]">
                      {branchesMessage}
                    </p>
                  )}

                  <p className="mt-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                    Cada sucursal conserva sus propios pedidos, menú,
                    inventario, caja y reportes. Desde Configuración solo se
                    edita nombre, creación y estado activo/inactivo; la
                    eliminación queda en el gestor dedicado para evitar borrados
                    accidentales.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => loadBranches(adminPassword)}
                    disabled={isLoadingBranches || isSavingBranches}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                  >
                    {isLoadingBranches ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Actualizar sedes
                  </button>

                  <Link
                    href="/local-santo/sucursales"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                  >
                    <Building2 size={16} />
                    Gestor completo
                  </Link>
                </div>
              </div>

              <div
                className={`grid gap-3 ${!canEditBranches ? "opacity-65" : ""}`}
              >
                <div className="grid gap-3 rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <TextInput
                    label="Nueva sucursal"
                    value={newBranchName}
                    onChange={setNewBranchName}
                    placeholder="Ejemplo: Sede principal"
                    disabled={!canEditBranches || isSavingBranches}
                  />

                  <button
                    type="button"
                    onClick={createBranchFromConfig}
                    disabled={
                      !canEditBranches ||
                      isSavingBranches ||
                      !newBranchName.trim()
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingBranches ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Crear sede
                  </button>
                </div>

                {branches.length > 0 ? (
                  <div className="grid gap-3">
                    {branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                      >
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                          <TextInput
                            label="Nombre de sucursal"
                            value={branch.name}
                            onChange={(value) =>
                              setBranches((currentBranches) =>
                                currentBranches.map((currentBranch) =>
                                  currentBranch.id === branch.id
                                    ? { ...currentBranch, name: value }
                                    : currentBranch,
                                ),
                              )
                            }
                            placeholder="Nombre de la sede"
                            disabled={!canEditBranches || isSavingBranches}
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateBranchFromConfig(branch.id, {
                                  name: branch.name.trim(),
                                })
                              }
                              disabled={
                                !canEditBranches ||
                                isSavingBranches ||
                                !branch.name.trim()
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save size={16} />
                              Guardar nombre
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateBranchFromConfig(branch.id, {
                                  is_active: branch.is_active === false,
                                })
                              }
                              disabled={!canEditBranches || isSavingBranches}
                              className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                branch.is_active
                                  ? "border-green-500/35 bg-green-50 text-green-700"
                                  : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"
                              }`}
                            >
                              {branch.is_active ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <XCircle size={16} />
                              )}
                              {branch.is_active ? "Activa" : "Inactiva"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                    No hay sucursales cargadas todavía o no se pudieron leer en
                    este momento.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Truck size={22} />}
            title="Envío por distancia"
            defaultCollapsed
            description="El cliente comparte su ubicación de Google Maps y el costo del delivery se calcula solo por kilómetros, con los rangos que definas aquí."
            locked={!canEditDeliveryZones}
            lockedText={
              accessRole === "support"
                ? "Soporte puede revisar esta sección, pero el envío por distancia lo guarda el dueño con su clave."
                : deliveryAccess.lockedByPlan
                  ? `Disponible desde ${deliveryAccess.minimumPlanLabel}.`
                  : "Delivery está desactivado desde Módulos del negocio. Actívalo para configurar el envío por distancia."
            }
          >
            <div
              className={`grid gap-4 ${!canEditDeliveryZones ? "opacity-65" : ""}`}
            >
              <DeliveryDistanceConfigCard canEdit={canEditDeliveryZones} />
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Table2 size={22} />}
            title="Mesas y QR"
            defaultCollapsed
            description="Edita las mesas reales que aparecen en el carrito público, el panel de mesas y las tarjetas QR por mesa."
            locked={!canEditTables}
            lockedText={`Disponible desde ${tablesAccess.minimumPlanLabel}. La lista se muestra para revisión, pero solo se guarda si el plan incluye mesas.`}
          >
            <div className={`grid gap-4 ${!canEditTables ? "opacity-65" : ""}`}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {activeLocalTables.length} activas
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {inactiveLocalTablesCount} inactivas
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {businessConfig.localTables.length ||
                        DEFAULT_CONFIG_LOCAL_TABLES.length}{" "}
                      registradas
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Estos nombres son los que verá el cliente al pedir desde
                    mesa y los que usa el sistema para relacionar pedidos,
                    cuentas abiertas y QR. Para ocultar una mesa sin perderla,
                    déjala inactiva.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={addLocalTableConfig}
                    disabled={!canEditTables}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Agregar mesa
                  </button>

                  <button
                    type="button"
                    onClick={restoreDefaultLocalTables}
                    disabled={!canEditTables}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={16} />
                    Restaurar base
                  </button>

                  <Link
                    href="/local-santo/mesas"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <Table2 size={16} />
                    Ver QR
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                {(businessConfig.localTables.length
                  ? businessConfig.localTables
                  : DEFAULT_CONFIG_LOCAL_TABLES
                ).map((table, index, tableList) => (
                  <div
                    key={`${table.id || table.name || "mesa"}-${index}`}
                    className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1.15fr_0.9fr_120px_auto] lg:items-end">
                      <TextInput
                        label="Nombre de mesa"
                        value={table.name || ""}
                        onChange={(value) =>
                          updateLocalTableConfig(index, { name: value })
                        }
                        placeholder="Mesa 1"
                        disabled={!canEditTables}
                      />

                      <TextInput
                        label="Área"
                        value={table.area || "Principal"}
                        onChange={(value) =>
                          updateLocalTableConfig(index, { area: value })
                        }
                        placeholder="Principal, terraza, barra..."
                        disabled={!canEditTables}
                      />

                      <TextInput
                        label="Orden"
                        type="number"
                        value={Number(table.sortOrder || index + 1)}
                        onChange={(value) =>
                          updateLocalTableConfig(index, {
                            sortOrder:
                              Number.isFinite(Number(value)) &&
                              Number(value) > 0
                                ? Math.round(Number(value))
                                : index + 1,
                          })
                        }
                        placeholder="1"
                        disabled={!canEditTables}
                      />

                      <button
                        type="button"
                        onClick={() => removeLocalTableConfig(index)}
                        disabled={!canEditTables || tableList.length <= 1}
                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                        Quitar
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                      <TextInput
                        label="Nota interna"
                        value={table.note || ""}
                        onChange={(value) =>
                          updateLocalTableConfig(index, { note: value })
                        }
                        placeholder="Opcional: cerca de caja, terraza, reservada..."
                        disabled={!canEditTables}
                      />

                      <label className="flex items-center gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                        <input
                          type="checkbox"
                          checked={table.isActive !== false}
                          disabled={!canEditTables}
                          onChange={(event) =>
                            updateLocalTableConfig(index, {
                              isActive: event.target.checked,
                            })
                          }
                          className="h-5 w-5 accent-[var(--brand-primary)] disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                          Mesa activa
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Grid2X2 size={22} />}
            title="Módulos del negocio"
            description="Puedes activar o desactivar los módulos incluidos en tu plan. Los no incluidos quedan visibles con candado y no se pueden activar desde aquí."
          >
            <div className="mb-4 rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                    Activación rápida
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Activa de una vez todos los módulos reales disponibles en el plan actual.
                    Los módulos futuros siguen ocultos hasta que tengan pantalla lista.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={activateAvailablePlanModules}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  <CheckCircle2 size={16} />
                  Activar disponibles
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {visibleOwnerModules.map((moduleItem) => (
                <ModuleToggleCard
                  key={moduleItem.moduleKey}
                  moduleItem={moduleItem}
                  checked={getModuleCheckedValue(businessConfig, moduleItem)}
                  onChange={(value) => updateModuleValue(moduleItem, value)}
                  icon={
                    MODULE_ICON_BY_KEY[moduleItem.moduleKey] || (
                      <Settings2 size={18} />
                    )
                  }
                />
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Store size={22} />}
            title="Productos del menú"
            description="Acceso directo para crear productos con foto, precio, categoría, descripción, disponibilidad y estado destacado."
            locked={!canEditMenuProducts}
            lockedText={`Disponible desde ${menuProductsAccess.minimumPlanLabel}. Si el módulo no está incluido o está apagado, el dueño no podrá editar el menú desde esta sección.`}
          >
            <div
              className={`grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center ${!canEditMenuProducts ? "opacity-65" : ""}`}
            >
              <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Editor operativo
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Desde aquí el dueño puede agregar productos nuevos, subir o
                  pegar una imagen, cambiar precios, categorías, descripción,
                  orden, visibilidad y marcado como destacado. Si el módulo se
                  apaga, la página pública mantiene el menú guardado y no se
                  rompe la venta.
                </p>
              </div>

              <Link
                href="/local-santo/menu"
                className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-6 py-4 text-xs font-black uppercase tracking-[0.12em] transition ${
                  canEditMenuProducts
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                    : "pointer-events-none border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]/45"
                }`}
              >
                <Store size={18} />
                Abrir productos
              </Link>
            </div>
          </SectionCard>
        </section>

        <section id="informacion-publica-avanzada" className="mt-4 scroll-mt-24">
          <SectionCard
            icon={<Store size={22} />}
            title="Información pública avanzada"
            defaultCollapsed
            description="Edita lo que sí se ve hoy en la página pública: textos principales, menú, botones superiores, categorías, destacados y contacto."
            locked={!canEditAdvancedPublic}
            lockedText={`Disponible desde ${advancedPublicAccess.minimumPlanLabel}. Solicita activación para editar títulos, horarios, ubicación y textos públicos desde aquí.`}
          >
            <div
              className={`grid gap-4 sm:grid-cols-2 ${!canEditAdvancedPublic ? "opacity-65" : ""}`}
            >
              <TextInput
                label="Frase principal pública"
                value={businessConfig.publicTagline}
                onChange={(value) => updateConfig("publicTagline", value)}
                placeholder="Smash Burgers, Combos y Sides"
                disabled={!canEditAdvancedPublic}
              />
              <TextInput
                label="Título de información"
                value={businessConfig.publicInfoTitle}
                onChange={(value) => updateConfig("publicInfoTitle", value)}
                placeholder={`Visita ${BRAND.name}`}
                disabled={!canEditAdvancedPublic}
              />
              <TextAreaInput
                label="Texto informativo"
                value={businessConfig.publicInfoText}
                onChange={(value) => updateConfig("publicInfoText", value)}
                placeholder="Texto visible en la página pública"
                disabled={!canEditAdvancedPublic}
              />
              <div className="grid gap-4">
                <TextInput
                  label="Título horario"
                  value={businessConfig.scheduleTitle}
                  onChange={(value) => updateConfig("scheduleTitle", value)}
                  placeholder="Horario"
                  disabled={!canEditAdvancedPublic}
                />
                <TextInput
                  label="Horario línea 1"
                  value={businessConfig.scheduleLine1}
                  onChange={(value) => updateConfig("scheduleLine1", value)}
                  placeholder="Lunes a jueves..."
                  disabled={!canEditAdvancedPublic}
                />
                <TextInput
                  label="Horario línea 2"
                  value={businessConfig.scheduleLine2}
                  onChange={(value) => updateConfig("scheduleLine2", value)}
                  placeholder="Viernes a domingos..."
                  disabled={!canEditAdvancedPublic}
                />
              </div>
              <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                  Textos del menú público
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                  Edita aquí los textos visibles de la sección de productos y
                  del selector de ingredientes.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="Etiqueta superior del menú"
                    value={businessConfig.publicMenuEyebrow}
                    onChange={(value) =>
                      updateConfig("publicMenuEyebrow", value)
                    }
                    placeholder={`Menú ${BRAND.name}`}
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Título del menú"
                    value={businessConfig.publicMenuTitle}
                    onChange={(value) => updateConfig("publicMenuTitle", value)}
                    placeholder="Elige tu pedido"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Texto bajo el título"
                    value={businessConfig.publicMenuText}
                    onChange={(value) => updateConfig("publicMenuText", value)}
                    placeholder="Texto informativo del menú"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Buscador del menú"
                    value={businessConfig.publicMenuSearchPlaceholder}
                    onChange={(value) =>
                      updateConfig("publicMenuSearchPlaceholder", value)
                    }
                    placeholder="Buscar productos, combos o adicionales"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Título del bloque de combos"
                    value={businessConfig.publicComboTitle}
                    onChange={(value) =>
                      updateConfig("publicComboTitle", value)
                    }
                    placeholder="Combos disponibles"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Texto del bloque de combos"
                    value={businessConfig.publicComboText}
                    onChange={(value) => updateConfig("publicComboText", value)}
                    placeholder="Los combos se manejan en divisas..."
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Botón del bloque de combos"
                    value={businessConfig.publicComboButtonText}
                    onChange={(value) =>
                      updateConfig("publicComboButtonText", value)
                    }
                    placeholder="Ver combos"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Botón de producto configurable"
                    value={businessConfig.publicCustomizeButtonText}
                    onChange={(value) =>
                      updateConfig("publicCustomizeButtonText", value)
                    }
                    placeholder="Elige tus ingredientes"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Título del selector de ingredientes"
                    value={businessConfig.publicCustomizerTitle}
                    onChange={(value) =>
                      updateConfig("publicCustomizerTitle", value)
                    }
                    placeholder="Elige tus ingredientes"
                    disabled={!canEditAdvancedPublic}
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                  Textos del carrito
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                  Título, totales, botones y etiquetas que ve el cliente dentro
                  del carrito público.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <TextInput
                    label="Título del carrito"
                    value={businessConfig.publicCartTitle}
                    onChange={(value) => updateConfig("publicCartTitle", value)}
                    placeholder="Tu pedido"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Etiqueta del total"
                    value={businessConfig.publicCartTotalLabel}
                    onChange={(value) => updateConfig("publicCartTotalLabel", value)}
                    placeholder="Total a cobrar"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Texto bajo el total"
                    value={businessConfig.publicCartTotalHint}
                    onChange={(value) => updateConfig("publicCartTotalHint", value)}
                    placeholder="Total general en divisas"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Botón de pedido local"
                    value={businessConfig.publicCartLocalOrderButtonText}
                    onChange={(value) =>
                      updateConfig("publicCartLocalOrderButtonText", value)
                    }
                    placeholder="Registrar pedido local"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Botón de WhatsApp"
                    value={businessConfig.publicCartWhatsappButtonText}
                    onChange={(value) =>
                      updateConfig("publicCartWhatsappButtonText", value)
                    }
                    placeholder="Enviar por WhatsApp"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Etiqueta de disponibilidad"
                    value={businessConfig.publicAvailabilityLabel}
                    onChange={(value) =>
                      updateConfig("publicAvailabilityLabel", value)
                    }
                    placeholder="Disponible"
                    disabled={!canEditAdvancedPublic}
                  />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/70">
                      Tamaño de las tarjetas del menú
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          value: "grande",
                          label: "Grande",
                          hint: "1 producto por fila en el teléfono, foto protagonista (actual)",
                        },
                        {
                          value: "media",
                          label: "Media",
                          hint: "2 por fila en el teléfono: se ve más menú sin perder la foto",
                        },
                        {
                          value: "compacta",
                          label: "Compacta",
                          hint: "3 por fila en el teléfono, tipo catálogo rápido",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateConfig("publicProductCardSize", option.value)
                          }
                          className={`rounded-xl border-2 px-3 py-3 text-left transition ${
                            businessConfig.publicProductCardSize === option.value
                              ? "border-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.1)]"
                              : "border-[var(--brand-primary)]/25 bg-white hover:border-[var(--brand-primary)]/60"
                          }`}
                        >
                          <span className="block text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-[0.66rem] font-bold leading-4 text-[var(--brand-ink-2)]/60">
                            {option.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/70">
                      Métodos de pago del carrito (uno por línea)
                    </label>
                    <textarea
                      value={businessConfig.publicPaymentMethods.join("\n")}
                      onChange={(event) =>
                        updateConfig(
                          "publicPaymentMethods",
                          event.target.value.split("\n"),
                        )
                      }
                      rows={4}
                      placeholder={DEFAULT_PUBLIC_PAYMENT_METHODS.join("\n")}
                      className="mt-2 w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                    />
                    <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                      Opciones que el cliente elige al pagar en el carrito público
                      (ej. Pago móvil, Zelle, Efectivo). Si lo dejas vacío se usan
                      las opciones estándar.
                    </p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/70">
                      Datos de pago que ve el cliente (opcional)
                    </label>
                    <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                      Escribe los datos de los métodos que quieras (número de pago
                      móvil, correo de Zelle…), una línea por dato. El cliente los
                      verá en botones desplegables &quot;Ver datos de…&quot; con
                      opción de copiar, en el carrito y al registrar su pedido.
                      Tú decides cuáles se muestran: los métodos que dejes vacíos
                      (ej. Efectivo) no muestran ningún botón.
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {businessConfig.publicPaymentMethods.map((method) => (
                        <div key={method}>
                          <label className="text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60">
                            Datos de {method}
                          </label>
                          <textarea
                            value={
                              businessConfig.publicPaymentMethodDetails?.[
                                method
                              ] || ""
                            }
                            onChange={(event) => {
                              const nextDetails = {
                                ...(businessConfig.publicPaymentMethodDetails ||
                                  {}),
                              };
                              if (event.target.value.trim()) {
                                nextDetails[method] = event.target.value;
                              } else {
                                delete nextDetails[method];
                              }
                              updateConfig(
                                "publicPaymentMethodDetails",
                                nextDetails,
                              );
                            }}
                            rows={3}
                            placeholder={"Banco: Banesco\nTeléfono: 0412-0000000\nCI: V-12.345.678"}
                            className="mt-1.5 w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/70">
                      Cupones de descuento (código y porcentaje por línea)
                    </label>
                    <textarea
                      value={businessConfig.publicCoupons.join("\n")}
                      onChange={(event) =>
                        updateConfig("publicCoupons", event.target.value.split("\n"))
                      }
                      rows={3}
                      placeholder={"BIENVENIDO10 10\nFERIA15 15"}
                      className="mt-2 w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                    />
                    <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                      El cliente escribe el código en el carrito y se le descuenta ese
                      porcentaje del pedido. Borra la línea para desactivar un cupón.
                      Los códigos no se muestran en el sitio: compártelos tú (Instagram,
                      volantes, ferias).
                    </p>
                  </div>
                  <TextInput
                    label="Título del grupo en divisas"
                    value={businessConfig.publicDivisaGroupTitle}
                    onChange={(value) =>
                      updateConfig("publicDivisaGroupTitle", value)
                    }
                    placeholder="Combos"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Nota del grupo en divisas"
                    value={businessConfig.publicDivisaOnlyNote}
                    onChange={(value) =>
                      updateConfig("publicDivisaOnlyNote", value)
                    }
                    placeholder="Pago solo en divisas"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Etiqueta corta en divisas"
                    value={businessConfig.publicDivisaOnlyBadge}
                    onChange={(value) =>
                      updateConfig("publicDivisaOnlyBadge", value)
                    }
                    placeholder="Solo divisas"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Título de productos normales"
                    value={businessConfig.publicRegularGroupTitle}
                    onChange={(value) =>
                      updateConfig("publicRegularGroupTitle", value)
                    }
                    placeholder="Productos normales"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Título de carrito vacío"
                    value={businessConfig.publicCartEmptyTitle}
                    onChange={(value) => updateConfig("publicCartEmptyTitle", value)}
                    placeholder="Tu carrito está vacío"
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Texto de carrito vacío"
                    value={businessConfig.publicCartEmptyText}
                    onChange={(value) => updateConfig("publicCartEmptyText", value)}
                    placeholder="Agrega productos del menú para preparar tu pedido."
                    disabled={!canEditAdvancedPublic}
                  />
                  <TextInput
                    label="Botón de carrito vacío"
                    value={businessConfig.publicCartEmptyButtonText}
                    onChange={(value) =>
                      updateConfig("publicCartEmptyButtonText", value)
                    }
                    placeholder="Ver menú"
                    disabled={!canEditAdvancedPublic}
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Barra superior pública
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                      Elige qué botones aparecen arriba, el texto y a dónde llevan. El carrito sigue siendo independiente.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetPublicNavButtons}
                    disabled={!canEditAdvancedPublic}
                    className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Restaurar botones
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {normalizePublicNavButtons(businessConfig.publicNavButtons).map(
                    (button, index) => (
                      <div
                        key={button.id}
                        className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-white p-3"
                      >
                        <div className="grid gap-3 lg:grid-cols-[auto_1fr_170px_1.2fr_90px] lg:items-end">
                          <label className="flex items-center gap-3 rounded-2xl bg-[var(--brand-cream)] px-3 py-3">
                            <input
                              type="checkbox"
                              checked={button.isVisible !== false}
                              disabled={!canEditAdvancedPublic}
                              onChange={(event) =>
                                updatePublicNavButton(index, {
                                  isVisible: event.target.checked,
                                })
                              }
                              className="h-5 w-5 accent-[var(--brand-primary)] disabled:cursor-not-allowed"
                            />
                            <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                              Visible
                            </span>
                          </label>

                          <TextInput
                            label="Texto"
                            value={button.label}
                            onChange={(value) =>
                              updatePublicNavButton(index, { label: value })
                            }
                            placeholder="Ej: Ver cuenta"
                            disabled={!canEditAdvancedPublic}
                          />

                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Tipo
                            </label>
                            <select
                              value={button.kind}
                              disabled={!canEditAdvancedPublic}
                              onChange={(event) =>
                                updatePublicNavButton(index, {
                                  kind: event.target.value as PublicNavButtonKind,
                                })
                              }
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#f3ead7] disabled:text-[var(--brand-ink)]/50"
                            >
                              <option value="section">Sección interna</option>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="instagram">Instagram</option>
                              <option value="url">URL personalizada</option>
                            </select>
                          </div>

                          <TextInput
                            label="Destino"
                            value={button.target}
                            onChange={(value) =>
                              updatePublicNavButton(index, { target: value })
                            }
                            placeholder="#menu, #abrir-cuenta o https://..."
                            helper={
                              button.kind === "whatsapp"
                                ? "Usa el WhatsApp configurado del negocio."
                                : button.kind === "instagram"
                                  ? "Usa el Instagram configurado del negocio."
                                  : "Ejemplos: #inicio, #menu, #abrir-cuenta, /ruta o https://..."
                            }
                            disabled={
                              !canEditAdvancedPublic ||
                              button.kind === "whatsapp" ||
                              button.kind === "instagram"
                            }
                          />

                          <TextInput
                            label="Orden"
                            type="number"
                            value={button.sortOrder}
                            onChange={(value) =>
                              updatePublicNavButton(index, {
                                sortOrder:
                                  Number.isFinite(Number(value)) && Number(value) > 0
                                    ? Math.round(Number(value))
                                    : index + 1,
                              })
                            }
                            placeholder="1"
                            disabled={!canEditAdvancedPublic}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Orden de categorías públicas
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                      Todos y Favoritos siempre se quedan primero. Aquí controlas lo que aparece después.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadAvailableProducts()}
                      disabled={!canEditAdvancedPublic || isLoadingProducts}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoadingProducts ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Actualizar
                    </button>

                    <button
                      type="button"
                      onClick={resetPublicCategoryOrder}
                      disabled={!canEditAdvancedPublic}
                      className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restaurar orden
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {publicCategoryOptions.map((category, index) => {
                    const isVisible = !hiddenPublicCategoryKeys.has(
                      normalizeComparableText(category),
                    )

                    return (
                      <div
                        key={category}
                        className="grid gap-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-white p-3 sm:grid-cols-[1fr_auto_120px] sm:items-center"
                      >
                        <div>
                          <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                            {category}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/55">
                            Aparece después de Todos y Favoritos en la página pública.
                          </p>
                        </div>

                        <label className="flex items-center gap-3 rounded-2xl bg-[var(--brand-cream)] px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            disabled={!canEditAdvancedPublic}
                            onChange={(event) =>
                              togglePublicCategoryVisibility(
                                category,
                                event.target.checked,
                              )
                            }
                            className="h-5 w-5 accent-[var(--brand-primary)] disabled:cursor-not-allowed"
                          />
                          <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                            Visible
                          </span>
                        </label>

                        <TextInput
                          label="Orden"
                          type="number"
                          value={index + 1}
                          onChange={(value) =>
                            updatePublicCategoryOrder(
                              category,
                              Number.isFinite(Number(value)) && Number(value) > 0
                                ? Number(value)
                                : index + 1,
                            )
                          }
                          placeholder="1"
                          disabled={!canEditAdvancedPublic}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <TextInput
                label="Texto botón ubicación"
                value={businessConfig.locationButtonText}
                onChange={(value) => updateConfig("locationButtonText", value)}
                placeholder="Abrir ubicación"
                disabled={!canEditAdvancedPublic}
              />
              <TextInput
                label="Link de Google Maps"
                value={businessConfig.googleMapsUrl}
                onChange={(value) => updateConfig("googleMapsUrl", value)}
                placeholder="https://maps.google.com/..."
                disabled={!canEditAdvancedPublic}
              />
              <TextInput
                label="Link de reseñas de Google"
                value={businessConfig.googleReviewUrl}
                onChange={(value) => updateConfig("googleReviewUrl", value)}
                placeholder="https://g.page/r/.../review"
                disabled={!canEditAdvancedPublic}
              />
              <TextInput
                label="Instagram"
                value={businessConfig.instagramUrl}
                onChange={(value) => updateConfig("instagramUrl", value)}
                placeholder="https://www.instagram.com/..."
                disabled={!canEditAdvancedPublic}
              />
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Grid2X2 size={22} />}
            title="Promoción pública"
            defaultCollapsed
            description="Configura una promoción visible en la página pública. Puede ser una oferta general o estar relacionada con un producto o combo del menú editable."
            locked={!canEditPromotion}
            lockedText={`Disponible desde ${promotionAccess.minimumPlanLabel}. La sección queda visible para que el negocio sepa que puede desbloquear promociones al subir de plan.`}
          >
            <div
              className={`grid gap-4 lg:grid-cols-[0.82fr_1.18fr] ${!canEditPromotion ? "opacity-65" : ""}`}
            >
              <div className="grid gap-3">
                <ToggleRow
                  label="Módulo de promociones"
                  description="Permite que la página pública pueda mostrar promociones configuradas desde este panel."
                  checked={businessConfig.promotionModuleEnabled}
                  onChange={(value) =>
                    updateConfig("promotionModuleEnabled", value)
                  }
                  icon={<Grid2X2 size={18} />}
                  disabled={!canEditPromotion}
                  lockedText={`No incluido en tu plan. Disponible desde ${promotionAccess.minimumPlanLabel}.`}
                />

                <ToggleRow
                  label="Promoción visible"
                  description="Muestra u oculta la promoción en la página pública sin borrar el contenido guardado."
                  checked={businessConfig.promotionActive}
                  onChange={(value) => updateConfig("promotionActive", value)}
                  icon={<Eye size={18} />}
                  disabled={!canEditPromotion}
                  lockedText={`No incluido en tu plan. Disponible desde ${promotionAccess.minimumPlanLabel}.`}
                />

                <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                    Producto o combo relacionado
                  </p>

                  <select
                    value={businessConfig.promotionProductId || 0}
                    disabled={!canEditPromotion}
                    onChange={(event) =>
                      applyPromotionProduct(Number(event.target.value || 0))
                    }
                    className="mt-3 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-sm font-black text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#f3ead7] disabled:text-[var(--brand-ink)]/50"
                  >
                    <option value={0}>Promoción general sin producto</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.category} · $
                        {product.price.toFixed(2)}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadAvailableProducts()}
                      disabled={isLoadingProducts || !canEditPromotion}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                    >
                      {isLoadingProducts ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Actualizar productos
                    </button>

                    {businessConfig.promotionProductId > 0 && (
                      <button
                        type="button"
                        disabled={!canEditPromotion}
                        onClick={() => applyPromotionProduct(0)}
                        className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                      >
                        Quitar producto
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Puedes usar productos o combos existentes. Si no eliges
                    ninguno, la promoción queda como anuncio general.
                  </p>
                </div>

                <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                    Vista rápida
                  </p>
                  <div className="mt-3 grid grid-cols-[76px_1fr] items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="h-[76px] w-[76px] rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${promotionPreviewImage})`,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                        {businessConfig.promotionTitle || "Promoción especial"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                        {businessConfig.promotionHighlight ||
                          businessConfig.promotionText ||
                          "Disponible por tiempo limitado."}
                      </p>
                      {businessConfig.promotionPriceUSD > 0 && (
                        <p className="mt-2 text-lg font-black text-[var(--brand-primary)]">
                          ${businessConfig.promotionPriceUSD.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Título de promoción"
                  value={businessConfig.promotionTitle}
                  onChange={(value) => updateConfig("promotionTitle", value)}
                  placeholder="Combo especial de la noche"
                  disabled={!canEditPromotion}
                />
                <TextInput
                  label="Detalle o beneficio"
                  value={businessConfig.promotionHighlight}
                  onChange={(value) =>
                    updateConfig("promotionHighlight", value)
                  }
                  placeholder="Disponible por tiempo limitado"
                  disabled={!canEditPromotion}
                />
                <TextInput
                  label="Precio promocional USD"
                  type="number"
                  value={businessConfig.promotionPriceUSD || ""}
                  onChange={(value) =>
                    updateConfig(
                      "promotionPriceUSD",
                      Number.isFinite(Number(value)) && Number(value) > 0
                        ? Number(value)
                        : 0,
                    )
                  }
                  placeholder="Ej: 12.00"
                  helper="Opcional. Si lo dejas vacío, la promoción se muestra sin precio."
                  disabled={!canEditPromotion}
                />
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Imagen de promoción
                  </label>

                  <div className="mt-2 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3">
                    <input
                      ref={promotionImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePromotionImageInputChange}
                    />

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        type="text"
                        value={businessConfig.promotionImage}
                        disabled={!canEditPromotion}
                        onChange={(event) =>
                          updateConfig("promotionImage", event.target.value)
                        }
                        placeholder="Sube una foto o pega /producto.png o https://..."
                        className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white px-4 py-4 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#f3ead7] disabled:text-[var(--brand-ink)]/50"
                      />

                      <button
                        type="button"
                        disabled={
                          !canEditPromotion || isUploadingPromotionImage
                        }
                        onClick={() => promotionImageInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUploadingPromotionImage ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <UploadCloud size={16} />
                        )}
                        {isUploadingPromotionImage ? "Subiendo" : "Subir foto"}
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr] sm:items-center">
                      <div
                        aria-hidden="true"
                        className="flex h-[120px] w-full items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white bg-cover bg-center text-[var(--brand-primary)] sm:w-[120px]"
                        style={{
                          backgroundImage: promotionPreviewImage
                            ? `url(${promotionPreviewImage})`
                            : undefined,
                        }}
                      >
                        {!promotionPreviewImage && <ImageIcon size={24} />}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                          Puedes subir una imagen desde el teléfono, pegar una
                          URL o usar la imagen del producto relacionado como
                          respaldo. Luego presiona Guardar configuración.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {selectedPromotionProduct?.image && (
                            <button
                              type="button"
                              disabled={!canEditPromotion}
                              onClick={useSelectedProductImageForPromotion}
                              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                            >
                              <ImageIcon size={14} />
                              Usar imagen del producto
                            </button>
                          )}

                          {businessConfig.promotionImage && (
                            <button
                              type="button"
                              disabled={!canEditPromotion}
                              onClick={() => updateConfig("promotionImage", "")}
                              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Quitar imagen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <TextAreaInput
                  label="Texto corto"
                  value={businessConfig.promotionText}
                  onChange={(value) => updateConfig("promotionText", value)}
                  placeholder="Describe la promoción de forma clara para el cliente."
                  disabled={!canEditPromotion}
                />
                <div className="grid gap-4">
                  <TextInput
                    label="Texto del botón"
                    value={businessConfig.promotionButtonText}
                    onChange={(value) =>
                      updateConfig("promotionButtonText", value)
                    }
                    placeholder="Pedir promoción"
                    disabled={!canEditPromotion}
                  />
                  <TextInput
                    label="Acción o enlace del botón"
                    value={businessConfig.promotionButtonHref}
                    onChange={(value) =>
                      updateConfig("promotionButtonHref", value)
                    }
                    placeholder="#menu, /, https://..."
                    helper="Puedes usar un ancla de la página, una ruta interna o un enlace completo."
                    disabled={!canEditPromotion}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="mt-4">
          <SectionCard
            icon={<Store size={22} />}
            title="Destacados públicos"
            defaultCollapsed
            description="Selecciona productos o combos para mostrarlos como recomendados en la página pública. El editor completo del menú está en Productos del menú."
            locked={!canEditFeaturedProducts}
            lockedText={`Disponible desde ${featuredProductsAccess.minimumPlanLabel}. La sección queda visible para que el negocio sepa que puede desbloquear productos destacados al subir de plan.`}
          >
            <div
              className={`grid gap-4 lg:grid-cols-[0.85fr_1.15fr] ${!canEditFeaturedProducts ? "opacity-65" : ""}`}
            >
              <div className="grid gap-3">
                <ToggleRow
                  label="Módulo de destacados"
                  description="Permite mostrar una selección editable de productos o combos recomendados en la página pública."
                  checked={businessConfig.featuredProductsModuleEnabled}
                  onChange={(value) =>
                    updateConfig("featuredProductsModuleEnabled", value)
                  }
                  icon={<Store size={18} />}
                  disabled={!canEditFeaturedProducts}
                  lockedText={`No incluido en tu plan. Disponible desde ${featuredProductsAccess.minimumPlanLabel}.`}
                />

                <ToggleRow
                  label="Destacados visibles"
                  description="Muestra u oculta la sección pública sin borrar los productos seleccionados."
                  checked={businessConfig.featuredProductsActive}
                  onChange={(value) =>
                    updateConfig("featuredProductsActive", value)
                  }
                  icon={<Eye size={18} />}
                  disabled={!canEditFeaturedProducts}
                  lockedText={`No incluido en tu plan. Disponible desde ${featuredProductsAccess.minimumPlanLabel}.`}
                />

                <TextInput
                  label="Título de sección"
                  value={businessConfig.featuredProductsTitle}
                  onChange={(value) =>
                    updateConfig("featuredProductsTitle", value)
                  }
                  placeholder="Favoritos de la casa"
                  disabled={!canEditFeaturedProducts}
                />

                <TextAreaInput
                  label="Texto corto"
                  value={businessConfig.featuredProductsText}
                  onChange={(value) =>
                    updateConfig("featuredProductsText", value)
                  }
                  placeholder="Explica por qué estos productos son recomendados."
                  disabled={!canEditFeaturedProducts}
                />

                <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                    Seleccionados
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    {businessConfig.featuredProductIds.length} productos
                    marcados. La sección pública aparece solo si el plan incluye
                    el módulo, está activo y hay productos seleccionados.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Productos disponibles
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                      Se cargan desde el menú editable activo. Si no hay
                      conexión, se usa el menú base como respaldo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadAvailableProducts()}
                    disabled={isLoadingProducts}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                  >
                    {isLoadingProducts ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Actualizar productos
                  </button>
                </div>

                {productsWarning && (
                  <div className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3">
                    <p className="text-xs font-black leading-5 text-[var(--brand-amber)]">
                      {productsWarning}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid max-h-[540px] gap-2 overflow-y-auto pr-1">
                  {availableProducts.length === 0 && (
                    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-4 text-center">
                      <p className="text-sm font-black uppercase text-[var(--brand-primary)]">
                        Sin productos disponibles
                      </p>
                      <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                        Carga el menú editable o crea productos desde Productos
                        del menú.
                      </p>
                    </div>
                  )}

                  {availableProducts.map((product) => {
                    const isSelected =
                      businessConfig.featuredProductIds.includes(product.id) ||
                      product.isFeatured === true;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={!canEditFeaturedProducts}
                        onClick={() => void toggleFeaturedProduct(product.id)}
                        className={`rounded-[1.2rem] border-2 p-3 text-left transition disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-[var(--brand-primary)]/20 bg-white hover:border-[var(--brand-primary)]"
                        }`}
                      >
                        <div className="grid grid-cols-[72px_1fr] items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="h-[72px] w-[72px] shrink-0 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${product.image || BRAND.logoUrl || "/logoremovebg.png"})`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                                {product.name}
                              </p>
                              {isSelected && (
                                <span className="rounded-full bg-green-500 px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-white">
                                  Marcado
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                              {product.category} · ${product.price.toFixed(2)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard
            icon={<DollarSign size={22} />}
            title="Tasa y moneda"
            defaultCollapsed
            description="Las tasas automáticas se leen directo del BCV y se actualizan solas todos los días. En Manual, usa la tasa que fijes aquí (el carrito le dice al cliente cuál está activa)."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-3">
                <ModeButton
                  label="Tasa BCV (dólar)"
                  description="Seguir la tasa oficial del dólar del BCV, actualizada a diario."
                  active={businessConfig.exchangeRateMode === "automatic"}
                  onClick={() => updateConfig("exchangeRateMode", "automatic")}
                />
                <ModeButton
                  label="Tasa BCV (euro)"
                  description="Seguir la tasa oficial del euro del BCV, actualizada a diario."
                  active={businessConfig.exchangeRateMode === "automaticEur"}
                  onClick={() =>
                    updateConfig("exchangeRateMode", "automaticEur")
                  }
                />
                <ModeButton
                  label="Manual"
                  description="Usar una tasa fijada por el negocio cuando sea necesario."
                  active={businessConfig.exchangeRateMode === "manual"}
                  onClick={() => updateConfig("exchangeRateMode", "manual")}
                />
              </div>

              <TextInput
                label="Tasa manual (Bs por dólar)"
                type="number"
                value={businessConfig.manualExchangeRate || ""}
                onChange={(value) =>
                  updateConfig(
                    "manualExchangeRate",
                    Number.isFinite(Number(value)) && Number(value) > 0
                      ? Number(value)
                      : 0,
                  )
                }
                placeholder="Ej: 667.05"
                helper="Solo se usa si el modo de tasa está en Manual."
              />
            </div>

            <LiveBcvRateHint
              manualActive={businessConfig.exchangeRateMode === "manual"}
            />
          </SectionCard>

          <SectionCard
            icon={<SlidersHorizontal size={22} />}
            title="Vista y operación"
            defaultCollapsed
            description="Preferencias internas para adaptar la pantalla al modo de trabajo del negocio."
          >
            <div className="grid gap-3 lg:grid-cols-3">
              {VIEW_MODE_OPTIONS.map((option) => (
                <ModeButton
                  key={option.value}
                  label={option.label}
                  description={option.description}
                  active={businessConfig.defaultViewMode === option.value}
                  onClick={() => updateConfig("defaultViewMode", option.value)}
                />
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ToggleRow
                label="Filtros abiertos por defecto"
                description="Mostrar filtros operativos apenas entra al panel."
                checked={businessConfig.filtersOpenByDefault}
                onChange={(value) =>
                  updateConfig("filtersOpenByDefault", value)
                }
                icon={<Eye size={18} />}
              />
              <ToggleRow
                label="Cerrar con pedidos activos"
                description="Permitir cierre aunque queden pedidos sin entregar."
                checked={businessConfig.allowCloseWithPendingOrders}
                onChange={(value) =>
                  updateConfig("allowCloseWithPendingOrders", value)
                }
                icon={<CheckCircle2 size={18} />}
              />
              <ToggleRow
                label="Cerrar con pagos pendientes"
                description="Permitir cierre aunque queden cobros pendientes o parciales."
                checked={businessConfig.allowCloseWithPendingPayments}
                onChange={(value) =>
                  updateConfig("allowCloseWithPendingPayments", value)
                }
                icon={<DollarSign size={18} />}
              />
            </div>
          </SectionCard>
        </section>

        <section className="mt-6 rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white p-4 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Guardar cambios
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                Los módulos bloqueados por plan no se activarán aunque aparezcan
                en pantalla.
              </p>
            </div>

            <button
              type="button"
              onClick={saveBusinessConfig}
              disabled={isSaving}
              className="flex items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-8 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Guardar configuración
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-black text-[var(--brand-ink-3)]">
        {value}
      </p>
    </div>
  );
}

// RIF venezolano: una letra (V/E/J/P/G) + 8 dígitos + 1 dígito verificador.
// Acepta con o sin guiones (J-12345678-9 o J123456789).
function isValidRif(value: string): boolean {
  return /^[VEJPGCvejpgc]-?\d{8}-?\d$/.test(value.trim());
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
          aria-label={label}
        />
        <span className="text-sm font-bold text-[var(--brand-ink)]">
          {value}
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
  locked,
  lockedText,
  defaultCollapsed = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  locked?: boolean;
  lockedText?: string;
  defaultCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <section className="rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            {icon}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              {title}
            </p>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {locked && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--brand-ink-3)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-white">
              <LockKeyhole size={13} />
              Bloqueado
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {isCollapsed ? "Mostrar" : "Minimizar"}
          </button>
        </div>
      </div>

      {!isCollapsed && locked && lockedText && (
        <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3">
          <p className="text-sm font-black leading-6 text-[var(--brand-amber)]">
            {lockedText}
          </p>
        </div>
      )}

      {!isCollapsed && children}
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helper,
  type = "text",
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#f3ead7] disabled:text-[var(--brand-ink)]/50"
      />
      {helper && (
        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
          {helper}
        </p>
      )}
    </div>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={7}
        className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#f3ead7] disabled:text-[var(--brand-ink)]/50"
      />
    </div>
  );
}

function ModeButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.2rem] border-2 p-4 text-left transition ${
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
          : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-3)] hover:border-[var(--brand-primary)]"
      }`}
    >
      <p className="text-sm font-black uppercase">{label}</p>
      <p className="mt-2 text-xs font-bold leading-5">{description}</p>
    </button>
  );
}

// Muestra la tasa BCV vigente (la que usaría el modo Automática) para que el
// dueño decida con contexto si necesita una tasa manual.
function LiveBcvRateHint({ manualActive }: { manualActive: boolean }) {
  const [bcvText, setBcvText] = useState("Consultando tasa BCV…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/exchange-rate", { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        const rate = Number(data.rate);
        if (!Number.isFinite(rate) || rate <= 0) {
          setBcvText("No se pudo consultar la tasa BCV ahora mismo.");
          return;
        }
        // Si el modo manual está activo, la API devuelve la tasa del negocio;
        // igual sirve como referencia de lo que está viendo el cliente.
        const label = data.manual
          ? "Tasa activa (manual del negocio)"
          : `Tasa BCV oficial${data.valueDate ? ` · ${data.valueDate}` : ""}`;
        setBcvText(`${label}: Bs ${rate.toFixed(2)} por dólar`);
      } catch {
        if (!cancelled) setBcvText("No se pudo consultar la tasa BCV ahora mismo.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
        Referencia en vivo
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{bcvText}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
        {manualActive
          ? "El sitio público está usando la tasa manual. Vuelve a Automática para seguir al BCV."
          : "El sitio público sigue al BCV automáticamente. Cada sede puede fijar su propia tasa en Sucursales → Configuración por sede."}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon,
  disabled,
  lockedText,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: ReactNode;
  disabled?: boolean;
  lockedText?: string;
}) {
  return (
    <div
      className={`rounded-[1.2rem] border-2 p-4 ${
        disabled
          ? "border-[var(--brand-primary)]/15 bg-[#f3ead7]"
          : checked
            ? "border-green-500/45 bg-green-50"
            : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
            {disabled ? <LockKeyhole size={18} /> : icon}
          </div>
          <div>
            <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
              {label}
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`h-8 w-14 shrink-0 rounded-full border-2 p-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
            checked
              ? "border-green-600 bg-green-500"
              : "border-[var(--brand-primary)]/30 bg-white"
          }`}
          aria-label={`Cambiar ${label}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-[var(--brand-ink)] transition ${
              checked ? "translate-x-6 bg-white" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {disabled && lockedText && (
        <p className="mt-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2 text-xs font-black leading-5 text-[var(--brand-primary)]">
          {lockedText}
        </p>
      )}
    </div>
  );
}

function ModuleToggleCard({
  moduleItem,
  checked,
  onChange,
  icon,
}: {
  moduleItem: LocalModulePlanAccess;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: ReactNode;
}) {
  const canToggle =
    moduleItem.includedInPlan &&
    Boolean(moduleItem.ownerConfigKey) &&
    !moduleItem.comingSoon;

  return (
    <ToggleRow
      label={getOwnerModuleLabel(moduleItem)}
      description={getOwnerModuleDescription(moduleItem)}
      checked={checked}
      onChange={onChange}
      icon={icon}
      disabled={!canToggle}
      lockedText={
        !moduleItem.includedInPlan
          ? `No incluido en tu plan. Disponible desde ${moduleItem.minimumPlanLabel}. Solicita activación para usar esta función.`
          : moduleItem.comingSoon
            ? "Esta función ya está contemplada para el plan, pero se activará cuando el módulo esté terminado."
            : !moduleItem.ownerConfigKey
              ? "Esta función se gestiona automáticamente por el sistema o por soporte."
              : undefined
      }
    />
  );
}
