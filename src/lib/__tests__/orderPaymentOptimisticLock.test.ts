// BH-SIM-003 (semana real, Día 5): el candado optimista de `updateOrderPayment`
// existía y lo usaban /api/open-accounts y la revisión de comprobantes, pero
// el cobro DIRECTO de caja (PATCH /api/orders/:id/payment) nunca lo pasaba.
// Reproducción real: María cobró $10 en efectivo (1ª pata); Kelvin, con la
// tarjeta desactualizada, cobró $19 por Zelle enviando expectedPrevious=$0 —
// el servidor ignoró el candado, respondió 200 y los $10 en efectivo
// desaparecieron del registro (evidencia en SIM-SEMANA/bugs.md).
//
// Este test fija el contrato de la lectura del payload: si el cliente manda
// expectedPrevious, el servidor DEBE propagarlo al store.
import { describe, expect, it } from "vitest"
import { readExpectedPrevious } from "@/lib/orderPaymentInput"

describe("readExpectedPrevious (BH-SIM-003)", () => {
  it("lee el candado que manda caja", () => {
    expect(readExpectedPrevious({ expectedPrevious: { amountReceivedUSD: 10, amountReceivedVES: 400 } })).toEqual({
      amountReceivedUSD: 10,
      amountReceivedVES: 400,
    })
  })

  it("acepta un candado en cero (primer cobro de un pedido virgen)", () => {
    expect(readExpectedPrevious({ expectedPrevious: { amountReceivedUSD: 0, amountReceivedVES: 0 } })).toEqual({
      amountReceivedUSD: 0,
      amountReceivedVES: 0,
    })
  })

  it("lo lee también dentro de body.payment (misma forma que el resto del payload)", () => {
    expect(readExpectedPrevious({ payment: { expectedPrevious: { amountReceivedUSD: 5, amountReceivedVES: 0 } } })).toEqual({
      amountReceivedUSD: 5,
      amountReceivedVES: 0,
    })
  })

  it("sin candado devuelve undefined (compatibilidad: el cobro sigue funcionando)", () => {
    expect(readExpectedPrevious({})).toBeUndefined()
    expect(readExpectedPrevious({ expectedPrevious: null })).toBeUndefined()
    expect(readExpectedPrevious({ expectedPrevious: "cualquier cosa" })).toBeUndefined()
  })

  it("normaliza montos sucios a números seguros", () => {
    expect(readExpectedPrevious({ expectedPrevious: { amountReceivedUSD: "10,00", amountReceivedVES: undefined } })).toEqual({
      amountReceivedUSD: 0,
      amountReceivedVES: 0,
    })
    expect(readExpectedPrevious({ expectedPrevious: { amountReceivedUSD: 10.005, amountReceivedVES: -3 } })).toEqual({
      amountReceivedUSD: 10.01,
      amountReceivedVES: 0,
    })
  })
})
