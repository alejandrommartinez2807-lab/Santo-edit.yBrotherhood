import { describe, expect, it } from "vitest"
import {
  findPublicCoupon,
  normalizePublicCoupons,
  parsePublicCouponLine,
} from "@/lib/publicPageConfig"

describe("cupones públicos · parsePublicCouponLine", () => {
  it("acepta código + porcentaje (con o sin %)", () => {
    expect(parsePublicCouponLine("BIENVENIDO10 10")).toEqual({
      code: "BIENVENIDO10",
      percent: 10,
    })
    expect(parsePublicCouponLine("  feria15   15%  ")).toEqual({
      code: "FERIA15",
      percent: 15,
    })
  })

  it("normaliza acentos y descarta caracteres raros del código", () => {
    expect(parsePublicCouponLine("día-del-niño 20")).toEqual({
      code: "DIA-DEL-NINO",
      percent: 20,
    })
  })

  it("rechaza líneas inválidas", () => {
    expect(parsePublicCouponLine("SOLOCODIGO")).toBeNull() // sin porcentaje
    expect(parsePublicCouponLine("AB 10")).toBeNull() // código muy corto
    expect(parsePublicCouponLine("CODIGO 0")).toBeNull() // 0%
    expect(parsePublicCouponLine("CODIGO 100")).toBeNull() // 100% no permitido
    expect(parsePublicCouponLine("CODIGO abc")).toBeNull() // porcentaje no numérico
    expect(parsePublicCouponLine("")).toBeNull()
  })
})

describe("cupones públicos · normalizePublicCoupons", () => {
  it("normaliza líneas, deduplica por código y descarta inválidas", () => {
    expect(
      normalizePublicCoupons(["bienvenido10 10", "BIENVENIDO10 25", "x 5", "FERIA15 15%"]),
    ).toEqual(["BIENVENIDO10 10", "FERIA15 15"])
  })

  it("acepta texto multilinea (editor) y valores vacíos", () => {
    expect(normalizePublicCoupons("PROMO20 20\n\nOTRO10 10")).toEqual([
      "PROMO20 20",
      "OTRO10 10",
    ])
    expect(normalizePublicCoupons(undefined)).toEqual([])
    expect(normalizePublicCoupons("")).toEqual([])
  })
})

describe("cupones públicos · findPublicCoupon", () => {
  const lines = ["BIENVENIDO10 10", "FERIA15 15"]

  it("encuentra el cupón sin importar mayúsculas/acentos", () => {
    expect(findPublicCoupon(lines, "bienvenido10")).toEqual({
      code: "BIENVENIDO10",
      percent: 10,
    })
    expect(findPublicCoupon(lines, " FERIA15 ")).toEqual({ code: "FERIA15", percent: 15 })
  })

  it("devuelve null si no existe o el código viene vacío", () => {
    expect(findPublicCoupon(lines, "NOEXISTE")).toBeNull()
    expect(findPublicCoupon(lines, "")).toBeNull()
    expect(findPublicCoupon(undefined, "BIENVENIDO10")).toBeNull()
  })
})
