import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Fichas CRM de huéspedes sobre Supabase (Hotel · Fase 19). Todo por branch_id.

export type GuestProfile = {
  id: string
  fullName: string
  phone: string
  email: string
  tags: string
  vip: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export type SaveGuestProfileInput = {
  id?: string
  fullName: string
  phone?: string
  email?: string
  tags?: string
  vip?: boolean
  notes?: string
}

function mapProfile(raw: Row): GuestProfile {
  return {
    id: String(raw.id || ""),
    fullName: cleanText(raw.full_name),
    phone: cleanText(raw.phone),
    email: cleanText(raw.email),
    tags: cleanText(raw.tags),
    vip: raw.vip === true,
    notes: cleanText(raw.notes),
    createdAt: String(raw.created_at || ""),
    updatedAt: String(raw.updated_at || ""),
  }
}

export async function getGuestProfiles(branchId?: string | null): Promise<GuestProfile[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("guest_profiles").select("*").order("full_name", { ascending: true })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapProfile(raw as Row))
}

export async function saveGuestProfile(
  input: SaveGuestProfileInput,
  branchId?: string | null,
): Promise<GuestProfile> {
  const supabase = getSupabaseAdmin()
  const fields = {
    full_name: cleanText(input.fullName),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    tags: cleanText(input.tags),
    vip: input.vip === true,
    notes: cleanText(input.notes),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    let updateQuery = supabase.from("guest_profiles").update(fields).eq("id", input.id)
    if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
    const { data, error } = await updateQuery.select("*").single()
    if (error) throw new Error(error.message)
    return mapProfile(data as Row)
  }

  const { data, error } = await supabase
    .from("guest_profiles")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Row)
}

export async function deleteGuestProfile(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("guest_profiles").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
