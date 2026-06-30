import type {
  MenuProductSalesChannel,
  MenuProductType,
  SaveMenuProductInput,
} from "./ordersMenu"
import type { ProductPaymentMode } from "@/types/localOrders"

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizePaymentMode(value: unknown): ProductPaymentMode {
  return value === "divisa" ? "divisa" : "mixto"
}

function normalizeProductType(value: unknown): MenuProductType {
  if (
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value
  }

  return "normal"
}

function normalizeSalesChannels(value: unknown): MenuProductSalesChannel[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue) ? parsedValue : cleanValue.split(/[;,|]/g)
          } catch {
            return cleanValue.split(/[;,|]/g)
          }
        })()
      : []
  const allowedChannels: MenuProductSalesChannel[] = ["local", "takeaway", "delivery"]
  const selectedChannels = rawList
    .map((item) => String(item || "").trim())
    .filter((item): item is MenuProductSalesChannel =>
      allowedChannels.includes(item as MenuProductSalesChannel)
    )

  return selectedChannels.length ? Array.from(new Set(selectedChannels)) : allowedChannels
}

function normalizeJsonArray(value: unknown) {
  if (Array.isArray(value)) return value

  const rawValue = String(value || "").trim()

  if (!rawValue) return []

  try {
    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

function normalizeJsonRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  const rawValue = String(value || "").trim()

  if (!rawValue) return {}

  try {
    const parsedValue = JSON.parse(rawValue)

    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? (parsedValue as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round(numberValue)
}

export { normalizeProductIds } from "@/lib/productIdList"

export function normalizeMenuProductInput(value: unknown): SaveMenuProductInput {
  const source = (value || {}) as Partial<SaveMenuProductInput>
  const id = Number(source.id || 0)

  return {
    id: Number.isFinite(id) && id > 0 ? Math.round(id) : undefined,
    name: String(source.name || "").trim(),
    category: String(source.category || "Otros").trim() || "Otros",
    description: String(source.description || "").trim(),
    price: normalizeNumber(source.price),
    image: String(source.image || "").trim(),
    paymentMode: normalizePaymentMode(source.paymentMode),
    isActive: normalizeBoolean(source.isActive, true),
    isFeatured: normalizeBoolean(source.isFeatured, false),
    sortOrder: normalizeNumber(source.sortOrder),
    productType: normalizeProductType(source.productType),
    salesChannels: normalizeSalesChannels(source.salesChannels),
    variations: normalizeJsonArray(source.variations),
    addons: normalizeJsonArray(source.addons),
    includedIngredients: normalizeJsonArray(source.includedIngredients),
    removableIngredients: normalizeJsonArray(source.removableIngredients),
    selectionRules: normalizeJsonRecord(source.selectionRules),
    preparationMinutes: normalizePositiveInteger(source.preparationMinutes),
    requiresWaiterConfirmation: normalizeBoolean(source.requiresWaiterConfirmation, false),
    inventoryDiscountEnabled: normalizeBoolean(source.inventoryDiscountEnabled, true),
    ivaRate: (() => {
      const raw = (source as { ivaRate?: unknown }).ivaRate
      if (raw == null || raw === "") return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
    })(),
  }
}
