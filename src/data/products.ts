export type ProductPaymentMode = "divisa" | "mixto"

export type ProductType = "normal" | "variations" | "addons" | "buildable" | "combo"

export type ProductSalesChannel = "local" | "takeaway" | "delivery"

export type Product = {
  id: number
  name: string
  category: string
  description: string
  price: number
  image: string
  paymentMode: ProductPaymentMode
  isActive?: boolean
  isFeatured?: boolean
  sortOrder?: number
  productType?: ProductType
  salesChannels?: ProductSalesChannel[]
  variations?: unknown[]
  addons?: unknown[]
  includedIngredients?: unknown[]
  removableIngredients?: unknown[]
  selectionRules?: Record<string, unknown>
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
  inventoryDiscountEnabled?: boolean
  premiumSummary?: string
  /** Tasa de IVA del producto (16 / 8 / 0 = exento). null = usa la default del negocio. */
  ivaRate?: number | null
}

export const categories = [
  "Todos",
  "Burgers",
  "Combos",
  "Papas",
  "Chicken",
  "Bebidas",
  "Postres",
]


export const products: Product[] = []
