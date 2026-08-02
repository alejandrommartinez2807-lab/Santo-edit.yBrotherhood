import { describe, expect, it, vi, beforeEach } from "vitest"

// Auditoría 2026-08-02 · el rate limit no frenaba un ataque repartido.
//
// El contador vivía en la memoria de cada proceso. En Vercel, con N instancias
// serverless, el límite real era "N x límite": bastaba espaciar los intentos
// para que cada uno cayera en una instancia con el contador en cero. La
// migración 0037 mueve el conteo a Postgres, que lo hace atómicamente.
//
// Lo importante de estos tests: la degradación. Si la migración todavía no está
// aplicada, el login NO puede quedarse bloqueado — se cae al contador de
// memoria de siempre y el personal sigue entrando.

const rpc = vi.fn()

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({ rpc }),
}))

const request = {
  headers: { get: (name: string) => (name === "x-forwarded-for" ? "190.1.2.3" : null) },
}

const LIMIT = { id: "api-local-auth-fallos", limit: 12, windowMs: 900_000 }

async function loadModule() {
  vi.resetModules()
  const shared = await import("@/lib/sharedRateLimit")
  const memoria = await import("@/lib/rateLimit")
  memoria.clearRateLimitStoreForTests()
  return shared
}

beforeEach(() => {
  rpc.mockReset()
  // @ts-expect-error - limpieza del recordatorio entre tests
  globalThis.__sharedRateLimitUnavailableUntil = 0
})

describe("contador compartido entre instancias", () => {
  it("suma en la base, no en memoria", async () => {
    const { registerSharedRateLimitHit } = await loadModule()
    rpc.mockResolvedValue({
      data: [{ hits: 3, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    const result = await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")

    expect(rpc).toHaveBeenCalledWith("increment_rate_limit", {
      p_key: "api-local-auth-fallos:190.1.2.3",
      p_window_ms: 900_000,
    })
    expect(result.count).toBe(3)
    expect(result.allowed).toBe(true)
  })

  it("bloquea al superar el límite", async () => {
    const { registerSharedRateLimitHit } = await loadModule()
    rpc.mockResolvedValue({
      data: [{ hits: 13, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    const result = await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    expect(result.allowed).toBe(false)
  })

  it("peek no gasta intento: con 12 justos todavía deja pasar el que acierta", async () => {
    const { peekSharedRateLimit } = await loadModule()
    rpc.mockResolvedValue({
      data: [{ hits: 11, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    const result = await peekSharedRateLimit(request, LIMIT, "190.1.2.3")

    expect(rpc).toHaveBeenCalledWith("peek_rate_limit", {
      p_key: "api-local-auth-fallos:190.1.2.3",
    })
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(11)
  })

  it("peek con el cupo agotado bloquea", async () => {
    const { peekSharedRateLimit } = await loadModule()
    rpc.mockResolvedValue({
      data: [{ hits: 12, reset_at: new Date(Date.now() + 900_000).toISOString() }],
      error: null,
    })

    expect((await peekSharedRateLimit(request, LIMIT, "190.1.2.3")).allowed).toBe(false)
  })

  it("sin fila previa, la IP entra limpia", async () => {
    const { peekSharedRateLimit } = await loadModule()
    rpc.mockResolvedValue({ data: [], error: null })

    const result = await peekSharedRateLimit(request, LIMIT, "190.1.2.3")
    expect(result.count).toBe(0)
    expect(result.allowed).toBe(true)
  })
})

describe("degradación cuando la migración 0037 no está aplicada", () => {
  it("si la función no existe, NO deja al personal fuera: cae al contador local", async () => {
    const { peekSharedRateLimit } = await loadModule()
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'function peek_rate_limit does not exist', code: "42883" },
    })

    const result = await peekSharedRateLimit(request, LIMIT, "190.1.2.3")

    // El contador de memoria está vacío, así que se puede intentar entrar.
    expect(result.allowed).toBe(true)
  })

  it("si la base revienta, tampoco bloquea el acceso", async () => {
    const { registerSharedRateLimitHit } = await loadModule()
    rpc.mockRejectedValue(new Error("sin conexión"))

    const result = await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    expect(result.count).toBe(1)
  })

  it("tras un fallo deja de martillear la base durante un rato", async () => {
    const { registerSharedRateLimitHit } = await loadModule()
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    const llamadasTrasElPrimerFallo = rpc.mock.calls.length

    await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")

    expect(rpc.mock.calls.length).toBe(llamadasTrasElPrimerFallo)
  })

  it("degradado sigue contando: el candado local no desaparece", async () => {
    const { registerSharedRateLimitHit } = await loadModule()
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    let last = await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    for (let i = 0; i < 12; i += 1) {
      last = await registerSharedRateLimitHit(request, LIMIT, "190.1.2.3")
    }

    expect(last.allowed).toBe(false)
  })
})
