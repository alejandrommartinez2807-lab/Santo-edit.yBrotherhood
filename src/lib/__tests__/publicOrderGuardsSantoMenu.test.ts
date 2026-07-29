// Porte del blindaje BH-SIM-001/002 a SANTO PERRITO (main): antes de fusionar
// se prueba la forma de SU menú, igual que se hizo con el armable de
// Brotherhood (BH-SIM-006 nació exactamente de no hacer esto). El menú real
// de Santo Perrito vive en su base y lo compone el editor estructurado
// (menu-avanzado): estos fixtures reproducen las formas que ese editor emite
// y lo que el ProductCard de main envía en el carrito — incluida la colapsada
// multi-sección con nombres unidos por " · " y sin id.
import { describe, expect, it } from "vitest"
import {
  repricePublicOrderItems,
  resolvePublicExchangeRate,
} from "@/lib/publicOrderGuards"

// Formas del editor de menú de main (constructor de variaciones/adicionales/
// ingredientes + grupos anidados con `values`).
const MENU_SANTO = [
  {
    id: 202608020001,
    name: "Perro Santo Clásico",
    price: 4.5,
    isActive: true,
    productType: "variations" as const,
    variations: [
      { id: "v-sencillo", name: "Sencillo", priceDelta: 0 },
      { id: "v-doble", name: "Doble salchicha", priceDelta: 1.5 },
    ],
    addons: [
      { id: "a-queso", name: "Queso rallado", price: 0.75 },
      { id: "a-tocineta", name: "Tocineta", price: 1 },
    ],
    removableIngredients: [
      { id: "r-cebolla", name: "Cebolla", extraPrice: 0 },
    ],
  },
  {
    id: 202608020002,
    name: "Perro Armable",
    price: 5,
    isActive: true,
    productType: "buildable" as const,
    // Grupos anidados como los emite el editor: el nombre del grupo NO es
    // elegible, solo sus opciones.
    variations: [
      {
        name: "Salchicha",
        values: [
          { id: "s-polaca", name: "Polaca", priceDelta: 0 },
          { id: "s-artesanal", name: "Artesanal", priceDelta: 1 },
        ],
      },
      {
        name: "Toppings",
        values: [
          { id: "t-queso", name: "Queso fundido", priceDelta: 0.5 },
          { id: "t-papitas", name: "Papitas trituradas", priceDelta: 0.25 },
        ],
      },
    ],
    addons: [{ id: "a-refresco", name: "Refresco de lata", price: 1.5 }],
  },
  {
    id: 202608020003,
    name: "Combo Perro + Papas + Refresco",
    price: 8,
    isActive: true,
    productType: "combo" as const,
  },
  {
    id: 202608020004,
    name: "Perro de ayer (inactivo)",
    price: 1,
    isActive: false,
    productType: "normal" as const,
  },
] as never[]

describe("guard de precios con la forma del menú de Santo Perrito", () => {
  it("perro con variación y adicionales legítimos pasa y paga exacto", () => {
    const result = repricePublicOrderItems(
      [
        {
          id: 202608020001,
          name: "Perro Santo Clásico",
          price: 4.5,
          quantity: 2,
          selectedVariation: { id: "v-doble", name: "Doble salchicha", priceDelta: 1.5 },
          selectedAddons: [
            { id: "a-queso", name: "Queso rallado", priceDelta: 0.75, quantity: 1 },
            { id: "a-tocineta", name: "Tocineta", priceDelta: 1, quantity: 2 },
          ],
        },
      ],
      MENU_SANTO,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(8.75) // 4.5 + 1.5 + 0.75 + 1*2
  })

  it("el armable colapsado por el ProductCard de main ('Polaca · Queso fundido') pasa con los deltas reales", () => {
    const result = repricePublicOrderItems(
      [
        {
          id: 202608020002,
          name: "Perro Armable",
          price: 0.01, // el cliente miente
          quantity: 1,
          selectedVariation: {
            // Así lo emite ProductCard: sin id, nombres unidos por " · " y
            // un delta que el cliente puede fabricar.
            name: "Polaca · Queso fundido · Papitas trituradas",
            priceDelta: -99,
          },
        },
      ],
      MENU_SANTO,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(5.75) // 5 + 0 + 0.5 + 0.25
  })

  it("el nombre de un GRUPO del armable no es un armado válido", () => {
    const result = repricePublicOrderItems(
      [
        {
          id: 202608020002,
          name: "Perro Armable",
          price: 5,
          quantity: 1,
          selectedVariation: { name: "Salchicha · Polaca", priceDelta: 0 },
        },
      ],
      MENU_SANTO,
    )
    expect(result.ok).toBe(false)
  })

  it("combo con precio fabricado se reescribe al precio real", () => {
    const result = repricePublicOrderItems(
      [{ id: 202608020003, name: "Combo Perro + Papas + Refresco", price: 0.5, quantity: 1 }],
      MENU_SANTO,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(8)
  })

  it("un producto desactivado del menú de Santo no se puede pedir", () => {
    const result = repricePublicOrderItems(
      [{ id: 202608020004, name: "Perro de ayer (inactivo)", price: 1, quantity: 1 }],
      MENU_SANTO,
    )
    expect(result.ok).toBe(false)
  })

  it("carrito viejo que referencia por NOMBRE (sin id vigente) sigue funcionando", () => {
    const result = repricePublicOrderItems(
      [
        {
          id: 202608020001,
          name: "Perro Santo Clásico",
          price: 4.5,
          quantity: 1,
          selectedVariation: { name: "Sencillo", priceDelta: 0 },
        },
      ],
      MENU_SANTO,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items[0].price).toBe(4.5)
  })
})

describe("tasa del servidor con la config de Santo Perrito", () => {
  it("la tasa del negocio pisa la del cliente; sin tasa del servidor sobrevive la del cliente", () => {
    expect(resolvePublicExchangeRate(4, 40)).toBe(40)
    expect(resolvePublicExchangeRate(38.5, 0)).toBe(38.5)
  })
})
