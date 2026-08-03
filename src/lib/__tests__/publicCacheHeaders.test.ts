import { beforeEach, describe, expect, it, vi } from "vitest"

// La consulta de sucursales toca Supabase; aquí solo importa cuántas devuelve.
const getActiveBranches = vi.fn()

vi.mock("@/lib/branch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/branch")>("@/lib/branch")

  return { ...actual, getActiveBranches: () => getActiveBranches() }
})

const { hayVariasSedes, isBranchCacheSafe, olvidarSedesRecordadas, publicReadHeaders } =
  await import("@/lib/publicCacheHeaders")

type FakeRequest = Parameters<typeof isBranchCacheSafe>[0]

// Lo mínimo que leen estas funciones: la query de la URL y las cabeceras.
function pedido(url: string, headers: Record<string, string> = {}): FakeRequest {
  const parsed = new URL(url, "https://ejemplo.test")

  return {
    nextUrl: { searchParams: parsed.searchParams },
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null
      },
    },
  } as unknown as FakeRequest
}

const VINEDO = "vinedo-1"
const SAN_DIEGO = "san-diego-2"

describe("caché del borde sin mezclar sedes", () => {
  it("con varias sedes NO cachea la URL sin sede, aunque venga la cabecera", () => {
    expect(isBranchCacheSafe(pedido("/api/public/products"), true)).toBe(false)
    expect(
      isBranchCacheSafe(pedido("/api/public/products", { "x-branch-id": VINEDO }), true),
    ).toBe(false)
  })

  it("con una sola sede la URL pelada sí se puede guardar", () => {
    expect(isBranchCacheSafe(pedido("/api/public/products"), false)).toBe(true)
  })

  it("cachea cuando la sede de la URL es la misma que la de la cabecera", () => {
    expect(
      isBranchCacheSafe(pedido(`/api/public/products?branch=${VINEDO}`, {
        "x-branch-id": VINEDO,
      }), true),
    ).toBe(true)
  })

  it("NO cachea si la URL dice una sede y la cabecera otra", () => {
    expect(
      isBranchCacheSafe(pedido(`/api/public/products?branch=${VINEDO}`, {
        "x-branch-id": SAN_DIEGO,
      }), true),
    ).toBe(false)
  })

  it("NO cachea cuando la sede solo viaja en el Referer del QR", () => {
    expect(
      isBranchCacheSafe(pedido("/api/public/products", {
        referer: `https://ejemplo.test/?branch=${SAN_DIEGO}`,
      }), true),
    ).toBe(false)
  })

  it("publicReadHeaders devuelve no-store justo en los casos que no son seguros", () => {
    const seguro: Record<string, string> = publicReadHeaders(
      pedido(`/api/public/products?branch=${VINEDO}`, { "x-branch-id": VINEDO }),
      60,
      3600,
      true,
    )
    expect(seguro["Cache-Control"]).toContain("s-maxage=60")
    expect(seguro["CDN-Cache-Control"]).toContain("stale-while-revalidate=3600")

    const inseguro: Record<string, string> = publicReadHeaders(
      pedido("/api/public/products"),
      60,
      3600,
      true,
    )
    expect(inseguro["Cache-Control"]).toContain("no-store")
    expect(inseguro).not.toHaveProperty("CDN-Cache-Control")
  })
})

describe("cuántas sedes hay (memoria corta)", () => {
  beforeEach(() => {
    olvidarSedesRecordadas()
    getActiveBranches.mockReset()
  })

  it("no vuelve a consultar dentro del plazo", async () => {
    getActiveBranches.mockResolvedValue([{ id: VINEDO }, { id: SAN_DIEGO }])

    expect(await hayVariasSedes(1_000)).toBe(true)
    expect(await hayVariasSedes(30_000)).toBe(true)
    expect(getActiveBranches).toHaveBeenCalledTimes(1)
  })

  it("la respuesta 'una sola sede' caduca enseguida, para no servirle su config a una sucursal nueva", async () => {
    getActiveBranches.mockResolvedValue([{ id: VINEDO }])
    expect(await hayVariasSedes(1_000)).toBe(false)

    getActiveBranches.mockResolvedValue([{ id: VINEDO }, { id: SAN_DIEGO }])
    expect(await hayVariasSedes(3_000)).toBe(false) // todavía dentro del plazo corto
    expect(await hayVariasSedes(10_000)).toBe(true) // ya volvió a preguntar
    expect(getActiveBranches).toHaveBeenCalledTimes(2)
  })

  it("si la consulta falla responde que hay varias y no lo recuerda", async () => {
    getActiveBranches.mockRejectedValue(new Error("sin base"))
    expect(await hayVariasSedes(1_000)).toBe(true)

    getActiveBranches.mockResolvedValue([{ id: VINEDO }])
    expect(await hayVariasSedes(1_100)).toBe(false)
    expect(getActiveBranches).toHaveBeenCalledTimes(2)
  })
})
