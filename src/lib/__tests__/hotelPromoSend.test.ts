import { describe, it, expect } from "vitest"
import {
  buildCampaignSendJobs,
  hasUsablePhone,
  manualCampaignPeriodKey,
  shortHash,
  CAMPAIGN_MAX_RECIPIENTS,
} from "@/lib/hotelPromoSend"

describe("hotelPromoSend · buildCampaignSendJobs", () => {
  const base = {
    templateText: "Hola {nombre}, en {hotel} te esperamos.",
    hotelName: "Lidotel",
  }

  it("renderiza el mensaje y los parámetros de plantilla por huésped", () => {
    const { jobs } = buildCampaignSendJobs({
      ...base,
      rows: [{ name: "María González", phone: "0412-1112233" }],
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0].name).toBe("María")
    expect(jobs[0].text).toBe("Hola María, en Lidotel te esperamos.")
    expect(jobs[0].templateParams).toEqual(["María", "Lidotel"])
    expect(jobs[0].phoneKey).toBe("04121112233".replace(/\D/g, ""))
  })

  it("deduplica por teléfono (mismos dígitos, distinto formato)", () => {
    const { jobs } = buildCampaignSendJobs({
      ...base,
      rows: [
        { name: "Ana", phone: "0412 111 2233" },
        { name: "Ana (repetida)", phone: "04121112233" },
      ],
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0].name).toBe("Ana")
  })

  it("salta filas sin teléfono usable y las cuenta", () => {
    const { jobs, skippedNoPhone } = buildCampaignSendJobs({
      ...base,
      rows: [
        { name: "Sin telefono", phone: "" },
        { name: "Corto", phone: "123" },
        { name: "Buena", phone: "04141234567" },
      ],
    })
    expect(jobs).toHaveLength(1)
    expect(skippedNoPhone).toBe(2)
  })

  it("respeta el tope de destinatarios y marca truncated", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      name: `H${i}`,
      phone: `0412000000${i}`,
    }))
    const { jobs, truncated } = buildCampaignSendJobs({ ...base, rows, maxRecipients: 3 })
    expect(jobs).toHaveLength(3)
    expect(truncated).toBe(true)
  })

  it("usa 'huésped' como fallback cuando no hay nombre", () => {
    const { jobs } = buildCampaignSendJobs({
      ...base,
      rows: [{ name: "", phone: "04121112233" }],
    })
    expect(jobs[0].templateParams[0]).toBe("huésped")
  })

  it("tope por defecto expuesto", () => {
    expect(CAMPAIGN_MAX_RECIPIENTS).toBeGreaterThan(0)
  })
})

describe("hotelPromoSend · helpers", () => {
  it("hasUsablePhone distingue válidos de inválidos", () => {
    expect(hasUsablePhone("04121112233")).toBe(true)
    expect(hasUsablePhone("123")).toBe(false)
    expect(hasUsablePhone("")).toBe(false)
  })

  it("shortHash es estable e cambia con el texto", () => {
    expect(shortHash("hola")).toBe(shortHash("hola"))
    expect(shortHash("hola")).not.toBe(shortHash("mundo"))
  })

  it("manualCampaignPeriodKey: mismo día + mismo texto = misma clave; texto distinto = distinta", () => {
    const a = manualCampaignPeriodKey("2026-07-18T10:00:00Z", "Promo A")
    const b = manualCampaignPeriodKey("2026-07-18", "Promo A")
    const c = manualCampaignPeriodKey("2026-07-18", "Promo B")
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a.startsWith("m:2026-07-18:")).toBe(true)
  })
})
