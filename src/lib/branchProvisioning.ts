import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getCaracasDayKey, getExpiredEventBranchIds } from "@/lib/branch"

// Aprovisionamiento de sedes/eventos: clonar el menú de otra sede al crear un
// evento y trasladar inventario entre sedes (enviar stock a la feria y devolver
// el sobrante al finalizar). El evento también puede manejar inventario propio:
// basta con no trasladar nada y cargar los insumos directo en el módulo de
// Inventario con la sede del evento seleccionada.

type UnknownRecord = Record<string, unknown>

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function nowLabel() {
  return new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })
}

// --- Comparativo de eventos --------------------------------------------------

export type EventOrderRow = {
  total_usd: unknown
  payment_received_equiv_usd: unknown
  created_at: unknown
}

// Agrega los pedidos (ya sin cancelados) de un evento a las métricas del
// comparativo de ferias: totales, días con ventas y promedios.
export function summarizeEventOrders(rows: EventOrderRow[]) {
  let salesUSD = 0
  let collectedUSD = 0
  const dayKeys = new Set<string>()
  let lastOrderAt = ""

  for (const row of rows) {
    salesUSD += toNumber(row.total_usd)
    collectedUSD += toNumber(row.payment_received_equiv_usd)
    const createdAt = String(row.created_at || "")
    if (createdAt) {
      dayKeys.add(getCaracasDayKey(new Date(createdAt)))
      if (createdAt > lastOrderAt) lastOrderAt = createdAt
    }
  }

  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const ordersCount = rows.length
  const days = dayKeys.size

  return {
    ordersCount,
    salesUSD: round2(salesUSD),
    collectedUSD: round2(collectedUSD),
    days,
    averageTicketUSD: ordersCount ? round2(salesUSD / ordersCount) : 0,
    salesPerDayUSD: days ? round2(salesUSD / days) : 0,
    lastOrderAt,
  }
}

export type EventExpenseRow = {
  data: unknown
}

// Suma en USD los gastos registrados en el evento (Control de gastos con la
// sede del evento seleccionada): alquiler del puesto, hielo, transporte...
// El equivalente en USD viene calculado al registrar el gasto; amountUSD es
// el fallback de gastos viejos sin equivalente.
export function sumEventExpensesUSD(rows: EventExpenseRow[]) {
  let total = 0

  for (const row of rows) {
    const data = (row?.data ?? {}) as UnknownRecord
    const equivalent = toNumber(data.equivalentUSD)
    total += equivalent > 0 ? equivalent : toNumber(data.amountUSD)
  }

  return Math.round((total + Number.EPSILON) * 100) / 100
}

// --- Auto-finalización de eventos vencidos ----------------------------------

// Desactiva los eventos cuya fecha de fin ya pasó (evaluación perezosa: se
// llama desde los listados de sedes, no hace falta un cron). Devuelve los ids
// finalizados para que el llamador ajuste su respuesta sin re-consultar.
export async function autoFinalizeExpiredEvents(
  branches: unknown[],
  rawBusinessConfig: unknown,
): Promise<string[]> {
  const expiredIds = getExpiredEventBranchIds(branches, rawBusinessConfig)
  if (!expiredIds.length) return []

  const supabase = getSupabaseAdmin()
  // Si el update falla igual se tratan como vencidos en la respuesta: el
  // próximo listado lo reintenta.
  await supabase.from("branches").update({ is_active: false }).in("id", expiredIds)

  return expiredIds
}

// --- Clonado de menú -------------------------------------------------------

export type CloneMenuResult = {
  productsCloned: number
  recipesCloned: number
}

// Copia el menú completo (productos con precios, variaciones, adicionales,
// ingredientes y reglas) y sus recetas de inventario de una sede a otra. Las
// imágenes no se duplican: los productos clonados apuntan a la misma URL del
// bucket público. Solo se permite hacia una sede sin menú (el evento recién
// creado) para nunca pisar un menú existente.
export async function cloneMenuToBranch(
  sourceBranchId: string,
  targetBranchId: string,
): Promise<CloneMenuResult> {
  const sourceId = cleanText(sourceBranchId)
  const targetId = cleanText(targetBranchId)

  if (!sourceId || !targetId) throw new Error("Indica la sede origen y destino")
  if (sourceId === targetId) throw new Error("La sede origen y destino no pueden ser la misma")

  const supabase = getSupabaseAdmin()

  const { count: targetCount, error: targetError } = await supabase
    .from("menu_products")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", targetId)

  if (targetError) throw new Error(targetError.message || "No se pudo revisar el menú destino")
  if ((targetCount ?? 0) > 0) {
    throw new Error("La sede destino ya tiene menú; el clonado solo aplica a sedes nuevas")
  }

  const { data: sourceProducts, error: sourceError } = await supabase
    .from("menu_products")
    .select("*")
    .eq("branch_id", sourceId)

  if (sourceError) throw new Error(sourceError.message || "No se pudo cargar el menú origen")
  if (!sourceProducts?.length) return { productsCloned: 0, recipesCloned: 0 }

  // IDs numéricos nuevos (PK global): base de tiempo + índice.
  const idBase = Date.now()
  const nowIso = new Date().toISOString()
  const productIdMap = new Map<number, number>()
  const clonedProducts = sourceProducts.map((raw, index) => {
    const row = { ...(raw as UnknownRecord) }
    const oldId = toNumber(row.id)
    const newId = idBase + index
    productIdMap.set(oldId, newId)
    return {
      ...row,
      id: newId,
      branch_id: targetId,
      created_at: nowIso,
      updated_at: nowIso,
    }
  })

  const { error: insertError } = await supabase.from("menu_products").insert(clonedProducts)
  if (insertError) throw new Error(insertError.message || "No se pudo clonar el menú")

  // Recetas: remapean el producto al clon. Los itemId de los ingredientes se
  // dejan tal cual (apuntan a insumos de la sede origen): el traslado de
  // inventario los remapea al crear los insumos del evento, y mientras tanto
  // el consumo automático simplemente los ignora (no existen en la sede).
  const { data: sourceRecipes, error: recipesError } = await supabase
    .from("inventory_recipes")
    .select("*")
    .eq("branch_id", sourceId)

  if (recipesError) return { productsCloned: clonedProducts.length, recipesCloned: 0 }

  const clonedRecipes = (sourceRecipes ?? [])
    .map((raw, index) => {
      const row = { ...(raw as UnknownRecord) }
      const mappedProductId = productIdMap.get(toNumber(row.product_id))
      if (!mappedProductId) return null
      // inventory_recipes no tiene created_at; solo se refresca updated_at.
      return {
        ...row,
        id: `rec-${idBase}-${randomSuffix()}-${index}`,
        branch_id: targetId,
        product_id: mappedProductId,
        updated_at: nowIso,
      }
    })
    .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe))

  if (clonedRecipes.length) {
    // branch-exempt: cada receta clonada ya lleva branch_id de la sede destino (asignado arriba).
    const { error: recipesInsertError } = await supabase
      .from("inventory_recipes")
      .insert(clonedRecipes)
    if (recipesInsertError) {
      return { productsCloned: clonedProducts.length, recipesCloned: 0 }
    }
  }

  return { productsCloned: clonedProducts.length, recipesCloned: clonedRecipes.length }
}

// --- Traslado de inventario -------------------------------------------------

export type InventoryTransferLine = {
  itemId: string
  quantity: number
}

export type InventoryTransferResult = {
  transferred: Array<{
    itemName: string
    quantity: number
    unit: string
  }>
  skipped: number
}

type SourceItemRow = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minimum_stock: number
  cost_usd: number
  cost_ves: number
  equivalent_cost_usd: number
  note: string
  is_active: boolean
}

function rowToSourceItem(raw: unknown): SourceItemRow {
  const row = (raw || {}) as UnknownRecord
  return {
    id: cleanText(row.id),
    name: cleanText(row.name),
    category: cleanText(row.category) || "General",
    quantity: toNumber(row.quantity),
    unit: cleanText(row.unit) || "unidades",
    minimum_stock: toNumber(row.minimum_stock),
    cost_usd: toNumber(row.cost_usd),
    cost_ves: toNumber(row.cost_ves),
    equivalent_cost_usd: toNumber(row.equivalent_cost_usd),
    note: cleanText(row.note),
    is_active: row.is_active !== false,
  }
}

// Mueve stock entre sedes descontando en origen y sumando en destino, con un
// movimiento registrado en ambos lados. Los insumos del destino se buscan por
// nombre (sin distinguir mayúsculas); si no existen se crean copiando la ficha
// del origen. `lines: "all"` traslada todo el stock disponible (la devolución
// del sobrante al finalizar un evento). Nunca deja cantidades negativas.
export async function transferInventoryBetweenBranches(
  sourceBranchId: string,
  targetBranchId: string,
  lines: InventoryTransferLine[] | "all",
  context: { sourceName?: string; targetName?: string } = {},
): Promise<InventoryTransferResult> {
  const sourceId = cleanText(sourceBranchId)
  const targetId = cleanText(targetBranchId)

  if (!sourceId || !targetId) throw new Error("Indica la sede origen y destino")
  if (sourceId === targetId) throw new Error("La sede origen y destino no pueden ser la misma")

  const supabase = getSupabaseAdmin()

  const { data: sourceRows, error: sourceError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("branch_id", sourceId)

  if (sourceError) throw new Error(sourceError.message || "No se pudo cargar el inventario origen")

  const sourceItems = new Map<string, SourceItemRow>()
  for (const raw of sourceRows ?? []) {
    const item = rowToSourceItem(raw)
    if (item.id) sourceItems.set(item.id, item)
  }

  const requested: InventoryTransferLine[] =
    lines === "all"
      ? [...sourceItems.values()]
          .filter((item) => item.quantity > 0)
          .map((item) => ({ itemId: item.id, quantity: item.quantity }))
      : lines
          .map((line) => ({ itemId: cleanText(line.itemId), quantity: toNumber(line.quantity) }))
          .filter((line) => line.itemId && line.quantity > 0)

  if (!requested.length) return { transferred: [], skipped: 0 }

  const { data: targetRows, error: targetError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("branch_id", targetId)

  if (targetError) throw new Error(targetError.message || "No se pudo cargar el inventario destino")

  const targetItemsByName = new Map<string, SourceItemRow>()
  for (const raw of targetRows ?? []) {
    const item = rowToSourceItem(raw)
    if (item.id && item.name) targetItemsByName.set(item.name.toLowerCase(), item)
  }

  const sourceLabel = cleanText(context.sourceName) || "otra sede"
  const targetLabel = cleanText(context.targetName) || "otra sede"
  const dateLabel = nowLabel()
  const transferred: InventoryTransferResult["transferred"] = []
  // Mapa insumo origen -> insumo destino para remapear recetas del destino.
  const itemIdMap = new Map<string, string>()
  let skipped = 0

  for (const line of requested) {
    const source = sourceItems.get(line.itemId)
    if (!source || source.quantity <= 0) {
      skipped += 1
      continue
    }

    const moved = roundQuantity(Math.min(source.quantity, line.quantity))
    if (moved <= 0) {
      skipped += 1
      continue
    }

    // 1) Descuenta en la sede origen y registra la salida.
    const sourceFinal = roundQuantity(source.quantity - moved)
    const { error: sourceUpdateError } = await supabase
      .from("inventory_items")
      .update({ quantity: sourceFinal, updated_at: new Date().toISOString() })
      .eq("id", source.id)
      .eq("branch_id", sourceId)

    if (sourceUpdateError) {
      skipped += 1
      continue
    }

    await supabase.from("inventory_movements").insert({
      id: `mov-${Date.now()}-${randomSuffix()}`,
      branch_id: sourceId,
      date_label: dateLabel,
      item_id: source.id,
      item_name: source.name,
      movement_type: "Traslado",
      previous_quantity: source.quantity,
      quantity_moved: -moved,
      final_quantity: sourceFinal,
      unit: source.unit,
      reason: `Traslado a ${targetLabel}`,
      related_expense: false,
      expense_id: "",
      note: "",
    })

    // 2) Suma en el destino (o crea el insumo copiando la ficha del origen).
    const existingTarget = targetItemsByName.get(source.name.toLowerCase())

    if (existingTarget) {
      const targetFinal = roundQuantity(existingTarget.quantity + moved)
      await supabase
        .from("inventory_items")
        .update({
          quantity: targetFinal,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTarget.id)
        .eq("branch_id", targetId)

      await supabase.from("inventory_movements").insert({
        id: `mov-${Date.now()}-${randomSuffix()}`,
        branch_id: targetId,
        date_label: dateLabel,
        item_id: existingTarget.id,
        item_name: existingTarget.name,
        movement_type: "Traslado",
        previous_quantity: existingTarget.quantity,
        quantity_moved: moved,
        final_quantity: targetFinal,
        unit: existingTarget.unit || source.unit,
        reason: `Traslado desde ${sourceLabel}`,
        related_expense: false,
        expense_id: "",
        note: "",
      })

      existingTarget.quantity = targetFinal
      itemIdMap.set(source.id, existingTarget.id)
    } else {
      const newItemId = `inv-${Date.now()}-${randomSuffix()}`
      const { error: createError } = await supabase.from("inventory_items").insert({
        id: newItemId,
        branch_id: targetId,
        name: source.name,
        category: source.category,
        quantity: moved,
        unit: source.unit,
        minimum_stock: source.minimum_stock,
        cost_usd: source.cost_usd,
        cost_ves: source.cost_ves,
        equivalent_cost_usd: source.equivalent_cost_usd,
        note: source.note,
        is_active: true,
        updated_at: new Date().toISOString(),
      })

      if (createError) {
        // Revierte la salida del origen para no perder stock en el aire.
        await supabase
          .from("inventory_items")
          .update({ quantity: source.quantity, updated_at: new Date().toISOString() })
          .eq("id", source.id)
          .eq("branch_id", sourceId)
        skipped += 1
        continue
      }

      await supabase.from("inventory_movements").insert({
        id: `mov-${Date.now()}-${randomSuffix()}`,
        branch_id: targetId,
        date_label: dateLabel,
        item_id: newItemId,
        item_name: source.name,
        movement_type: "Traslado",
        previous_quantity: 0,
        quantity_moved: moved,
        final_quantity: moved,
        unit: source.unit,
        reason: `Traslado desde ${sourceLabel}`,
        related_expense: false,
        expense_id: "",
        note: "",
      })

      const createdItem: SourceItemRow = {
        ...source,
        id: newItemId,
        quantity: moved,
      }
      targetItemsByName.set(source.name.toLowerCase(), createdItem)
      itemIdMap.set(source.id, newItemId)
    }

    source.quantity = sourceFinal
    transferred.push({ itemName: source.name, quantity: moved, unit: source.unit })
  }

  // 3) Remapea las recetas del destino: los ingredientes que apuntaban a los
  // insumos de la sede origen (menú clonado) pasan a apuntar a los del destino,
  // para que el consumo automático descuente el stock trasladado.
  if (itemIdMap.size) {
    await remapRecipeIngredients(targetId, itemIdMap)
  }

  return { transferred, skipped }
}

async function remapRecipeIngredients(branchId: string, itemIdMap: Map<string, string>) {
  const supabase = getSupabaseAdmin()

  const { data: recipes, error } = await supabase
    .from("inventory_recipes")
    .select("id, ingredients")
    .eq("branch_id", branchId)

  if (error || !recipes?.length) return

  for (const raw of recipes) {
    const row = raw as UnknownRecord
    const ingredients = Array.isArray(row.ingredients) ? row.ingredients : []
    let changed = false

    const remapped = ingredients.map((ingredient) => {
      if (!ingredient || typeof ingredient !== "object") return ingredient
      const entry = ingredient as UnknownRecord
      const mappedId = itemIdMap.get(cleanText(entry.itemId))
      if (!mappedId || mappedId === entry.itemId) return ingredient
      changed = true
      return { ...entry, itemId: mappedId }
    })

    if (changed) {
      await supabase
        .from("inventory_recipes")
        .update({ ingredients: remapped, updated_at: new Date().toISOString() })
        .eq("id", cleanText(row.id))
        .eq("branch_id", branchId)
    }
  }
}
