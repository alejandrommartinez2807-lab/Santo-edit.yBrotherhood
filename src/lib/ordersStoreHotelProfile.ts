import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Contenido de la landing pública del hotel (Hotel · Fase 11). Una fila por
// propiedad (branch_id). Todo por branch_id.

export type HotelProfile = {
  headline: string
  about: string
  amenities: string
  address: string
  phone: string
  email: string
  checkinTime: string
  checkoutTime: string
}

export type SaveHotelProfileInput = Partial<HotelProfile>

const EMPTY_PROFILE: HotelProfile = {
  headline: "",
  about: "",
  amenities: "",
  address: "",
  phone: "",
  email: "",
  checkinTime: "15:00",
  checkoutTime: "12:00",
}

function mapProfile(raw: Row): HotelProfile {
  return {
    headline: cleanText(raw.headline),
    about: cleanText(raw.about),
    amenities: cleanText(raw.amenities),
    address: cleanText(raw.address),
    phone: cleanText(raw.phone),
    email: cleanText(raw.email),
    checkinTime: cleanText(raw.checkin_time) || "15:00",
    checkoutTime: cleanText(raw.checkout_time) || "12:00",
  }
}

export async function getHotelProfile(branchId?: string | null): Promise<HotelProfile> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("hotel_profile").select("*").limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapProfile(data as Row) : { ...EMPTY_PROFILE }
}

export async function saveHotelProfile(
  input: SaveHotelProfileInput,
  branchId?: string | null,
): Promise<HotelProfile> {
  const supabase = getSupabaseAdmin()
  const fields = {
    headline: cleanText(input.headline),
    about: cleanText(input.about),
    amenities: cleanText(input.amenities),
    address: cleanText(input.address),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    checkin_time: cleanText(input.checkinTime) || "15:00",
    checkout_time: cleanText(input.checkoutTime) || "12:00",
    updated_at: new Date().toISOString(),
  }

  // Upsert manual: una fila por branch.
  let existingQuery = supabase.from("hotel_profile").select("id").limit(1)
  if (branchId) existingQuery = existingQuery.eq("branch_id", branchId)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing && (existing as Row).id) {
    const { data, error } = await supabase
      .from("hotel_profile")
      .update(fields)
      .eq("id", (existing as Row).id)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return mapProfile(data as Row)
  }

  const { data, error } = await supabase
    .from("hotel_profile")
    .insert({ ...fields, branch_id: branchId ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Row)
}
