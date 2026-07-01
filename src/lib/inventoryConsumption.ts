// Cálculo puro del consumo de inventario de un pedido.
//
// Fuente canónica: las recetas (`inventory_recipes`), que llevan cantidad por
// ingrediente. Si un producto no tiene receta activa, se usan como respaldo los
// ingredientes incluidos del propio producto que estén vinculados a un insumo
// (el vínculo que el dueño configura en el menú avanzado), con su cantidad por
// unidad (o 1 si no se especificó).
//
// Es una función pura y determinista: no toca la base de datos. El ejecutor que
// aplica los movimientos vive en ordersInventory (applyInventoryConsumption).

export type ConsumptionOrderItem = {
  id: number | string
  name?: string
  quantity?: number
}

export type ConsumptionRecipeIngredient = {
  itemId?: string | null
  itemName?: string
  quantity?: number
  unit?: string
}

export type ConsumptionRecipe = {
  productId: number | string
  ingredients?: ConsumptionRecipeIngredient[]
  isActive?: boolean
}

export type ConsumptionProductIngredientLink = {
  inventoryItemId?: string | null
  name?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

export type ConsumptionProduct = {
  id: number | string
  inventoryDiscountEnabled?: boolean
  includedIngredients?: ConsumptionProductIngredientLink[]
}

export type ConsumptionLine = {
  itemId: string
  itemName: string
  unit: string
  quantity: number
}

function toPositive(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000
}

export function computeInventoryConsumption(input: {
  items: ConsumptionOrderItem[]
  recipes: ConsumptionRecipe[]
  products?: ConsumptionProduct[]
}): ConsumptionLine[] {
  const recipeByProduct = new Map<string, ConsumptionRecipe>()
  for (const recipe of input.recipes || []) {
    if (recipe.isActive === false) continue
    recipeByProduct.set(String(recipe.productId), recipe)
  }

  const productById = new Map<string, ConsumptionProduct>()
  for (const product of input.products || []) {
    productById.set(String(product.id), product)
  }

  // Acumula consumo por insumo; conserva nombre/unidad del primero que aparezca.
  const totals = new Map<string, ConsumptionLine>()
  const add = (itemId: string, itemName: string, unit: string, quantity: number) => {
    if (!itemId || quantity <= 0) return
    const current = totals.get(itemId)
    if (current) {
      current.quantity = round4(current.quantity + quantity)
    } else {
      totals.set(itemId, { itemId, itemName, unit, quantity: round4(quantity) })
    }
  }

  for (const item of input.items || []) {
    const soldQty = toPositive(item.quantity)
    if (soldQty <= 0) continue

    const productKey = String(item.id)
    const product = productById.get(productKey)
    // Respeta el interruptor por producto: si el dueño lo apagó, no descuenta.
    if (product && product.inventoryDiscountEnabled === false) continue

    const recipe = recipeByProduct.get(productKey)

    if (recipe) {
      for (const ingredient of recipe.ingredients || []) {
        const itemId = String(ingredient.itemId || "").trim()
        const perUnit = toPositive(ingredient.quantity)
        if (!itemId || perUnit <= 0) continue
        add(itemId, String(ingredient.itemName || itemId), String(ingredient.unit || ""), perUnit * soldQty)
      }
      continue
    }

    // Respaldo: ingredientes incluidos vinculados a inventario (cant. o 1).
    if (product) {
      for (const ingredient of product.includedIngredients || []) {
        const itemId = String(ingredient.inventoryItemId || "").trim()
        if (!itemId) continue
        const perUnit = toPositive(ingredient.inventoryQuantity) || 1
        add(itemId, String(ingredient.name || itemId), String(ingredient.inventoryUnit || ""), perUnit * soldQty)
      }
    }
  }

  return [...totals.values()].filter((line) => line.quantity > 0)
}
