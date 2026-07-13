import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Paquetes / todo incluido sobre Supabase (Hotel · Fase 23). Todo por branch_id.

export type HotelPackage = {
  id: string
  name: string
  description: string
  includes: string
  price: number
  active: boolean
  sortOrder: number
}

export type SavePackageInput = {
  id?: string
  name: string
  description?: string
  includes?: string
  price?: number
  active?: boolean
  sortOrder?: number
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapPackage(raw: Row): HotelPackage {
  return {
    id: String(raw.id || ""),
    name: cleanText(raw.name),
    description: cleanText(raw.description),
    includes: cleanText(raw.includes),
    price: Math.max(0, num(raw.price, 0)),
    active: raw.active !== false,
    sortOrder: num(raw.sort_order, 0),
  }
}

export async function getPackages(branchId?: string | null): Promise<HotelPackage[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("packages")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapPackage(raw as Row))
}

export async function savePackage(input: SavePackageInput, branchId?: string | null): Promise<HotelPackage> {
  const supabase = getSupabaseAdmin()
  const fields = {
    name: cleanText(input.name),
    description: cleanText(input.description),
    includes: cleanText(input.includes),
    price: Math.max(0, num(input.price, 0)),
    active: input.active !== false,
    sort_order: num(input.sortOrder, 0),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("packages").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapPackage(data as Row)
  }

  const { data, error } = await supabase
    .from("packages")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPackage(data as Row)
}

export async function deletePackage(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("packages").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
