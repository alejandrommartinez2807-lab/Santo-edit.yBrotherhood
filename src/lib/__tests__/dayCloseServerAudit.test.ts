import { describe, expect, it } from "vitest"

// H-3 (auditoría 2026-07-30, primer paso 2026-08-04): el total "real cobrado"
// del cierre lo manda el NAVEGADOR — un cierre que cuadra consigo mismo no
// prueba nada. El servidor ahora guarda su propio esperado (la suma de los
// pedidos reales, la misma de collectionByOrigin) y la brecha contra lo
// reportado. Solo informa; estas pruebas fijan la aritmética y el signo.

import { buildDayCloseServerAudit } from "@/lib/ordersDayClose"

describe("buildDayCloseServerAudit", () => {
  it("esperado = cuentas + directos, redondeado a centavos", () => {
    const audit = buildDayCloseServerAudit({
      accountCollectedUSD: 120.5,
      directCollectedUSD: 79.49,
      reportedCollectedUSD: 199.99,
    })

    expect(audit).toEqual({
      expectedCollectedUSD: 199.99,
      reportedCollectedUSD: 199.99,
      gapUSD: 0,
    })
  })

  it("signo de la brecha: positivo = se reportó de MÁS, negativo = de MENOS", () => {
    const deMas = buildDayCloseServerAudit({
      accountCollectedUSD: 100,
      directCollectedUSD: 0,
      reportedCollectedUSD: 130,
    })
    const deMenos = buildDayCloseServerAudit({
      accountCollectedUSD: 100,
      directCollectedUSD: 50,
      reportedCollectedUSD: 120,
    })

    expect(deMas.gapUSD).toBe(30)
    expect(deMenos.gapUSD).toBe(-30)
  })

  it("los flotantes no ensucian los centavos (0.1 + 0.2)", () => {
    const audit = buildDayCloseServerAudit({
      accountCollectedUSD: 0.1,
      directCollectedUSD: 0.2,
      reportedCollectedUSD: 0.3,
    })

    expect(audit.expectedCollectedUSD).toBe(0.3)
    expect(audit.gapUSD).toBe(0)
  })

  it("día sin cobros: todo en cero, sin NaN", () => {
    const audit = buildDayCloseServerAudit({
      accountCollectedUSD: 0,
      directCollectedUSD: 0,
      reportedCollectedUSD: 0,
    })

    expect(audit).toEqual({
      expectedCollectedUSD: 0,
      reportedCollectedUSD: 0,
      gapUSD: 0,
    })
  })
})
