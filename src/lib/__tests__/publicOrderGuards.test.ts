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

// Productos ARMABLES (buildable) — las 68 burgers de Brotherhood. El carrito
// (ProductCard.tsx) colapsa TODAS las secciones elegidas en UNA sola variación
// con el nombre unido por " · " y sin id. La primera versión del guard buscaba
// ese nombre compuesto entero, no lo encontraba y rechazaba el pedido: habría
// tumbado el producto principal del negocio. Evidencia: SIM-SEMANA/armable.md.
const ARMABLE = [
  {
    id: 201,
    name: "Burger Armable",
    price: 8,
    isActive: true,
    productType: "buildable" as const,
    variations: [
      {
        name: "Tipo de preparación",
        type: "single",
        values: [
          { name: "Smash", priceDelta: 0 },
          { name: "Clásica", priceDelta: 0 },
          { name: "A la parrilla", priceDelta: 0 },
        ],
      },
      {
        name: "Proteína",
        type: "single",
        values: [
          { name: "Carne", priceDelta: 0 },
          { name: "Mixta", priceDelta: 1.5 },
        ],
      },
      {
        name: "Custom Fries",
        type: "single",
        values: [
          { name: "Cheddar", priceDelta: 2 },
          { name: "Tocineta", priceDelta: 2.5 },
        ],
      },
    ],
    addons: [
      { name: "Tocineta", price: 1.5, maxQuantity: 2 },
      { name: "Queso americano", price: 1, maxQuantity: 2 },
    ],
  },
] as never[]

function armable(overrides: Record<string, unknown>) {
  return { id: 201, name: "Burger Armable", price: 8, quantity: 1, ...overrides }
}

describe("repricePublicOrderItems · productos ARMABLES (BH-SIM-006)", () => {
  it("una sola sección elegida sigue funcionando", () => {
    const r = repricePublicOrderItems([armable({ selectedVariation: { name: "Smash", priceDelta: 0 } })], ARMABLE)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.items[0].price).toBe(8)
  })

  it("dos secciones colapsadas en un nombre compuesto se resuelven parte por parte", () => {
    const r = repricePublicOrderItems(
      [armable({ selectedVariation: { name: "Smash · Carne", priceDelta: 0 } })],
      ARMABLE,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.items[0].price).toBe(8)
  })

  it("las tres secciones con recargo suman el delta REAL de cada parte", () => {
    const r = repricePublicOrderItems(
      [armable({ selectedVariation: { name: "Clásica · Mixta · Cheddar", priceDelta: 99 } })],
      ARMABLE,
    )
    expect(r.ok).toBe(true)
    // 8 + 0 + 1.5 + 2 = 11.5 (el priceDelta mentiroso de 99 se ignora)
    if (r.ok) expect(r.items[0].price).toBe(11.5)
  })

  it("el pedido más cargado: 3 secciones + adicionales con cantidad", () => {
    const r = repricePublicOrderItems(
      [
        armable({
          selectedVariation: { name: "A la parrilla · Mixta · Tocineta", priceDelta: 0 },
          selectedAddons: [
            { name: "Tocineta", priceDelta: 0, quantity: 2 },
            { name: "Queso americano", priceDelta: 0, quantity: 1 },
          ],
        }),
      ],
      ARMABLE,
    )
    expect(r.ok).toBe(true)
    // 8 + 1.5 + 2.5 + (1.5×2) + 1 = 16
    if (r.ok) expect(r.items[0].price).toBe(16)
  })

  it("deltas mentirosos en un armable NO abaratan el precio", () => {
    const r = repricePublicOrderItems(
      [
        armable({
          price: 0.5,
          selectedVariation: { name: "Clásica · Mixta · Cheddar", priceDelta: -7 },
          selectedAddons: [{ name: "Tocineta", priceDelta: -1, quantity: 2 }],
        }),
      ],
      ARMABLE,
    )
    expect(r.ok).toBe(true)
    // 8 + 1.5 + 2 + (1.5×2) = 14.5
    if (r.ok) expect(r.items[0].price).toBe(14.5)
  })

  it("si UNA parte del armado no existe, se rechaza el pedido entero", () => {
    const r = repricePublicOrderItems(
      [armable({ selectedVariation: { name: "Smash · Caviar de beluga", priceDelta: 0 } })],
      ARMABLE,
    )
    expect(r.ok).toBe(false)
  })

  it("el nombre de un GRUPO no cuenta como opción elegible", () => {
    const r = repricePublicOrderItems(
      [armable({ selectedVariation: { name: "Proteína · Carne", priceDelta: 0 } })],
      ARMABLE,
    )
    expect(r.ok).toBe(false)
  })

  it("tolera separadores con espaciado irregular", () => {
    const r = repricePublicOrderItems(
      [armable({ selectedVariation: { name: "Smash·Mixta ·  Cheddar", priceDelta: 0 } })],
      ARMABLE,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.items[0].price).toBe(11.5)
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
