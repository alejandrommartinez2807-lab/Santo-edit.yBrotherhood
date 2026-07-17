import { categories as fallbackCategories, type Product } from "@/data/products"

// Categorías del menú público. Se derivan del menú REAL (en el orden del menú,
// vía sortOrder) para que nunca queden chips de categorías sin productos: las
// categorías base de la plantilla solo aplican como último recurso cuando el
// menú editable está vacío (marcas white-label recién creadas).
export function buildPublicProductCategories(
  products: Pick<Product, "category" | "sortOrder">[],
  apiCategories?: unknown,
) {
  const fromProducts = [...products]
    .sort((first, second) => {
      const firstOrder = Number(first.sortOrder || 9999)
      const secondOrder = Number(second.sortOrder || 9999)
      return (Number.isFinite(firstOrder) ? firstOrder : 9999) - (Number.isFinite(secondOrder) ? secondOrder : 9999)
    })
    .map((product) => String(product.category || "").trim())
    .filter(Boolean)

  if (fromProducts.length) {
    return Array.from(new Set(["Todos", ...fromProducts]))
  }

  const fromApi = Array.isArray(apiCategories)
    ? apiCategories.map((category) => String(category || "").trim()).filter(Boolean)
    : []

  if (fromApi.length) {
    return Array.from(new Set(["Todos", ...fromApi]))
  }

  return [...fallbackCategories]
}
