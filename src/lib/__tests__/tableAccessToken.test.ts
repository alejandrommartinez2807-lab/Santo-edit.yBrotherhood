import { describe, expect, it, beforeEach, afterEach } from "vitest"

import {
  signTableToken,
  isValidTableToken,
  isTableTokenEnabled,
} from "@/lib/tableAccessToken"

// Auditoría 2026-08-02 · fuga de inteligencia comercial por la consulta de mesas.
//
// /api/public/table-account-status es público a propósito (el comensal escanea
// y ve su cuenta sin clave), pero la única credencial era el NOMBRE de la mesa,
// y esos se adivinan solos: "Mesa 1", "Mesa 2", "Barra". Desde fuera se podían
// recorrer todas las mesas de las dos sedes y leer en vivo cuánto llevaba cada
// una y qué había pedido — ticket medio, ocupación y horas pico servidos a
// cualquiera, competencia incluida.
//
// La firma va en el QR y no se guarda en ninguna parte: se deriva de la mesa,
// la sede y el secreto del negocio.

const SECRET_ORIGINAL = process.env.ORDERS_API_SECRET

beforeEach(() => {
  process.env.ORDERS_API_SECRET = "secreto-de-prueba-largo"
})

afterEach(() => {
  if (SECRET_ORIGINAL === undefined) delete process.env.ORDERS_API_SECRET
  else process.env.ORDERS_API_SECRET = SECRET_ORIGINAL
})

describe("firma de mesa", () => {
  it("la misma mesa y sede dan siempre la misma firma (el QR no caduca)", () => {
    const a = signTableToken("Mesa 1", "sede-1")
    const b = signTableToken("Mesa 1", "sede-1")

    expect(a).toBeTruthy()
    expect(a).toBe(b)
  })

  it("no distingue mayúsculas ni espacios sobrantes", () => {
    expect(signTableToken("Mesa 1", "sede-1")).toBe(signTableToken("  mesa 1 ", "sede-1"))
  })

  it("cada mesa tiene la suya: con la de la Mesa 1 no se lee la Mesa 2", () => {
    expect(signTableToken("Mesa 1", "sede-1")).not.toBe(signTableToken("Mesa 2", "sede-1"))
    expect(isValidTableToken(signTableToken("Mesa 1", "sede-1"), "Mesa 2", "sede-1")).toBe(
      false,
    )
  })

  it("la misma mesa en otra sede tiene otra firma", () => {
    expect(signTableToken("Mesa 1", "sede-1")).not.toBe(signTableToken("Mesa 1", "sede-2"))
    expect(isValidTableToken(signTableToken("Mesa 1", "sede-1"), "Mesa 1", "sede-2")).toBe(
      false,
    )
  })

  it("la firma correcta valida", () => {
    expect(isValidTableToken(signTableToken("Barra", "sede-1"), "Barra", "sede-1")).toBe(
      true,
    )
  })

  it("no se puede adivinar el nombre de la mesa: sin firma no vale", () => {
    expect(isValidTableToken("", "Mesa 1", "sede-1")).toBe(false)
    expect(isValidTableToken("abcdef123456", "Mesa 1", "sede-1")).toBe(false)
    expect(isValidTableToken(null, "Mesa 1", "sede-1")).toBe(false)
    expect(isValidTableToken(undefined, "Mesa 1", "sede-1")).toBe(false)
  })

  it("una firma con la longitud cambiada no cuela", () => {
    const real = signTableToken("Mesa 1", "sede-1")
    expect(isValidTableToken(real.slice(0, -1), "Mesa 1", "sede-1")).toBe(false)
    expect(isValidTableToken(`${real}0`, "Mesa 1", "sede-1")).toBe(false)
  })

  it("la firma no revela el secreto: es corta y hexadecimal", () => {
    const token = signTableToken("Mesa 1", "sede-1")
    expect(token).toMatch(/^[0-9a-f]{12}$/)
    expect(token).not.toContain("secreto-de-prueba-largo")
  })
})

describe("negocio sin secreto configurado", () => {
  it("no se puede firmar, y el mecanismo se declara apagado", () => {
    process.env.ORDERS_API_SECRET = ""

    expect(isTableTokenEnabled()).toBe(false)
    expect(signTableToken("Mesa 1", "sede-1")).toBe("")
    // Y nada valida, para que el endpoint sepa que debe comportarse como antes
    // en vez de dejar a todos los comensales sin ver su cuenta.
    expect(isValidTableToken("lo-que-sea", "Mesa 1", "sede-1")).toBe(false)
  })

  it("con secreto, el mecanismo se declara activo", () => {
    expect(isTableTokenEnabled()).toBe(true)
  })
})
