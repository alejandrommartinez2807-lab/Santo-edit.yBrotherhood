import { describe, it, expect } from "vitest"
import { clampRating, summarizeReviews } from "../reviewsSummary"

describe("reviewsSummary", () => {
  it("acota el rating a 1-5", () => {
    expect(clampRating(0)).toBe(1)
    expect(clampRating(7)).toBe(5)
    expect(clampRating(3)).toBe(3)
    expect(clampRating("4")).toBe(4)
  })

  it("promedia solo las publicadas y arma la distribución", () => {
    const s = summarizeReviews([
      { rating: 5, published: true },
      { rating: 4, published: true },
      { rating: 3, published: true },
      { rating: 1, published: false }, // no cuenta
    ])
    expect(s.count).toBe(3)
    expect(s.average).toBe(4) // (5+4+3)/3
    expect(s.distribution[5]).toBe(1)
    expect(s.distribution[1]).toBe(0)
  })

  it("sin reseñas, promedio 0", () => {
    expect(summarizeReviews([]).average).toBe(0)
  })
})
