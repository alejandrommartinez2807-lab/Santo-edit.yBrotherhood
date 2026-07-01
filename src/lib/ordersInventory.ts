import { getSupabaseAdmin } from "./supabaseServer"
import type { ConsumptionLine } from "./inventoryConsumption"

export type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minimumStock: number
  costUSD: number
  costVES: number
  equivalentCostUSD: number
  note: string
  isActive: boolean
  updatedAt: string
}

export type InventoryMovement = {
  id: string
  dateLabel: string
  itemId: string
  itemName: string
  movementType: string
  previousQuantity: number
  quantityMoved: number
  finalQuantity: number
  unit: string
  reason: string
  relatedExpense: boolean
  expenseId: string
  note: string
  createdAt: string
}

export type InventoryRecipeIngredient = {
  itemId: string
  itemName: string
  quantity: number
  unit: string
}

export type InventoryRecipe = {
  id: string
  productId: number
  productName: string
  productCategory: string
  ingredients: InventoryRecipeIngredient[]
  note: string
  isActive: boolean
  updatedAt: string
}

export type SaveInventoryRecipeInput = {
  id?: string
  productId: number
  productName: string
  productCategory?: string
  ingredients: InventoryRecipeIngredient[]
  note?: string
  isActive?: boolean
}

export type SaveInventoryItemInput = {
  id?: string
  name: string
  category?: string
  quantity?: number
  unit?: string
  minimumStock?: number
  costUSD?: number
  costVES?: number
  equivalentCostUSD?: number
  note?: string
  isActive?: boolean
  movementType?: string
  movementReason?: string
  movementNote?: string
  relatedExpense?: boolean
  expenseId?: string
}

function normalizeInventoryItem(value: unknown): InventoryItem {
  const source = (value || {}) as Partial<InventoryItem>
  const quantity = Number(source.quantity || 0)
  const minimumStock = Number(source.minimumStock || 0)
  const costUSD = Number(source.costUSD || 0)
  const costVES = Number(source.costVES || 0)
  const equivalentCostUSD = Number(source.equivalentCostUSD || source.costUSD || 0)

  return {
    id: String(source.id || "").trim(),
    name: String(source.name || "").trim(),
    category: String(source.category || "General").trim() || "General",
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: String(source.unit || "unidades").trim() || "unidades",
    minimumStock: Number.isFinite(minimumStock) ? minimumStock : 0,
    costUSD: Number.isFinite(costUSD) ? costUSD : 0,
    costVES: Number.isFinite(costVES) ? costVES : 0,
    equivalentCostUSD: Number.isFinite(equivalentCostUSD) ? equivalentCostUSD : 0,
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  }
}

function normalizeInventoryMovement(value: unknown): InventoryMovement {
  const source = (value || {}) as Partial<InventoryMovement>
  const previousQuantity = Number(source.previousQuantity || 0)
  const quantityMoved = Number(source.quantityMoved || 0)
  const finalQuantity = Number(source.finalQuantity || 0)

  return {
    id: String(source.id || "").trim(),
    dateLabel: String(source.dateLabel || "").trim(),
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    movementType: String(source.movementType || "Ajuste").trim() || "Ajuste",
    previousQuantity: Number.isFinite(previousQuantity) ? previousQuantity : 0,
    quantityMoved: Number.isFinite(quantityMoved) ? quantityMoved : 0,
    finalQuantity: Number.isFinite(finalQuantity) ? finalQuantity : 0,
    unit: String(source.unit || "unidades").trim() || "unidades",
    reason: String(source.reason || "Movimiento manual").trim(),
    relatedExpense: source.relatedExpense === true,
    expenseId: String(source.expenseId || "").trim(),
    note: String(source.note || "").trim(),
    createdAt: String(source.createdAt || "").trim(),
  }
}

function normalizeInventoryRecipeIngredient(value: unknown): InventoryRecipeIngredient {
  const source = (value || {}) as Partial<InventoryRecipeIngredient>
  const quantity = Number(source.quantity || 0)

  return {
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: String(source.unit || "unidades").trim() || "unidades",
  }
}

function normalizeInventoryRecipe(value: unknown): InventoryRecipe {
  const source = (value || {}) as Partial<InventoryRecipe>
  const productId = Number(source.productId || 0)
  const ingredients: unknown[] = Array.isArray(source.ingredients)
    ? source.ingredients
    : []

  return {
    id: String(source.id || "").trim(),
    productId: Number.isFinite(productId) ? productId : 0,
    productName: String(source.productName || "").trim(),
    productCategory: String(source.productCategory || "").trim(),
    ingredients: ingredients
      .map(normalizeInventoryRecipeIngredient)
      .filter((ingredient: InventoryRecipeIngredient) => ingredient.itemId && ingredient.itemName && ingredient.quantity > 0),
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  }
}




// El inventario vive en Supabase: insumos (`inventory_items`), movimientos
// (`inventory_movements`) y recetas (`inventory_recipes`). Mapeamos las
// columnas snake_case a la forma camelCase que usa la app vía los normalizadores.
function inventoryItemRowToItem(row: Record<string, unknown>): InventoryItem {
  return normalizeInventoryItem({
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    minimumStock: row.minimum_stock,
    costUSD: row.cost_usd,
    costVES: row.cost_ves,
    equivalentCostUSD: row.equivalent_cost_usd,
    note: row.note,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  })
}

function inventoryMovementRowToMovement(row: Record<string, unknown>): InventoryMovement {
  return normalizeInventoryMovement({
    id: row.id,
    dateLabel: row.date_label,
    itemId: row.item_id,
    itemName: row.item_name,
    movementType: row.movement_type,
    previousQuantity: row.previous_quantity,
    quantityMoved: row.quantity_moved,
    finalQuantity: row.final_quantity,
    unit: row.unit,
    reason: row.reason,
    relatedExpense: row.related_expense,
    expenseId: row.expense_id,
    note: row.note,
    createdAt: row.created_at,
  })
}

function inventoryRecipeRowToRecipe(row: Record<string, unknown>): InventoryRecipe {
  return normalizeInventoryRecipe({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productCategory: row.product_category,
    ingredients: row.ingredients,
    note: row.note,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  })
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

export async function getInventory(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let q = supabase.from("inventory_items").select("*")
  if (branchId) q = q.eq("branch_id", branchId)
  const { data, error } = await q
  if (error) {
    throw new Error(error.message || "No se pudo cargar el inventario")
  }

  return (data ?? [])
    .map((row) => inventoryItemRowToItem(row as Record<string, unknown>))
    .filter((item: InventoryItem) => item.id && item.name)
}

export async function getInventoryMovements(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let q = supabase
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
  if (branchId) q = q.eq("branch_id", branchId)
  const { data, error } = await q
  if (error) {
    throw new Error(error.message || "No se pudo cargar el historial de inventario")
  }

  return (data ?? [])
    .map((row) => inventoryMovementRowToMovement(row as Record<string, unknown>))
    .filter((movement: InventoryMovement) => movement.id && movement.itemId)
}

// Aplica el consumo calculado de un pedido: descuenta stock y registra un
// movimiento por cada insumo. En modo simulación (dryRun) no toca la base;
// devuelve el plan para poder auditarlo/loguear. Es idempotente-friendly solo a
// nivel de "mejor esfuerzo": el llamador debe envolverlo para que un fallo aquí
// nunca tumbe el pedido ya creado.
export async function applyInventoryConsumption(
  lines: ConsumptionLine[],
  branchId?: string | null,
  options: { dryRun?: boolean; reason?: string } = {},
): Promise<{ dryRun: boolean; applied: ConsumptionLine[] }> {
  const dryRun = options.dryRun !== false
  const applied: ConsumptionLine[] = []

  if (!lines.length) return { dryRun, applied }

  const supabase = getSupabaseAdmin()

  // Stock actual de los insumos afectados (una sola consulta).
  const itemIds = [...new Set(lines.map((line) => line.itemId))]
  let query = supabase.from("inventory_items").select("id, name, quantity, unit").in("id", itemIds)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data: rows } = await query

  const stockById = new Map<string, { name: string; quantity: number; unit: string }>()
  for (const raw of rows ?? []) {
    const row = raw as Record<string, unknown>
    stockById.set(String(row.id), {
      name: String(row.name || ""),
      quantity: Number(row.quantity ?? 0) || 0,
      unit: String(row.unit || ""),
    })
  }

  const reason = options.reason || "Consumo automático por pedido"
  const dateLabel = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })

  for (const line of lines) {
    const stock = stockById.get(line.itemId)
    if (!stock) continue // el insumo no existe en esta sucursal: se ignora.

    const previousQuantity = stock.quantity
    // No dejamos stock negativo: se descuenta hasta 0 como máximo.
    const moved = Math.min(previousQuantity, line.quantity)
    const finalQuantity = Math.round((previousQuantity - moved + Number.EPSILON) * 10000) / 10000

    if (!dryRun && moved > 0) {
      await supabase
        .from("inventory_items")
        .update({ quantity: finalQuantity, updated_at: new Date().toISOString() })
        .eq("id", line.itemId)

      await supabase.from("inventory_movements").insert({
        id: `mov-${Date.now()}-${randomSuffix()}`,
        branch_id: branchId ?? null,
        date_label: dateLabel,
        item_id: line.itemId,
        item_name: stock.name || line.itemName,
        movement_type: "Consumo",
        previous_quantity: previousQuantity,
        quantity_moved: -moved,
        final_quantity: finalQuantity,
        unit: stock.unit || line.unit,
        reason,
        related_expense: false,
        expense_id: "",
        note: "",
      })
    }

    applied.push({ ...line, quantity: moved })
  }

  return { dryRun, applied }
}

export async function getInventoryRecipes(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let q = supabase.from("inventory_recipes").select("*")
  if (branchId) q = q.eq("branch_id", branchId)
  const { data, error } = await q
  if (error) {
    throw new Error(error.message || "No se pudieron cargar las recetas de inventario")
  }

  return (data ?? [])
    .map((row) => inventoryRecipeRowToRecipe(row as Record<string, unknown>))
    .filter((recipe: InventoryRecipe) => recipe.id && recipe.productName)
}

export async function saveInventoryRecipe(input: SaveInventoryRecipeInput, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  const recipeId = cleanText(input.id) || `rec-${Date.now()}-${randomSuffix()}`
  const normalized = normalizeInventoryRecipe({ ...input, id: recipeId })

  const { data, error } = await supabase
    .from("inventory_recipes")
    .upsert({
      id: recipeId,
      branch_id: branchId ?? null,
      product_id: normalized.productId,
      product_name: normalized.productName,
      product_category: normalized.productCategory,
      ingredients: normalized.ingredients,
      note: normalized.note,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message || "No se pudo guardar la receta de inventario")
  }

  return {
    inventoryRecipe: inventoryRecipeRowToRecipe(data as Record<string, unknown>),
  }
}

export async function deleteInventoryRecipe(recipeId: string, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("inventory_recipes")
    .delete()
    .eq("id", cleanText(recipeId))

  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message || "No se pudo eliminar la receta de inventario")
  }

  return {
    ok: true,
    message: "Receta eliminada correctamente.",
  }
}

export async function saveInventoryItem(input: SaveInventoryItemInput, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  const isNew = !cleanText(input.id)
  const itemId = cleanText(input.id) || `inv-${Date.now()}-${randomSuffix()}`

  // Cantidad anterior (para registrar el movimiento si cambia el stock)
  let previousQuantity = 0
  if (!isNew) {
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("id", itemId)
      .maybeSingle()
    previousQuantity = Number((existing as Record<string, unknown>)?.quantity ?? 0) || 0
  }

  const normalized = normalizeInventoryItem({ ...input, id: itemId })
  const finalQuantity = normalized.quantity

  const { data: savedRow, error } = await supabase
    .from("inventory_items")
    .upsert({
      id: itemId,
      branch_id: branchId ?? null,
      name: normalized.name,
      category: normalized.category,
      quantity: finalQuantity,
      unit: normalized.unit,
      minimum_stock: normalized.minimumStock,
      cost_usd: normalized.costUSD,
      cost_ves: normalized.costVES,
      equivalent_cost_usd: normalized.equivalentCostUSD,
      note: normalized.note,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message || "No se pudo guardar el producto de inventario")
  }

  // Registrar movimiento si cambió la cantidad (o carga inicial de un insumo nuevo)
  let inventoryMovement: InventoryMovement | null = null
  const quantityMoved = finalQuantity - previousQuantity
  if ((isNew && finalQuantity !== 0) || (!isNew && quantityMoved !== 0)) {
    const { data: movementRow } = await supabase
      .from("inventory_movements")
      .insert({
        id: `mov-${Date.now()}-${randomSuffix()}`,
        branch_id: branchId ?? null,
        date_label: new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }),
        item_id: itemId,
        item_name: normalized.name,
        movement_type: isNew ? "Carga inicial" : "Ajuste",
        previous_quantity: previousQuantity,
        quantity_moved: quantityMoved,
        final_quantity: finalQuantity,
        unit: normalized.unit,
        reason: isNew ? "Carga inicial de inventario" : "Ajuste manual de inventario",
        related_expense: false,
        expense_id: "",
        note: normalized.note,
      })
      .select("*")
      .single()

    if (movementRow) {
      inventoryMovement = inventoryMovementRowToMovement(movementRow as Record<string, unknown>)
    }
  }

  return {
    inventoryItem: inventoryItemRowToItem(savedRow as Record<string, unknown>),
    inventoryMovement,
  }
}

export async function deleteInventoryItem(itemId: string, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("inventory_items")
    .delete()
    .eq("id", cleanText(itemId))

  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el producto de inventario")
  }

  return {
    ok: true,
    message: "Producto eliminado del inventario.",
    inventoryMovement: null as InventoryMovement | null,
  }
}
