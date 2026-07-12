import { describe, expect, it } from "vitest"
import {
  extractBcvEurRate,
  extractBcvUsdRate,
  extractBcvValueDate,
  parseVenezuelanNumber,
} from "@/lib/bcvRates"

// Estructura real de la página del BCV (jul 2026): bloque por moneda con
// id="dolar" y el número en formato venezolano (coma decimal).
const BCV_SAMPLE_HTML = `
<div id="euro" class="col-sm-12 col-xs-12">
  <span>EUR</span> <strong> 763,19191650 </strong>
</div>
<div id="dolar" class="col-sm-12 col-xs-12 ">
  <span>USD</span> <strong> 667,05000000 </strong>
</div>
<div class="pull-right dinpro center">
  Fecha Valor: <span>Lunes, 06 Julio 2026</span>
</div>
<table>
  <caption>Tasas Informativas del Sistema Bancario (Bs/USD)</caption>
  <tr><td>BBVA Provincial</td><td>653,1539</td><td>653,0225</td></tr>
</table>
`

describe("bcvRates", () => {
  it("extrae la tasa del DÓLAR (no la del euro) desde el bloque id=dolar", () => {
    expect(extractBcvUsdRate(BCV_SAMPLE_HTML)).toBe(667.05)
  })

  it("extrae la tasa desde el texto USD si no encuentra el bloque id=dolar", () => {
    const withoutId = BCV_SAMPLE_HTML.replace('id="dolar"', 'data-x="dolar"')
    expect(extractBcvUsdRate(withoutId)).toBe(667.05)
  })

  it("lanza error si el HTML no trae una tasa USD reconocible", () => {
    expect(() => extractBcvUsdRate("<html><body>mantenimiento</body></html>")).toThrow()
  })

  it("extrae la tasa del EURO (no la del dólar) desde el bloque id=euro", () => {
    expect(extractBcvEurRate(BCV_SAMPLE_HTML)).toBe(763.1919165)
  })

  it("extrae la tasa euro desde el texto EUR si no encuentra el bloque id=euro", () => {
    const withoutId = BCV_SAMPLE_HTML.replace('id="euro"', 'data-x="euro"')
    expect(extractBcvEurRate(withoutId)).toBe(763.1919165)
  })

  it("lanza error si el HTML no trae una tasa EUR reconocible", () => {
    expect(() => extractBcvEurRate("<html><body>mantenimiento</body></html>")).toThrow()
  })

  it("extrae la fecha valor publicada por el BCV", () => {
    expect(extractBcvValueDate(BCV_SAMPLE_HTML)).toBe("Lunes, 06 Julio 2026")
  })

  it("parsea números en formato venezolano", () => {
    expect(parseVenezuelanNumber("667,05000000")).toBe(667.05)
    expect(parseVenezuelanNumber("1.234,56")).toBe(1234.56)
    expect(parseVenezuelanNumber("no-numero")).toBeNull()
    expect(parseVenezuelanNumber("-5,10")).toBeNull()
  })
})
