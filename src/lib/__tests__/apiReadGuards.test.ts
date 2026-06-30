import { describe, expect, it } from "vitest"
import { resolveApiReadGuardOptions } from "@/lib/apiReadGuards"

describe("apiReadGuards", () => {
  it("resuelve límites seguros por defecto", () => {
    const result = resolveApiReadGuardOptions({ id: " reports get " })

    expect(result.id).toBe("reports_get")
    expect(result.limit).toBe(180)
    expect(result.windowMs).toBe(60_000)
    expect(result.skipSameOrigin).toBe(false)
  })

  it("normaliza límites explícitos", () => {
    const result = resolveApiReadGuardOptions({
      id: "support/status",
      limit: 0,
      windowMs: 250,
      skipSameOrigin: true,
    })

    expect(result.id).toBe("support/status")
    expect(result.limit).toBe(1)
    expect(result.windowMs).toBe(1_000)
    expect(result.skipSameOrigin).toBe(true)
  })
})
