import { cleanText } from "@/components/cartUtils";
import { DEFAULT_PUBLIC_PAYMENT_METHODS } from "@/lib/publicPageConfig";

export type DeliveryZone = {
  name: string;
  costUSD: number;
  isActive?: boolean;
};

export const LOCATIONS_STORAGE_KEY = "santo_perrito_order_locations";

// Semilla del editor de zonas en Configuración (panel privado). El carrito
// público ya NO las usa: ahí solo valen las zonas reales de /api/delivery-zones.
export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [
  { name: "La Trigaleña", costUSD: 2, isActive: true },
  { name: "Centro", costUSD: 1, isActive: true },
  { name: "Prebo", costUSD: 2.5, isActive: true },
  { name: "Naguanagua", costUSD: 3, isActive: true },
  { name: "Los Samanes", costUSD: 3, isActive: true },
  { name: "San Diego", costUSD: 4, isActive: true },
];

// Fallback cuando el dueño no ha personalizado sus métodos en Configuración
// (la lista editable viaja en businessConfig.publicPaymentMethods).
export const PAYMENT_METHOD_OPTIONS = DEFAULT_PUBLIC_PAYMENT_METHODS;

export const ADDRESS_HELPERS = [
  "Urb.",
  "Calle",
  "Casa",
  "Apto",
  "Edificio",
  "Conjunto",
  "Frente a",
  "Al lado de",
];

export function cleanCustomerNoteWithStaffConfirmation(
  customerNote: string,
  productNames: string[],
) {
  const note = cleanText(customerNote);

  if (!productNames.length) return note;

  const confirmationNote = `Productos por confirmar con el personal: ${productNames.join(", ")}.`;

  if (!note) return confirmationNote;

  if (note.includes(confirmationNote)) return note;

  return `${note}\n${confirmationNote}`;
}

export function cleanStaffConfirmationProductLabel(productNames: string[]) {
  if (!productNames.length) return "";
  if (productNames.length === 1) return productNames[0];

  return (
    productNames.slice(0, -1).join(", ") +
    " y " +
    productNames[productNames.length - 1]
  );
}

export async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "El servidor no devolvió una respuesta válida. Revisa que la API de pedidos y Supabase estén funcionando correctamente.",
    );
  }
}

export function normalizeFormMoney(value: string) {
  const rawValue = value.trim().replace(/\s/g, "");

  if (!rawValue) return 0;

  const hasComma = rawValue.includes(",");
  const hasDot = rawValue.includes(".");
  const lastCommaIndex = rawValue.lastIndexOf(",");
  const lastDotIndex = rawValue.lastIndexOf(".");
  let normalizedValue = rawValue;

  if (hasComma && hasDot) {
    normalizedValue =
      lastCommaIndex > lastDotIndex
        ? rawValue.replace(/\./g, "").replace(",", ".")
        : rawValue.replace(/,/g, "");
  } else if (hasComma) {
    normalizedValue = rawValue.replace(",", ".");
  }

  const numberValue = Number(normalizedValue);

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

export function normalizeDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((zone) => ({
      name: String(zone?.name || "").trim(),
      costUSD: Number(zone?.costUSD || 0),
      isActive: zone?.isActive !== false,
    }))
    .filter(
      (zone) =>
        zone.name &&
        zone.isActive !== false &&
        Number.isFinite(zone.costUSD) &&
        zone.costUSD >= 0,
    );
}
