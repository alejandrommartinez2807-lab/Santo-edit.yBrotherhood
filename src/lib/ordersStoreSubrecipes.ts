import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"

import { type Row } from "./ordersStoreMappers"

// ============================================================
// SUBRECETAS SOBRE SUPABASE (recetas base reutilizables)
//
// Preparaciones hechas con insumos del inventario. Toda query se filtra/asigna
// por branch_id para no mezclar entre sucursales (branchIsolation.fitness lo
// vigila). Los ingredientes se guardan como jsonb, igual que inventory_recipes.
// ============================================================

export type SubrecipeIngredient = {
  itemId: string
  itemName: string
  quantity: number
  unit: string
}

export type Subrecipe = {
  id: string
  name: string
  yieldQuantity: number
  yieldUnit: string
  ingredients: SubrecipeIngredient[]
  note: string
  isActive: boolean
  sortOrder: number
}

export type SaveSubrecipeInput = {
  id?: string
  name: string
  yieldQuantity?: number
  yieldUnit?: string
  ingredients?: SubrecipeIngredient[]
  note?: string
  isActive?: boolean
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeIngredients(value: unknown): SubrecipeIngredient[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []

  return list
    .map((raw) => {
      const item = (raw || {}) as Record<string, unknown>
      return {
        itemId: cleanText(item.itemId),
        itemName: cleanText(item.itemName),
        quantity: toNumber(item.quantity),
        unit: cleanText(item.unit) || "unidades",
      }
    })
    .filter((ingredient) => ingredient.itemId || ingredient.itemName)
}

function mapSubrecipe(raw: Row): Subrecipe {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    yieldQuantity: toNumber(raw.yield_quantity) || 1,
    yieldUnit: cleanText(raw.yield_unit) || "porción",
    ingredients: normalizeIngredients(raw.ingredients),
    note: cleanText(raw.note),
    isActive: raw.is_active !== false,
    sortOrder: Number(raw.sort_order) || 0,
  }
}

export async function getSubrecipes(branchId?: string | null): Promise<Subrecipe[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("subrecipes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapSubrecipe(raw as Row))
}

export async function saveSubrecipe(
  input: SaveSubrecipeInput,
  branchId?: string | null,
): Promise<Subrecipe> {
  const supabase = getSupabaseAdmin()

  const fields = {
    name: cleanText(input.name),
    yield_quantity: toNumber(input.yieldQuantity) || 1,
    yield_unit: cleanText(input.yieldUnit) || "porción",
    ingredients: normalizeIngredients(input.ingredients),
    note: cleanText(input.note),
    is_active: input.isActive !== false,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    // Actualiza una fila concreta de esta sucursal (no toca otras sucursales).
    let updateQuery = supabase.from("subrecipes").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapSubrecipe(data as Row)
  }

  // Nueva subreceta: se inserta al final de la lista de su sucursal.
  let countQuery = supabase.from("subrecipes").select("id", { count: "exact", head: true })
  if (branchId) countQuery = countQuery.eq("branch_id", branchId)
  const { count } = await countQuery

  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data, error } = await supabase
    .from("subrecipes")
    .insert({ ...fields, branch_id: branchId ?? null, sort_order: (count ?? 0) + 1 })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSubrecipe(data as Row)
}

export async function deleteSubrecipe(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  // Borra una fila concreta, acotada además a la sucursal.
  let deleteQuery = supabase.from("subrecipes").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
