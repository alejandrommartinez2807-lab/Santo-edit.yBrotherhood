// Helpers puros extraídos de ProductCard (sin estado/JSX). Comportamiento idéntico.
import { formatUSD } from "@/utils/formatCurrency";
import type { CartSelectionOption } from "@/hooks/useCart";
import type { Product, ProductSalesChannel, ProductType } from "@/data/products";

export type DisplayOption = {
  label: string;
  detail?: string;
};

export type SelectableOption = CartSelectionOption & {
  key: string;
  detail?: string;
  maxQuantity?: number;
};

export type ProductSelectionRules = {
  maxAddons: number;
  minAddons: number;
  requiresStaffReview: boolean;
  notes: string;
};

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function cleanNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function cleanPositiveInteger(value: unknown) {
  const numberValue = Math.floor(cleanNumber(value));

  return numberValue > 0 ? numberValue : 0;
}

export function getProductType(
  value: Product["productType"],
  category: string,
): ProductType {
  if (
    value === "normal" ||
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value;
  }

  return category === "Combos" ? "combo" : "normal";
}

export function getSalesChannels(
  channels: Product["salesChannels"],
): ProductSalesChannel[] {
  if (!Array.isArray(channels) || channels.length === 0) {
    return ["local", "takeaway", "delivery"];
  }

  const validChannels = channels.filter(
    (channel): channel is ProductSalesChannel =>
      channel === "local" || channel === "takeaway" || channel === "delivery",
  );

  return validChannels.length
    ? validChannels
    : ["local", "takeaway", "delivery"];
}

export function readText(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";

  const source = value as Record<string, unknown>;

  for (const key of keys) {
    const text = source[key];

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    if (typeof text === "number" && Number.isFinite(text)) {
      return String(text);
    }
  }

  return "";
}

export function readNumber(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return 0;

  const source = value as Record<string, unknown>;

  for (const key of keys) {
    const numberValue = Number(source[key]);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return 0;
}

export function readPositiveInteger(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return 0;

  const source = value as Record<string, unknown>;

  for (const key of keys) {
    const numberValue = cleanPositiveInteger(source[key]);

    if (numberValue > 0) return numberValue;
  }

  return 0;
}

export function readBoolean(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;

  for (const key of keys) {
    const rawValue = source[key];

    if (typeof rawValue === "boolean") return rawValue;
    if (typeof rawValue === "number") return rawValue > 0;
    if (typeof rawValue === "string") {
      const normalized = rawValue
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

      if (
        ["true", "1", "si", "yes", "activo", "activa", "incluido"].includes(
          normalized,
        )
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
          "pausado",
          "pausada",
        ].includes(normalized)
      ) {
        return false;
      }
    }
  }

  return null;
}

export function readArray(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return [];

  const source = value as Record<string, unknown>;

  for (const key of keys) {
    const arrayValue = source[key];

    if (Array.isArray(arrayValue)) return arrayValue;
  }

  return [];
}

export function normalizeSelectionRules(
  value: Product["selectionRules"],
): ProductSelectionRules {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    maxAddons: cleanPositiveInteger(
      source.maxAddons ?? source.maximumAddons ?? source.maxExtras,
    ),
    minAddons: cleanPositiveInteger(
      source.minAddons ?? source.minimumAddons ?? source.minExtras,
    ),
    requiresStaffReview:
      readBoolean(source, [
        "requiresStaffReview",
        "requiresWaiterConfirmation",
      ]) === true,
    notes: cleanText(source.notes ?? source.note ?? source.internalRulesNote),
  };
}

export function formatOptionPrice(priceDelta: number) {
  if (!priceDelta) return "";

  return priceDelta > 0
    ? `+${formatUSD(priceDelta)}`
    : `-${formatUSD(Math.abs(priceDelta))}`;
}

export function formatSelectedOption(option: CartSelectionOption) {
  const quantity = Math.max(1, Math.round(cleanNumber(option.quantity) || 1));
  const quantityLabel = quantity > 1 ? ` x${quantity}` : "";
  const priceDelta = cleanNumber(option.priceDelta);
  const priceLabel =
    priceDelta > 0 ? ` (+${formatUSD(priceDelta * quantity)})` : "";

  return `${option.name}${quantityLabel}${priceLabel}`;
}

export function toDisplayOptions(
  value: unknown[] | undefined,
  fallbackLabel: string,
): DisplayOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((option, index): DisplayOption | null => {
      if (typeof option === "string") {
        const label = option.trim();
        return label ? { label } : null;
      }

      if (typeof option === "number" && Number.isFinite(option)) {
        return { label: String(option) };
      }

      if (readBoolean(option, ["isActive", "active", "activo"]) === false) {
        return null;
      }

      const label =
        readText(option, [
          "name",
          "nombre",
          "title",
          "titulo",
          "label",
          "etiqueta",
          "option",
          "opcion",
        ]) || `${fallbackLabel} ${index + 1}`;

      const price = readNumber(option, [
        "priceDelta",
        "price",
        "precio",
        "priceUSD",
        "precioUSD",
        "extraPrice",
        "additionalPrice",
      ]);
      const maxQuantity = readPositiveInteger(option, [
        "maxQuantity",
        "cantidadMaxima",
        "max",
        "limit",
      ]);
      const description = readText(option, [
        "description",
        "descripcion",
        "detail",
        "detalle",
        "note",
        "nota",
      ]);

      const detailParts = [
        formatOptionPrice(price),
        maxQuantity > 1 ? `máx. ${maxQuantity}` : "",
        description,
      ].filter(Boolean);

      return {
        label,
        detail: detailParts.join(" · ") || undefined,
      };
    })
    .filter((option): option is DisplayOption => Boolean(option?.label));
}

export function ingredientList(value: unknown[] | undefined) {
  return toDisplayOptions(value, "Ingrediente").map((option) => option.label);
}

export function normalizeSelectableOption(
  value: unknown,
  index: number,
  fallbackLabel: string,
  groupName?: string,
): SelectableOption | null {
  if (typeof value === "string") {
    const name = value.trim();

    if (!name) return null;

    return {
      key: `${fallbackLabel}-${index}-${name}`,
      id: `${fallbackLabel}-${index}`,
      name,
      groupName,
      priceDelta: 0,
      quantity: 1,
      maxQuantity: 1,
    };
  }

  if (!value || typeof value !== "object") return null;

  if (readBoolean(value, ["isActive", "active", "activo"]) === false) {
    return null;
  }

  const name =
    readText(value, [
      "name",
      "nombre",
      "title",
      "titulo",
      "label",
      "etiqueta",
      "option",
      "opcion",
    ]) || `${fallbackLabel} ${index + 1}`;
  const priceDelta = readNumber(value, [
    "priceDelta",
    "price",
    "precio",
    "priceUSD",
    "precioUSD",
    "extraPrice",
    "additionalPrice",
  ]);
  const maxQuantity =
    readPositiveInteger(value, [
      "maxQuantity",
      "cantidadMaxima",
      "max",
      "limit",
    ]) || 1;
  const detail = readText(value, [
    "description",
    "descripcion",
    "detail",
    "detalle",
    "note",
    "nota",
  ]);
  const id = readText(value, ["id", "key", "slug"]);

  return {
    key: `${fallbackLabel}-${index}-${id || name}-${priceDelta}`,
    id: id || `${fallbackLabel}-${index}`,
    name,
    groupName,
    priceDelta,
    quantity: 1,
    maxQuantity,
    detail:
      [
        formatOptionPrice(priceDelta),
        maxQuantity > 1 ? `máx. ${maxQuantity}` : "",
        detail,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
  };
}

export function flattenVariationOptions(
  value: unknown[] | undefined,
): SelectableOption[] {
  if (!Array.isArray(value)) return [];

  const options: SelectableOption[] = [];

  value.forEach((item, itemIndex) => {
    if (readBoolean(item, ["isActive", "active", "activo"]) === false) {
      return;
    }

    const groupName = readText(item, [
      "name",
      "nombre",
      "title",
      "titulo",
      "label",
      "etiqueta",
    ]);
    const values = readArray(item, ["values", "opciones", "options", "items"]);

    if (values.length > 0) {
      values.forEach((valueItem, valueIndex) => {
        const option = normalizeSelectableOption(
          valueItem,
          valueIndex,
          `variation-${itemIndex}`,
          groupName,
        );

        if (option) options.push(option);
      });
      return;
    }

    const option = normalizeSelectableOption(item, itemIndex, "variation");

    if (option) options.push(option);
  });

  return options;
}

// Vista por GRUPO de variaciones para el customizer público (estilo
// BOMBASTYC: "Burger", "Tipo de molla", "Refresco" como secciones separadas,
// cada una con su propia obligatoriedad y límites). Las entradas legadas sin
// values[] se agrupan en un grupo sin nombre ("Elige presentación").
export type VariationGroupView = {
  key: string;
  name: string;
  required: boolean;
  multiple: boolean;
  minSelections: number;
  maxSelections: number;
  options: SelectableOption[];
};

export function readVariationGroups(
  value: unknown[] | undefined,
): VariationGroupView[] {
  if (!Array.isArray(value)) return [];

  const groups: VariationGroupView[] = [];
  const legacyOptions: SelectableOption[] = [];

  value.forEach((item, itemIndex) => {
    if (readBoolean(item, ["isActive", "active", "activo"]) === false) {
      return;
    }

    const groupName = readText(item, [
      "name",
      "nombre",
      "title",
      "titulo",
      "label",
      "etiqueta",
    ]);
    const values = readArray(item, ["values", "opciones", "options", "items"]);

    if (values.length > 0) {
      const options = values
        .map((valueItem, valueIndex) =>
          normalizeSelectableOption(
            valueItem,
            valueIndex,
            `variation-${itemIndex}`,
            groupName,
          ),
        )
        .filter((option): option is SelectableOption => Boolean(option));

      if (!options.length) return;

      const required =
        readBoolean(item, ["required", "obligatorio", "isRequired"]) === true;
      const minSelections = readPositiveInteger(item, [
        "minSelections",
        "min",
        "minimo",
      ]);
      const maxSelections = readPositiveInteger(item, [
        "maxSelections",
        "max",
        "maximo",
      ]);
      const multiple =
        readText(item, ["type", "tipo"]).toLowerCase() === "multiple";

      groups.push({
        key: `variation-group-${itemIndex}`,
        name: groupName,
        required: required || minSelections > 0,
        multiple,
        minSelections: required ? Math.max(1, minSelections) : minSelections,
        maxSelections: multiple ? maxSelections : 1,
        options,
      });
      return;
    }

    const option = normalizeSelectableOption(item, itemIndex, "variation");

    if (option) legacyOptions.push(option);
  });

  if (legacyOptions.length > 0) {
    groups.push({
      key: "variation-group-legacy",
      name: "",
      required: false,
      multiple: false,
      minSelections: 0,
      maxSelections: 1,
      options: legacyOptions,
    });
  }

  return groups;
}

export function flattenAddonOptions(value: unknown[] | undefined): SelectableOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => normalizeSelectableOption(item, index, "addon"))
    .filter((option): option is SelectableOption => Boolean(option));
}

export function flattenIngredientOptions(
  value: unknown[] | undefined,
): SelectableOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => normalizeSelectableOption(item, index, "ingredient"))
    .filter((option): option is SelectableOption => Boolean(option));
}

export function hasRequiredVariation(value: unknown[] | undefined) {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (!item || typeof item !== "object") return false;

    const required = readBoolean(item, [
      "required",
      "obligatorio",
      "isRequired",
    ]);
    const minSelections = readPositiveInteger(item, [
      "minSelections",
      "min",
      "minimo",
    ]);

    return required === true || minSelections > 0;
  });
}
