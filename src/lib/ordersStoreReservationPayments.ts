import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { decodeDataUrlImage } from "@/lib/dataUrlImages"
import { type Row } from "./ordersStoreMappers"

// Pagos/depósitos de reserva sobre Supabase (Hotel · Fase 9). Todo por branch_id.
// P1-A (cobro online): el huésped puede reportar su abono desde el teléfono con
// una captura opcional, que se guarda en el bucket de comprobantes.

const RESERVATION_PROOFS_BUCKET = "payment-proofs"

export type ReservationPayment = {
  id: string
  reservationId: string
  method: string
  amount: number
  reference: string
  status: string
  note: string
  proofImageUrl: string
  proofFileId: string
  proofFileName: string
  createdAt: string
}

export type CreateReservationPaymentInput = {
  reservationId: string
  method?: string
  amount: number
  reference?: string
  note?: string
  // Captura del comprobante (opcional), como data URL de imagen.
  proofDataUrl?: string
  proofFileName?: string
  proofMimeType?: string
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
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
    proofImageUrl: cleanText(raw.proof_image_url),
    proofFileId: cleanText(raw.proof_file_id),
    proofFileName: cleanText(raw.proof_file_name),
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

  // Captura opcional del comprobante: se sube al bucket de comprobantes y se
  // guarda su URL. Sin imagen, el depósito se registra igual.
  let proofImageUrl = ""
  let proofFileId = ""
  const proofDataUrl = cleanText(input.proofDataUrl)
  if (proofDataUrl) {
    const image = decodeDataUrlImage(proofDataUrl, {
      label: "El comprobante",
      maxBytes: 7_000_000,
      fallbackMimeType: input.proofMimeType || "image/jpeg",
    })
    const path = `reservation-proofs/${Date.now()}-${randomSuffix()}`
    let { error: uploadError } = await supabase.storage
      .from(RESERVATION_PROOFS_BUCKET)
      .upload(path, image.buffer, { contentType: image.mimeType, upsert: true })
    // En una base recién provisionada el bucket todavía no existe: se crea
    // público al vuelo (service role) y se reintenta, sin pasos manuales
    // (mismo patrón que las fotos de habitación).
    if (uploadError && /bucket not found/i.test(uploadError.message || "")) {
      await supabase.storage
        .createBucket(RESERVATION_PROOFS_BUCKET, { public: true })
        .catch(() => undefined)
      ;({ error: uploadError } = await supabase.storage
        .from(RESERVATION_PROOFS_BUCKET)
        .upload(path, image.buffer, { contentType: image.mimeType, upsert: true }))
    }
    if (uploadError) throw new Error(uploadError.message || "No se pudo subir el comprobante")
    const { data: publicData } = supabase.storage.from(RESERVATION_PROOFS_BUCKET).getPublicUrl(path)
    proofImageUrl = publicData?.publicUrl || ""
    proofFileId = path
  }

  const insertRow: Record<string, unknown> = {
    branch_id: branchId ?? null,
    reservation_id: cleanText(input.reservationId) || null,
    method: cleanText(input.method) || "transferencia",
    amount: Math.max(0, num(input.amount, 0)),
    reference: cleanText(input.reference),
    note: cleanText(input.note),
    status: "reportado",
  }
  // Solo se mandan las columnas de captura cuando hay imagen: así el registro
  // sin comprobante funciona aunque la migración 0040 no esté aplicada todavía.
  if (proofImageUrl) {
    insertRow.proof_image_url = proofImageUrl
    insertRow.proof_file_id = proofFileId
    insertRow.proof_file_name = cleanText(input.proofFileName)
  }

  const { data, error } = await supabase
    .from("reservation_payments")
    .insert(insertRow)
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
