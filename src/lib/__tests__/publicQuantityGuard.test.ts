import { describe, expect, it } from "vitest"

import { repricePublicOrderItems } from "@/lib/publicOrderGuards"

// Auditoría 2026-08-02 · la cantidad viajaba sin validar.
//
// El precio se recalculaba contra el menú real, pero la CANTIDAD entraba tal
// cual desde el cliente. Con 0,05 se creaba la cabecera del pedido y reventaba
// el insert de las líneas: quedaba un pedido fantasma con total inventado y sin
// productos, que había que anular a mano antes de poder cerrar el día. Con
// 500000 entraba entero un pedido de seis millones a la cola de cocina.

const MENU = [
  {
    id: 12,
    name: "Doble Smash",
    price: 9,
    isActive: true,
  },
] as unknown as Parameters<typeof repricePublicOrderItems>[1]

function pedir(quantity: unknown) {
  return repricePublicOrderItems(
    [{ id: 12, name: "Doble Smash", price: 9, quantity }],
    MENU,
  )
}

describe("cantidad en pedidos del público", () => {
  it("una cantidad normal pasa", () => {
    const resultado = pedir(2)
    expect(resultado.ok).toBe(true)
  })

  it("una unidad pasa", () => {
    expect(pedir(1).ok).toBe(true)
  })

  it("rechaza fracciones (el pedido fantasma sin líneas)", () => {
    const resultado = pedir(0.05)
    expect(resultado.ok).toBe(false)
  })

  it("rechaza cero y negativos", () => {
    expect(pedir(0).ok).toBe(false)
    expect(pedir(-3).ok).toBe(false)
  })

  it("rechaza la cantidad absurda (pedido de seis millones)", () => {
    expect(pedir(500000).ok).toBe(false)
  })

  it("rechaza texto y basura", () => {
    expect(pedir("muchas").ok).toBe(false)
    expect(pedir(null).ok).toBe(false)
    expect(pedir(undefined).ok).toBe(false)
    expect(pedir(Number.NaN).ok).toBe(false)
    expect(pedir(Infinity).ok).toBe(false)
  })

  it("el tope deja pasar 99 y corta en 100", () => {
    expect(pedir(99).ok).toBe(true)
    expect(pedir(100).ok).toBe(false)
  })

  it("el mensaje habla de cantidad, no de que cambió el menú", () => {
    const resultado = pedir(0.05)
    if (resultado.ok) throw new Error("debía fallar")
    expect(resultado.error).toMatch(/cantidad/i)
  })
})
