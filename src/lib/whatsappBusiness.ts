import { captureError } from "@/lib/monitoring"

// ============================================================
// Cliente mínimo de la WhatsApp Business Cloud API (Meta) — Hotel.
// Con esto el sistema puede INICIAR mensajes al huésped (promociones,
// campañas del CRM, avisos automáticos) sin abrir WhatsApp a mano.
//
// Queda DORMIDO hasta que el hotel conecte su WhatsApp Business. Se activa
// solo con variables de entorno (Meta for Developers → app de WhatsApp
// Business Cloud API):
//   WHATSAPP_BUSINESS_TOKEN     = token permanente del sistema
//   WHATSAPP_BUSINESS_PHONE_ID  = "Phone number ID" del número del hotel
//   WHATSAPP_CAMPAIGN_TEMPLATE  = (opcional) nombre de plantilla de MARKETING
//                                 aprobada para promos/campañas
//   WHATSAPP_TEMPLATE_LANG      = (opcional) idioma de la plantilla (default es)
//
// Regla de Meta que condiciona el diseño: los mensajes que INICIA el negocio
// fuera de la ventana de 24 h requieren una PLANTILLA aprobada (categoría
// marketing para promociones). El texto libre solo llega a quien escribió al
// negocio en las últimas 24 h. Por eso el envío de campañas usa la plantilla
// si está configurada (llega a todos) y, si no, cae a texto libre.
// ============================================================

const GRAPH_API_VERSION = "v20.0"

function getToken() {
  return String(process.env.WHATSAPP_BUSINESS_TOKEN || "").trim()
}

function getPhoneNumberId() {
  return String(process.env.WHATSAPP_BUSINESS_PHONE_ID || "").trim()
}

/** true cuando hay token + phone id, es decir el hotel ya conectó WhatsApp Business. */
export function isWhatsAppBusinessConfigured(): boolean {
  return Boolean(getToken() && getPhoneNumberId())
}

/** Nombre de la plantilla de marketing aprobada para campañas/promos (vacío = usar texto libre). */
export function getCampaignTemplateName(): string {
  return String(process.env.WHATSAPP_CAMPAIGN_TEMPLATE || "").trim()
}

export function getTemplateLang(): string {
  return String(process.env.WHATSAPP_TEMPLATE_LANG || "es").trim() || "es"
}

// Normaliza a formato internacional sin "+" (números venezolanos 0412... →
// 58412...). Devuelve "" si no parece un teléfono válido.
export function normalizePhoneForWhatsAppApi(value: string): string {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0") && digits.length === 11) return `58${digits.slice(1)}`
  if (digits.startsWith("4") && digits.length === 10) return `58${digits}`
  if (digits.startsWith("58") && digits.length === 12) return digits
  if (!digits.startsWith("0") && digits.length >= 10 && digits.length <= 15) return digits
  return ""
}

export type WhatsAppSendResult = { ok: boolean; error?: string }

async function postToGraph(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
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

/** Texto libre. Solo llega a huéspedes dentro de la ventana de 24 h de Meta. */
export async function sendWhatsAppBusinessText(
  phone: string,
  body: string,
): Promise<WhatsAppSendResult> {
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

/**
 * Plantilla de marketing aprobada para campañas/promos. `bodyParams` van en
 * orden a las variables {{1}}, {{2}}, … del cuerpo de la plantilla (p. ej.
 * {{1}} = nombre del huésped, {{2}} = nombre del hotel). Llega a TODOS los
 * huéspedes (no depende de la ventana de 24 h).
 */
export async function sendWhatsAppBusinessCampaignTemplate(
  phone: string,
  bodyParams: string[],
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppBusinessConfigured()) {
    return { ok: false, error: "WhatsApp Business no está configurado" }
  }
  const to = normalizePhoneForWhatsAppApi(phone)
  if (!to) return { ok: false, error: "Teléfono no válido" }

  const templateName = getCampaignTemplateName()
  if (!templateName) return { ok: false, error: "Sin plantilla de campaña configurada" }

  const parameters = bodyParams.map((text) => ({
    type: "text" as const,
    text: String(text || "").slice(0, 512),
  }))

  return postToGraph({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: getTemplateLang() },
      components: parameters.length
        ? [{ type: "body", parameters }]
        : [],
    },
  })
}
