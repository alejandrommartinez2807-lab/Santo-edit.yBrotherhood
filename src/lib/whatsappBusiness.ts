import { captureError } from "@/lib/monitoring"

// Cliente mínimo de la WhatsApp Business Cloud API (Meta). Con esto el
// sistema puede INICIAR mensajes al cliente (p. ej. la encuesta post-venta
// automática) sin abrir WhatsApp a mano.
//
// Para conectarlo (Meta for Developers → app de WhatsApp Business):
//   WHATSAPP_BUSINESS_TOKEN     = token permanente del sistema
//   WHATSAPP_BUSINESS_PHONE_ID  = "Phone number ID" del número del negocio
//   WHATSAPP_SURVEY_TEMPLATE    = (opcional) nombre de plantilla aprobada
//   WHATSAPP_TEMPLATE_LANG      = (opcional) idioma de la plantilla (es)
//
// Nota de Meta: los mensajes que INICIA el negocio fuera de la ventana de
// 24 h requieren una PLANTILLA aprobada. Si configuras la plantilla, se usa
// (con {{1}} = nombre del cliente y {{2}} = link de la encuesta); sin
// plantilla se intenta texto libre, que llega solo si el cliente escribió
// al negocio en las últimas 24 h.

const GRAPH_API_VERSION = "v20.0"

function getToken() {
  return String(process.env.WHATSAPP_BUSINESS_TOKEN || "").trim()
}

function getPhoneNumberId() {
  return String(process.env.WHATSAPP_BUSINESS_PHONE_ID || "").trim()
}

export function isWhatsAppBusinessConfigured(): boolean {
  return Boolean(getToken() && getPhoneNumberId())
}

export function getSurveyTemplateName(): string {
  return String(process.env.WHATSAPP_SURVEY_TEMPLATE || "").trim()
}

// Plantilla de BOTONES: la encuesta se contesta con un toque dentro del chat
// (sin link). Si está configurada, tiene prioridad sobre el link.
export function getSurveyButtonTemplateName(): string {
  return String(process.env.WHATSAPP_SURVEY_BUTTON_TEMPLATE || "").trim()
}

// Normaliza a formato internacional sin "+" (igual que los botones wa.me
// del panel: números venezolanos 0412... → 58412...).
export function normalizePhoneForWhatsAppApi(value: string): string {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0") && digits.length === 11) return `58${digits.slice(1)}`
  if (digits.startsWith("4") && digits.length === 10) return `58${digits}`
  if (digits.startsWith("58") && digits.length === 12) return digits
  if (!digits.startsWith("0") && digits.length >= 10 && digits.length <= 15) return digits
  return ""
}

type SendResult = { ok: boolean; error?: string }

async function postToGraph(payload: Record<string, unknown>): Promise<SendResult> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${getPhoneNumberId()}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      },
    )

    if (response.ok) return { ok: true }

    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    const message = String(data?.error?.message || `HTTP ${response.status}`)

    return { ok: false, error: message }
  } catch (error) {
    captureError(error, { route: "lib/whatsappBusiness", action: "postToGraph" })
    return { ok: false, error: error instanceof Error ? error.message : "Fallo de red" }
  }
}

export async function sendWhatsAppBusinessText(
  phone: string,
  body: string,
): Promise<SendResult> {
  if (!isWhatsAppBusinessConfigured()) {
    return { ok: false, error: "WhatsApp Business no está configurado" }
  }

  const to = normalizePhoneForWhatsAppApi(phone)
  if (!to) return { ok: false, error: "Teléfono no válido" }

  return postToGraph({
    to,
    type: "text",
    text: { body: String(body || "").slice(0, 4000), preview_url: true },
  })
}

// Plantilla aprobada con dos variables de cuerpo: {{1}} nombre, {{2}} link.
export async function sendWhatsAppBusinessSurveyTemplate(
  phone: string,
  customerName: string,
  surveyUrl: string,
): Promise<SendResult> {
  if (!isWhatsAppBusinessConfigured()) {
    return { ok: false, error: "WhatsApp Business no está configurado" }
  }

  const to = normalizePhoneForWhatsAppApi(phone)
  if (!to) return { ok: false, error: "Teléfono no válido" }

  const templateName = getSurveyTemplateName()
  if (!templateName) return { ok: false, error: "Sin plantilla configurada" }

  return postToGraph({
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: String(process.env.WHATSAPP_TEMPLATE_LANG || "es").trim() || "es",
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(customerName || "cliente").slice(0, 60) },
            { type: "text", text: surveyUrl },
          ],
        },
      ],
    },
  })
}

// Plantilla de BOTONES de respuesta rápida: la encuesta se contesta con un
// toque, dentro del chat, sin link y sin escribir. El texto de cada botón lo
// fija la plantilla aprobada en Meta; aquí sólo mandamos el "payload" de cada
// botón (pedido + puntaje), que vuelve por el webhook cuando el cliente toca.
// {{1}} del cuerpo = nombre del cliente. `payloads` va en orden de botón.
export async function sendWhatsAppBusinessSurveyButtons(
  phone: string,
  customerName: string,
  payloads: string[],
): Promise<SendResult> {
  if (!isWhatsAppBusinessConfigured()) {
    return { ok: false, error: "WhatsApp Business no está configurado" }
  }

  const to = normalizePhoneForWhatsAppApi(phone)
  if (!to) return { ok: false, error: "Teléfono no válido" }

  const templateName = getSurveyButtonTemplateName()
  if (!templateName) return { ok: false, error: "Sin plantilla de botones configurada" }
  if (!payloads.length) return { ok: false, error: "Sin opciones de botón" }

  const buttonComponents = payloads.map((payload, index) => ({
    type: "button",
    sub_type: "quick_reply",
    index: String(index),
    parameters: [{ type: "payload", payload }],
  }))

  return postToGraph({
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: String(process.env.WHATSAPP_TEMPLATE_LANG || "es").trim() || "es",
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(customerName || "cliente").slice(0, 60) },
          ],
        },
        ...buttonComponents,
      ],
    },
  })
}
