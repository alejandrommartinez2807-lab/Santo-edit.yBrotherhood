import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import type { Supplier } from "@/types/localOrders"

import { type Row } from "./ordersStoreMappers"

// ============================================================
// PROVEEDORES SOBRE SUPABASE (Fase 1: CRUD / listado)
//
// Toda query se filtra/asigna por branch_id para no mezclar proveedores
// entre sucursales (el test branchIsolation.fitness.test.ts lo vigila).
// ============================================================

export type SaveSupplierInput = {
  id?: string
  name: string
  contactName?: string
  phone?: string
  email?: string
  note?: string
  isActive?: boolean
}

function mapSupplier(raw: Row): Supplier {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    contactName: cleanText(raw.contact_name),
    phone: cleanText(raw.phone),
    email: cleanText(raw.email),
    note: cleanText(raw.note),
    isActive: raw.is_active !== false,
    sortOrder: Number(raw.sort_order) || 0,
  }
}

export async function getSuppliers(branchId?: string | null): Promise<Supplier[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("suppliers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapSupplier(raw as Row))
}

export async function saveSupplier(
  input: SaveSupplierInput,
  branchId?: string | null,
): Promise<Supplier> {
  const supabase = getSupabaseAdmin()

  const fields = {
    name: cleanText(input.name),
    contact_name: cleanText(input.contactName),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    note: cleanText(input.note),
    is_active: input.isActive !== false,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    // Actualiza una fila concreta de esta sucursal (no toca otras sucursales).
    let updateQuery = supabase.from("suppliers").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapSupplier(data as Row)
  }

  // Nuevo proveedor: se inserta al final de la lista de su sucursal.
  let countQuery = supabase.from("suppliers").select("id", { count: "exact", head: true })
  if (branchId) countQuery = countQuery.eq("branch_id", branchId)
  const { count } = await countQuery

  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...fields, branch_id: branchId ?? null, sort_order: (count ?? 0) + 1 })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSupplier(data as Row)
}

export async function deleteSupplier(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  // Borra una fila concreta, acotada además a la sucursal.
  let deleteQuery = supabase.from("suppliers").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
