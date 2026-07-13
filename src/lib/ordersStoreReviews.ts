import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"
import { clampRating } from "./reviewsSummary"

// Reseñas del huésped sobre Supabase (Hotel · Fase 13). Todo por branch_id.

export type Review = {
  id: string
  reservationId: string
  guestName: string
  rating: number
  comment: string
  published: boolean
  createdAt: string
}

export type CreateReviewInput = {
  reservationId?: string
  guestName?: string
  rating: number
  comment?: string
}

function mapReview(raw: Row): Review {
  return {
    id: String(raw.id || ""),
    reservationId: cleanText(raw.reservation_id),
    guestName: cleanText(raw.guest_name) || "Huésped",
    rating: clampRating(raw.rating),
    comment: cleanText(raw.comment),
    published: raw.published !== false,
    createdAt: String(raw.created_at || ""),
  }
}

export async function getReviews(branchId?: string | null): Promise<Review[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("guest_reviews").select("*").order("created_at", { ascending: false })
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapReview(raw as Row))
}

export async function createReview(
  input: CreateReviewInput,
  branchId?: string | null,
): Promise<Review> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("guest_reviews")
    .insert({
      branch_id: branchId ?? null,
      reservation_id: cleanText(input.reservationId) || null,
      guest_name: cleanText(input.guestName),
      rating: clampRating(input.rating),
      comment: cleanText(input.comment),
      published: true,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapReview(data as Row)
}

export async function setReviewPublished(
  id: string,
  published: boolean,
  branchId?: string | null,
): Promise<Review> {
  const supabase = getSupabaseAdmin()
  let updateQuery = supabase.from("guest_reviews").update({ published }).eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapReview(data as Row)
}

export async function deleteReview(id: string, branchId?: string | null): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  let deleteQuery = supabase.from("guest_reviews").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
