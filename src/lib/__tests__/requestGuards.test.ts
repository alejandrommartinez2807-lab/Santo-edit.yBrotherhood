import { describe, expect, it, afterEach } from "vitest"
import {
  checkRequestSizeLimit,
  checkSameOriginRequest,
  getEnvByteLimit,
  getRequestContentLength,
  getRequestHost,
  isAllowedApiSourceHost,
  parseContentLength,
} from "@/lib/requestGuards"

function requestWithContentLength(value: string | null) {
  return {
    headers: {
      get(name: string) {
        if (name.toLowerCase() !== "content-length") return null
        return value
      },
    },
  }
}

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

describe("requestGuards", () => {
  afterEach(() => {
    delete process.env.TEST_REQUEST_LIMIT_BYTES
    delete process.env.ALLOWED_API_ORIGINS
  })

  it("parsea content-length válido", () => {
    expect(parseContentLength("1200")).toBe(1200)
    expect(parseContentLength(" 2048 ")).toBe(2048)
  })

  it("ignora content-length inválido", () => {
    expect(parseContentLength(null)).toBeNull()
    expect(parseContentLength("abc")).toBeNull()
    expect(parseContentLength("12.5")).toBeNull()
    expect(parseContentLength("-1")).toBeNull()
  })

  it("bloquea solicitudes cuando content-length excede el máximo", () => {
    const request = requestWithContentLength("5001")
    const result = checkRequestSizeLimit(request, { maxBytes: 5000 })

    expect(getRequestContentLength(request)).toBe(5001)
    expect(result.allowed).toBe(false)
    expect(result.contentLength).toBe(5001)
    expect(result.maxBytes).toBe(5000)
  })

  it("permite solicitudes sin content-length para no romper clientes válidos", () => {
    const result = checkRequestSizeLimit(requestWithContentLength(null), { maxBytes: 5000 })

    expect(result.allowed).toBe(true)
    expect(result.contentLength).toBeNull()
  })

  it("lee límites desde entorno con mínimos y máximos seguros", () => {
    process.env.TEST_REQUEST_LIMIT_BYTES = "999999999"
    expect(
      getEnvByteLimit("TEST_REQUEST_LIMIT_BYTES", 2000, {
        minBytes: 1000,
        maxBytes: 5000,
      })
    ).toBe(5000)

    process.env.TEST_REQUEST_LIMIT_BYTES = "50"
    expect(
      getEnvByteLimit("TEST_REQUEST_LIMIT_BYTES", 2000, {
        minBytes: 1000,
        maxBytes: 5000,
      })
    ).toBe(1000)
  })
})

describe("sameOriginRequestGuard", () => {
  afterEach(() => {
    delete process.env.ALLOWED_API_ORIGINS
  })

  it("permite solicitudes sin origin ni referer para no romper clientes válidos", () => {
    const result = checkSameOriginRequest(requestWithHeaders({ host: "santoperrito.com" }))

    expect(result.allowed).toBe(true)
    expect(result.source).toBe("none")
    expect(result.reason).toBe("missing-source")
  })

  it("permite origin del mismo host", () => {
    const request = requestWithHeaders({
      host: "santoperrito.com",
      origin: "https://santoperrito.com",
    })

    const result = checkSameOriginRequest(request)

    expect(getRequestHost(request)).toBe("santoperrito.com")
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe("same-host")
  })

  it("permite alias www del mismo dominio", () => {
    const result = checkSameOriginRequest(
      requestWithHeaders({
        host: "santoperrito.com",
        origin: "https://www.santoperrito.com",
      })
    )

    expect(result.allowed).toBe(true)
    expect(result.reason).toBe("www-alias")
  })

  it("permite hosts adicionales configurados por entorno", () => {
    process.env.ALLOWED_API_ORIGINS = "https://preview-santo.vercel.app, admin.santoperrito.com"

    expect(
      isAllowedApiSourceHost("preview-santo.vercel.app", "santoperrito.com")
    ).toBe(true)

    const result = checkSameOriginRequest(
      requestWithHeaders({
        host: "santoperrito.com",
        origin: "https://admin.santoperrito.com",
      })
    )

    expect(result.allowed).toBe(true)
    expect(result.reason).toBe("allowed-host")
  })

  it("bloquea origin externo cuando intenta usar una ruta mutante", () => {
    const result = checkSameOriginRequest(
      requestWithHeaders({
        host: "santoperrito.com",
        origin: "https://sitio-malo.example",
      })
    )

    expect(result.allowed).toBe(false)
    expect(result.source).toBe("origin")
    expect(result.reason).toBe("blocked")
    expect(result.requestHost).toBe("santoperrito.com")
    expect(result.sourceHost).toBe("sitio-malo.example")
  })

  it("usa x-forwarded-host cuando el deploy está detrás de proxy", () => {
    const result = checkSameOriginRequest(
      requestWithHeaders({
        host: "internal.vercel.local",
        "x-forwarded-host": "santoperrito.com",
        referer: "https://santoperrito.com/menu",
      })
    )

    expect(result.allowed).toBe(true)
    expect(result.source).toBe("referer")
  })
})
