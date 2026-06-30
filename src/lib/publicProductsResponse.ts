import {
  categories as fallbackCategories,
  products as fallbackProducts,
  type Product,
} from "@/data/products"
import type { MenuProduct } from "@/lib/orders"
import { buildPublicProductCategories } from "@/lib/publicProductCategories"

export type PublicProductsResponse = {
  ok: true
  products: Product[]
  categories: string[]
  fallback: boolean
  warning?: string
}

export function menuProductToPublicProduct(product: MenuProduct): Product {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price,
    image: product.image || "/logo.png",
    paymentMode: product.paymentMode,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder,
    productType: product.productType,
    salesChannels: product.salesChannels,
    variations: product.variations,
    addons: product.addons,
    includedIngredients: product.includedIngredients,
    removableIngredients: product.removableIngredients,
    selectionRules: product.selectionRules,
    preparationMinutes: product.preparationMinutes,
    requiresWaiterConfirmation: product.requiresWaiterConfirmation,
    inventoryDiscountEnabled: product.inventoryDiscountEnabled,
    premiumSummary: product.premiumSummary,
    ivaRate: product.ivaRate,
  }
}

export function buildCategories(products: Product[]) {
  return buildPublicProductCategories(products)
}

export function buildPublicProductsResponse(
  menuProducts: MenuProduct[]
): PublicProductsResponse {
  const activeProducts = menuProducts
    .filter((product) => product.isActive !== false)
    .map(menuProductToPublicProduct)
  const products = activeProducts.length ? activeProducts : fallbackProducts

  return {
    ok: true,
    products,
    categories: buildCategories(products),
    fallback: activeProducts.length === 0,
    warning:
      activeProducts.length === 0
        ? "El menú editable todavía no tiene productos activos. Se está mostrando el menú base."
        : undefined,
  }
}

export function buildPublicProductsFallbackResponse(error?: unknown): PublicProductsResponse {
  return {
    ok: true,
    products: fallbackProducts,
    categories: fallbackCategories,
    fallback: true,
    warning:
      error instanceof Error
        ? `No se pudo cargar el menú editable. Se está mostrando el menú base. Detalle: ${error.message}`
        : "No se pudo cargar el menú editable. Se está mostrando el menú base.",
  }
}
