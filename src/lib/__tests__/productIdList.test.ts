import { describe, expect, it } from "vitest"
import { normalizeProductIds } from "@/lib/productIdList"

describe("productIdList", () => {
  it("normaliza ids desde arrays sin duplicados ni valores inválidos", () => {
    expect(normalizeProductIds([1, "2", 2, 2.7, "x", 0, -1])).toEqual([
      1,
      2,
      3,
    ])
  })

  it("normaliza ids desde JSON o texto separado", () => {
    expect(normalizeProductIds('[3,"4",0,"x"]')).toEqual([3, 4])
    expect(normalizeProductIds("5;6|7,5")).toEqual([5, 6, 7])
  })

  it("devuelve lista vacía con entradas vacías o no soportadas", () => {
    expect(normalizeProductIds(" ")).toEqual([])
    expect(normalizeProductIds({ ids: [1, 2] })).toEqual([])
    expect(normalizeProductIds(null)).toEqual([])
  })
})
