import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { type Row } from "./ordersStoreMappers"

// Pagos/depósitos de reserva sobre Supabase (Hotel · Fase 9). Todo por branch_id.

export type ReservationPayment = {
  id: string
  reservationId: string
  method: string
  amount: number
  reference: string
  status: string
  note: string
  createdAt: string
}

export type CreateReservationPaymentInput = {
  reservationId: string
  method?: string
  amount: number
  reference?: string
  note?: string
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapPayment(raw: Row): ReservationPayment {
  return {
    id: String(raw.id || ""),
    reservationId: cleanText(raw.reservation_id),
    method: cleanText(raw.method) || "transferencia",
    amount: num(raw.amount, 0),
    reference: cleanText(raw.reference),
    status: cleanText(raw.status) || "reportado",
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
  }
}

export async function getReservationPayments(
  filters: { reservationId?: string } = {},
  branchId?: string | null,
): Promise<ReservationPayment[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("reservation_payments").select("*").order("created_at", { ascending: false }).limit(200)
  if (branchId) query = query.eq("branch_id", branchId)
  if (filters.reservationId) query = query.eq("reservation_id", filters.reservationId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapPayment(raw as Row))
}

export async function createReservationPayment(
  input: CreateReservationPaymentInput,
  branchId?: string | null,
): Promise<ReservationPayment> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("reservation_payments")
    .insert({
      branch_id: branchId ?? null,
      reservation_id: cleanText(input.reservationId) || null,
      method: cleanText(input.method) || "transferencia",
      amount: Math.max(0, num(input.amount, 0)),
      reference: cleanText(input.reference),
      note: cleanText(input.note),
      status: "reportado",
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPayment(data as Row)
}

export async function updateReservationPaymentStatus(
  id: string,
  status: string,
  branchId?: string | null,
): Promise<ReservationPayment> {
  const supabase = getSupabaseAdmin()
  const clean = ["reportado", "confirmado", "rechazado"].includes(cleanText(status))
    ? cleanText(status)
    : "reportado"
  let updateQuery = supabase.from("reservation_payments").update({ status: clean }).eq("id", id)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data, error } = await updateQuery.select("*").single()
  if (error) throw new Error(error.message)
  return mapPayment(data as Row)
}
