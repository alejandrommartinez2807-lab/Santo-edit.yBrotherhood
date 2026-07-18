import { createHmac, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { captureError } from "@/lib/monitoring"
import {
  getConfiguredSurveyAspects,
  savePublicSurveyResponse,
  saveWhatsAppButtonSurveyResponse,
} from "@/lib/surveys"
import {
  extractWhatsAppSurveyReplies,
  parseSurveyButtonPayload,
} from "@/lib/surveyButtons"
import {
  extractWhatsAppFlowReplies,
  parseFlowSurveyResponse,
} from "@/lib/surveyFlow"
import { sendWhatsAppBusinessText } from "@/lib/whatsappBusiness"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Webhook de WhatsApp Business Cloud API (Meta): recibe la ENCUESTA que el
// cliente contesta con un toque dentro del chat (botón de la plantilla).
//
// Configurar en Meta → tu app → WhatsApp → Configuration:
//   Callback URL   = https://<tu-dominio>/api/whatsapp/webhook
//   Verify token   = el mismo valor de WHATSAPP_WEBHOOK_VERIFY_TOKEN
//   Suscribir el campo "messages".
// Recomendado: WHATSAPP_APP_SECRET (App Secret) para validar la firma.

function getVerifyToken(): string {
  return String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()
}

// GET: handshake de verificación de Meta (echo del hub.challenge).
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge") || ""
  const expected = getVerifyToken()

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

// Valida la firma X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el
// App Secret). Si no hay App Secret configurado, no se puede validar.
function isValidSignature(rawBody: string, header: string | null): boolean {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || "").trim()
  if (!appSecret) return true // sin secreto no hay validación posible

  const signature = String(header || "")
  if (!signature.startsWith("sha256=")) return false

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex")
  const received = signature.slice("sha256=".length)

  // timingSafeEqual exige longitudes iguales; si difieren, no coincide.
  const expectedBuf = Buffer.from(expected, "hex")
  const receivedBuf = Buffer.from(received, "hex")
  if (expectedBuf.length !== receivedBuf.length || expectedBuf.length === 0) {
    return false
  }

  return timingSafeEqual(expectedBuf, receivedBuf)
}

// Agradecimiento best-effort (dentro de la ventana de 24 h, texto libre
// permitido porque el cliente acaba de escribirnos con su respuesta).
async function thankCustomer(to: string): Promise<void> {
  await sendWhatsAppBusinessText(
    to,
    "¡Gracias por tu opinión! Nos ayuda muchísimo a mejorar.",
  ).catch(() => undefined)
}

// POST: llega un evento de Meta. Extraemos la respuesta (toque o formulario),
// guardamos la calificación y (best-effort) agradecemos. SIEMPRE respondemos
// 200 rápido para que Meta no reintente en bucle.
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  let body: unknown = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ received: true })
  }

  try {
    // 1) Encuesta de UN TOQUE (plantilla de botones).
    for (const reply of extractWhatsAppSurveyReplies(body)) {
      const parsed = parseSurveyButtonPayload(reply.payload)
      if (!parsed) continue

      const result = await saveWhatsAppButtonSurveyResponse({
        orderId: parsed.orderId,
        score: parsed.score,
      })

      if (result.ok && !result.alreadyAnswered && reply.from) {
        await thankCustomer(reply.from)
      }
    }

    // 2) Encuesta COMPLETA (formulario Flow): varias preguntas 1–5 +
    //    comentario. Se guarda igual que la encuesta web (mismos aspectos).
    const flowReplies = extractWhatsAppFlowReplies(body)
    if (flowReplies.length) {
      const aspects = await getConfiguredSurveyAspects()

      for (const reply of flowReplies) {
        const parsed = parseFlowSurveyResponse(reply.responseJson, aspects)
        if (!parsed) continue

        const result = await savePublicSurveyResponse({
          orderId: parsed.orderId,
          ratings: parsed.ratings,
          comment: parsed.comment,
        })

        // ok o "ya respondió" (409) ⇒ agradecemos igual; otros errores no.
        if (reply.from && (result.ok || result.status === 409)) {
          await thankCustomer(reply.from)
        }
      }
    }
  } catch (error) {
    captureError(error, { route: "/api/whatsapp/webhook", action: "POST" })
  }

  return NextResponse.json({ received: true })
}
