import { describe, it, expect } from "vitest"
import {
  encodeSurveyFlowToken,
  extractWhatsAppFlowReplies,
  parseFlowSurveyResponse,
  parseSurveyFlowToken,
} from "@/lib/surveyFlow"

const ASPECTS = ["Sabor de la comida", "Tiempo de entrega", "Atención"]

describe("flow token", () => {
  it("codifica y lee el pedido", () => {
    const token = encodeSurveyFlowToken("ORD-abc123")
    expect(token).toBe("svyf1|ord-abc123")
    expect(parseSurveyFlowToken(token)).toBe("ord-abc123")
  })

  it("rechaza tokens inválidos", () => {
    expect(parseSurveyFlowToken("")).toBeNull()
    expect(parseSurveyFlowToken("svyf1|nada")).toBeNull()
    expect(parseSurveyFlowToken("otro|ord-x")).toBeNull()
  })
})

describe("parseFlowSurveyResponse", () => {
  it("mapea rating_N a los aspectos + comentario + pedido", () => {
    const responseJson = JSON.stringify({
      rating_1: "5",
      rating_2: "4",
      rating_3: "3",
      comment: "Todo excelente",
      order_id: "ord-abc",
    })

    expect(parseFlowSurveyResponse(responseJson, ASPECTS)).toEqual({
      orderId: "ord-abc",
      ratings: {
        "Sabor de la comida": 5,
        "Tiempo de entrega": 4,
        Atención: 3,
      },
      comment: "Todo excelente",
    })
  })

  it("usa el flow_token si no vino order_id", () => {
    const responseJson = JSON.stringify({
      rating_1: "4",
      flow_token: "svyf1|ord-xyz",
    })

    const result = parseFlowSurveyResponse(responseJson, ASPECTS)
    expect(result?.orderId).toBe("ord-xyz")
    expect(result?.ratings).toEqual({ "Sabor de la comida": 4 })
  })

  it("ignora puntajes fuera de rango y acepta objeto ya parseado", () => {
    const result = parseFlowSurveyResponse(
      { rating_1: "9", rating_2: "2", comment: "", order_id: "ord-a" },
      ASPECTS,
    )
    expect(result).toEqual({
      orderId: "ord-a",
      ratings: { "Tiempo de entrega": 2 },
      comment: "",
    })
  })

  it("devuelve null sin pedido válido o con JSON roto", () => {
    expect(parseFlowSurveyResponse(JSON.stringify({ rating_1: "5" }), ASPECTS)).toBeNull()
    expect(parseFlowSurveyResponse("{no es json", ASPECTS)).toBeNull()
  })
})

describe("extractWhatsAppFlowReplies", () => {
  it("extrae el response_json de un nfm_reply", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "584121112233",
                    type: "interactive",
                    interactive: {
                      type: "nfm_reply",
                      nfm_reply: {
                        name: "flow",
                        response_json: '{"rating_1":"5","order_id":"ord-abc"}',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(extractWhatsAppFlowReplies(body)).toEqual([
      { from: "584121112233", responseJson: '{"rating_1":"5","order_id":"ord-abc"}' },
    ])
  })

  it("ignora mensajes que no son formularios", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: "1", type: "text", text: { body: "hola" } },
                  {
                    from: "2",
                    type: "interactive",
                    interactive: { type: "button_reply", button_reply: { id: "x" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(extractWhatsAppFlowReplies(body)).toEqual([])
  })
})
