import { afterEach, describe, expect, it } from "vitest"
import {
  formatPublicUSD,
  formatVES,
  getPublicCurrencyName,
  getPublicCurrencySymbol,
  setPublicCurrencySymbol,
} from "@/utils/formatCurrency"

afterEach(() => {
  setPublicCurrencySymbol("$")
})

describe("moneda del sitio público", () => {
  it("el nombre acompaña al símbolo que eligió el dueño", () => {
    expect(getPublicCurrencyName()).toBe("dólares")

    setPublicCurrencySymbol("€")
    expect(getPublicCurrencySymbol()).toBe("€")
    expect(getPublicCurrencyName()).toBe("euros")
    expect(formatPublicUSD(2)).toContain("€")
  })

  it("cualquier otro valor cae en dólares, no inventa monedas", () => {
    setPublicCurrencySymbol("₿")
    expect(getPublicCurrencySymbol()).toBe("$")
    expect(getPublicCurrencyName()).toBe("dólares")
  })

  it("los bolívares no dependen del símbolo público", () => {
    setPublicCurrencySymbol("€")
    expect(formatVES(1722.37)).toBe("1.722,37")
  })
})
