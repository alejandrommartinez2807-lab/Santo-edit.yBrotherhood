// Encuesta post-venta CONTESTADA DENTRO DE WHATSAPP (sin link, sin escribir).
//
// El negocio inicia la conversación con una PLANTILLA de botones aprobada en
// Meta (business-initiated ⇒ obligatoriamente plantilla). El cliente sólo
// TOCA un botón; su elección vuelve por el webhook de entrada como el
// "payload" que fijamos al enviar cada botón. Aquí codificamos ese payload
// (pedido + puntaje) y lo volvemos a leer cuando llega la respuesta.
//
// WhatsApp permite máximo 3 botones de respuesta rápida por mensaje iniciado
// por el negocio, así que usamos una escala de 3 niveles (Excelente/Bien/Malo)
// mapeada a estrellas 1–5 para que caiga en los mismos promedios del dueño.

export type SurveyButtonChoice = {
  key: string
  // Texto del botón: es informativo aquí, el texto REAL lo fija la plantilla
  // aprobada en Meta. Debe coincidir con esa plantilla.
  label: string
  // Estrellas equivalentes (1–5) que se guardan en survey_responses.
  score: number
}

// Orden = orden de los botones en la plantilla (índice 0, 1, 2).
export const SURVEY_BUTTON_CHOICES: SurveyButtonChoice[] = [
  { key: "great", label: "Excelente", score: 5 },
  { key: "ok", label: "Bien", score: 3 },
  { key: "bad", label: "Malo", score: 1 },
]

// Aspecto bajo el que se guarda la calificación de un toque (aparece en los
// reportes del dueño junto a los aspectos de la encuesta web).
export const WHATSAPP_SURVEY_ASPECT = "Experiencia general"

const PAYLOAD_PREFIX = "svy1"
const PAYLOAD_SEP = "|"

// Puntaje válido = 1..5 (nuestros botones usan 5/3/1, pero aceptamos el rango
// completo por si la plantilla se amplía en el futuro).
function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function isValidOrderId(value: string): boolean {
  return /^ord-[a-z0-9-]{1,80}$/.test(value)
}

export function encodeSurveyButtonPayload(orderId: string, score: number): string {
  return [PAYLOAD_PREFIX, String(orderId || "").trim().toLowerCase(), String(score)].join(
    PAYLOAD_SEP,
  )
}

export type ParsedSurveyPayload = { orderId: string; score: number }

export function parseSurveyButtonPayload(payload: unknown): ParsedSurveyPayload | null {
  const parts = String(payload || "").split(PAYLOAD_SEP)
  if (parts.length !== 3 || parts[0] !== PAYLOAD_PREFIX) return null

  const orderId = parts[1].trim().toLowerCase()
  const score = Number(parts[2])

  if (!isValidOrderId(orderId) || !isValidScore(score)) return null

  return { orderId, score }
}

// Payloads en orden de botón para el envío de la plantilla (uno por botón).
export function buildSurveyButtonPayloads(orderId: string): string[] {
  return SURVEY_BUTTON_CHOICES.map((choice) =>
    encodeSurveyButtonPayload(orderId, choice.score),
  )
}

export type WhatsAppSurveyReply = { from: string; payload: string }

// Extrae de un cuerpo de webhook de Meta las respuestas de botón que nos
// interesan. Tolera formas parciales/desconocidas sin romper (todo opcional).
export function extractWhatsAppSurveyReplies(body: unknown): WhatsAppSurveyReply[] {
  const replies: WhatsAppSurveyReply[] = []
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
        const from = String(message.from || "").trim()
        const type = String(message.type || "")

        // Plantilla con botones de respuesta rápida ⇒ type "button".
        if (type === "button") {
          const button = message.button as Record<string, unknown> | undefined
          const payload = String(button?.payload || "").trim()
          if (from && payload) replies.push({ from, payload })
          continue
        }

        // Mensaje interactivo (dentro de la ventana de 24 h) ⇒ button_reply.id.
        if (type === "interactive") {
          const interactive = message.interactive as Record<string, unknown> | undefined
          const buttonReply = interactive?.button_reply as
            | Record<string, unknown>
            | undefined
          const payload = String(buttonReply?.id || "").trim()
          if (from && payload) replies.push({ from, payload })
        }
      }
    }
  }

  return replies
}
