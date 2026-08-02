import { buildConsumptionMovement } from "@/lib/inventoryShortage"
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
// devuelve el plan para poder auditarlo/loguear. Con orderId es IDEMPOTENTE:
// si el consumo de ese pedido ya se aplicó, no vuelve a descontar (antes un
// reintento idempotente de createOrder drenaba el stock dos veces — A1).
export async function applyInventoryConsumption(
  lines: ConsumptionLine[],
  branchId?: string | null,
  options: { dryRun?: boolean; reason?: string; orderId?: string } = {},
): Promise<{ dryRun: boolean; applied: ConsumptionLine[] }> {
  const dryRun = options.dryRun !== false
  const applied: ConsumptionLine[] = []

  if (!lines.length) return { dryRun, applied }

  const supabase = getSupabaseAdmin()
  const cleanOrderId = String(options.orderId || "").trim()

  // Guardia de idempotencia (A1, 2026-07-24): mismo patrón que la reversión.
  // createOrder puede devolver un pedido EXISTENTE (client_order_id repetido o
  // carrera 23505) y el llamador volvía a descontar todo su consumo.
  if (!dryRun && cleanOrderId) {
    let appliedQuery = supabase
      .from("inventory_movements")
      .select("id", { head: true, count: "exact" })
      .eq("movement_type", "Consumo")
      .eq("note", `Pedido ${cleanOrderId}`)
    if (branchId) appliedQuery = appliedQuery.eq("branch_id", branchId)
    const { count: alreadyAppliedCount, error: appliedError } = await appliedQuery
    if (appliedError) throw new Error(appliedError.message)
    if ((alreadyAppliedCount ?? 0) > 0) return { dryRun, applied }
  }

  // Stock actual de los insumos afectados (una sola consulta). El error ya no
  // se descarta: antes una lectura fallida dejaba el mapa vacío y la venta
  // pasaba SIN descontar nada, sin log ni alerta (A3).
  const itemIds = [...new Set(lines.map((line) => line.itemId))]
  let query = supabase.from("inventory_items").select("id, name, quantity, unit").in("id", itemIds)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data: rows, error: stockError } = await query
  if (stockError) throw new Error(stockError.message)

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
  const failures: string[] = []

  for (const line of lines) {
    const stock = stockById.get(line.itemId)
    if (!stock) {
      // Receta apuntando a un insumo que no existe en esta sucursal: antes se
      // ignoraba en silencio para siempre (A5); ahora queda registrado.
      failures.push(`insumo ${line.itemName || line.itemId} no existe en la sucursal`)
      continue
    }

    let previousQuantity = stock.quantity

    if (!dryRun) {
      // Lock optimista contra el "lost update" (A3): el UPDATE exige que el
      // stock siga siendo el leído; si otro pedido lo movió, se relee y se
      // reintenta una vez con el valor fresco.
      let updated = false

      for (let attempt = 0; attempt < 2 && !updated; attempt += 1) {
        const plan = buildConsumptionMovement({
          previousQuantity,
          requested: line.quantity,
          unit: stock.unit || line.unit,
          reason,
        })

        if (!plan.shouldRecord) break

        // Stock ya en 0: no hay fila que actualizar, pero la venta NO puede
        // desaparecer del historial (BH-SIM-004) — se registra el movimiento
        // con cantidad 0 y el faltante completo en el motivo.
        let stockWritten = !plan.needsStockUpdate

        if (plan.needsStockUpdate) {
          const { data: updatedRows, error: updateError } = await supabase
            .from("inventory_items")
            .update({ quantity: plan.finalQuantity, updated_at: new Date().toISOString() })
            .eq("id", line.itemId)
            .eq("quantity", previousQuantity)
            .select("id")

          if (updateError) throw new Error(updateError.message)
          stockWritten = Boolean(updatedRows?.length)
        }

        if (stockWritten) {
          const { error: movementError } = await supabase.from("inventory_movements").insert({
            id: `mov-${Date.now()}-${randomSuffix()}`,
            branch_id: branchId ?? null,
            date_label: dateLabel,
            item_id: line.itemId,
            item_name: stock.name || line.itemName,
            movement_type: "Consumo",
            previous_quantity: previousQuantity,
            quantity_moved: -plan.moved,
            final_quantity: plan.finalQuantity,
            unit: stock.unit || line.unit,
            // El faltante queda en el motivo, tanto si fue parcial como si el
            // stock ya estaba en cero (antes ese caso no dejaba rastro).
            reason: plan.reason,
            related_expense: false,
            expense_id: "",
            // El pedido queda vinculado en la nota: permite REVERTIR el consumo
            // si el pedido se anula sin haberse preparado (pedido del dueño).
            note: cleanOrderId ? `Pedido ${cleanOrderId}` : "",
          })
          if (movementError) throw new Error(movementError.message)

          applied.push({ ...line, quantity: plan.moved })
          updated = true
          break
        }

        // Perdimos la carrera: releer el stock actual y reintentar una vez.
        let rereadQuery = supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", line.itemId)
        if (branchId) rereadQuery = rereadQuery.eq("branch_id", branchId)
        const { data: freshRows, error: rereadError } = await rereadQuery.limit(1)
        if (rereadError) throw new Error(rereadError.message)
        previousQuantity = Number((freshRows?.[0] as { quantity?: unknown })?.quantity ?? 0) || 0
      }

      if (!updated && Math.min(previousQuantity, line.quantity) > 0) {
        failures.push(`no se pudo descontar ${line.itemName || line.itemId} (conflicto de stock)`)
      }
    } else {
      const moved = Math.min(previousQuantity, line.quantity)
      applied.push({ ...line, quantity: moved })
    }
  }

  if (failures.length) {
    throw new Error(`Consumo de inventario incompleto: ${failures.join("; ")}`)
  }

  return { dryRun, applied }
}

// Reversión del consumo de UN pedido anulado que NO llegó a prepararse:
// devuelve al stock lo que se descontó al crearlo (movimientos "Consumo" con
// note "Pedido <id>") y deja un movimiento "Ajuste" por insumo como rastro.
// Pedidos viejos sin nota vinculada: no hay nada que revertir (devuelve 0).
export async function revertInventoryConsumptionForOrder(
  orderId: string,
  branchId?: string | null,
): Promise<{ reverted: number }> {
  const cleanOrderId = String(orderId || "").trim()
  if (!cleanOrderId) return { reverted: 0 }

  const supabase = getSupabaseAdmin()

  // Idempotencia POR INSUMO (A4, 2026-07-24): antes la guardia era global —
  // si la reversión caía a mitad del bucle, un reintento veía "ya hay un
  // Ajuste de este pedido" y los insumos restantes no se devolvían nunca.
  // Ahora se salta solo lo YA revertido y se completa el resto.
  let revertedQuery = supabase
    .from("inventory_movements")
    .select("item_id")
    .eq("movement_type", "Ajuste")
    .eq("note", `Reversión pedido ${cleanOrderId}`)
  if (branchId) revertedQuery = revertedQuery.eq("branch_id", branchId)
  const { data: revertedRows, error: revertedError } = await revertedQuery
  if (revertedError) throw new Error(revertedError.message)

  const alreadyRevertedItemIds = new Set(
    (revertedRows ?? []).map((row) => String((row as Record<string, unknown>).item_id || "")),
  )

  let query = supabase
    .from("inventory_movements")
    .select("id,item_id,item_name,quantity_moved,unit")
    .eq("movement_type", "Consumo")
    .eq("note", `Pedido ${cleanOrderId}`)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data: allMovements, error: movementsError } = await query
  if (movementsError) throw new Error(movementsError.message)

  const movements = (allMovements ?? []).filter(
    (raw) => !alreadyRevertedItemIds.has(String((raw as Record<string, unknown>).item_id || "")),
  )

  if (!movements.length) return { reverted: 0 }

  const dateLabel = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })
  let reverted = 0

  for (const raw of movements) {
    const movement = raw as Record<string, unknown>
    const itemId = String(movement.item_id || "")
    const quantityBack = Math.abs(Number(movement.quantity_moved || 0))
    if (!itemId || quantityBack <= 0) continue

    let itemQuery = supabase
      .from("inventory_items")
      .select("id,quantity,unit,name")
      .eq("id", itemId)
    if (branchId) itemQuery = itemQuery.eq("branch_id", branchId)
    const { data: itemRows } = await itemQuery.limit(1)
    const item = itemRows?.[0] as Record<string, unknown> | undefined
    if (!item) continue

    let previousQuantity = Number(item.quantity ?? 0) || 0
    let finalQuantity =
      Math.round((previousQuantity + quantityBack + Number.EPSILON) * 10000) / 10000

    // Candado optimista (auditoría 2026-08-02). Anular un pedido en pleno
    // servicio devolvía los ingredientes escribiendo el total a pelo: si entre
    // la lectura y la escritura entraba otra venta que consumía ese insumo, la
    // reversión pisaba el descuento y esa mercancía vendida reaparecía en el
    // stock. Ante un choque se relee y se recalcula: la devolución no se pierde.
    let stockWritten = false

    for (let attempt = 0; attempt < 4 && !stockWritten; attempt += 1) {
      let updateQuery = supabase
        .from("inventory_items")
        .update({ quantity: finalQuantity, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("quantity", previousQuantity)
      if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
      const { data: updatedRows, error: updateError } = await updateQuery.select("id")
      if (updateError) throw new Error(updateError.message)

      stockWritten = Boolean(updatedRows?.length)

      if (stockWritten) break

      let freshQuery = supabase
        .from("inventory_items")
        .select("quantity")
        .eq("id", itemId)
      if (branchId) freshQuery = freshQuery.eq("branch_id", branchId)
      const { data: fresh } = await freshQuery.maybeSingle()

      if (!fresh) break

      previousQuantity = Number((fresh as Record<string, unknown>).quantity ?? 0) || 0
      finalQuantity =
        Math.round((previousQuantity + quantityBack + Number.EPSILON) * 10000) / 10000
    }

    if (!stockWritten) continue

    const { error: insertError } = await supabase.from("inventory_movements").insert({
      id: `mov-${Date.now()}-${randomSuffix()}`,
      branch_id: branchId ?? null,
      date_label: dateLabel,
      item_id: itemId,
      item_name: String(movement.item_name || item.name || ""),
      movement_type: "Ajuste",
      previous_quantity: previousQuantity,
      quantity_moved: quantityBack,
      final_quantity: finalQuantity,
      unit: String(movement.unit || item.unit || ""),
      reason: "Reversión por anulación de pedido (ingredientes sin usar)",
      related_expense: false,
      expense_id: "",
      note: `Reversión pedido ${cleanOrderId}`,
    })
    if (insertError) throw new Error(insertError.message)

    reverted += 1
  }

  return { reverted }
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

  // Guardia de sede (I1, 2026-07-24): el upsert reasignaba branch_id — con el
  // id de una receta de la sede A, un guardado desde la sede B se la "robaba"
  // y le pisaba el contenido en silencio.
  if (cleanText(input.id)) {
    const { data: existingRow, error: existingError } = await supabase
      .from("inventory_recipes")
      .select("id, branch_id")
      .eq("id", recipeId)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)

    const existingBranch = cleanText((existingRow as Record<string, unknown> | null)?.branch_id)
    if (existingRow && existingBranch && branchId && existingBranch !== branchId) {
      throw new Error("Esa receta pertenece a otra sucursal")
    }
  }

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
    const { data: existing, error: existingError } = await supabase
      .from("inventory_items")
      .select("quantity, branch_id")
      .eq("id", itemId)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)

    // Guardia de sede (I1, 2026-07-24): el upsert reasignaba branch_id — con
    // el id de un insumo de la sede A, un POST desde la sede B movía la fila
    // de sucursal y le sobrescribía el stock.
    const existingBranch = cleanText((existing as Record<string, unknown> | null)?.branch_id)
    if (existing && existingBranch && branchId && existingBranch !== branchId) {
      throw new Error("Ese insumo pertenece a otra sucursal")
    }

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
