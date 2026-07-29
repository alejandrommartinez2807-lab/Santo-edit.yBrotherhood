import { describe, it, expect } from "vitest"
import { parsePublicMoneyInput, toVesInputAmount } from "@/lib/publicMoneyInput"

describe("parsePublicMoneyInput", () => {
  it("lee el formato que precarga la app (coma decimal, sin miles)", () => {
    expect(parsePublicMoneyInput("9648,99")).toBe(9648.99)
    expect(parsePublicMoneyInput("1820,00")).toBe(1820)
    expect(parsePublicMoneyInput("4824,50")).toBe(4824.5)
  })

  // El caso que motivó el arreglo: el monto a pagar se muestra "Bs 9.648,99" y
  // el cliente reescribe el campo copiando eso. Antes daba 0 y el reporte salía
  // en cero sin avisarle a nadie.
  it("entiende el separador de miles con coma decimal (es-VE)", () => {
    expect(parsePublicMoneyInput("9.648,99")).toBe(9648.99)
    expect(parsePublicMoneyInput("1.820,00")).toBe(1820)
    expect(parsePublicMoneyInput("2.179,50")).toBe(2179.5)
    expect(parsePublicMoneyInput("1.234.567,89")).toBe(1234567.89)
  })

  it("entiende el formato en-US (coma de miles, punto decimal)", () => {
    expect(parsePublicMoneyInput("3,632.50")).toBe(3632.5)
    expect(parsePublicMoneyInput("1,234,567.89")).toBe(1234567.89)
  })

  it("respeta el punto como decimal en montos en divisas", () => {
    expect(parsePublicMoneyInput("13.00")).toBe(13)
    expect(parsePublicMoneyInput("6.50")).toBe(6.5)
    expect(parsePublicMoneyInput("25")).toBe(25)
  })

  it("devuelve 0 con basura, vacío o negativos", () => {
    expect(parsePublicMoneyInput("")).toBe(0)
    expect(parsePublicMoneyInput("   ")).toBe(0)
    expect(parsePublicMoneyInput("abc")).toBe(0)
    expect(parsePublicMoneyInput("-50")).toBe(0)
  })

  // ── Formatos de la lista del §15 del guion (barrido 2026-07-29) ──────────

  it("ceros y céntimos mínimos", () => {
    expect(parsePublicMoneyInput("0,00")).toBe(0)
    expect(parsePublicMoneyInput("0.01")).toBe(0.01)
    expect(parsePublicMoneyInput("0,01")).toBe(0.01)
  })

  it("enteros cortos y decimales de un dígito", () => {
    expect(parsePublicMoneyInput("1")).toBe(1)
    expect(parsePublicMoneyInput("1,5")).toBe(1.5)
    expect(parsePublicMoneyInput("1,50")).toBe(1.5)
  })

  // Ambigüedad documentada en el parser: "3.632" sin más contexto es
  // indecidible y se lee 3,63 IGUAL en todo el sistema (pantalla y caja).
  it("'3.632' sin decimales se lee 3,63 (ambigüedad resuelta igual en todo el sistema)", () => {
    expect(parsePublicMoneyInput("3.632")).toBe(3.63)
  })

  // El monto a pagar se MUESTRA "Bs 9.648,99": el cliente que lo copia manda
  // también el "Bs". Antes eso daba 0 — la misma clase de bug que motivó este
  // parser, pero por el símbolo en vez del punto de miles.
  it("tolera símbolos de moneda pegados o separados", () => {
    expect(parsePublicMoneyInput("Bs 9.648,99")).toBe(9648.99)
    expect(parsePublicMoneyInput("bs. 250,00")).toBe(250)
    expect(parsePublicMoneyInput("$10")).toBe(10)
    expect(parsePublicMoneyInput("€6.50")).toBe(6.5)
    expect(parsePublicMoneyInput("250 Bs")).toBe(250)
  })

  it("texto mezclado con números sigue siendo basura (0), no un monto a medias", () => {
    expect(parsePublicMoneyInput("12abc")).toBe(0)
    expect(parsePublicMoneyInput("1.2.3")).toBe(0)
    expect(parsePublicMoneyInput("Bs")).toBe(0)
  })

  it("más de dos decimales se redondea a céntimos", () => {
    expect(parsePublicMoneyInput("10.123")).toBe(10.12)
    expect(parsePublicMoneyInput("10.999")).toBe(11)
    expect(parsePublicMoneyInput("0,005")).toBe(0.01)
  })

  it("números muy grandes no pierden precisión de céntimos", () => {
    expect(parsePublicMoneyInput("999.999.999,99")).toBe(999999999.99)
    expect(parsePublicMoneyInput("123456789012,34")).toBe(123456789012.34)
  })

  it("ignora espacios intercalados", () => {
    expect(parsePublicMoneyInput(" 9 648,99 ")).toBe(9648.99)
  })

  // Ida y vuelta: lo que la app precarga tiene que volver al mismo número, o el
  // cliente que no toca el campo reportaría un monto distinto al que debe.
  it("hace ida y vuelta con toVesInputAmount sin perder el monto", () => {
    for (const monto of [9648.99, 1820, 4824.5, 0.5, 1234567.89]) {
      expect(parsePublicMoneyInput(toVesInputAmount(monto))).toBe(monto)
    }
  })
})

describe("toVesInputAmount", () => {
  it("usa coma decimal y NO separador de miles", () => {
    expect(toVesInputAmount(9648.99)).toBe("9648,99")
    expect(toVesInputAmount(1820)).toBe("1820,00")
    expect(toVesInputAmount(1234567.89)).toBe("1234567,89")
  })
})
