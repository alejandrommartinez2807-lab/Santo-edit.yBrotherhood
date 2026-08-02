import { describe, expect, it, beforeEach } from "vitest"

import {
  getPublicApiCacheKey,
  withPublicApiCache,
  clearPublicApiCache,
  PUBLIC_API_CACHE_TTL_MS,
} from "@/lib/publicApiCache"

// Auditoría 2026-08-02 · medido contra brotherhood-xi.vercel.app.
// Una sola carga de la home hacía 23 llamadas a la API: 13 a business-config,
// 5 a branches y 3 a products (130 KB cada una). Son ~25 componentes que piden
// la configuración cada uno por su lado con `cache: "no-store"`.

function makeResponse(body: string, ok = true) {
  return new Response(body, { status: ok ? 200 : 500 })
}

describe("clave de caché de la API pública", () => {
  it("cachea las rutas públicas pesadas", () => {
    expect(getPublicApiCacheKey("GET", "/api/public/business-config")).toBeTruthy()
    expect(getPublicApiCacheKey("GET", "/api/public/branches")).toBeTruthy()
    expect(getPublicApiCacheKey("GET", "/api/public/products")).toBeTruthy()
  })

  it("NO cachea nada que no sea GET (un pedido nunca se sirve de caché)", () => {
    expect(getPublicApiCacheKey("POST", "/api/public/business-config")).toBeNull()
    expect(getPublicApiCacheKey("PATCH", "/api/public/branches")).toBeNull()
  })

  it("NO cachea rutas de pedidos ni del panel", () => {
    expect(getPublicApiCacheKey("GET", "/api/orders")).toBeNull()
    expect(getPublicApiCacheKey("GET", "/api/public/table-account-status")).toBeNull()
    expect(getPublicApiCacheKey("GET", "/api/exchange-rate")).toBeNull()
  })

  it("dos sedes NO comparten configuración", () => {
    const sedeA = getPublicApiCacheKey("GET", "/api/public/business-config", "sede-a")
    const sedeB = getPublicApiCacheKey("GET", "/api/public/business-config", "sede-b")

    expect(sedeA).not.toBe(sedeB)
  })

  it("el cache-buster ?theme= no crea una clave distinta cada vez", () => {
    const primera = getPublicApiCacheKey(
      "GET",
      "/api/public/business-config?theme=1111",
      "sede-a",
    )
    const segunda = getPublicApiCacheKey(
      "GET",
      "/api/public/business-config?theme=2222",
      "sede-a",
    )

    expect(primera).toBe(segunda)
  })

  it("otros parámetros SÍ distinguen (no se mezcla el menú de otra sede)", () => {
    expect(getPublicApiCacheKey("GET", "/api/public/products?branch=1")).not.toBe(
      getPublicApiCacheKey("GET", "/api/public/products?branch=2"),
    )
  })
})

describe("colapso de la ráfaga", () => {
  beforeEach(() => {
    clearPublicApiCache()
  })

  it("13 componentes pidiendo a la vez = 1 sola petición real", async () => {
    let llamadasReales = 0

    const resultados = await Promise.all(
      Array.from({ length: 13 }, () =>
        withPublicApiCache("k", async () => {
          llamadasReales += 1
          return makeResponse('{"ok":true}')
        }),
      ),
    )

    expect(llamadasReales).toBe(1)
    expect(resultados).toHaveLength(13)
  })

  it("cada llamador recibe su propio cuerpo legible", async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 3 }, () =>
        withPublicApiCache("k", async () => makeResponse('{"ok":true}')),
      ),
    )

    for (const response of respuestas) {
      expect(await response.json()).toEqual({ ok: true })
    }
  })

  it("pasada la ventana se vuelve a pedir fresco", async () => {
    let llamadasReales = 0
    const run = async () => {
      llamadasReales += 1
      return makeResponse('{"ok":true}')
    }

    const t0 = 1_000_000
    await withPublicApiCache("k", run, t0)
    await withPublicApiCache("k", run, t0 + 1)
    expect(llamadasReales).toBe(1)

    await withPublicApiCache("k", run, t0 + PUBLIC_API_CACHE_TTL_MS + 1)
    expect(llamadasReales).toBe(2)
  })

  it("un error NO se queda pegado en la caché", async () => {
    let llamadasReales = 0
    const run = async () => {
      llamadasReales += 1
      return makeResponse("boom", false)
    }

    const t0 = 2_000_000
    await withPublicApiCache("k", run, t0)
    await withPublicApiCache("k", run, t0 + 1)

    expect(llamadasReales).toBe(2)
  })

  it("si la petición revienta, la siguiente lo vuelve a intentar", async () => {
    let llamadasReales = 0

    await expect(
      withPublicApiCache("k", async () => {
        llamadasReales += 1
        throw new Error("sin red")
      }),
    ).rejects.toThrow("sin red")

    await withPublicApiCache("k", async () => {
      llamadasReales += 1
      return makeResponse('{"ok":true}')
    })

    expect(llamadasReales).toBe(2)
  })
})
