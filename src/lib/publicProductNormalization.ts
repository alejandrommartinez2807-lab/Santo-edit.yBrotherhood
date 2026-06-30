import {
  products as fallbackProducts,
  type Product,
  type ProductSalesChannel,
  type ProductType,
} from "@/data/products"

export type NormalizePublicProductsOptions = {
  imageFallback?: string
}

function normalizePaymentMode(value: unknown): Product["paymentMode"] {
  return value === "divisa" ? "divisa" : "mixto"
}

function normalizeProductType(value: unknown, category: string): ProductType {
  if (
    value === "normal" ||
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value
  }

  return category === "Combos" ? "combo" : "normal"
}

export function tryParsePublicProductJson(value: unknown): unknown {
  if (typeof value !== "string") return value

  const trimmed = value.trim()

  if (!trimmed) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

export function normalizePublicProductArray(value: unknown): unknown[] {
  const parsedValue = tryParsePublicProductJson(value)

  if (Array.isArray(parsedValue)) return parsedValue

  if (typeof parsedValue === "string") {
    return parsedValue
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeSalesChannels(value: unknown): ProductSalesChannel[] {
  const values = normalizePublicProductArray(value)
  const channels = values.filter(
    (channel): channel is ProductSalesChannel =>
      channel === "local" || channel === "takeaway" || channel === "delivery"
  )

  return channels.length ? channels : ["local", "takeaway", "delivery"]
}

function normalizeSelectionRules(value: unknown): Record<string, unknown> {
  const parsedValue = tryParsePublicProductJson(value)

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return {}
  }

  return parsedValue as Record<string, unknown>
}

export function normalizePublicProductBoolean(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()

    if (["true", "1", "si", "sí", "yes", "activo", "activa"].includes(normalized)) {
      return true
    }

    if (["false", "0", "no", "inactivo", "inactiva"].includes(normalized)) {
      return false
    }
  }

  return defaultValue
}

function normalizeNumber(value: unknown, defaultValue = 0) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : defaultValue
}

export function normalizePublicProduct(
  value: unknown,
  options: NormalizePublicProductsOptions = {},
): Product | null {
  const source = (value || {}) as Partial<Product>
  const id = Number(source.id || 0)
  const price = Number(source.price || 0)
  const category = String(source.category || "Otros").trim() || "Otros"
  const imageFallback = options.imageFallback || "/logo.png"

  if (!Number.isFinite(id) || id <= 0 || !source.name) {
    return null
  }

  return {
    id: Math.round(id),
    name: String(source.name || "").trim(),
    category,
    description: String(source.description || "").trim(),
    price: Number.isFinite(price) && price > 0 ? price : 0,
    image: String(source.image || "").trim() || imageFallback,
    paymentMode: normalizePaymentMode(source.paymentMode),
    isActive: source.isActive !== false,
    isFeatured: source.isFeatured === true,
    sortOrder: Number(source.sortOrder || 9999),
    productType: normalizeProductType(source.productType, category),
    salesChannels: normalizeSalesChannels(source.salesChannels),
    variations: normalizePublicProductArray(source.variations),
    addons: normalizePublicProductArray(source.addons),
    includedIngredients: normalizePublicProductArray(source.includedIngredients),
    removableIngredients: normalizePublicProductArray(source.removableIngredients),
    selectionRules: normalizeSelectionRules(source.selectionRules),
    preparationMinutes: normalizeNumber(source.preparationMinutes),
    requiresWaiterConfirmation: normalizePublicProductBoolean(source.requiresWaiterConfirmation),
    inventoryDiscountEnabled: normalizePublicProductBoolean(source.inventoryDiscountEnabled, true),
    premiumSummary: String(source.premiumSummary || "").trim(),
    ivaRate: (() => {
      const raw = (source as { ivaRate?: unknown }).ivaRate
      if (raw == null || raw === "") return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    })(),
  }
}

export function normalizePublicProducts(
  value: unknown,
  options: NormalizePublicProductsOptions = {},
): Product[] {
  if (!Array.isArray(value)) return fallbackProducts

  const cleanProducts = value
    .map((product) => normalizePublicProduct(product, options))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.isActive !== false)
    .sort((a, b) => {
      const orderA = Number(a.sortOrder || 9999)
      const orderB = Number(b.sortOrder || 9999)

      if (orderA !== orderB) return orderA - orderB

      return a.name.localeCompare(b.name)
    })

  return cleanProducts.length ? cleanProducts : fallbackProducts
}
