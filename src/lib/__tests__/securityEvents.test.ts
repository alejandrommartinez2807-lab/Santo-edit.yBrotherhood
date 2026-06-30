import { describe, expect, it } from "vitest"
import {
  buildSecurityEventPayload,
  fingerprintSecurityValue,
} from "@/lib/securityEvents"

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

describe("securityEvents", () => {
  it("crea fingerprints estables sin exponer el valor original", () => {
    const first = fingerprintSecurityValue("203.0.113.7")
    const second = fingerprintSecurityValue("203.0.113.7")

    expect(first).toBe(second)
    expect(first).toMatch(/^fp_[a-f0-9]{8}$/)
    expect(first).not.toContain("203.0.113.7")
  })

  it("arma payloads de seguridad sin guardar IP ni user-agent crudos", () => {
    const payload = buildSecurityEventPayload({
      kind: "rate_limit",
      route: "orders-post",
      request: requestWithHeaders({
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "Mozilla/5.0 Test Browser",
      }),
      metadata: {
        count: 11,
      },
    })

    expect(payload.kind).toBe("rate_limit")
    expect(payload.route).toBe("orders-post")
    expect(payload.count).toBe(11)
    expect(payload.clientFingerprint).toMatch(/^fp_[a-f0-9]{8}$/)
    expect(JSON.stringify(payload)).not.toContain("203.0.113.7")
    expect(JSON.stringify(payload)).not.toContain("Mozilla/5.0 Test Browser")
  })
})
