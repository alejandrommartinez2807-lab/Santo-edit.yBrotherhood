"use client"

import { useEffect, useMemo, useState } from "react"

const CART_STORAGE_KEY = "santo_perrito_cart_v5_channels"

export type CartProductType =
  | "normal"
  | "variations"
  | "addons"
  | "buildable"
  | "combo"

export type CartSalesChannel = "local" | "takeaway" | "delivery"

export type CartSelectionOption = {
  id?: string
  name: string
  groupName?: string
  priceDelta?: number
  quantity?: number
}

export type CartItem = {
  cartLineId: string
  id: number
  name: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  category: string
  quantity: number
  note?: string
  noteEnabled?: boolean
  paymentMode?: "divisa" | "mixto"
  productType?: CartProductType
  selectedVariation?: CartSelectionOption | null
  selectedAddons?: CartSelectionOption[]
  removedIngredients?: CartSelectionOption[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  salesChannels?: CartSalesChannel[]
  ivaRate?: number | null
}

export type ProductToAdd = {
  id: number
  name: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  category: string
  paymentMode?: "divisa" | "mixto"
  productType?: CartProductType
  selectedVariation?: CartSelectionOption | null
  selectedAddons?: CartSelectionOption[]
  removedIngredients?: CartSelectionOption[]
  selectionSummary?: string
  requiresWaiterConfirmation?: boolean
  salesChannels?: CartSalesChannel[]
  ivaRate?: number | null
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function cleanNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeProductType(value: unknown): CartProductType {
  if (
    value === "normal" ||
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value
  }

  return "normal"
}


function normalizeSalesChannels(value: unknown): CartSalesChannel[] {
  if (!Array.isArray(value)) {
    return ["local", "takeaway", "delivery"]
  }

  const channels = value.filter(
    (channel): channel is CartSalesChannel =>
      channel === "local" || channel === "takeaway" || channel === "delivery"
  )

  return channels.length ? Array.from(new Set(channels)) : ["local", "takeaway", "delivery"]
}

function normalizeSelectionOption(value: unknown): CartSelectionOption | null {
  if (!value || typeof value !== "object") return null

  const source = value as Partial<CartSelectionOption>
  const name = cleanText(source.name)

  if (!name) return null

  const priceDelta = cleanNumber(source.priceDelta, 0)
  const quantity = Math.max(1, Math.round(cleanNumber(source.quantity, 1)))

  return {
    id: cleanText(source.id) || undefined,
    name,
    groupName: cleanText(source.groupName) || undefined,
    priceDelta,
    quantity,
  }
}

function normalizeSelectionOptions(value: unknown): CartSelectionOption[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeSelectionOption)
    .filter((option): option is CartSelectionOption => Boolean(option))
}

function optionKey(option: CartSelectionOption | null | undefined) {
  if (!option) return ""

  return [
    cleanText(option.groupName),
    cleanText(option.name),
    cleanNumber(option.priceDelta, 0).toFixed(2),
    Math.max(1, Math.round(cleanNumber(option.quantity, 1))),
  ].join("|")
}

function buildCartLineId(product: ProductToAdd) {
  const selectedAddons = normalizeSelectionOptions(product.selectedAddons)
  const removedIngredients = normalizeSelectionOptions(product.removedIngredients)

  const parts = [
    `p:${product.id}`,
    `v:${optionKey(normalizeSelectionOption(product.selectedVariation))}`,
    `a:${selectedAddons.map(optionKey).sort().join(";")}`,
    `r:${removedIngredients.map(optionKey).sort().join(";")}`,
  ]

  return parts.join("__")
}


function formatSelectionOption(option: CartSelectionOption) {
  const quantity = Math.max(1, Math.round(cleanNumber(option.quantity, 1)))
  const quantityLabel = quantity > 1 ? ` x${quantity}` : ""
  const priceDelta = cleanNumber(option.priceDelta, 0)
  const priceLabel = priceDelta > 0 ? ` (+$${(priceDelta * quantity).toFixed(2)})` : ""

  return `${cleanText(option.groupName) ? `${cleanText(option.groupName)}: ` : ""}${option.name}${quantityLabel}${priceLabel}`
}

function buildSelectionSummary(product: ProductToAdd) {
  const parts: string[] = []
  const selectedVariation = normalizeSelectionOption(product.selectedVariation)
  const selectedAddons = normalizeSelectionOptions(product.selectedAddons)
  const removedIngredients = normalizeSelectionOptions(product.removedIngredients)

  if (selectedVariation) {
    parts.push(
      formatSelectionOption(selectedVariation)
    )
  }

  if (selectedAddons.length > 0) {
    parts.push(`Adicionales: ${selectedAddons.map(formatSelectionOption).join(", ")}`)
  }

  if (removedIngredients.length > 0) {
    parts.push(`Sin: ${removedIngredients.map((option) => option.name).join(", ")}`)
  }

  return cleanText(product.selectionSummary) || parts.join(" · ")
}

function normalizeCartItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => {
      return (
        item &&
        typeof item === "object" &&
        "id" in item &&
        "name" in item &&
        "price" in item
      )
    })
    .map((item: Record<string, unknown>) => {
      const id = Number(item.id)
      const price = cleanNumber(item.price, 0)
      const basePrice = cleanNumber(item.basePrice, price)
      const selectedVariation = normalizeSelectionOption(item.selectedVariation)
      const selectedAddons = normalizeSelectionOptions(item.selectedAddons)
      const removedIngredients = normalizeSelectionOptions(item.removedIngredients)
      const productType = normalizeProductType(item.productType)
      const product: ProductToAdd = {
        id,
        name: cleanText(item.name),
        price,
        basePrice,
        unitOptionsPrice: cleanNumber(item.unitOptionsPrice, Math.max(0, price - basePrice)),
        image: cleanText(item.image),
        category: cleanText(item.category),
        paymentMode: item.paymentMode === "divisa" ? "divisa" : "mixto",
        productType,
        selectedVariation,
        selectedAddons,
        removedIngredients,
        selectionSummary: cleanText(item.selectionSummary),
        requiresWaiterConfirmation: Boolean(item.requiresWaiterConfirmation),
        salesChannels: normalizeSalesChannels(item.salesChannels),
        ivaRate: item.ivaRate == null ? null : Number(item.ivaRate),
      }

      return {
        ...product,
        cartLineId: cleanText(item.cartLineId) || buildCartLineId(product),
        quantity: Math.max(1, Math.round(cleanNumber(item.quantity, 1))),
        note: cleanText(item.note),
        noteEnabled: Boolean(item.noteEnabled ?? false),
        selectionSummary: buildSelectionSummary(product),
      }
    })
    .filter((item) => item.id && item.name && item.price >= 0)
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY)

      if (savedCart) {
        setItems(normalizeCartItems(JSON.parse(savedCart)))
      }
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  function addItem(product: ProductToAdd) {
    const basePrice = cleanNumber(product.basePrice, product.price)
    const price = Math.max(0, cleanNumber(product.price, basePrice))
    const selectedVariation = normalizeSelectionOption(product.selectedVariation)
    const selectedAddons = normalizeSelectionOptions(product.selectedAddons)
    const removedIngredients = normalizeSelectionOptions(product.removedIngredients)
    const normalizedProduct: ProductToAdd = {
      id: Number(product.id),
      name: cleanText(product.name),
      price,
      basePrice,
      unitOptionsPrice: cleanNumber(product.unitOptionsPrice, Math.max(0, price - basePrice)),
      image: cleanText(product.image),
      category: cleanText(product.category),
      paymentMode: product.paymentMode === "divisa" ? "divisa" : "mixto",
      productType: normalizeProductType(product.productType),
      selectedVariation,
      selectedAddons,
      removedIngredients,
      selectionSummary: cleanText(product.selectionSummary),
      requiresWaiterConfirmation: Boolean(product.requiresWaiterConfirmation),
      salesChannels: normalizeSalesChannels(product.salesChannels),
    }

    const cartLineId = buildCartLineId(normalizedProduct)
    const selectionSummary = buildSelectionSummary(normalizedProduct)

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.cartLineId === cartLineId
      )

      if (existingItem) {
        return currentItems.map((item) =>
          item.cartLineId === cartLineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [
        ...currentItems,
        {
          ...normalizedProduct,
          cartLineId,
          quantity: 1,
          note: "",
          noteEnabled: false,
          selectionSummary,
        },
      ]
    })
  }

  function removeItem(cartLineId: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.cartLineId !== cartLineId)
    )
  }

  function increaseQuantity(cartLineId: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartLineId === cartLineId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }

  function decreaseQuantity(cartLineId: string) {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.cartLineId === cartLineId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function updateItemNote(cartLineId: string, note: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartLineId === cartLineId ? { ...item, note } : item
      )
    )
  }

  function updateItemNoteEnabled(cartLineId: string, noteEnabled: boolean) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartLineId === cartLineId
          ? {
              ...item,
              noteEnabled,
              note: noteEnabled ? item.note ?? "" : "",
            }
          : item
      )
    )
  }

  function clearCart() {
    setItems([])
  }

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )

  return {
    items,
    addItem,
    removeItem,
    increaseQuantity,
    decreaseQuantity,
    updateItemNote,
    updateItemNoteEnabled,
    clearCart,
    totalItems,
    totalPrice,
  }
}
