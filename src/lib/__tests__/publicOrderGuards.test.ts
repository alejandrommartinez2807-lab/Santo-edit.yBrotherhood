// BH-SIM-001 (semana real, Día 1): el POST público de pedidos confiaba en el
// precio que mandaba el cliente — un pedido QR guardó la Doble Brutal de $9.50
// en $0.01 (evidencia: SIM-SEMANA/dia-1.md, pedido "SIM Manipulador dia-1").
// BH-SIM-002: la tasa de cambio del pedido también venía del cliente y el
// cobro en Bs usa la tasa DEL PEDIDO → tasa fabricada = pagar menos Bs.
// Estos tests definen el contrato del blindaje: el precio y la tasa de un
// pedido PÚBLICO los decide el servidor a partir del menú real de la sede.
import { describe, expect, it } from "vitest"
import {
  repricePublicOrderItems,
  resolvePublicExchangeRate,
} from "@/lib/publicOrderGuards"

const MENU = [
  {
    id: 101,
    name: "Burger Doble Brutal",
    price: 9.5,
    isActive: true,
    productType: "variations" as const,
    variations: [
      { id: "v-sencilla", name: "Sencilla", priceDelta: -1.5 },
      { id: "v-triple", name: "Triple", priceDelta: 2 },
    ],
    addons: [
      { id: "a-tocineta", name: "Tocineta extra", price: 1.5 },
      { id: "a-queso", name: "Queso extra", price: 1 },
    ],
  },
  {
    id: 102,
    name: "Refresco 1.5L",
    price: 2.5,
    isActive: true,
    productType: "normal" as const,
  },
] as never[]

function item(overrides: Record<string, unknown>) {
  return {
    id: 101,
    name: "Burger Doble Brutal",
    price: 9.5,
    quantity: 1,
    ...overrides,
  }
}

describe("repricePublicOrderItems (BH-SIM-001)", () => {
  it("acepta el precio legítimo del menú", () => {
    const result = repricePublicOrderItems([item({})], MENU)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(9.5)
  })

  it("REESCRIBE un precio fabricado por el cliente con el precio real del menú", () => {
    const result = repricePublicOrderItems([item({ price: 0.01 })], MENU)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(9.5)
  })

  it("suma el delta real de la variación aunque el cliente mienta", () => {
    const result = repricePublicOrderItems(
      [item({ price: 0.01, selectedVariation: { id: "v-triple", name: "Triple", priceDelta: -9 } })],
      MENU,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(11.5)
  })

  it("suma los adicionales con el precio del menú (por cantidad)", () => {
    const result = repricePublicOrderItems(
      [
        item({
          price: 1,
          selectedAddons: [
            { id: "a-tocineta", name: "Tocineta extra", priceDelta: 0.01, quantity: 2 },
            { id: "a-queso", name: "Queso extra", priceDelta: 0, quantity: 1 },
          ],
        }),
      ],
      MENU,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(13.5) // 9.5 + 1.5*2 + 1
  })

  it("rechaza un producto que no existe en el menú de la sede", () => {
    const result = repricePublicOrderItems([item({ id: 999999 })], MENU)
    expect(result.ok).toBe(false)
  })

  it("rechaza una variación inventada", () => {
    const result = repricePublicOrderItems(
      [item({ selectedVariation: { id: "v-hacker", name: "Gratis", priceDelta: -9.5 } })],
      MENU,
    )
    expect(result.ok).toBe(false)
  })

  it("rechaza un adicional inventado", () => {
    const result = repricePublicOrderItems(
      [item({ selectedAddons: [{ id: "x", name: "Combo fantasma", priceDelta: -5, quantity: 1 }] })],
      MENU,
    )
    expect(result.ok).toBe(false)
  })

  it("rechaza un producto inactivo", () => {
    const inactive = [{ ...(MENU[0] as Record<string, unknown>), isActive: false }] as never[]
    const result = repricePublicOrderItems([item({})], inactive)
    expect(result.ok).toBe(false)
  })

  it("acepta variación por nombre cuando no viaja id (carritos viejos)", () => {
    const result = repricePublicOrderItems(
      [item({ selectedVariation: { name: "Sencilla", priceDelta: -1.5 } })],
      MENU,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(8)
  })
})

describe("resolvePublicExchangeRate (BH-SIM-002)", () => {
  it("con tasa del servidor, la del cliente se ignora", () => {
    expect(resolvePublicExchangeRate(4, 40)).toBe(40)
  })
  it("sin tasa del servidor, sobrevive la del cliente (documentado)", () => {
    expect(resolvePublicExchangeRate(38.5, 0)).toBe(38.5)
  })
  it("tasa del cliente absurda sin servidor: se limpia a 0 (sin Bs)", () => {
    expect(resolvePublicExchangeRate(-3, 0)).toBe(0)
    expect(resolvePublicExchangeRate(Number.NaN, 0)).toBe(0)
  })
})
