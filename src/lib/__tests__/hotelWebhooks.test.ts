import { describe, expect, it } from "vitest"
import { createHmac } from "crypto"
import {
  buildWebhookPayload,
  isValidWebhookUrl,
  parseWebhookEvents,
  webhookMatchesEvent,
} from "@/lib/hotelWebhooks"
import { signWebhookPayload } from "@/lib/hotelWebhookDispatch"

describe("parseWebhookEvents", () => {
  it("limpia el CSV y descarta eventos desconocidos", () => {
    expect(parseWebhookEvents(" reserva_creada, checkin ,invento,,")).toEqual([
      "reserva_creada",
      "checkin",
    ])
    expect(parseWebhookEvents("")).toEqual([])
    expect(parseWebhookEvents(undefined)).toEqual([])
  })
})

describe("webhookMatchesEvent", () => {
  it("lista vacía escucha todos los eventos reales pero no la prueba", () => {
    expect(webhookMatchesEvent({ events: "" }, "reserva_creada")).toBe(true)
    expect(webhookMatchesEvent({ events: "" }, "checkout")).toBe(true)
    expect(webhookMatchesEvent({ events: "" }, "prueba")).toBe(false)
  })

  it("lista específica filtra y el inactivo nunca dispara", () => {
    expect(webhookMatchesEvent({ events: "checkin,checkout" }, "checkin")).toBe(true)
    expect(webhookMatchesEvent({ events: "checkin,checkout" }, "reserva_creada")).toBe(false)
    expect(webhookMatchesEvent({ events: "", active: false }, "checkin")).toBe(false)
  })
})

describe("isValidWebhookUrl", () => {
  it("solo acepta http(s) absolutas", () => {
    expect(isValidWebhookUrl("https://webhook.site/abc")).toBe(true)
    expect(isValidWebhookUrl("http://localhost:9999/hook")).toBe(true)
    expect(isValidWebhookUrl("ftp://x.com")).toBe(false)
    expect(isValidWebhookUrl("no-es-url")).toBe(false)
    expect(isValidWebhookUrl("")).toBe(false)
  })
})

describe("payload + firma", () => {
  it("arma el payload con evento, fecha y datos", () => {
    const p = buildWebhookPayload("checkin", { code: "ABC12" }, "2026-07-16T12:00:00.000Z")
    expect(p).toEqual({
      event: "checkin",
      firedAt: "2026-07-16T12:00:00.000Z",
      data: { code: "ABC12" },
    })
  })

  it("firma HMAC-SHA256 hex verificable por el receptor", () => {
    const body = JSON.stringify({ event: "prueba", data: {} })
    const signature = signWebhookPayload("secreto-123", body)
    const expected = createHmac("sha256", "secreto-123").update(body, "utf8").digest("hex")
    expect(signature).toBe(expected)
    expect(signature).toMatch(/^[0-9a-f]{64}$/)
    // Otro secreto u otro cuerpo cambian la firma.
    expect(signWebhookPayload("otro", body)).not.toBe(signature)
    expect(signWebhookPayload("secreto-123", body + " ")).not.toBe(signature)
  })
})
