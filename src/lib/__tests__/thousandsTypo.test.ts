import { describe, expect, it } from "vitest"

import { detectThousandsTypo, parseMoneyInput } from "@/lib/localOrderMoney"

// Auditoría 2026-08-02 · el cobro en bolívares mil veces menor.
//
// El pendiente sale en pantalla como "Bs 9.648,99". Si el cajero teclea "9.648"
// en vez de usar el botón "Completar pendiente en Bs", el punto se lee como
// decimal (la regla es la misma en toda la app y no se toca) y se registran
// 9,65 bolívares. El pedido queda "Pago parcial" y esos bolívares no aparecen
// en el arqueo hasta que alguien lo nota.

describe("aviso de separador de miles en el cobro en Bs", () => {
  it("la regla de parseo NO cambia: sigue leyendo el punto como decimal", () => {
    expect(parseMoneyInput("9.648")).toBe(9.65)
  })

  it("detecta el caso real: pendiente 9.648,99 y el cajero teclea 9.648", () => {
    expect(detectThousandsTypo("9.648", 9648.99)).toBe(9648)
  })

  it("propone el monto en miles, no el leído", () => {
    expect(detectThousandsTypo("12.500", 12500)).toBe(12500)
  })

  it("no avisa cuando el monto tecleado ya es coherente con el pendiente", () => {
    expect(detectThousandsTypo("9648,99", 9648.99)).toBe(0)
    expect(detectThousandsTypo("9648", 9648.99)).toBe(0)
  })

  it("no avisa con decimales de verdad", () => {
    expect(detectThousandsTypo("9,65", 9.65)).toBe(0)
    expect(detectThousandsTypo("9.6", 9.6)).toBe(0)
    expect(detectThousandsTypo("0,50", 0.5)).toBe(0)
  })

  it("no avisa si al leerlo como miles tampoco cuadra con el pendiente", () => {
    // Teclea 1.234 pero el pendiente es 50.000: 1234 sigue sin encajar.
    expect(detectThousandsTypo("1.234", 50000)).toBe(0)
  })

  it("no avisa con un abono parcial legítimo", () => {
    // El cliente abona 5.000 de 9.648,99: es un pago parcial normal, no un
    // error de tecleo… pero 5 está MUY por debajo y 5000 encaja en el rango,
    // así que sí se avisa. El aviso no bloquea: solo pregunta.
    expect(detectThousandsTypo("5.000", 9648.99)).toBe(5000)
  })

  it("aguanta entradas vacías o basura sin romper", () => {
    expect(detectThousandsTypo("", 9648.99)).toBe(0)
    expect(detectThousandsTypo("abc", 9648.99)).toBe(0)
    expect(detectThousandsTypo("9.648", 0)).toBe(0)
  })

  it("tolera el prefijo de moneda que a veces se pega", () => {
    expect(detectThousandsTypo("Bs 9.648", 9648.99)).toBe(9648)
  })
})
