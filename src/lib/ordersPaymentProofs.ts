import type { PaymentProof, PaymentProofStatus } from "@/types/localOrders"
import { decodeDataUrlImage } from "@/lib/dataUrlImages"
import { getSupabaseAdmin } from "./supabaseServer"
import { fetchAllRows } from "./ordersStoreQueries"

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

// Vigencia de las URLs firmadas de comprobantes. El panel las usa al vuelo
// (ver/abrir la imagen); 1 hora sobra y evita que un link reenviado sirva
// para siempre.
const SIGNED_PROOF_TTL_SECONDS = 60 * 60

// Genera una URL firmada de corta duración para una ruta del bucket privado.
// Si no hay ruta o falla la firma, devuelve "" (el panel muestra "sin imagen").
async function signProofPath(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  path: string,
): Promise<string> {
  const cleanPath = cleanText(path)
  if (!cleanPath) return ""

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(cleanPath, SIGNED_PROOF_TTL_SECONDS)

  if (error || !data?.signedUrl) return ""
  return data.signedUrl
}

// Firma varias rutas en una sola llamada (bucket privado). Devuelve un mapa
// ruta -> URL firmada; las rutas vacías o que fallen quedan fuera. Lo usa el
// historial de cierres, que puede traer muchos comprobantes de golpe.
export async function signPaymentProofPaths(
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const cleanPaths = [...new Set(paths.map(cleanText).filter(Boolean))]
  if (cleanPaths.length === 0) return result

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrls(cleanPaths, SIGNED_PROOF_TTL_SECONDS)

  if (error || !Array.isArray(data)) return result
  for (const entry of data) {
    if (entry?.path && entry.signedUrl) result.set(entry.path, entry.signedUrl)
  }
  return result
}

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

export type PaymentProofsFreshness = {
  count: number
  maxCreatedAt: string | null
  maxReviewedAt: string | null
}

// La huella barata del sondeo de comprobantes (2026-08-04). Esta ruta ni
// siquiera se beneficiaba del ETag por contenido: el bucket es privado y cada
// lectura re-firma las URLs, así que el JSON cambia en TODAS las respuestas y
// el hash nunca coincidía — cada sondeo de 10 s bajaba la lista completa.
// payment_proofs no tiene updated_at y no hace falta: sus únicas escrituras
// son INSERT (count y max created_at), el DELETE del cierre (count) y la
// revisión, que SIEMPRE estampa reviewed_at = now(). Mismos filtros que el
// cuerpo (getPaymentProofs).
export async function getPaymentProofsFreshness(
  options: { orderId?: string; status?: string } = {},
  branchId?: string | null,
): Promise<PaymentProofsFreshness> {
  const supabase = getSupabaseAdmin()

  let createdQuery = supabase
    .from("payment_proofs")
    .select("created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(1)
  if (branchId) createdQuery = createdQuery.eq("branch_id", branchId)
  if (options.orderId) createdQuery = createdQuery.eq("order_id", options.orderId)
  if (options.status) createdQuery = createdQuery.eq("status", options.status)

  // Sin el not-null, Postgres ordena NULLS FIRST en desc y el máximo real
  // quedaría escondido detrás de los comprobantes sin revisar.
  let reviewedQuery = supabase
    .from("payment_proofs")
    .select("reviewed_at")
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(1)
  if (branchId) reviewedQuery = reviewedQuery.eq("branch_id", branchId)
  if (options.orderId) reviewedQuery = reviewedQuery.eq("order_id", options.orderId)
  if (options.status) reviewedQuery = reviewedQuery.eq("status", options.status)

  const [created, reviewed] = await Promise.all([createdQuery, reviewedQuery])

  if (created.error) throw new Error(created.error.message)
  if (reviewed.error) throw new Error(reviewed.error.message)

  const maxOf = (data: unknown[] | null, column: string) => {
    const value = (data?.[0] as Record<string, unknown> | undefined)?.[column]
    return typeof value === "string" && value ? value : null
  }

  return {
    count: created.count ?? 0,
    maxCreatedAt: maxOf(created.data, "created_at"),
    maxReviewedAt: maxOf(reviewed.data, "reviewed_at"),
  }
}

// Tope de seguridad del buzón (H-2): el cierre lo vacía a diario, así que
// pasar de aquí significa muchos días sin cerrar acumulados.
const MAX_PAYMENT_PROOFS = 5000

export async function getPaymentProofs(
  options: { orderId?: string; status?: string } = {},
  branchId?: string | null,
) {
  const supabase = getSupabaseAdmin()

  // Paginado (H-2, 2026-08-04): sin .range, PostgREST corta en 1000 filas y
  // los comprobantes más viejos del buzón desaparecen EN SILENCIO.
  const data = await fetchAllRows((from, to) => {
    let query = supabase
      .from("payment_proofs")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
    if (branchId) query = query.eq("branch_id", branchId)
    if (options.orderId) {
      query = query.eq("order_id", options.orderId)
    }
    if (options.status) {
      query = query.eq("status", options.status)
    }
    return query
  }, MAX_PAYMENT_PROOFS)

  const proofs = data.map((row) =>
    paymentProofRowToProof(row as Record<string, unknown>),
  )

  // Bucket privado: reemplazamos la URL guardada por una URL firmada fresca,
  // generada desde la ruta del archivo (proofFileId). Cubre comprobantes
  // viejos y nuevos sin migrar datos.
  //
  // En UNA sola llamada a Storage (auditoría 2026-08-02). Antes se firmaba de
  // una en una: un sábado con 40 comprobantes en el buzón eran hasta 80
  // llamadas por cada carga de la lista, y caja y la pantalla la piden cada
  // 10 s — cerca de mil llamadas por minuto solo para firmar. El cajero que
  // estaba validando un pago móvil veía la lista tardar o expirar. El helper
  // por lotes ya existía en este mismo archivo, sin usar.
  const signedByPath = await signPaymentProofPaths(
    proofs.flatMap((proof) => [proof.proofFileId, proof.proofFileId2]),
  )

  return proofs.map((proof) => ({
    ...proof,
    proofImageUrl: proof.proofFileId ? signedByPath.get(proof.proofFileId) || "" : "",
    proofImageUrl2: proof.proofFileId2 ? signedByPath.get(proof.proofFileId2) || "" : "",
  }))
}

// Limpieza al cierre del día: los comprobantes quedan fotografiados DENTRO
// del cierre guardado, así que las filas se borran para que el panel de
// comprobantes arranque limpio. Las imágenes en Storage se conservan (los
// links del historial siguen funcionando).
export async function clearPaymentProofs(
  branchId?: string | null,
  options?: { createdUntil?: string | null },
) {
  // Fail-closed (auditoría 2026-07-24, B): sin sede resuelta el `neq("id","")`
  // vaciaba el buzón de comprobantes de TODAS las sucursales.
  if (!branchId) {
    throw new Error("No se pudo resolver la sucursal: no se archivan los comprobantes")
  }

  // Solo se limpia hasta donde llegó la FOTOGRAFÍA del cierre (auditoría
  // 2026-08-02). Antes se vaciaba el buzón entero de la sede: el comprobante
  // que un cliente subía mientras se guardaba el cierre, o los que quedaban
  // fuera del tope del snapshot, se borraban sin haber quedado registrados en
  // ninguna parte — el cliente pagó y su prueba desapareció.
  const createdUntil = String(options?.createdUntil || "").trim()

  const supabase = getSupabaseAdmin()
  let query = supabase.from("payment_proofs").delete().eq("branch_id", branchId)
  if (createdUntil) query = query.lte("created_at", createdUntil)
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
  // Bucket privado: no hay URL pública estable. Guardamos una URL firmada
  // inicial como respaldo, pero la fuente de verdad para mostrar es la ruta
  // (fileId), que getPaymentProofs vuelve a firmar en cada lectura.
  const signedUrl = await signProofPath(supabase, path)
  return { url: signedUrl, fileId: path }
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

  // branch-exempt: baseRow/rowWithSecond llevan branch_id asignado arriba.
  let { data, error } = await supabase
    .from("payment_proofs")
    .insert(rowWithSecond)
    .select("*")
    .single()

  if (error && hasSecondImage && /proof_image_url_2|proof_file_id_2|proof_file_name_2|column/i.test(error.message || "")) {
    // branch-exempt: baseRow lleva branch_id asignado arriba.
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
