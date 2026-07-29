// Blindaje del pedido PÚBLICO (BH-SIM-001 / BH-SIM-002, semana real 2026-07).
// El POST /api/orders es público (QR/checkout): el cliente arma el carrito en
// su navegador y hasta ahora el servidor confiaba en `items[].price` y en
// `exchangeRate` tal como llegaban. Un cliente hostil podía fabricar su precio
// (evidencia: pedido guardado en $0.01) o una tasa baja para pagar menos Bs.
// Regla nueva: para peticiones SIN identidad de staff, el precio unitario se
// RECALCULA desde el menú real de la sede y la tasa la decide el servidor.
// Las sesiones de staff conservan su flexibilidad (ítems manuales, ajustes).

import type { MenuProduct } from "@/lib/orders"

type SelectionOptionLike = {
  id?: unknown
  name?: unknown
  priceDelta?: unknown
  quantity?: unknown
}

type PublicOrderItemLike = {
  id?: unknown
  name?: unknown
  price?: unknown
  quantity?: unknown
  selectedVariation?: SelectionOptionLike | null
  selectedAddons?: SelectionOptionLike[] | null
}

export type RepriceResult =
  | { ok: true; items: (PublicOrderItemLike & { price: number; basePrice: number })[] }
  | { ok: false; error: string }

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function cleanText(value: unknown) {
  return String(value ?? "").trim()
}

function cleanNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

type PriceIndexEntry = {
  price: number
  isActive: boolean
  // clave (id o nombre, normalizados) → delta legítimo de esa opción
  optionDeltas: Map<string, number>
}

function normalizeKey(value: unknown) {
  return cleanText(value).toLowerCase()
}

function collectOptionValues(entry: PriceIndexEntry, values: unknown, priceKey: "priceDelta" | "price" | "extraPrice") {
  if (!Array.isArray(values)) return
  for (const raw of values) {
    if (!raw || typeof raw !== "object") continue
    const option = raw as Record<string, unknown>
    const delta = cleanNumber(option[priceKey])
    const idKey = normalizeKey(option.id)
    const nameKey = normalizeKey(option.name)
    if (idKey) entry.optionDeltas.set(idKey, delta)
    if (nameKey) entry.optionDeltas.set(nameKey, delta)
    // Grupos de variaciones anidados ({ values: [...] })
    if (Array.isArray((option as { values?: unknown }).values)) {
      collectOptionValues(entry, (option as { values?: unknown }).values, "priceDelta")
    }
  }
}

export function buildProductPriceIndex(menuProducts: MenuProduct[]): Map<number, PriceIndexEntry> {
  const index = new Map<number, PriceIndexEntry>()
  for (const product of menuProducts || []) {
    const record = product as unknown as Record<string, unknown>
    const id = Math.round(cleanNumber(record.id))
    if (!id) continue
    const entry: PriceIndexEntry = {
      price: roundMoney(cleanNumber(record.price)),
      isActive: record.isActive !== false,
      optionDeltas: new Map(),
    }
    collectOptionValues(entry, record.variations, "priceDelta")
    collectOptionValues(entry, record.addons, "price")
    collectOptionValues(entry, record.includedIngredients, "extraPrice")
    collectOptionValues(entry, record.removableIngredients, "extraPrice")
    index.set(id, entry)
  }
  return index
}

function lookupOption(entry: PriceIndexEntry, option: SelectionOptionLike): number | null {
  const byId = normalizeKey(option.id)
  if (byId && entry.optionDeltas.has(byId)) return entry.optionDeltas.get(byId) as number
  const byName = normalizeKey(option.name)
  if (byName && entry.optionDeltas.has(byName)) return entry.optionDeltas.get(byName) as number
  return null
}

const MENU_CHANGED_ERROR =
  "El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo."

export function repricePublicOrderItems(
  items: PublicOrderItemLike[],
  menuProducts: MenuProduct[],
): RepriceResult {
  const index = buildProductPriceIndex(menuProducts)
  const repriced: (PublicOrderItemLike & { price: number; basePrice: number })[] = []

  for (const item of items || []) {
    const productId = Math.round(cleanNumber(item.id))
    const entry = index.get(productId)
    if (!entry || !entry.isActive) {
      return { ok: false, error: MENU_CHANGED_ERROR }
    }

    let unit = entry.price

    const variation = item.selectedVariation
    if (variation && (cleanText(variation.id) || cleanText(variation.name))) {
      const delta = lookupOption(entry, variation)
      if (delta === null) return { ok: false, error: MENU_CHANGED_ERROR }
      unit = roundMoney(unit + delta)
    }

    for (const addon of item.selectedAddons || []) {
      if (!addon || !(cleanText(addon.id) || cleanText(addon.name))) continue
      const delta = lookupOption(entry, addon)
      if (delta === null) return { ok: false, error: MENU_CHANGED_ERROR }
      const addonQuantity = Math.max(1, Math.round(cleanNumber(addon.quantity) || 1))
      unit = roundMoney(unit + delta * addonQuantity)
    }

    repriced.push({ ...item, price: unit, basePrice: entry.price })
  }

  return { ok: true, items: repriced }
}

// BH-SIM-002: la tasa de un pedido público la decide el servidor. Si el
// negocio tiene tasa propia (>0), la del cliente se ignora; sin tasa del
// servidor, la del cliente sobrevive solo si es un número positivo.
export function resolvePublicExchangeRate(clientRate: unknown, serverRate: unknown): number {
  const server = cleanNumber(serverRate)
  if (server > 0) return server
  const client = cleanNumber(clientRate)
  return client > 0 ? client : 0
}
