import { describe, expect, it } from "vitest"
import { resolveApiMutationGuardOptions } from "@/lib/apiMutationGuards"

describe("apiMutationGuards", () => {
  it("resuelve límites seguros por defecto", () => {
    const result = resolveApiMutationGuardOptions({ id: " menu products post " })

    expect(result.id).toBe("menu_products_post")
    expect(result.limit).toBe(120)
    expect(result.windowMs).toBe(60_000)
    expect(result.maxBytes).toBe(2_000_000)
    expect(result.skipSameOrigin).toBe(false)
  })

  it("respeta límites explícitos con mínimos y máximos seguros", () => {
    const small = resolveApiMutationGuardOptions({
      id: "staff",
      maxBytes: 100,
      minBytes: 10_000,
      hardMaxBytes: 20_000,
    })

    expect(small.maxBytes).toBe(10_000)

    const large = resolveApiMutationGuardOptions({
      id: "staff",
      maxBytes: 99_000,
      minBytes: 10_000,
      hardMaxBytes: 20_000,
    })

    expect(large.maxBytes).toBe(20_000)
  })

  it("permite controlar límites desde entorno", () => {
    process.env.TEST_PRIVATE_API_LIMIT_BYTES = "4096"

    const result = resolveApiMutationGuardOptions({
      id: "business-config",
      envMaxBytes: "TEST_PRIVATE_API_LIMIT_BYTES",
      maxBytes: 2_000_000,
      minBytes: 1_000,
      hardMaxBytes: 10_000,
    })

    expect(result.maxBytes).toBe(4096)

    delete process.env.TEST_PRIVATE_API_LIMIT_BYTES
  })
})
