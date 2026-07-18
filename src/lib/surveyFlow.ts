// Encuesta COMPLETA dentro de WhatsApp con WhatsApp Flows: un formulario
// nativo (varias preguntas 1–5 + comentario), igual que la página /encuesta
// pero embebido en el chat, sin link.
//
// El negocio inicia con una plantilla que lleva un botón tipo "flow"
// (business-initiated ⇒ plantilla). El cliente toca el botón, se abre el
// formulario dentro de WhatsApp, lo llena y toca Enviar. La respuesta vuelve
// por el webhook como un mensaje interactivo "nfm_reply" con un response_json
// que trae las calificaciones + el comentario + el pedido (lo pasamos como
// dato del Flow y lo hacemos eco en la respuesta).

import { isValidSurveyOrderId } from "@/lib/surveyButtons"

const FLOW_TOKEN_PREFIX = "svyf1"
const FLOW_TOKEN_SEP = "|"

// Nombres de campo del Flow. Las preguntas de estrellas van numeradas y se
// mapean por POSICIÓN a los aspectos que tenga configurados el dueño.
export const FLOW_ORDER_FIELD = "order_id"
export const FLOW_COMMENT_FIELD = "comment"
export function flowRatingField(index: number): string {
  return `rating_${index + 1}`
}

// Token que viaja en el Flow para saber a qué pedido pertenece la respuesta.
export function encodeSurveyFlowToken(orderId: string): string {
  return [FLOW_TOKEN_PREFIX, String(orderId || "").trim().toLowerCase()].join(FLOW_TOKEN_SEP)
}

export function parseSurveyFlowToken(token: unknown): string | null {
  const parts = String(token || "").split(FLOW_TOKEN_SEP)
  if (parts.length !== 2 || parts[0] !== FLOW_TOKEN_PREFIX) return null
  const orderId = parts[1].trim().toLowerCase()
  return isValidSurveyOrderId(orderId) ? orderId : null
}

export type FlowSurveyResult = {
  orderId: string
  ratings: Record<string, number>
  comment: string
}

// Convierte el response_json del Flow en algo que guardar. `aspects` son los
// aspectos configurados por el dueño; rating_1 → aspects[0], etc.
export function parseFlowSurveyResponse(
  responseJson: unknown,
  aspects: string[],
): FlowSurveyResult | null {
  let data: Record<string, unknown> = {}

  if (typeof responseJson === "string") {
    try {
      const parsed = JSON.parse(responseJson)
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>
    } catch {
      return null
    }
  } else if (responseJson && typeof responseJson === "object") {
    data = responseJson as Record<string, unknown>
  }

  // El pedido: preferimos el campo que hicimos eco; si no, el flow_token.
  let orderId = String(data[FLOW_ORDER_FIELD] || "").trim().toLowerCase()
  if (!isValidSurveyOrderId(orderId)) {
    orderId = parseSurveyFlowToken(data.flow_token) || ""
  }
  if (!isValidSurveyOrderId(orderId)) return null

  const ratings: Record<string, number> = {}
  aspects.forEach((aspect, index) => {
    const score = Math.round(Number(data[flowRatingField(index)]))
    if (score >= 1 && score <= 5) ratings[aspect] = score
  })

  const comment = String(data[FLOW_COMMENT_FIELD] || "").trim().slice(0, 1000)

  return { orderId, ratings, comment }
}

export type WhatsAppFlowReply = { from: string; responseJson: string }

// Extrae del webhook los envíos de formulario Flow (mensajes interactivos
// tipo nfm_reply). Tolera formas parciales sin romper.
export function extractWhatsAppFlowReplies(body: unknown): WhatsAppFlowReply[] {
  const replies: WhatsAppFlowReply[] = []
  const root = (body ?? {}) as Record<string, unknown>
  const entries = Array.isArray(root.entry) ? root.entry : []

  for (const entry of entries) {
    const changes = Array.isArray((entry as Record<string, unknown>)?.changes)
      ? ((entry as Record<string, unknown>).changes as unknown[])
      : []

    for (const change of changes) {
      const value = (change as Record<string, unknown>)?.value as
        | Record<string, unknown>
        | undefined
      const messages = Array.isArray(value?.messages) ? (value!.messages as unknown[]) : []

      for (const raw of messages) {
        const message = raw as Record<string, unknown>
        if (String(message.type || "") !== "interactive") continue

        const interactive = message.interactive as Record<string, unknown> | undefined
        if (String(interactive?.type || "") !== "nfm_reply") continue

        const nfmReply = interactive?.nfm_reply as Record<string, unknown> | undefined
        const responseJson = String(nfmReply?.response_json || "").trim()
        const from = String(message.from || "").trim()

        if (from && responseJson) replies.push({ from, responseJson })
      }
    }
  }

  return replies
}
