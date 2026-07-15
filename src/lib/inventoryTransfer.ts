import { getSupabaseAdmin } from "@/lib/supabaseServer"

// Transferencia de inventario entre sedes (p. ej. surtir un evento o una
// feria desde la sede principal): descuenta stock en la sede origen y lo
// suma en la sede destino, dejando UN movimiento en cada lado para que los
// historiales cuadren. Si el insumo no existe en la sede destino, se crea
// copiando sus datos (costos, unidad, mínimo).

export type InventoryTransferItemInput = {
  itemId: string
  quantity: number
}

export type InventoryTransferLine = {
  itemName: string
  quantity: number
  unit: string
}

export type InventoryTransferResult = {
  targetBranchName: string
  transferred: InventoryTransferLine[]
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeName(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

export async function transferInventoryToBranch(input: {
  sourceBranchId: string
  targetBranchId: string
  items: InventoryTransferItemInput[]
  note?: string
  actorLabel?: string
}): Promise<InventoryTransferResult> {
  const sourceBranchId = cleanText(input.sourceBranchId)
  const targetBranchId = cleanText(input.targetBranchId)
  const note = cleanText(input.note)
  const actorLabel = cleanText(input.actorLabel)

  if (!sourceBranchId) throw new Error("No se pudo identificar la sede origen")
  if (!targetBranchId) throw new Error("Elige la sede destino de la transferencia")
  if (sourceBranchId === targetBranchId) {
    throw new Error("La sede destino debe ser distinta a la sede actual")
  }

  const requestedItems = (input.items || [])
    .map((item) => ({
      itemId: cleanText(item.itemId),
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.itemId && Number.isFinite(item.quantity) && item.quantity > 0)

  if (!requestedItems.length) {
    throw new Error("Indica al menos un producto con cantidad a transferir")
  }

  const supabase = getSupabaseAdmin()

  // branch-exempt: los nombres de las sedes se leen por id explícito.
  const { data: branchRows, error: branchError } = await supabase
    .from("branches")
    .select("id, name")
    .in("id", [sourceBranchId, targetBranchId])

  if (branchError) throw new Error(branchError.message)

  const sourceBranch = (branchRows ?? []).find((row) => String(row.id) === sourceBranchId)
  const targetBranch = (branchRows ?? []).find((row) => String(row.id) === targetBranchId)

  if (!targetBranch) throw new Error("La sede destino no existe")

  const sourceBranchName = cleanText(sourceBranch?.name) || "Sede origen"
  const targetBranchName = cleanText(targetBranch?.name) || "Sede destino"

  // Insumos de la sede origen.
  const itemIds = [...new Set(requestedItems.map((item) => item.itemId))]
  const { data: sourceRows, error: sourceError } = await supabase
    .from("inventory_items")
    .select("*")
    .in("id", itemIds)
    .eq("branch_id", sourceBranchId)

  if (sourceError) throw new Error(sourceError.message)

  const sourceById = new Map(
    (sourceRows ?? []).map((row) => [String((row as Record<string, unknown>).id), row as Record<string, unknown>]),
  )

  // Validación completa ANTES de tocar nada: o pasa todo, o no pasa nada.
  for (const requested of requestedItems) {
    const row = sourceById.get(requested.itemId)
    if (!row) {
      throw new Error("Uno de los productos ya no existe en esta sede. Refresca e intenta de nuevo.")
    }
    const available = Number(row.quantity ?? 0) || 0
    if (requested.quantity > available) {
      throw new Error(
        `No hay suficiente "${cleanText(row.name)}": disponible ${available}, pediste transferir ${requested.quantity}.`,
      )
    }
  }

  // Inventario de la sede destino (para sumar por nombre+unidad).
  const { data: targetRows, error: targetError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("branch_id", targetBranchId)

  if (targetError) throw new Error(targetError.message)

  const targetByKey = new Map(
    (targetRows ?? []).map((row) => {
      const record = row as Record<string, unknown>
      return [`${normalizeName(record.name)}|${normalizeName(record.unit)}`, record]
    }),
  )

  const dateLabel = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })
  const nowIso = new Date().toISOString()
  const reasonSuffix = [note, actorLabel ? `por ${actorLabel}` : ""].filter(Boolean).join(" · ")
  const transferred: InventoryTransferLine[] = []

  for (const requested of requestedItems) {
    const sourceRow = sourceById.get(requested.itemId)!
    const itemName = cleanText(sourceRow.name)
    const unit = cleanText(sourceRow.unit) || "unidades"
    const sourcePrevious = Number(sourceRow.quantity ?? 0) || 0
    const sourceFinal = roundQty(sourcePrevious - requested.quantity)

    // 1) Descuenta en la sede origen.
    const { error: decrementError } = await supabase
      .from("inventory_items")
      .update({ quantity: sourceFinal, updated_at: nowIso })
      .eq("id", requested.itemId)
      .eq("branch_id", sourceBranchId)

    if (decrementError) throw new Error(decrementError.message)

    // 2) Suma (o crea) en la sede destino. Si esto falla, se restaura el
    //    stock de origen para no perder inventario.
    try {
      const key = `${normalizeName(itemName)}|${normalizeName(unit)}`
      const targetRow = targetByKey.get(key)

      if (targetRow) {
        const targetPrevious = Number(targetRow.quantity ?? 0) || 0
        const targetFinal = roundQty(targetPrevious + requested.quantity)

        const { error: incrementError } = await supabase
          .from("inventory_items")
          .update({ quantity: targetFinal, updated_at: nowIso })
          .eq("id", String(targetRow.id))
          .eq("branch_id", targetBranchId)

        if (incrementError) throw new Error(incrementError.message)

        targetRow.quantity = targetFinal

        await supabase.from("inventory_movements").insert({
          id: `mov-${Date.now()}-${randomSuffix()}`,
          branch_id: targetBranchId,
          date_label: dateLabel,
          item_id: String(targetRow.id),
          item_name: itemName,
          movement_type: "Transferencia recibida",
          previous_quantity: targetPrevious,
          quantity_moved: requested.quantity,
          final_quantity: targetFinal,
          unit,
          reason: `Transferencia desde ${sourceBranchName}${reasonSuffix ? ` · ${reasonSuffix}` : ""}`,
          note: note,
          created_at: nowIso,
        })
      } else {
        const newItemId = `inv-${Date.now()}-${randomSuffix()}`

        const { error: insertError } = await supabase.from("inventory_items").insert({
          id: newItemId,
          branch_id: targetBranchId,
          name: itemName,
          category: cleanText(sourceRow.category) || "General",
          quantity: requested.quantity,
          unit,
          minimum_stock: Number(sourceRow.minimum_stock ?? 0) || 0,
          cost_usd: Number(sourceRow.cost_usd ?? 0) || 0,
          cost_ves: Number(sourceRow.cost_ves ?? 0) || 0,
          equivalent_cost_usd: Number(sourceRow.equivalent_cost_usd ?? 0) || 0,
          note: cleanText(sourceRow.note),
          is_active: true,
          updated_at: nowIso,
        })

        if (insertError) throw new Error(insertError.message)

        targetByKey.set(key, {
          id: newItemId,
          name: itemName,
          unit,
          quantity: requested.quantity,
        })

        await supabase.from("inventory_movements").insert({
          id: `mov-${Date.now()}-${randomSuffix()}`,
          branch_id: targetBranchId,
          date_label: dateLabel,
          item_id: newItemId,
          item_name: itemName,
          movement_type: "Transferencia recibida",
          previous_quantity: 0,
          quantity_moved: requested.quantity,
          final_quantity: requested.quantity,
          unit,
          reason: `Transferencia desde ${sourceBranchName}${reasonSuffix ? ` · ${reasonSuffix}` : ""}`,
          note: note,
          created_at: nowIso,
        })
      }
    } catch (error) {
      // Restaura el stock de origen (mejor esfuerzo) y corta la operación.
      await supabase
        .from("inventory_items")
        .update({ quantity: sourcePrevious, updated_at: new Date().toISOString() })
        .eq("id", requested.itemId)
        .eq("branch_id", sourceBranchId)

      throw error instanceof Error
        ? error
        : new Error("No se pudo completar la transferencia en la sede destino")
    }

    // 3) Movimiento de salida en la sede origen.
    await supabase.from("inventory_movements").insert({
      id: `mov-${Date.now()}-${randomSuffix()}`,
      branch_id: sourceBranchId,
      date_label: dateLabel,
      item_id: requested.itemId,
      item_name: itemName,
      movement_type: "Transferencia enviada",
      previous_quantity: sourcePrevious,
      quantity_moved: -requested.quantity,
      final_quantity: sourceFinal,
      unit,
      reason: `Transferencia a ${targetBranchName}${reasonSuffix ? ` · ${reasonSuffix}` : ""}`,
      note: note,
      created_at: nowIso,
    })

    sourceRow.quantity = sourceFinal
    transferred.push({ itemName, quantity: requested.quantity, unit })
  }

  return { targetBranchName, transferred }
}
