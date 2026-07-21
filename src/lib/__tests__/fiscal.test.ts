import { describe, it, expect } from "vitest"
import { computeFiscalTotals, computeIgtfOnDivisa, DEFAULT_FISCAL_CONFIG, type FiscalConfig } from "@/lib/fiscal"

const cfg = (over: Partial<FiscalConfig> = {}): FiscalConfig => ({ ...DEFAULT_FISCAL_CONFIG, ...over })

describe("computeIgtfOnDivisa", () => {
  it("cobra 3% por defecto sobre el monto en divisas", () => {
    expect(computeIgtfOnDivisa(100)).toBe(3)
    expect(computeIgtfOnDivisa(1)).toBe(0.03)
  })
  it("respeta una tasa configurada distinta", () => {
    expect(computeIgtfOnDivisa(100, { igtfEnabled: true, igtfRate: 3.5 })).toBe(3.5)
  })
  it("no cobra si el IGTF está desactivado o la tasa es 0", () => {
    expect(computeIgtfOnDivisa(100, { igtfEnabled: false, igtfRate: 3 })).toBe(0)
    expect(computeIgtfOnDivisa(100, { igtfEnabled: true, igtfRate: 0 })).toBe(0)
  })
  it("monto <= 0 o inválido → 0", () => {
    expect(computeIgtfOnDivisa(0)).toBe(0)
    expect(computeIgtfOnDivisa(-5)).toBe(0)
    // @ts-expect-error runtime
    expect(computeIgtfOnDivisa("x")).toBe(0)
  })
  it("redondea a 2 decimales", () => {
    expect(computeIgtfOnDivisa(0.33)).toBe(0.01)
  })
})

describe("computeFiscalTotals · IVA incluido", () => {
  it("extrae el IVA 16% de un precio que ya lo incluye", () => {
    // $116 incluye IVA → base 100, IVA 16
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 1, ivaRate: 16 }], cfg())
    expect(r.subtotalUSD).toBe(100)
    expect(r.ivaTotalUSD).toBe(16)
    expect(r.totalBeforeIgtfUSD).toBe(116)
  })

  it("respeta tasas distintas por producto (16, 8, exento)", () => {
    const r = computeFiscalTotals(
      [
        { priceUSD: 116, quantity: 1, ivaRate: 16 }, // base 100 iva 16
        { priceUSD: 108, quantity: 1, ivaRate: 8 }, // base 100 iva 8
        { priceUSD: 50, quantity: 1, ivaRate: 0 }, // exento: base 50 iva 0
      ],
      cfg(),
    )
    expect(r.subtotalUSD).toBe(250)
    expect(r.ivaTotalUSD).toBe(24)
    expect(r.ivaByRate.map((b) => b.rate)).toEqual([16, 8, 0])
    const exento = r.ivaByRate.find((b) => b.rate === 0)!
    expect(exento.ivaUSD).toBe(0)
    expect(exento.baseUSD).toBe(50)
  })

  it("usa la tasa por defecto cuando el producto no define IVA", () => {
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 1 }], cfg({ ivaDefaultRate: 16 }))
    expect(r.ivaTotalUSD).toBe(16)
  })

  it("multiplica por cantidad", () => {
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 3, ivaRate: 16 }], cfg())
    expect(r.totalBeforeIgtfUSD).toBe(348)
    expect(r.ivaTotalUSD).toBe(48)
  })
})

describe("computeFiscalTotals · IVA aparte", () => {
  it("suma el IVA sobre el precio neto", () => {
    const r = computeFiscalTotals(
      [{ priceUSD: 100, quantity: 1, ivaRate: 16 }],
      cfg({ pricesIncludeIva: false }),
    )
    expect(r.subtotalUSD).toBe(100)
    expect(r.ivaTotalUSD).toBe(16)
    expect(r.totalBeforeIgtfUSD).toBe(116)
  })
})

describe("computeFiscalTotals · IGTF en divisas", () => {
  it("cobra 3% sobre el monto pagado en divisas", () => {
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 1, ivaRate: 16 }], cfg(), 116)
    expect(r.igtfBaseUSD).toBe(116)
    expect(r.igtfUSD).toBe(3.48)
    expect(r.totalUSD).toBe(119.48)
  })

  it("solo aplica IGTF sobre la porción pagada en divisas", () => {
    // Total 116, pero solo $50 en divisas → IGTF sobre 50
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 1, ivaRate: 16 }], cfg(), 50)
    expect(r.igtfBaseUSD).toBe(50)
    expect(r.igtfUSD).toBe(1.5)
    expect(r.totalUSD).toBe(117.5)
  })

  it("no cobra IGTF si está desactivado", () => {
    const r = computeFiscalTotals(
      [{ priceUSD: 116, quantity: 1, ivaRate: 16 }],
      cfg({ igtfEnabled: false }),
      116,
    )
    expect(r.igtfUSD).toBe(0)
    expect(r.totalUSD).toBe(116)
  })

  it("nunca cobra IGTF sobre más del total debido", () => {
    const r = computeFiscalTotals([{ priceUSD: 116, quantity: 1, ivaRate: 16 }], cfg(), 999)
    expect(r.igtfBaseUSD).toBe(116) // acotado al total
    expect(r.igtfUSD).toBe(3.48)
  })
})

describe("computeFiscalTotals · bordes", () => {
  it("ignora líneas inválidas", () => {
    const r = computeFiscalTotals(
      [
        { priceUSD: 0, quantity: 0, ivaRate: 16 },
        { priceUSD: -5, quantity: 1, ivaRate: 16 },
        { priceUSD: 116, quantity: 1, ivaRate: 16 },
      ],
      cfg(),
    )
    expect(r.totalBeforeIgtfUSD).toBe(116)
  })

  it("carrito vacío da todo en cero", () => {
    const r = computeFiscalTotals([], cfg(), 100)
    expect(r.totalUSD).toBe(0)
    expect(r.igtfUSD).toBe(0)
  })
})
