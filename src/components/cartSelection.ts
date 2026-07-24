// Helpers de selección de ítems del carrito, extraídos de CartDrawer (puros).
import { formatPublicUSD as formatUSD } from "@/utils/formatCurrency";
import type { CartItem, CartSelectionOption } from "@/components/cartTypes";

export function cleanSelectionOption(
  option: CartSelectionOption | null | undefined,
): CartSelectionOption | null {
  const name = String(option?.name || "").trim();

  if (!name) return null;

  return {
    id: String(option?.id || "").trim() || undefined,
    name,
    groupName: String(option?.groupName || "").trim() || undefined,
    priceDelta: Number.isFinite(Number(option?.priceDelta))
      ? Number(option?.priceDelta)
      : 0,
    quantity: Math.max(1, Math.round(Number(option?.quantity || 1))),
  };
}

export function cleanSelectionOptions(
  options: CartSelectionOption[] | undefined,
): CartSelectionOption[] {
  if (!Array.isArray(options)) return [];

  const cleanedOptions: CartSelectionOption[] = [];

  options.forEach((option) => {
    const cleanedOption = cleanSelectionOption(option);

    if (cleanedOption) {
      cleanedOptions.push(cleanedOption);
    }
  });

  return cleanedOptions;
}

export function formatSelectionOption(option: CartSelectionOption) {
  const quantityLabel =
    option.quantity && option.quantity > 1 ? ` x${option.quantity}` : "";
  const priceDelta = Number(option.priceDelta || 0);
  const priceLabel = priceDelta > 0 ? ` (+${formatUSD(priceDelta)})` : "";

  return `${option.groupName ? `${option.groupName}: ` : ""}${option.name}${quantityLabel}${priceLabel}`;
}

export function buildSelectionLines(item: CartItem) {
  const lines: string[] = [];
  const selectedVariation = cleanSelectionOption(item.selectedVariation);
  const selectedAddons = cleanSelectionOptions(item.selectedAddons);
  const removedIngredients = cleanSelectionOptions(item.removedIngredients);

  if (selectedVariation) {
    lines.push(`Variación: ${formatSelectionOption(selectedVariation)}`);
  }

  if (selectedAddons.length > 0) {
    lines.push(
      `Adicionales: ${selectedAddons.map(formatSelectionOption).join(", ")}`,
    );
  }

  if (removedIngredients.length > 0) {
    lines.push(
      `Sin: ${removedIngredients.map((option) => option.name).join(", ")}`,
    );
  }

  if (item.requiresWaiterConfirmation) {
    lines.push("Requiere confirmación del personal");
  }

  return lines;
}

export function getSelectionSummary(item: CartItem) {
  const summary = String(item.selectionSummary || "").trim();

  if (summary) return summary;

  return buildSelectionLines(item).join(" · ");
}

// Desglose ESTRUCTURADO de la selección para pintar el resumen con jerarquía
// visual en el carrito (proteína/variación aparte, extras como chips, quitados
// aparte), en vez de un solo texto concatenado.
export type CartSelectionSegments = {
  variation: { label: string; groupName: string } | null;
  addons: { label: string; priceDelta: number }[];
  removed: string[];
  notes: string[];
};

export function buildSelectionSegments(item: CartItem): CartSelectionSegments {
  const selectedVariation = cleanSelectionOption(item.selectedVariation);
  const selectedAddons = cleanSelectionOptions(item.selectedAddons);
  const removedIngredients = cleanSelectionOptions(item.removedIngredients);

  const variation = selectedVariation
    ? {
        label:
          selectedVariation.quantity && selectedVariation.quantity > 1
            ? `${selectedVariation.name} x${selectedVariation.quantity}`
            : selectedVariation.name,
        groupName: selectedVariation.groupName || "",
      }
    : null;

  const addons = selectedAddons.map((option) => ({
    label:
      option.quantity && option.quantity > 1
        ? `${option.name} x${option.quantity}`
        : option.name,
    priceDelta: Number(option.priceDelta || 0),
  }));

  const removed = removedIngredients.map((option) => option.name);

  const notes = item.requiresWaiterConfirmation
    ? ["Requiere confirmación del personal"]
    : [];

  return { variation, addons, removed, notes };
}

export function hasSelectionSegments(segments: CartSelectionSegments) {
  return Boolean(
    segments.variation ||
      segments.addons.length > 0 ||
      segments.removed.length > 0 ||
      segments.notes.length > 0,
  );
}
