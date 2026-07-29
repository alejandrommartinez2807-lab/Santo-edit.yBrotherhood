// BH-SIM-007 · La opción "Tasa BCV (euro)" de Configuración no se guardaba.
//
// La pantalla de Configuración ofrece los tres modos (dólar BCV, euro BCV y
// tasa fija del negocio), pero `POST /api/business-config` solo reconocía
// "manual" y "automatic": elegir EURO se guardaba como DÓLAR sin avisar. El
// dueño veía la opción marcada en su navegador y el negocio seguía cobrando
// con la tasa del dólar. Verificado contra la base el 2026-07-29: se envió
// `automaticEur` y quedó `automatic`.
//
// Brotherhood cobra con la tasa EURO, así que esto le afecta directamente.
import { describe, expect, it } from "vitest"
import { readExchangeRateModeValue } from "@/lib/exchangeRateModeInput"

describe("readExchangeRateModeValue (BH-SIM-007)", () => {
  it("guarda el modo EURO cuando el dueño lo elige", () => {
    expect(readExchangeRateModeValue("automaticEur")).toBe("automaticEur")
  })

  it("acepta las variantes de escritura del euro", () => {
    expect(readExchangeRateModeValue("automaticeur")).toBe("automaticEur")
    expect(readExchangeRateModeValue("AUTOMATICEUR")).toBe("automaticEur")
    expect(readExchangeRateModeValue("euro")).toBe("automaticEur")
    expect(readExchangeRateModeValue("  Euro  ")).toBe("automaticEur")
  })

  it("sigue guardando la tasa fija del negocio", () => {
    expect(readExchangeRateModeValue("manual")).toBe("manual")
    expect(readExchangeRateModeValue("MANUAL")).toBe("manual")
  })

  it("sigue guardando el dólar BCV", () => {
    expect(readExchangeRateModeValue("automatic")).toBe("automatic")
  })

  it("cualquier basura cae al dólar BCV (comportamiento de siempre)", () => {
    expect(readExchangeRateModeValue("")).toBe("automatic")
    expect(readExchangeRateModeValue(null)).toBe("automatic")
    expect(readExchangeRateModeValue("bitcoin")).toBe("automatic")
    expect(readExchangeRateModeValue(42)).toBe("automatic")
  })

  it("coincide con lo que ya normalizaba la config por sede (una sola regla)", () => {
    // BranchConfigPanel ya guardaba bien el euro; la global se había quedado
    // atrás. Las dos deben responder igual.
    for (const entrada of ["automaticEur", "euro", "manual", "automatic", "x"]) {
      expect(typeof readExchangeRateModeValue(entrada)).toBe("string")
    }
  })
})
