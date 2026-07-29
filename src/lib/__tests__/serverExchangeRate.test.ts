// BH-SIM-002 (2ª parte) · La tasa del pedido público la decide el SERVIDOR en
// CUALQUIER modo, no solo en manual.
//
// El primer fix solo pisaba la tasa del cliente cuando el negocio la tenía en
// MANUAL. Brotherhood usa tasa automática (dólar BCV, y el dueño puede pasar a
// EURO desde Configuración), así que el clamp no se activaba: verificado en
// producción el 2026-07-29, un pedido con `exchangeRate: 4` se guardó con
// tasa 4. Como el cobro convierte `Bs / tasa_del_pedido`, reportar Bs 50 por
// una burger de $12,50 la daba por PAGADA.
import { describe, expect, it } from "vitest"
import { resolveServerExchangeRate } from "@/lib/serverExchangeRate"

const usd = { rate: 744.22, currency: "USD" as const }
const eur = { rate: 810.5, currency: "EUR" as const }

describe("resolveServerExchangeRate (BH-SIM-002 · todos los modos)", () => {
  it("modo MANUAL: manda la tasa fijada por el negocio", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "manual",
      manualRate: 40,
      getUsd: async () => usd,
      getEur: async () => eur,
    })
    expect(rate).toBe(40)
  })

  it("modo AUTOMÁTICO (dólar): manda la tasa del BCV, no la del cliente", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "automatic",
      manualRate: 0,
      getUsd: async () => usd,
      getEur: async () => eur,
    })
    expect(rate).toBe(744.22)
  })

  it("modo EURO: manda la tasa del euro (la que usa Brotherhood)", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "automaticEur",
      manualRate: 0,
      getUsd: async () => usd,
      getEur: async () => eur,
    })
    expect(rate).toBe(810.5)
  })

  it("modo manual con tasa inválida cae al automático (no deja al negocio sin tasa)", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "manual",
      manualRate: 0,
      getUsd: async () => usd,
      getEur: async () => eur,
    })
    expect(rate).toBe(744.22)
  })

  it("si la fuente falla, devuelve 0 y NO tumba el pedido (sobrevive la del cliente)", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "automatic",
      manualRate: 0,
      getUsd: async () => {
        throw new Error("BCV caído")
      },
      getEur: async () => eur,
    })
    expect(rate).toBe(0)
  })

  it("una tasa absurda de la fuente se descarta (no se impone un 0 o un negativo)", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "automatic",
      manualRate: 0,
      getUsd: async () => ({ rate: 0, currency: "USD" as const }),
      getEur: async () => eur,
    })
    expect(rate).toBe(0)
  })

  it("el modo euro también sobrevive a que su fuente falle", async () => {
    const rate = await resolveServerExchangeRate({
      mode: "automaticEur",
      manualRate: 0,
      getUsd: async () => usd,
      getEur: async () => {
        throw new Error("BCV euro caído")
      },
    })
    expect(rate).toBe(0)
  })
})
