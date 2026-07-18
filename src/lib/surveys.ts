import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig } from "@/lib/orders"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import { WHATSAPP_SURVEY_ASPECT } from "@/lib/surveyButtons"

// Encuesta post-venta con estrellas: helpers de servidor compartidos por la
// página pública (/encuesta/<pedido>), el panel de resultados del dueño y el
// despachador automático por WhatsApp Business.

export const DEFAULT_SURVEY_ASPECTS = [
  "Calidad del producto",
  "Servicio",
  "Ambiente",
]

export function parseSurveyAspects(value: unknown): string[] {
  const aspects = String(value || "")
    .split(/[,;\n]/g)
    .map((aspect) => aspect.trim())
    .filter(Boolean)
    .slice(0, 8)

  return aspects.length ? aspects : DEFAULT_SURVEY_ASPECTS
}

export async function getConfiguredSurveyAspects(): Promise<string[]> {
  const config = await getBusinessConfig()
  return parseSurveyAspects(
    (config as unknown as Record<string, unknown>).postSaleSurveyAspects,
  )
}

// ¿La tabla de la migración 0027 falta? (para degradar con mensaje claro)
function isMissingTableError(error: { code?: string | null; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    /relation .* does not exist|could not find the table/i.test(String(error?.message || ""))
  )
}

export type PublicSurveyContext = {
  orderFound: boolean
  displayNumber: string
  customerName: string
  alreadyAnswered: boolean
  surveyAvailable: boolean
}

export async function getPublicSurveyContext(orderId: string): Promise<PublicSurveyContext> {
  const supabase = getSupabaseAdmin()

  // branch-exempt: lookup puntual por id único e imprevisible (ord-...).
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_name, seq, branch_seq, branch_code")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)

  if (!orderRow) {
    return {
      orderFound: false,
      displayNumber: "",
      customerName: "",
      alreadyAnswered: false,
      surveyAvailable: true,
    }
  }

  const seq = Number(orderRow.seq || 0)
  const branchSeq = Number(orderRow.branch_seq || 0)
  const branchCode = String(orderRow.branch_code || "").trim()
  const displayNumber =
    branchSeq > 0
      ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
      : seq > 0
        ? `#${String(seq).padStart(2, "0")}`
        : ""

  // branch-exempt: la respuesta se busca por el mismo order_id imprevisible.
  const { data: existing, error: existingError } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle()

  if (existingError && !isMissingTableError(existingError)) {
    throw new Error(existingError.message)
  }

  return {
    orderFound: true,
    displayNumber,
    customerName: String(orderRow.customer_name || "").trim(),
    alreadyAnswered: Boolean(existing),
    surveyAvailable: !isMissingTableError(existingError) || !existingError,
  }
}

export type SaveSurveyResponseInput = {
  orderId: string
  ratings: Record<string, number>
  comment: string
}

export async function savePublicSurveyResponse(
  input: SaveSurveyResponseInput,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = getSupabaseAdmin()

  // branch-exempt: lookup puntual por id único e imprevisible.
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_name, branch_id, status")
    .eq("id", input.orderId)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!orderRow) {
    return { ok: false, error: "No encontramos ese pedido", status: 404 }
  }

  const aspects = await getConfiguredSurveyAspects()
  const ratings: Record<string, number> = {}

  for (const aspect of aspects) {
    const value = Math.round(Number(input.ratings?.[aspect] || 0))
    if (value >= 1 && value <= 5) ratings[aspect] = value
  }

  const comment = String(input.comment || "").trim().slice(0, 1000)

  if (!Object.keys(ratings).length && !comment) {
    return {
      ok: false,
      error: "Califica al menos un aspecto o déjanos una sugerencia",
      status: 400,
    }
  }

  const { error: insertError } = await supabase.from("survey_responses").insert({
    order_id: input.orderId,
    branch_id: orderRow.branch_id ?? null,
    ratings,
    comment,
    customer_name: String(orderRow.customer_name || "").trim(),
  })

  if (insertError) {
    // 23505 = unique_violation: ya respondió esta encuesta.
    if (insertError.code === "23505") {
      return {
        ok: false,
        error: "Ya habías respondido esta encuesta. ¡Gracias por tu opinión!",
        status: 409,
      }
    }
    if (isMissingTableError(insertError)) {
      return {
        ok: false,
        error: "La encuesta no está disponible en este momento",
        status: 503,
      }
    }
    throw new Error(insertError.message)
  }

  return { ok: true }
}

// Guarda la respuesta de UN TOQUE recibida por el webhook de WhatsApp: el
// cliente tocó un botón (Excelente/Bien/Malo ⇒ 5/3/1). Se guarda bajo el
// aspecto "Experiencia general" para que entre en los promedios del dueño.
// UNA respuesta por pedido (índice único): tocar dos veces no duplica.
export async function saveWhatsAppButtonSurveyResponse(input: {
  orderId: string
  score: number
}): Promise<
  | { ok: true; alreadyAnswered?: boolean }
  | { ok: false; error: string; status: number }
> {
  const score = Math.round(Number(input.score))
  if (!(score >= 1 && score <= 5)) {
    return { ok: false, error: "Puntaje no válido", status: 400 }
  }

  const supabase = getSupabaseAdmin()

  // branch-exempt: lookup puntual por id único e imprevisible (ord-...).
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_name, branch_id")
    .eq("id", input.orderId)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!orderRow) return { ok: false, error: "No encontramos ese pedido", status: 404 }

  const { error: insertError } = await supabase.from("survey_responses").insert({
    order_id: input.orderId,
    branch_id: orderRow.branch_id ?? null,
    ratings: { [WHATSAPP_SURVEY_ASPECT]: score },
    comment: "",
    customer_name: String(orderRow.customer_name || "").trim(),
  })

  if (insertError) {
    // 23505 = unique_violation: ya había respondido (no es un error real).
    if (insertError.code === "23505") return { ok: true, alreadyAnswered: true }
    if (isMissingTableError(insertError)) {
      return { ok: false, error: "La encuesta no está disponible", status: 503 }
    }
    throw new Error(insertError.message)
  }

  return { ok: true }
}

export type SurveyResponseEntry = {
  id: string
  orderId: string
  branchId: string | null
  ratings: Record<string, number>
  comment: string
  customerName: string
  createdAt: string
}

export type SurveyResults = {
  responses: SurveyResponseEntry[]
  totalResponses: number
  // Promedio por aspecto sobre las respuestas cargadas.
  averages: Array<{ aspect: string; average: number; count: number }>
}

export async function getSurveyResults(options: {
  branchId?: string | null
  limit?: number
}): Promise<SurveyResults> {
  const supabase = getSupabaseAdmin()
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500)

  let query = supabase
    .from("survey_responses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options.branchId) query = query.eq("branch_id", options.branchId)

  const { data, error } = await query

  if (error) {
    if (isMissingTableError(error)) {
      return { responses: [], totalResponses: 0, averages: [] }
    }
    throw new Error(error.message)
  }

  const responses: SurveyResponseEntry[] = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      id: String(row.id || ""),
      orderId: String(row.order_id || ""),
      branchId: row.branch_id ? String(row.branch_id) : null,
      ratings:
        row.ratings && typeof row.ratings === "object"
          ? (row.ratings as Record<string, number>)
          : {},
      comment: String(row.comment || ""),
      customerName: String(row.customer_name || ""),
      createdAt: String(row.created_at || ""),
    }
  })

  const totals = new Map<string, { sum: number; count: number }>()

  for (const response of responses) {
    for (const [aspect, value] of Object.entries(response.ratings)) {
      const rating = Number(value)
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue
      const current = totals.get(aspect) || { sum: 0, count: 0 }
      current.sum += rating
      current.count += 1
      totals.set(aspect, current)
    }
  }

  const averages = Array.from(totals.entries())
    .map(([aspect, { sum, count }]) => ({
      aspect,
      average: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((first, second) => second.count - first.count)

  return { responses, totalResponses: responses.length, averages }
}

// Marca en el pedido que la encuesta ya fue enviada (para no repetir).
// Degrada en silencio si la migración 0027 no está aplicada.
export async function markOrderSurveySent(
  orderId: string,
  channel: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  // branch-exempt: update puntual por id único.
  const { error } = await supabase
    .from("orders")
    .update({
      survey_sent_at: new Date().toISOString(),
      survey_sent_channel: channel,
    })
    .eq("id", orderId)
    .is("survey_sent_at", null)

  if (error) {
    if (isMissingColumnError(error)) return false
    throw new Error(error.message)
  }

  return true
}
