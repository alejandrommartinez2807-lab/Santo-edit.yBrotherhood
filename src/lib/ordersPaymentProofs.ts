import type { PaymentProof, PaymentProofStatus } from "@/types/localOrders"
import { decodeDataUrlImage } from "@/lib/dataUrlImages"
import { getSupabaseAdmin } from "./supabaseServer"

export type CreatePaymentProofInput = {
  orderId: string
  customerName?: string
  customerPhone?: string
  reportedMethod?: string
  amountReportedUSD?: number
  amountReportedVES?: number
  paymentReference?: string
  customerNote?: string
  dataUrl?: string
  fileName?: string
  mimeType?: string
  // Segunda captura (solo pago mixto: una por cada pata). Opcional.
  dataUrl2?: string
  fileName2?: string
  mimeType2?: string
}

export type ReviewPaymentProofInput = {
  status: PaymentProofStatus
  reviewedBy?: string
  internalNote?: string
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function cleanText(value: unknown) {
  return String(value || "").trim()
}

const PAYMENT_PROOFS_BUCKET = "payment-proofs"

function paymentProofRowToProof(row: Record<string, unknown>): PaymentProof {
  return {
    id: cleanText(row.id),
    orderId: cleanText(row.order_id),
    createdAt: cleanText(row.created_at),
    customerName: cleanText(row.customer_name),
    customerPhone: cleanText(row.customer_phone),
    orderType: cleanText(row.order_type),
    orderTotalUSD: Number(row.order_total_usd || 0),
    reportedMethod: cleanText(row.reported_method),
    amountReportedUSD: Number(row.amount_reported_usd || 0),
    amountReportedVES: Number(row.amount_reported_ves || 0),
    paymentReference: cleanText(row.payment_reference),
    customerNote: cleanText(row.customer_note),
    proofImageUrl: cleanText(row.proof_image_url),
    proofFileId: cleanText(row.proof_file_id),
    proofFileName: cleanText(row.proof_file_name),
    proofImageUrl2: cleanText(row.proof_image_url_2),
    proofFileId2: cleanText(row.proof_file_id_2),
    proofFileName2: cleanText(row.proof_file_name_2),
    status: (cleanText(row.status) || "Comprobante enviado") as PaymentProofStatus,
    reviewedBy: cleanText(row.reviewed_by),
    reviewedAt: cleanText(row.reviewed_at),
    internalNote: cleanText(row.internal_note),
  }
}

export async function getPaymentProofs(
  options: { orderId?: string; status?: string } = {},
  branchId?: string | null,
) {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("payment_proofs").select("*").order("created_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)
  if (options.orderId) {
    query = query.eq("order_id", options.orderId)
  }
  if (options.status) {
    query = query.eq("status", options.status)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || "No se pudieron cargar los comprobantes")
  }

  return (data ?? []).map((row) => paymentProofRowToProof(row as Record<string, unknown>))
}

// Limpieza al cierre del día: los comprobantes quedan fotografiados DENTRO
// del cierre guardado, así que las filas se borran para que el panel de
// comprobantes arranque limpio. Las imágenes en Storage se conservan (los
// links del historial siguen funcionando).
export async function clearPaymentProofs(branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("payment_proofs").delete()
  query = branchId ? query.eq("branch_id", branchId) : query.neq("id", "")
  const { error } = await query
  if (error) {
    throw new Error(error.message || "No se pudieron archivar los comprobantes")
  }
  return { ok: true }
}

async function uploadProofImage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dataUrl: string,
  mimeType?: string,
): Promise<{ url: string; fileId: string }> {
  if (!cleanText(dataUrl)) return { url: "", fileId: "" }

  const image = decodeDataUrlImage(dataUrl, {
    label: "El comprobante",
    maxBytes: 7_000_000,
    fallbackMimeType: mimeType || "image/jpeg",
  })
  const path = `proofs/${Date.now()}-${randomSuffix()}`
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(path, image.buffer, { contentType: image.mimeType, upsert: true })
  if (uploadError) {
    throw new Error(uploadError.message || "No se pudo subir el comprobante")
  }
  const { data: publicData } = supabase.storage.from(PAYMENT_PROOFS_BUCKET).getPublicUrl(path)
  return { url: publicData?.publicUrl || "", fileId: path }
}

export async function createPaymentProof(input: CreatePaymentProofInput, branchId?: string | null) {
  const supabase = getSupabaseAdmin()
  const id = `proof-${Date.now()}-${randomSuffix()}`

  // Subir la imagen del comprobante (si viene) a Supabase Storage. En pago
  // mixto puede venir una SEGUNDA captura (una por cada pata).
  const uploaded = await uploadProofImage(supabase, cleanText(input.dataUrl), input.mimeType)
  const proofImageUrl = uploaded.url
  const proofFileId = uploaded.fileId
  const uploaded2 = await uploadProofImage(supabase, cleanText(input.dataUrl2), input.mimeType2)
  const proofImageUrl2 = uploaded2.url
  const proofFileId2 = uploaded2.fileId

  // Completar datos del pedido (tipo y total) desde la orden, si existe
  let orderType = ""
  let orderTotalUSD = 0
  let orderQuery = supabase
    .from("orders")
    .select("order_type, total_usd, customer_name")
    .eq("id", cleanText(input.orderId))
  if (branchId) orderQuery = orderQuery.eq("branch_id", branchId)
  const { data: orderRow } = await orderQuery.maybeSingle()
  if (orderRow) {
    const o = orderRow as Record<string, unknown>
    orderType = cleanText(o.order_type)
    orderTotalUSD = Number(o.total_usd || 0)
  }

  // Fila base (una sola imagen): funciona con o sin la migración 0030.
  const baseRow: Record<string, unknown> = {
    id,
    branch_id: branchId ?? null,
    order_id: cleanText(input.orderId),
    customer_name: cleanText(input.customerName) || cleanText((orderRow as Record<string, unknown>)?.customer_name),
    customer_phone: cleanText(input.customerPhone),
    order_type: orderType,
    order_total_usd: orderTotalUSD,
    reported_method: cleanText(input.reportedMethod),
    amount_reported_usd: Number(input.amountReportedUSD || 0),
    amount_reported_ves: Number(input.amountReportedVES || 0),
    payment_reference: cleanText(input.paymentReference),
    customer_note: cleanText(input.customerNote),
    proof_image_url: proofImageUrl,
    proof_file_id: proofFileId,
    proof_file_name: cleanText(input.fileName),
    status: "Comprobante enviado",
  }

  // Solo si hay SEGUNDA captura se tocan las columnas nuevas: así los
  // comprobantes de una sola imagen siguen funcionando aunque la migración 0030
  // aún no esté aplicada. Si el insert con las columnas nuevas falla porque no
  // existen todavía, se reintenta sin ellas (se guarda con la primera imagen).
  const hasSecondImage = Boolean(proofImageUrl2 || proofFileId2 || cleanText(input.fileName2))
  const rowWithSecond = hasSecondImage
    ? {
        ...baseRow,
        proof_image_url_2: proofImageUrl2,
        proof_file_id_2: proofFileId2,
        proof_file_name_2: cleanText(input.fileName2),
      }
    : baseRow

  let { data, error } = await supabase
    .from("payment_proofs")
    .insert(rowWithSecond)
    .select("*")
    .single()

  if (error && hasSecondImage && /proof_image_url_2|proof_file_id_2|proof_file_name_2|column/i.test(error.message || "")) {
    ;({ data, error } = await supabase
      .from("payment_proofs")
      .insert(baseRow)
      .select("*")
      .single())
  }

  if (error) {
    throw new Error(error.message || "No se pudo enviar el comprobante")
  }

  return paymentProofRowToProof(data as Record<string, unknown>)
}

export async function reviewPaymentProof(
  proofId: string,
  input: ReviewPaymentProofInput,
  branchId?: string | null,
) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("payment_proofs")
    .update({
      status: input.status,
      reviewed_by: cleanText(input.reviewedBy),
      internal_note: cleanText(input.internalNote),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", cleanText(proofId))
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.select("*").single()

  if (error) {
    throw new Error(error.message || "No se pudo revisar el comprobante")
  }

  return paymentProofRowToProof(data as Record<string, unknown>)
}
