export type BusinessComplexityProfile =
  "simple" | "standard" | "advanced" | "custom";

export type BusinessComplexitySettings = {
  businessComplexityProfile: BusinessComplexityProfile;

  publicAllowOrdering: boolean;
  publicAllowEatHere: boolean;
  publicAllowTakeaway: boolean;
  publicAllowDelivery: boolean;
  publicAllowOpenAccounts: boolean;
  publicAllowPaymentProofs: boolean;
  publicAllowProductCustomization: boolean;
  publicAllowCustomerNotes: boolean;
  publicAllowAttachments: boolean;
  publicRequireCustomerPhone: boolean;

  internalAllowCancelOrders: boolean;
  internalAdvancedReportsEnabled?: boolean;
  internalAllowOrderCancellation?: boolean;
  internalInventoryAutoConsumptionEnabled?: boolean;
  internalAllowEditOrderNotes: boolean;
  internalAllowReopenPayments: boolean;
  internalRequireCloseReview: boolean;
  internalShowAdvancedReports: boolean;

  inventoryAutoDeductEnabled: boolean;
  inventoryAutoDeductDryRun: boolean;
};

export type BusinessComplexityBooleanKey = Exclude<
  keyof BusinessComplexitySettings,
  "businessComplexityProfile"
>;

export const BUSINESS_COMPLEXITY_BOOLEAN_KEYS: BusinessComplexityBooleanKey[] =
  [
    "publicAllowOrdering",
    "publicAllowEatHere",
    "publicAllowTakeaway",
    "publicAllowDelivery",
    "publicAllowOpenAccounts",
    "publicAllowPaymentProofs",
    "publicAllowProductCustomization",
    "publicAllowCustomerNotes",
    "publicAllowAttachments",
    "publicRequireCustomerPhone",
    "internalAllowCancelOrders",
    "internalAllowEditOrderNotes",
    "internalAllowReopenPayments",
    "internalRequireCloseReview",
    "internalShowAdvancedReports",
    "inventoryAutoDeductEnabled",
    "inventoryAutoDeductDryRun",
  ];

export const BUSINESS_COMPLEXITY_CONFIG_KEYS = [
  "businessComplexityProfile",
  ...BUSINESS_COMPLEXITY_BOOLEAN_KEYS,
] as const;

export const DEFAULT_BUSINESS_COMPLEXITY_SETTINGS: BusinessComplexitySettings =
  {
    businessComplexityProfile: "advanced",

    publicAllowOrdering: true,
    publicAllowEatHere: true,
    publicAllowTakeaway: true,
    publicAllowDelivery: true,
    publicAllowOpenAccounts: true,
    publicAllowPaymentProofs: true,
    publicAllowProductCustomization: true,
    publicAllowCustomerNotes: true,
    publicAllowAttachments: true,
    publicRequireCustomerPhone: false,

    internalAllowCancelOrders: true,
    internalAllowEditOrderNotes: true,
    internalAllowReopenPayments: true,
    internalRequireCloseReview: false,
    internalShowAdvancedReports: true,

    inventoryAutoDeductEnabled: false,
    inventoryAutoDeductDryRun: true,
  };

export const BUSINESS_COMPLEXITY_PROFILE_DEFINITIONS: Array<{
  value: BusinessComplexityProfile;
  label: string;
  description: string;
  patch: Partial<BusinessComplexitySettings>;
}> = [
  {
    value: "simple",
    label: "Simple",
    description:
      "Menos opciones para el cliente y más revisión interna antes de acciones delicadas.",
    patch: {
      businessComplexityProfile: "simple",
      publicAllowOrdering: true,
      publicAllowEatHere: true,
      publicAllowTakeaway: true,
      publicAllowDelivery: false,
      publicAllowOpenAccounts: false,
      publicAllowPaymentProofs: false,
      publicAllowProductCustomization: false,
      publicAllowCustomerNotes: false,
      publicAllowAttachments: false,
      publicRequireCustomerPhone: false,
      internalAllowCancelOrders: false,
      internalAllowEditOrderNotes: true,
      internalAllowReopenPayments: false,
      internalRequireCloseReview: true,
      internalShowAdvancedReports: false,
      inventoryAutoDeductEnabled: false,
      inventoryAutoDeductDryRun: true,
    },
  },
  {
    value: "standard",
    label: "Estándar",
    description:
      "Balance para operar caja, cocina, delivery y cierres con permisos moderados.",
    patch: {
      businessComplexityProfile: "standard",
      publicAllowOrdering: true,
      publicAllowEatHere: true,
      publicAllowTakeaway: true,
      publicAllowDelivery: true,
      publicAllowOpenAccounts: true,
      publicAllowPaymentProofs: true,
      publicAllowProductCustomization: true,
      publicAllowCustomerNotes: true,
      publicAllowAttachments: true,
      publicRequireCustomerPhone: false,
      internalAllowCancelOrders: true,
      internalAllowEditOrderNotes: true,
      internalAllowReopenPayments: false,
      internalRequireCloseReview: true,
      internalShowAdvancedReports: true,
      inventoryAutoDeductEnabled: false,
      inventoryAutoDeductDryRun: true,
    },
  },
  {
    value: "advanced",
    label: "Avanzado",
    description:
      "Más libertad operativa para negocios con supervisión y personal entrenado.",
    patch: DEFAULT_BUSINESS_COMPLEXITY_SETTINGS,
  },
  {
    value: "custom",
    label: "Personalizado",
    description: "Se activa cuando el dueño ajusta permisos manualmente.",
    patch: { businessComplexityProfile: "custom" },
  },
];

const TRUE_VALUES = new Set([
  "true",
  "1",
  "si",
  "sí",
  "activo",
  "activa",
  "activado",
  "activada",
  "enabled",
  "on",
  "visible",
  "habilitado",
  "habilitada",
]);

const FALSE_VALUES = new Set([
  "false",
  "0",
  "no",
  "inactivo",
  "inactiva",
  "desactivado",
  "desactivada",
  "disabled",
  "off",
  "oculto",
  "oculta",
]);

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeBusinessComplexityProfile(
  value: unknown,
): BusinessComplexityProfile {
  const normalized = normalizeText(value);

  if (normalized === "simple" || normalized === "sencillo") return "simple";
  if (normalized === "standard" || normalized === "estandar") return "standard";
  if (normalized === "advanced" || normalized === "avanzado") return "advanced";
  if (normalized === "custom" || normalized === "personalizado")
    return "custom";

  return DEFAULT_BUSINESS_COMPLEXITY_SETTINGS.businessComplexityProfile;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = normalizeText(value);

  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return fallback;
}

function readAliasBoolean(
  source: Record<string, unknown>,
  key: BusinessComplexityBooleanKey,
  fallback: boolean,
  aliases: string[] = [],
) {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return normalizeBoolean(source[key], fallback);
  }

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      return normalizeBoolean(source[alias], fallback);
    }
  }

  return fallback;
}

export function normalizeBusinessComplexitySettings(
  value: unknown,
): BusinessComplexitySettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const defaults = DEFAULT_BUSINESS_COMPLEXITY_SETTINGS;
  const profile = normalizeBusinessComplexityProfile(
    source.businessComplexityProfile,
  );

  return {
    businessComplexityProfile: profile,

    publicAllowOrdering: readAliasBoolean(
      source,
      "publicAllowOrdering",
      defaults.publicAllowOrdering,
      ["allowPublicOrdering", "allowClientOrders", "publicOrdersEnabled"],
    ),
    publicAllowEatHere: readAliasBoolean(
      source,
      "publicAllowEatHere",
      defaults.publicAllowEatHere,
      ["allowEatHere", "publicEatHereEnabled"],
    ),
    publicAllowTakeaway: readAliasBoolean(
      source,
      "publicAllowTakeaway",
      defaults.publicAllowTakeaway,
      ["allowTakeaway", "publicTakeawayEnabled"],
    ),
    publicAllowDelivery: readAliasBoolean(
      source,
      "publicAllowDelivery",
      defaults.publicAllowDelivery,
      ["allowDeliveryOrders", "publicDeliveryEnabled"],
    ),
    publicAllowOpenAccounts: readAliasBoolean(
      source,
      "publicAllowOpenAccounts",
      defaults.publicAllowOpenAccounts,
      ["allowOpenAccounts", "publicOpenAccountsEnabled"],
    ),
    publicAllowPaymentProofs: readAliasBoolean(
      source,
      "publicAllowPaymentProofs",
      defaults.publicAllowPaymentProofs,
      ["allowPaymentProofs", "publicPaymentProofsEnabled"],
    ),
    publicAllowProductCustomization: readAliasBoolean(
      source,
      "publicAllowProductCustomization",
      defaults.publicAllowProductCustomization,
      ["allowProductCustomization", "publicCustomizationEnabled"],
    ),
    publicAllowCustomerNotes: readAliasBoolean(
      source,
      "publicAllowCustomerNotes",
      defaults.publicAllowCustomerNotes,
      ["allowCustomerNotes", "publicCustomerNotesEnabled"],
    ),
    publicAllowAttachments: readAliasBoolean(
      source,
      "publicAllowAttachments",
      defaults.publicAllowAttachments,
      ["allowOrderAttachments", "publicAttachmentsEnabled"],
    ),
    publicRequireCustomerPhone: readAliasBoolean(
      source,
      "publicRequireCustomerPhone",
      defaults.publicRequireCustomerPhone,
      ["requireCustomerPhone", "publicPhoneRequired"],
    ),

    internalAllowCancelOrders: readAliasBoolean(
      source,
      "internalAllowCancelOrders",
      defaults.internalAllowCancelOrders,
      ["allowCancelOrders", "allowOrderCancellation"],
    ),
    internalAllowEditOrderNotes: readAliasBoolean(
      source,
      "internalAllowEditOrderNotes",
      defaults.internalAllowEditOrderNotes,
      ["allowEditOrderNotes", "allowStaffEditOrderNotes"],
    ),
    internalAllowReopenPayments: readAliasBoolean(
      source,
      "internalAllowReopenPayments",
      defaults.internalAllowReopenPayments,
      ["allowReopenPayments", "allowPaymentReopen"],
    ),
    internalRequireCloseReview: readAliasBoolean(
      source,
      "internalRequireCloseReview",
      defaults.internalRequireCloseReview,
      ["requireCloseReview", "requireDayCloseReview"],
    ),
    internalShowAdvancedReports: readAliasBoolean(
      source,
      "internalShowAdvancedReports",
      defaults.internalShowAdvancedReports,
      ["showAdvancedReports", "advancedReportsVisible"],
    ),

    inventoryAutoDeductEnabled: readAliasBoolean(
      source,
      "inventoryAutoDeductEnabled",
      defaults.inventoryAutoDeductEnabled,
      ["autoInventoryDeductionEnabled", "autoDeductInventory"],
    ),
    inventoryAutoDeductDryRun: readAliasBoolean(
      source,
      "inventoryAutoDeductDryRun",
      defaults.inventoryAutoDeductDryRun,
      ["inventoryDeductDryRun", "autoInventoryDeductionDryRun"],
    ),
  };
}

export function getBusinessComplexityProfilePatch(
  profile: BusinessComplexityProfile,
  current?: Partial<BusinessComplexitySettings>,
): Partial<BusinessComplexitySettings> {
  if (profile === "custom") {
    return {
      ...normalizeBusinessComplexitySettings(current || {}),
      businessComplexityProfile: "custom",
    };
  }

  const definition = BUSINESS_COMPLEXITY_PROFILE_DEFINITIONS.find(
    (item) => item.value === profile,
  );

  return {
    ...DEFAULT_BUSINESS_COMPLEXITY_SETTINGS,
    ...(definition?.patch || {}),
    businessComplexityProfile: profile,
  };
}

export function isInventoryAutoDeductActuallyEnabled(value: unknown) {
  const settings = normalizeBusinessComplexitySettings(value);

  // Fase 2g solo prepara el interruptor. Para evitar descuentos de stock no
  // validados, el backend lo considera activo únicamente cuando el dueño lo
  // active y además quite el modo de prueba en una fase posterior.
  return (
    settings.inventoryAutoDeductEnabled && !settings.inventoryAutoDeductDryRun
  );
}
