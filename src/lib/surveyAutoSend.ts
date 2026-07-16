import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig } from "@/lib/orders"
import { getSiteUrl } from "@/lib/siteUrl"
import { captureError } from "@/lib/monitoring"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import { markOrderSurveySent } from "@/lib/surveys"
import {
  getSurveyTemplateName,
  isWhatsAppBusinessConfigured,
  sendWhatsAppBusinessSurveyTemplate,
  sendWhatsAppBusinessText,
} from "@/lib/whatsappBusiness"

// Envío AUTOMÁTICO de la encuesta post-venta: X minutos después de marcar
// el pedido como Entregado (delivery/pick up con teléfono), se manda el link
// de /encuesta/<pedido> por WhatsApp Business Cloud API.
//
// No hay cron: el despacho se dispara "de gratis" con el polling del panel
// del staff (GET /api/orders llama a maybeDispatchPostSaleSurveys, con
// throttle). Mientras el negocio esté operando, las encuestas salen solas;
// también se puede disparar a mano con POST /api/surveys {action:"dispatch"}.

const RUN_INTERVAL_MS = 2 * 60 * 1000
const MAX_ORDER_AGE_HOURS = 48
const BATCH_LIMIT = 10

let lastRunAt = 0
let isRunning = false

export type SurveyDispatchResult = {
  ok: boolean
  sent: number
  pending: number
  reason?: string
}

export async function dispatchPostSaleSurveys(): Promise<SurveyDispatchResult> {
  const config = (await getBusinessConfig()) as unknown as Record<string, unknown>

  if (config.postSaleSurveyEnabled === false) {
    return { ok: true, sent: 0, pending: 0, reason: "La encuesta post-venta está apagada" }
  }

  if (config.postSaleSurveyAutoEnabled !== true) {
    return { ok: true, sent: 0, pending: 0, reason: "El envío automático está apagado en Configuración" }
  }

  if (!isWhatsAppBusinessConfigured()) {
    return {
      ok: true,
      sent: 0,
      pending: 0,
      reason:
        "Falta conectar WhatsApp Business (WHATSAPP_BUSINESS_TOKEN y WHATSAPP_BUSINESS_PHONE_ID en el servidor)",
    }
  }

  const delayMinutes = Math.min(
    1440,
    Math.max(5, Math.round(Number(config.postSaleSurveyDelayMinutes) || 40)),
  )
  const now = Date.now()
  const deliveredBefore = new Date(now - delayMinutes * 60 * 1000).toISOString()
  const createdAfter = new Date(now - MAX_ORDER_AGE_HOURS * 60 * 60 * 1000).toISOString()

  const supabase = getSupabaseAdmin()

  // updated_at ≈ momento de la entrega (último cambio de estado del pedido).
  const { data, error } = await supabase
    .from("orders")
    // branch-exempt: barrido intencional de TODAS las sedes (cada pedido ya
    // guarda su sede y el link de la encuesta es por pedido).
    .select("id, customer_name, customer_phone, order_type, branch_seq, branch_code, seq, survey_sent_at")
    .eq("status", "Entregado")
    .is("survey_sent_at", null)
    .in("order_type", ["Delivery", "Para llevar"])
    .neq("customer_phone", "")
    .not("customer_phone", "is", null)
    .lte("updated_at", deliveredBefore)
    .gte("created_at", createdAfter)
    .eq("is_training", false)
    .limit(BATCH_LIMIT)

  if (error) {
    // Sin la migración 0027 no hay survey_sent_at: NO se envía nada (sin esa
    // marca no podemos evitar duplicados).
    if (isMissingColumnError(error)) {
      return {
        ok: false,
        sent: 0,
        pending: 0,
        reason: "Falta aplicar la migración 0027 en Supabase (columna survey_sent_at)",
      }
    }
    throw new Error(error.message)
  }

  const pendingOrders = data ?? []
  let sent = 0
  const customMessage = String(config.postSaleSurveyMessage || "").trim()
  const businessName = String(config.businessName || "el negocio").trim()
  const siteUrl = getSiteUrl()
  const useTemplate = Boolean(getSurveyTemplateName())

  for (const raw of pendingOrders) {
    const order = raw as Record<string, unknown>
    const orderId = String(order.id || "")
    const phone = String(order.customer_phone || "")
    const customerName = String(order.customer_name || "").trim() || "cliente"
    const surveyUrl = `${siteUrl}/encuesta/${orderId}`
    const branchSeq = Number(order.branch_seq || 0)
    const seq = Number(order.seq || 0)
    const branchCode = String(order.branch_code || "").trim()
    const displayNumber =
      branchSeq > 0
        ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
        : seq > 0
          ? `#${String(seq).padStart(2, "0")}`
          : ""

    const body = customMessage
      ? [customMessage, "", `Califícanos aquí (1 minuto): ${surveyUrl}`].join("\n")
      : [
          `Hola ${customerName}, somos ${businessName}. ¡Gracias por tu pedido${displayNumber ? ` ${displayNumber}` : ""}!`,
          "",
          "¿Nos regalas 1 minuto? Califica tu pedido con estrellas aquí:",
          surveyUrl,
          "",
          "Tu opinión nos ayuda muchísimo a mejorar.",
        ].join("\n")

    const result = useTemplate
      ? await sendWhatsAppBusinessSurveyTemplate(phone, customerName, surveyUrl)
      : await sendWhatsAppBusinessText(phone, body)

    if (result.ok) {
      await markOrderSurveySent(orderId, useTemplate ? "auto-template" : "auto-whatsapp")
      sent += 1
    } else {
      captureError(new Error(result.error || "Fallo al enviar encuesta"), {
        route: "lib/surveyAutoSend",
        action: "send",
      })
    }
  }

  return { ok: true, sent, pending: pendingOrders.length - sent }
}

// Disparo oportunista con throttle: lo llama el GET de pedidos del panel y
// se AWAITEA antes de responder (en serverless el trabajo suelto tras
// responder se congela). Solo una petición cada 2 min paga esta latencia.
export async function maybeDispatchPostSaleSurveys(): Promise<void> {
  const now = Date.now()

  if (isRunning || now - lastRunAt < RUN_INTERVAL_MS) return

  lastRunAt = now
  isRunning = true

  try {
    await dispatchPostSaleSurveys()
  } catch (error) {
    captureError(error, { route: "lib/surveyAutoSend", action: "maybeDispatch" })
  } finally {
    isRunning = false
  }
}
