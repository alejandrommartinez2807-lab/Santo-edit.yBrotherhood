import { beforeEach, describe, expect, it } from "vitest"

import { checkRateLimit, clearRateLimitStoreForTests } from "@/lib/rateLimit"
import { normalizePublicTableLookup } from "@/lib/publicLocalTableAccounts"

// QA ronda 2026-07-27, hallazgo B-3: "Pedir la cuenta" limitaba a 6 peticiones
// por minuto con la llave `ruta + IP`, SIN la mesa. En un restaurante todos los
// teléfonos salen por la misma IP (el WiFi del local, o el CGNAT del operador),
// así que un comensal martillando el botón dejaba a las demás mesas sin poder
// pedir su cuenta: recibían 429 y el mesonero nunca se enteraba.
//
// El freno ahora es por MESA, con un tope por IP muy por encima del tamaño de
// un local. Estas pruebas fijan las dos mitades.

const IP = "190.202.10.5"

// Espejo de lo que hace src/app/api/public/open-accounts/request-bill/route.ts
const TABLE_LIMIT = { limit: 6, windowMs: 60_000 }
const IP_LIMIT = { id: "api-public-request-bill-post", limit: 60, windowMs: 60_000 }

function requestFrom(ip: string) {
  return {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "x-forwarded-for" ? ip : null
      },
    },
  }
}

function askForBill(table: string, ip = IP) {
  return checkRateLimit(requestFrom(ip), {
    ...TABLE_LIMIT,
    id: `api-public-request-bill-post:${normalizePublicTableLookup(table)}`,
  })
}

describe("freno de 'Pedir la cuenta' · por mesa, no por local entero", () => {
  beforeEach(() => {
    clearRateLimitStoreForTests()
  })

  it("una mesa que martilla el botón se frena a las 6 del minuto", () => {
    const results = Array.from({ length: 8 }, () => askForBill("Mesa 3"))

    expect(results.filter((result) => result.allowed)).toHaveLength(6)
    expect(results.slice(6).every((result) => !result.allowed)).toBe(true)
  })

  it("con la Mesa 3 frenada, la Mesa 4 sigue pudiendo pedir su cuenta", () => {
    for (let i = 0; i < 10; i += 1) askForBill("Mesa 3")

    expect(askForBill("Mesa 3").allowed).toBe(false)
    expect(askForBill("Mesa 4").allowed).toBe(true)
    expect(askForBill("Barra").allowed).toBe(true)
  })

  it("todas las mesas del local comparten la IP del WiFi y aun así pasan", () => {
    const mesas = ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Barra", "Afuera"]
    const perMesa = mesas.map((mesa) => askForBill(mesa, "190.202.10.5"))

    expect(perMesa.every((result) => result.allowed)).toBe(true)

    // Y el tope por IP tiene que dejar sitio a un local lleno: 6 mesas
    // pidiendo hasta 6 veces cada una son 36 peticiones, por debajo de 60.
    expect(mesas.length * TABLE_LIMIT.limit).toBeLessThanOrEqual(IP_LIMIT.limit)
  })

  it("la mesa se normaliza: 'MESA 3', ' mesa  3 ' y 'Mesa 3' son la misma", () => {
    for (let i = 0; i < 6; i += 1) askForBill("Mesa 3")

    expect(askForBill("  MESA  3 ").allowed).toBe(false)
    expect(askForBill("mesa 3").allowed).toBe(false)
  })

  it("el tope por IP frena a quien inventa nombres de mesa para esquivar el freno", () => {
    const request = requestFrom("45.10.1.1")
    const results = Array.from({ length: IP_LIMIT.limit + 5 }, () =>
      checkRateLimit(request, IP_LIMIT),
    )

    expect(results.filter((result) => result.allowed)).toHaveLength(IP_LIMIT.limit)
    expect(results.at(-1)?.allowed).toBe(false)
  })

  it("dos locales distintos (IP distinta) no se frenan entre sí", () => {
    for (let i = 0; i < 10; i += 1) askForBill("Mesa 3", "190.202.10.5")

    expect(askForBill("Mesa 3", "190.202.10.5").allowed).toBe(false)
    expect(askForBill("Mesa 3", "201.44.9.9").allowed).toBe(true)
  })
})
