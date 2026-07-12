import { describe, expect, it } from "vitest"
import {
  buildConfigWarnings,
  buildFormFromProduct,
  buildPremiumSummary,
  cleanRowsForSave,
  cleanVariationGroupsForSave,
  isFormDirty,
  normalizeAddonRows,
  normalizeIngredientRows,
  normalizeMenuProduct,
  normalizeMenuProducts,
  normalizeSalesChannels,
  normalizeVariationGroups,
  type MenuProduct,
} from "../domain"

function baseProduct(overrides: Partial<MenuProduct> = {}): MenuProduct {
  return normalizeMenuProduct({
    id: 1,
    name: "Perro clásico",
    category: "Perros",
    price: 3.5,
    ...overrides,
  }) as MenuProduct
}

describe("normalizeMenuProduct", () => {
  it("rechaza productos sin id o sin nombre", () => {
    expect(normalizeMenuProduct({ name: "Sin id" })).toBeNull()
    expect(normalizeMenuProduct({ id: 4 })).toBeNull()
    expect(normalizeMenuProduct(null)).toBeNull()
  })

  it("aplica defaults sensatos a campos faltantes", () => {
    const product = baseProduct()

    expect(product.category).toBe("Perros")
    expect(product.productType).toBe("normal")
    expect(product.salesChannels).toEqual(["local", "takeaway", "delivery"])
    expect(product.isActive).toBe(true)
    expect(product.inventoryDiscountEnabled).toBe(true)
  })

  it("ordena productos: activos primero, luego sortOrder y nombre", () => {
    const products = normalizeMenuProducts([
      { id: 1, name: "B", sortOrder: 2 },
      { id: 2, name: "A", sortOrder: 2 },
      { id: 3, name: "C", sortOrder: 1, isActive: false },
      { id: 4, name: "D", sortOrder: 1 },
    ])

    expect(products.map((product) => product.name)).toEqual(["D", "A", "B", "C"])
  })
})

describe("normalizeVariationGroups", () => {
  it("tolera datos viejos y descarta valores sin nombre", () => {
    const groups = normalizeVariationGroups([
      {
        name: "Tamaño",
        type: "single",
        values: [{ name: "Grande", priceDelta: "1,5" }, { name: "" }, null],
      },
      "no soy un objeto",
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].values).toHaveLength(1)
    expect(groups[0].values[0].priceDelta).toBe(1.5)
    expect(groups[0].maxSelections).toBe(1)
  })

  it("acepta JSON en texto (columna config vieja)", () => {
    const groups = normalizeVariationGroups(
      JSON.stringify([{ name: "Salsa", type: "multiple", maxSelections: 3, values: [{ name: "Tártara" }] }]),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe("multiple")
    expect(groups[0].maxSelections).toBe(3)
  })
})

describe("cleanVariationGroupsForSave", () => {
  it("descarta grupos sin nombre o sin valores y fuerza min <= max", () => {
    const cleaned = cleanVariationGroupsForSave([
      {
        name: "Tamaño",
        type: "multiple",
        required: true,
        minSelections: 5,
        maxSelections: 2,
        values: [
          { name: "Grande" },
          { name: "  " },
        ],
      },
      { name: "", type: "single", required: false, minSelections: 0, maxSelections: 1, values: [{ name: "X" }] },
      { name: "Vacío", type: "single", required: false, minSelections: 0, maxSelections: 1, values: [] },
    ])

    expect(cleaned).toHaveLength(1)
    expect(cleaned[0].values).toHaveLength(1)
    expect(cleaned[0].minSelections).toBeLessThanOrEqual(cleaned[0].maxSelections)
    expect(cleaned[0].minSelections).toBeGreaterThanOrEqual(1)
  })

  it("un grupo obligatorio nunca queda con min 0", () => {
    const cleaned = cleanVariationGroupsForSave([
      {
        name: "Proteína",
        type: "single",
        required: true,
        minSelections: 0,
        maxSelections: 1,
        values: [{ name: "Carne" }],
      },
    ])

    expect(cleaned[0].minSelections).toBe(1)
  })
})

describe("normalizeAddonRows / normalizeIngredientRows", () => {
  it("migra priceDelta viejo hacia price y aplica maxQuantity minimo 1", () => {
    const addons = normalizeAddonRows([{ name: "Tocineta", priceDelta: 0.5 }])

    expect(addons[0].price).toBe(0.5)
    expect(addons[0].maxQuantity).toBe(1)
  })

  it("conserva el vínculo de inventario de los ingredientes", () => {
    const rows = normalizeIngredientRows(
      [{ name: "Queso", inventoryItemId: "inv-9", inventoryUnit: "kg", inventoryQuantity: "0,05" }],
      "included",
    )

    expect(rows[0].inventoryItemId).toBe("inv-9")
    expect(rows[0].inventoryQuantity).toBe(0.05)
    expect(rows[0].included).toBe(true)
  })

  it("cleanRowsForSave descarta filas sin nombre", () => {
    expect(cleanRowsForSave([{ name: " " }, { name: "Queso" }])).toHaveLength(1)
  })
})

describe("normalizeSalesChannels", () => {
  it("filtra canales inválidos y evita lista vacía", () => {
    expect(normalizeSalesChannels(["local", "otro", "local"])).toEqual(["local"])
    expect(normalizeSalesChannels([])).toEqual(["local", "takeaway", "delivery"])
    expect(normalizeSalesChannels("basura")).toEqual(["local", "takeaway", "delivery"])
  })
})

describe("buildPremiumSummary", () => {
  it("resume la configuración en una sola línea", () => {
    const summary = buildPremiumSummary({
      productType: "variations",
      salesChannels: ["local"],
      variations: [
        { name: "Tamaño", type: "single", required: true, minSelections: 1, maxSelections: 1, values: [{ name: "G" }, { name: "P" }] },
      ],
      addons: [{ name: "Tocineta" }],
      removableIngredients: [],
      preparationMinutes: 10,
      requiresWaiterConfirmation: true,
      inventoryDiscountEnabled: false,
    })

    expect(summary).toContain("Con variaciones")
    expect(summary).toContain("Canales: Local")
    expect(summary).toContain("Variaciones: 2")
    expect(summary).toContain("Adicionales: 1")
    expect(summary).toContain("10 min")
    expect(summary).toContain("Confirma mesonero")
    expect(summary).toContain("Sin descuento automático")
  })

  it("cae a 'Configuración básica' sin detalles", () => {
    const summary = buildPremiumSummary({
      productType: "normal",
      salesChannels: ["local", "takeaway", "delivery"],
      variations: [],
      addons: [],
      removableIngredients: [],
      preparationMinutes: 0,
      requiresWaiterConfirmation: false,
      inventoryDiscountEnabled: true,
    })

    expect(summary).toBe("Configuración básica")
  })
})

describe("isFormDirty", () => {
  it("un formulario recién cargado no está sucio", () => {
    const product = baseProduct({
      variations: [{ name: "Tamaño", type: "single", values: [{ name: "Grande" }] }],
      selectionRules: { maxAddons: 3, notes: "regla" },
    })

    const form = buildFormFromProduct(product)

    expect(isFormDirty(form, product)).toBe(false)
  })

  it("detecta cualquier edición del formulario", () => {
    const product = baseProduct()
    const form = buildFormFromProduct(product)

    expect(isFormDirty({ ...form, preparationMinutes: "12" }, product)).toBe(true)
    expect(isFormDirty({ ...form, productType: "combo" }, product)).toBe(true)
  })

  it("sin producto seleccionado nunca está sucio", () => {
    expect(isFormDirty(buildFormFromProduct(baseProduct()), null)).toBe(false)
  })
})

describe("buildConfigWarnings", () => {
  it("advierte tipos marcados sin configuración", () => {
    const form = buildFormFromProduct(baseProduct())

    expect(buildConfigWarnings({ ...form, productType: "variations" })).toHaveLength(1)
    expect(buildConfigWarnings({ ...form, productType: "addons" })).toHaveLength(1)
    expect(buildConfigWarnings({ ...form, productType: "buildable" })).toHaveLength(1)
    expect(buildConfigWarnings({ ...form, productType: "combo" })).toHaveLength(1)
    expect(buildConfigWarnings({ ...form, salesChannels: [] })).toHaveLength(1)
    expect(buildConfigWarnings(form)).toHaveLength(0)
  })
})
