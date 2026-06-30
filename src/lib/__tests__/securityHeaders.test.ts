import { describe, expect, it } from "vitest"
import {
  applyApiNoStoreHeaders,
  applyApiSecurityHeaders,
  applyPrivateApiHeaders,
  getApiNoStoreValue,
} from "@/lib/securityHeaders"

function mutableHeaders() {
  const values = new Map<string, string>()

  return {
    values,
    set(name: string, value: string) {
      values.set(name, value)
    },
  }
}

describe("securityHeaders", () => {
  it("aplica headers básicos de seguridad para APIs", () => {
    const headers = mutableHeaders()

    applyApiSecurityHeaders(headers)

    expect(headers.values.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.values.get("Referrer-Policy")).toBe("no-referrer")
    expect(headers.values.get("X-Frame-Options")).toBe("DENY")
    expect(headers.values.get("X-Robots-Tag")).toBe("noindex, nofollow")
    expect(headers.values.get("Cross-Origin-Resource-Policy")).toBe("same-origin")
    expect(headers.values.get("Vary")).toBe("Origin")
  })

  it("aplica no-store para APIs privadas", () => {
    const headers = mutableHeaders()

    applyApiNoStoreHeaders(headers)

    expect(headers.values.get("Cache-Control")).toBe(getApiNoStoreValue())
  })

  it("combina seguridad y no-store en applyPrivateApiHeaders", () => {
    const headers = mutableHeaders()

    applyPrivateApiHeaders(headers)

    expect(headers.values.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.values.get("Cache-Control")).toBe(getApiNoStoreValue())
  })
})
