import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  checkRateLimit,
  clearRateLimitStoreForTests,
  getClientIp,
  getRateLimitStoreSizeForTests,
} from "@/lib/rateLimit"

function requestWithHeaders(headers: Record<string, string>) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    headers: {
      get(name: string) {
        return normalizedHeaders.get(name.toLowerCase()) || null
      },
    },
  }
}

describe("rateLimit", () => {
  beforeEach(() => {
    clearRateLimitStoreForTests()
  })

  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX_KEYS
    clearRateLimitStoreForTests()
  })

  it("uses the first x-forwarded-for IP", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      "x-real-ip": "198.51.100.20",
    })

    expect(getClientIp(request)).toBe("203.0.113.7")
  })

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const request = requestWithHeaders({
      "x-real-ip": "198.51.100.20",
    })

    expect(getClientIp(request)).toBe("198.51.100.20")
  })

  it("blocks after exceeding the configured limit", () => {
    const request = requestWithHeaders({ "x-forwarded-for": "203.0.113.7" })
    const options = { id: "orders-post", limit: 2, windowMs: 60_000 }

    expect(checkRateLimit(request, options, 1_000).allowed).toBe(true)
    expect(checkRateLimit(request, options, 2_000).allowed).toBe(true)

    const blocked = checkRateLimit(request, options, 3_000)

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("resets the counter after the window expires", () => {
    const request = requestWithHeaders({ "x-forwarded-for": "203.0.113.7" })
    const options = { id: "products-get", limit: 1, windowMs: 1_000 }

    expect(checkRateLimit(request, options, 1_000).allowed).toBe(true)
    expect(checkRateLimit(request, options, 1_500).allowed).toBe(false)
    expect(checkRateLimit(request, options, 2_001).allowed).toBe(true)
  })

  it("limita el tamaño del store para evitar crecimiento indefinido", () => {
    process.env.RATE_LIMIT_MAX_KEYS = "500"

    for (let index = 0; index < 520; index += 1) {
      checkRateLimit(
        requestWithHeaders({ "x-forwarded-for": `203.0.113.${index}` }),
        { id: "public-read", limit: 10, windowMs: 60_000 },
        1_000 + index
      )
    }

    expect(getRateLimitStoreSizeForTests()).toBeLessThanOrEqual(500)
  })
})
