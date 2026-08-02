import { describe, expect, it, beforeEach } from "vitest"

import {
  peekRateLimit,
  registerRateLimitHit,
  clearRateLimitStoreForTests,
} from "@/lib/rateLimit"

// Auditoría 2026-08-02 · brute-force de las claves de rol.
//
// El límite general de /api/local-auth cuenta TODAS las llamadas, así que no se
// puede apretar: el local entero sale por un solo wifi y el panel llama a esa
// ruta en cada cambio de módulo. El candado nuevo cuenta solo los FALLOS.

const request = {
  headers: {
    get: (name: string) => (name === "x-forwarded-for" ? "190.1.2.3" : null),
  },
}

const otraIp = {
  headers: {
    get: (name: string) => (name === "x-forwarded-for" ? "190.9.9.9" : null),
  },
}

const LOCK = { id: "api-local-auth-fallos", limit: 12, windowMs: 900_000 }

describe("candado de fallos de login", () => {
  beforeEach(() => {
    clearRateLimitStoreForTests()
  })

  it("peek NO gasta cupo: mirar mil veces no bloquea a nadie", () => {
    for (let i = 0; i < 1000; i += 1) peekRateLimit(request, LOCK)

    expect(peekRateLimit(request, LOCK).allowed).toBe(true)
    expect(peekRateLimit(request, LOCK).count).toBe(0)
  })

  it("bloquea tras 12 claves incorrectas", () => {
    for (let i = 0; i < 12; i += 1) registerRateLimitHit(request, LOCK)

    expect(peekRateLimit(request, LOCK).allowed).toBe(false)
  })

  it("con 11 fallos todavía deja intentar (el empleado despistado entra)", () => {
    for (let i = 0; i < 11; i += 1) registerRateLimitHit(request, LOCK)

    expect(peekRateLimit(request, LOCK).allowed).toBe(true)
  })

  it("el bloqueo es por IP: no deja fuera al resto del local", () => {
    for (let i = 0; i < 12; i += 1) registerRateLimitHit(request, LOCK)

    expect(peekRateLimit(request, LOCK).allowed).toBe(false)
    expect(peekRateLimit(otraIp, LOCK).allowed).toBe(true)
  })

  it("la ventana expira y se puede volver a intentar", () => {
    const now = Date.now()
    for (let i = 0; i < 12; i += 1) registerRateLimitHit(request, LOCK, now)

    expect(peekRateLimit(request, LOCK, now).allowed).toBe(false)
    expect(peekRateLimit(request, LOCK, now + LOCK.windowMs + 1).allowed).toBe(true)
  })

  it("informa cuántos segundos hay que esperar", () => {
    const now = Date.now()
    for (let i = 0; i < 12; i += 1) registerRateLimitHit(request, LOCK, now)

    const blocked = peekRateLimit(request, LOCK, now)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(LOCK.windowMs / 1000)
  })
})
