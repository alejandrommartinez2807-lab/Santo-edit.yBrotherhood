import { describe, it, expect } from "vitest"
import {
  SURVEY_BUTTON_CHOICES,
  buildSurveyButtonPayloads,
  encodeSurveyButtonPayload,
  extractWhatsAppSurveyReplies,
  parseSurveyButtonPayload,
} from "@/lib/surveyButtons"

describe("payload de botón de encuesta", () => {
  it("codifica y vuelve a leer pedido + puntaje", () => {
    const payload = encodeSurveyButtonPayload("ORD-abc123", 5)
    expect(payload).toBe("svy1|ord-abc123|5")
    expect(parseSurveyButtonPayload(payload)).toEqual({
      orderId: "ord-abc123",
      score: 5,
    })
  })

  it("un payload por cada botón, en orden", () => {
    const payloads = buildSurveyButtonPayloads("ord-xyz")
    expect(payloads).toHaveLength(SURVEY_BUTTON_CHOICES.length)
    expect(payloads).toEqual([
      "svy1|ord-xyz|5",
      "svy1|ord-xyz|3",
      "svy1|ord-xyz|1",
    ])
  })

  it("rechaza payloads inválidos", () => {
    expect(parseSurveyButtonPayload("")).toBeNull()
    expect(parseSurveyButtonPayload("otracosa|ord-x|5")).toBeNull()
    expect(parseSurveyButtonPayload("svy1|ord-x")).toBeNull()
    expect(parseSurveyButtonPayload("svy1|sin-prefijo-ord|5")).toBeNull()
    expect(parseSurveyButtonPayload("svy1|ord-x|9")).toBeNull()
    expect(parseSurveyButtonPayload("svy1|ord-x|0")).toBeNull()
    expect(parseSurveyButtonPayload("svy1|ord-x|abc")).toBeNull()
  })
})

describe("extractWhatsAppSurveyReplies", () => {
  it("extrae el toque de una plantilla de botones (type button)", () => {
    const body = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    from: "584121112233",
                    type: "button",
                    button: { text: "Excelente", payload: "svy1|ord-abc|5" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(extractWhatsAppSurveyReplies(body)).toEqual([
      { from: "584121112233", payload: "svy1|ord-abc|5" },
    ])
  })

  it("extrae un botón interactivo (button_reply.id)", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "584120000000",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "svy1|ord-def|3", title: "Bien" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(extractWhatsAppSurveyReplies(body)).toEqual([
      { from: "584120000000", payload: "svy1|ord-def|3" },
    ])
  })

  it("ignora eventos sin mensajes (p. ej. acuses de entrega) sin romper", () => {
    expect(extractWhatsAppSurveyReplies({})).toEqual([])
    expect(extractWhatsAppSurveyReplies({ entry: [{ changes: [{ value: {} }] }] })).toEqual(
      [],
    )
    expect(
      extractWhatsAppSurveyReplies({
        entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }],
      }),
    ).toEqual([])
  })
})
