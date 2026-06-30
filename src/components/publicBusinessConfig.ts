// Normalizadores y caché de la configuración pública del negocio, extraídos de CartDrawer.
import { BRAND } from "@/lib/brand";
import { cleanText, cleanWhatsappNumber } from "@/components/cartUtils";
import type {
  MembershipPlan,
  PublicLocalTable,
  PublicBusinessConfig,
  RequestedLocalTableContext,
  PublicTableAccountNotice,
} from "@/components/cartTypes";

export const DEFAULT_QUICK_PLACES = [
  "Mesa 1",
  "Mesa 2",
  "Mesa 3",
  "Mesa 4",
  "Barra",
  "Afuera",
];

export const PUBLIC_CONFIG_CACHE_KEY = "santo_perrito_public_business_config_v2";

export const DEFAULT_PUBLIC_CONFIG: PublicBusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: "Menú y pedidos",
  publicMenuEyebrow: `Menú ${BRAND.name}`,
  publicMenuTitle: "Elige tu pedido",
  publicMenuText: "Combos en divisas y productos normales con referencia en bolívares según la tasa activa del negocio.",
  publicMenuSearchPlaceholder: "Buscar productos, combos o adicionales",
  publicComboTitle: "Combos disponibles",
  publicComboText: "Los combos se manejan en divisas para mantener precios claros.",
  publicComboButtonText: "Ver combos",
  publicCustomizeButtonText: "Elige tus ingredientes",
  publicCustomizerTitle: "Elige tus ingredientes",
  themePrimaryColor: "#a00000",
  themeAccentColor: "#ffd23c",
  themeCreamColor: "#fff7e8",
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  paymentProofsEnabled: false,
  businessComplexityProfile: "advanced",
  publicOrdersEnabled: true,
  publicLocalOrdersEnabled: true,
  publicTakeawayOrdersEnabled: true,
  publicDeliveryOrdersEnabled: true,
  publicOpenAccountEnabled: true,
  publicPaymentProofsEnabled: true,
  publicPaymentProofUploadEnabled: true,
  publicIngredientCustomizationEnabled: true,
  publicAddonsEnabled: true,
  publicNotesEnabled: true,
  publicCustomerNotesEnabled: true,
  publicAttachmentsEnabled: true,
  publicCustomerAttachmentsEnabled: true,
  publicCustomerImageAttachmentEnabled: true,
  publicPhoneRequired: false,
  membershipPlan: "menuDigital",
  localTables: [],
  locationLabel: "Mesa",
  onlinePaymentsEnabled: false,
  fiscalEnabled: false,
  ivaDefaultRate: 16,
  pricesIncludeIva: true,
  igtfEnabled: true,
  igtfRate: 3,
};


export function normalizeMembershipPlan(value: unknown): MembershipPlan {
  const normalized = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    normalized === "menudigital" ||
    normalized === "menu digital" ||
    normalized === "menu-digital" ||
    normalized === "menu_digital"
  ) {
    return "menuDigital";
  }

  if (
    normalized === "basic" ||
    normalized === "basico" ||
    normalized === "basic plan"
  ) {
    return "basic";
  }

  if (
    normalized === "operational" ||
    normalized === "operativo" ||
    normalized === "operation"
  ) {
    return "operational";
  }

  if (normalized === "pro" || normalized === "profesional") {
    return "pro";
  }

  return "complete";
}

type PublicComplexityProfile = "simple" | "standard" | "advanced" | "custom";

type PublicComplexityDefaults = {
  publicOrdersEnabled: boolean;
  publicLocalOrdersEnabled: boolean;
  publicTakeawayOrdersEnabled: boolean;
  publicDeliveryOrdersEnabled: boolean;
  publicOpenAccountEnabled: boolean;
  publicPaymentProofsEnabled: boolean;
  publicIngredientCustomizationEnabled: boolean;
  publicAddonsEnabled: boolean;
  publicNotesEnabled: boolean;
  publicCustomerNotesEnabled: boolean;
  publicAttachmentsEnabled: boolean;
  publicCustomerAttachmentsEnabled: boolean;
  publicCustomerImageAttachmentEnabled: boolean;
  publicPhoneRequired: boolean;
};

const PUBLIC_COMPLEXITY_PROFILE_DEFAULTS: Record<PublicComplexityProfile, PublicComplexityDefaults> = {
  simple: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: false,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: false,
    publicOpenAccountEnabled: false,
    publicPaymentProofsEnabled: false,
    publicIngredientCustomizationEnabled: false,
    publicAddonsEnabled: false,
    publicNotesEnabled: false,
    publicCustomerNotesEnabled: false,
    publicAttachmentsEnabled: false,
    publicCustomerAttachmentsEnabled: false,
    publicCustomerImageAttachmentEnabled: false,
    publicPhoneRequired: false,
  },
  standard: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
  advanced: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
  custom: {
    publicOrdersEnabled: true,
    publicLocalOrdersEnabled: true,
    publicTakeawayOrdersEnabled: true,
    publicDeliveryOrdersEnabled: true,
    publicOpenAccountEnabled: true,
    publicPaymentProofsEnabled: true,
    publicIngredientCustomizationEnabled: true,
    publicAddonsEnabled: true,
    publicNotesEnabled: true,
    publicCustomerNotesEnabled: true,
    publicAttachmentsEnabled: true,
    publicCustomerAttachmentsEnabled: true,
    publicCustomerImageAttachmentEnabled: true,
    publicPhoneRequired: false,
  },
};

export function normalizePublicComplexityProfile(value: unknown): PublicComplexityProfile {
  const normalized = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["simple", "sencillo", "basico", "básico"].includes(normalized)) {
    return "simple";
  }

  if (["standard", "estandar", "estándar", "normal"].includes(normalized)) {
    return "standard";
  }

  if (["custom", "personalizado", "personalizada"].includes(normalized)) {
    return "custom";
  }

  return "advanced";
}

function readPublicControlBoolean(
  source: Record<string, unknown>,
  key: keyof PublicComplexityDefaults,
  fallback: boolean,
) {
  return Object.prototype.hasOwnProperty.call(source, key)
    ? normalizePublicBoolean(source[key], fallback)
    : fallback;
}

function readPublicControlBooleanAliases(
  source: Record<string, unknown>,
  keys: Array<keyof PublicComplexityDefaults | string>,
  fallback: boolean,
) {
  const matchedKey = keys.find((key) =>
    Object.prototype.hasOwnProperty.call(source, key)
  );

  return matchedKey ? normalizePublicBoolean(source[matchedKey], fallback) : fallback;
}

export function doesPlanAllowLocalOrders(plan: MembershipPlan) {
  return plan !== "menuDigital";
}

export function doesPlanAllowDelivery(plan: MembershipPlan) {
  return plan === "operational" || plan === "pro" || plan === "complete";
}

export function normalizePublicBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    [
      "true",
      "1",
      "si",
      "activo",
      "activa",
      "activado",
      "activada",
      "enabled",
      "on",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "inactivo",
      "inactiva",
      "desactivado",
      "desactivada",
      "disabled",
      "off",
    ].includes(normalized)
  ) {
    return false;
  }

  return fallback;
}

export function normalizePublicLocalTables(value: unknown): PublicLocalTable[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? (() => {
          try {
            const parsedValue = JSON.parse(value);
            return Array.isArray(parsedValue)
              ? parsedValue
              : value.split(/[;,|\n]/g);
          } catch {
            return value.split(/[;,|\n]/g);
          }
        })()
      : [];
  const seen = new Set<string>();
  const tables: PublicLocalTable[] = [];

  rawList.forEach((item, index) => {
    const rawItem =
      item && typeof item === "object"
        ? (item as Partial<PublicLocalTable>)
        : { name: String(item || "") };
    const name = cleanText(rawItem.name);
    const key = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!name || !key || seen.has(key)) return;

    seen.add(key);

    const sortOrder = Number(rawItem.sortOrder || index + 1);

    tables.push({
      id:
        cleanText(rawItem.id) ||
        key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      area: cleanText(rawItem.area) || "Principal",
      sortOrder:
        Number.isFinite(sortOrder) && sortOrder > 0
          ? Math.round(sortOrder)
          : index + 1,
      isActive: normalizePublicBoolean(rawItem.isActive, true),
    });
  });

  return tables
    .filter((table) => table.isActive !== false)
    .sort((first, second) => {
      const firstOrder = Number(first.sortOrder || 9999);
      const secondOrder = Number(second.sortOrder || 9999);

      if (firstOrder !== secondOrder) return firstOrder - secondOrder;

      return first.name.localeCompare(second.name);
    });
}

export function getActivePublicLocalTableNames(tables: PublicLocalTable[]) {
  const names = normalizePublicLocalTables(tables)
    .map((table) => table.name)
    .filter(Boolean);

  return names.length ? names : DEFAULT_QUICK_PLACES;
}

export function normalizePublicTableLookup(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getRequestedLocalTableContextFromUrl(): RequestedLocalTableContext {
  if (typeof window === "undefined") {
    return { requestedTable: "", isQrLink: false };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const requestedTable =
      cleanText(params.get("mesa")) ||
      cleanText(params.get("table")) ||
      cleanText(params.get("ubicacion")) ||
      cleanText(params.get("ubicación"));
    const sourceValue = cleanText(
      params.get("origen") || params.get("source"),
    ).toLowerCase();
    const isQrLink =
      params.get("mesa_qr") === "1" ||
      params.get("qr") === "1" ||
      sourceValue === "qr" ||
      sourceValue === "mesa";

    return { requestedTable, isQrLink };
  } catch {
    return { requestedTable: "", isQrLink: false };
  }
}

export function resolveRequestedLocalTableName(
  requestedTable: string,
  tables: PublicLocalTable[],
) {
  const cleanRequestedTable = cleanText(requestedTable);
  const requestedKey = normalizePublicTableLookup(cleanRequestedTable);

  if (!requestedKey) return "";

  const tableOptions = normalizePublicLocalTables(tables);

  for (const table of tableOptions) {
    const tableNameKey = normalizePublicTableLookup(table.name);
    const tableIdKey = normalizePublicTableLookup(table.id);

    if (requestedKey === tableNameKey || requestedKey === tableIdKey) {
      return table.name;
    }
  }

  return tableOptions.length ? "" : cleanRequestedTable;
}

function normalizePublicMoney(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizePublicOpenAccount(value: unknown) {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;

  if (!source) return null;

  const id = cleanText(source.id);
  const tableNumber = cleanText(source.tableNumber);

  if (!id || !tableNumber) return null;

  const rawOrders = Array.isArray(source.orders) ? source.orders : [];

  return {
    id,
    tableNumber,
    customerName: cleanText(source.customerName),
    status: cleanText(source.status) || "Abierta",
    totalEstimatedUSD: normalizePublicMoney(source.totalEstimatedUSD),
    totalCollectedUSD: normalizePublicMoney(source.totalCollectedUSD),
    pendingUSD: normalizePublicMoney(source.pendingUSD),
    createdAt: cleanText(source.createdAt),
    updatedAt: cleanText(source.updatedAt),
    orders: rawOrders
      .map((rawOrder) => {
        const order =
          rawOrder && typeof rawOrder === "object"
            ? (rawOrder as Record<string, unknown>)
            : {};
        const orderId = cleanText(order.id);
        const rawItems = Array.isArray(order.items) ? order.items : [];

        if (!orderId) return null;

        return {
          id: orderId,
          displayNumber: cleanText(order.displayNumber),
          status: cleanText(order.status) || "Nuevo",
          paymentStatus: cleanText(order.paymentStatus) || "Pendiente",
          totalUSD: normalizePublicMoney(order.totalUSD),
          receivedEquivalentUSD: normalizePublicMoney(order.receivedEquivalentUSD),
          pendingUSD: normalizePublicMoney(order.pendingUSD),
          createdAt: cleanText(order.createdAt),
          itemsText: cleanText(order.itemsText),
          items: rawItems
            .map((rawItem) => {
              const item =
                rawItem && typeof rawItem === "object"
                  ? (rawItem as Record<string, unknown>)
                  : {};
              const name = cleanText(item.name);
              const quantity = Number(item.quantity || 0);

              if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;

              return {
                id: Number(item.id || 0) || undefined,
                name,
                category: cleanText(item.category),
                quantity,
                selectionSummary: cleanText(item.selectionSummary),
                note: cleanText(item.note),
              };
            })
            .filter(isPresent),
        };
      })
      .filter(isPresent),
  };
}

export function normalizePublicTableAccountNotice(
  value: unknown,
): PublicTableAccountNotice {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const tableName = cleanText(source.tableName);

  if (!tableName) return null;

  const openAccountsAvailable = normalizePublicBoolean(
    source.openAccountsAvailable,
    false,
  );
  const hasOpenAccount = normalizePublicBoolean(source.hasOpenAccount, false);

  return {
    requestedTable: cleanText(source.requestedTable),
    tableName,
    hasOpenAccount,
    openAccountsAvailable,
    status: openAccountsAvailable
      ? hasOpenAccount
        ? "open"
        : "free"
      : "unavailable",
    openAccount: normalizePublicOpenAccount(source.openAccount),
  };
}

export function normalizePublicBusinessConfig(value: unknown): PublicBusinessConfig {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const businessConfig =
    source.businessConfig && typeof source.businessConfig === "object"
      ? (source.businessConfig as Record<string, unknown>)
      : source;

  const membershipPlan = normalizeMembershipPlan(businessConfig.membershipPlan);
  const businessComplexityProfile = normalizePublicComplexityProfile(
    businessConfig.businessComplexityProfile ||
      businessConfig.publicBusinessComplexityProfile ||
      businessConfig.businessComplexity ||
      businessConfig.businessComplexityLevel ||
      businessConfig.businessComplexityMode ||
      businessConfig.publicComplexityProfile ||
      businessConfig.publicComplexityMode,
  );
  const publicComplexityDefaults = PUBLIC_COMPLEXITY_PROFILE_DEFAULTS[businessComplexityProfile];
  const publicOrdersEnabled = readPublicControlBoolean(
    businessConfig,
    "publicOrdersEnabled",
    publicComplexityDefaults.publicOrdersEnabled,
  );
  const publicLocalOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      businessConfig,
      "publicLocalOrdersEnabled",
      publicComplexityDefaults.publicLocalOrdersEnabled,
    );
  const publicTakeawayOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      businessConfig,
      "publicTakeawayOrdersEnabled",
      publicComplexityDefaults.publicTakeawayOrdersEnabled,
    );
  const publicDeliveryOrdersEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      businessConfig,
      "publicDeliveryOrdersEnabled",
      publicComplexityDefaults.publicDeliveryOrdersEnabled,
    );
  const publicOpenAccountEnabled =
    publicOrdersEnabled &&
    readPublicControlBoolean(
      businessConfig,
      "publicOpenAccountEnabled",
      publicComplexityDefaults.publicOpenAccountEnabled,
    );
  const publicPaymentProofsEnabled = readPublicControlBooleanAliases(
    businessConfig,
    ["publicPaymentProofsEnabled", "publicPaymentProofUploadEnabled"],
    publicComplexityDefaults.publicPaymentProofsEnabled,
  );
  const publicIngredientCustomizationEnabled = readPublicControlBoolean(
    businessConfig,
    "publicIngredientCustomizationEnabled",
    publicComplexityDefaults.publicIngredientCustomizationEnabled,
  );
  const publicAddonsEnabled = readPublicControlBoolean(
    businessConfig,
    "publicAddonsEnabled",
    publicComplexityDefaults.publicAddonsEnabled,
  );
  const publicNotesEnabled = readPublicControlBooleanAliases(
    businessConfig,
    ["publicNotesEnabled", "publicCustomerNotesEnabled"],
    publicComplexityDefaults.publicNotesEnabled,
  );
  const publicAttachmentsEnabled = readPublicControlBooleanAliases(
    businessConfig,
    [
      "publicAttachmentsEnabled",
      "publicCustomerAttachmentsEnabled",
      "publicCustomerImageAttachmentEnabled",
    ],
    publicComplexityDefaults.publicAttachmentsEnabled,
  );
  const publicPhoneRequired = readPublicControlBoolean(
    businessConfig,
    "publicPhoneRequired",
    publicComplexityDefaults.publicPhoneRequired,
  );

  return {
    businessName:
      cleanText(businessConfig.businessName) ||
      DEFAULT_PUBLIC_CONFIG.businessName,
    businessShortDescription:
      cleanText(businessConfig.businessShortDescription) ||
      DEFAULT_PUBLIC_CONFIG.businessShortDescription,
    publicMenuEyebrow:
      cleanText(businessConfig.publicMenuEyebrow) ||
      DEFAULT_PUBLIC_CONFIG.publicMenuEyebrow,
    publicMenuTitle:
      cleanText(businessConfig.publicMenuTitle) ||
      DEFAULT_PUBLIC_CONFIG.publicMenuTitle,
    publicMenuText:
      cleanText(businessConfig.publicMenuText) ||
      DEFAULT_PUBLIC_CONFIG.publicMenuText,
    publicMenuSearchPlaceholder:
      cleanText(businessConfig.publicMenuSearchPlaceholder) ||
      DEFAULT_PUBLIC_CONFIG.publicMenuSearchPlaceholder,
    publicComboTitle:
      cleanText(businessConfig.publicComboTitle) ||
      DEFAULT_PUBLIC_CONFIG.publicComboTitle,
    publicComboText:
      cleanText(businessConfig.publicComboText) ||
      DEFAULT_PUBLIC_CONFIG.publicComboText,
    publicComboButtonText:
      cleanText(businessConfig.publicComboButtonText) ||
      DEFAULT_PUBLIC_CONFIG.publicComboButtonText,
    publicCustomizeButtonText:
      cleanText(businessConfig.publicCustomizeButtonText) ||
      DEFAULT_PUBLIC_CONFIG.publicCustomizeButtonText,
    publicCustomizerTitle:
      cleanText(businessConfig.publicCustomizerTitle) ||
      cleanText(businessConfig.publicCustomizeButtonText) ||
      DEFAULT_PUBLIC_CONFIG.publicCustomizerTitle,
    themePrimaryColor:
      cleanText(businessConfig.themePrimaryColor) ||
      DEFAULT_PUBLIC_CONFIG.themePrimaryColor,
    themeAccentColor:
      cleanText(businessConfig.themeAccentColor) ||
      DEFAULT_PUBLIC_CONFIG.themeAccentColor,
    themeCreamColor:
      cleanText(businessConfig.themeCreamColor) ||
      DEFAULT_PUBLIC_CONFIG.themeCreamColor,
    productCardBackgroundColor:
      cleanText(businessConfig.productCardBackgroundColor) ||
      DEFAULT_PUBLIC_CONFIG.productCardBackgroundColor,
    productCardTextColor:
      cleanText(businessConfig.productCardTextColor) ||
      DEFAULT_PUBLIC_CONFIG.productCardTextColor,
    productCardBorderColor:
      cleanText(businessConfig.productCardBorderColor) ||
      DEFAULT_PUBLIC_CONFIG.productCardBorderColor,
    productCardButtonColor:
      cleanText(businessConfig.productCardButtonColor) ||
      DEFAULT_PUBLIC_CONFIG.productCardButtonColor,
    mainWhatsapp: cleanWhatsappNumber(businessConfig.mainWhatsapp),
    deliveryWhatsapp: cleanWhatsappNumber(businessConfig.deliveryWhatsapp),
    deliveryEnabled:
      normalizePublicBoolean(businessConfig.deliveryEnabled, true) &&
      doesPlanAllowDelivery(membershipPlan) &&
      publicOrdersEnabled &&
      publicDeliveryOrdersEnabled,
    deliveryModuleEnabled: normalizePublicBoolean(
      businessConfig.deliveryModuleEnabled,
      true,
    ),
    paymentProofsEnabled:
      (normalizePublicBoolean(businessConfig.paymentProofsEnabled, false) ||
        normalizePublicBoolean(businessConfig.paymentProofsModuleEnabled, false)) &&
      publicPaymentProofsEnabled,
    businessComplexityProfile,
    publicOrdersEnabled,
    publicLocalOrdersEnabled,
    publicTakeawayOrdersEnabled,
    publicDeliveryOrdersEnabled,
    publicOpenAccountEnabled,
    publicPaymentProofsEnabled,
    publicPaymentProofUploadEnabled: publicPaymentProofsEnabled,
    publicIngredientCustomizationEnabled,
    publicAddonsEnabled,
    publicNotesEnabled,
    publicCustomerNotesEnabled: publicNotesEnabled,
    publicAttachmentsEnabled,
    publicCustomerAttachmentsEnabled: publicAttachmentsEnabled,
    publicCustomerImageAttachmentEnabled: publicAttachmentsEnabled,
    publicPhoneRequired,
    membershipPlan,
    localTables: normalizePublicLocalTables(businessConfig.localTables),
    locationLabel: cleanText(businessConfig.locationLabel) || DEFAULT_PUBLIC_CONFIG.locationLabel,
    onlinePaymentsEnabled: normalizePublicBoolean(businessConfig.onlinePaymentsEnabled, false),
    fiscalEnabled: normalizePublicBoolean(businessConfig.fiscalEnabled, false),
    ivaDefaultRate: Number.isFinite(Number(businessConfig.ivaDefaultRate))
      ? Number(businessConfig.ivaDefaultRate)
      : DEFAULT_PUBLIC_CONFIG.ivaDefaultRate,
    pricesIncludeIva: normalizePublicBoolean(businessConfig.pricesIncludeIva, true),
    igtfEnabled: normalizePublicBoolean(businessConfig.igtfEnabled, true),
    igtfRate: Number.isFinite(Number(businessConfig.igtfRate))
      ? Number(businessConfig.igtfRate)
      : DEFAULT_PUBLIC_CONFIG.igtfRate,
  };
}

export function readCachedPublicBusinessConfig(): PublicBusinessConfig {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_CONFIG;

  try {
    const cachedValue = window.localStorage.getItem(PUBLIC_CONFIG_CACHE_KEY);

    if (!cachedValue) return DEFAULT_PUBLIC_CONFIG;

    return normalizePublicBusinessConfig(JSON.parse(cachedValue));
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}

export function writeCachedPublicBusinessConfig(config: PublicBusinessConfig) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLIC_CONFIG_CACHE_KEY,
      JSON.stringify(config),
    );
  } catch {
    // La configuración pública funciona aunque el navegador no permita guardar cache local.
  }
}
