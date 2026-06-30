import { categories as fallbackCategories, type Product } from "@/data/products"

export function buildPublicProductCategories(
  products: Pick<Product, "category">[],
  apiCategories?: unknown,
) {
  const fromApi = Array.isArray(apiCategories)
    ? apiCategories.map((category) => String(category || "").trim()).filter(Boolean)
    : []

  const merged = [
    ...fallbackCategories,
    ...fromApi,
    ...products.map((product) => product.category).filter(Boolean),
  ]

  return Array.from(new Set(merged)).filter(Boolean)
}
