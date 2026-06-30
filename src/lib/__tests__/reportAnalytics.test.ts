import { describe, expect, it } from "vitest"
import {
  buildInventoryHealthReport,
  buildManagerAlerts,
  buildProductMarginsReport,
  buildSupplierPayablesReport,
} from "../reportAnalytics"

describe("reportAnalytics", () => {
  it("resume cuentas por pagar vencidas, próximas y por proveedor", () => {
    const report = buildSupplierPayablesReport([
      { id: "p1", supplierId: "s1", supplierName: "Proveedor A", dueDate: "2026-06-20", totalUSD: 100, paidUSD: 25, paymentStatus: "Parcial" },
      { id: "p2", supplierId: "s1", supplierName: "Proveedor A", dueDate: "2026-07-02", totalUSD: 50, paidUSD: 0, paymentStatus: "Pendiente" },
      { id: "p3", supplierId: "s2", supplierName: "Proveedor B", dueDate: "2026-06-28", totalUSD: 30, paidUSD: 30, paymentStatus: "Pagado" },
    ], { today: "2026-06-30", dueSoonDays: 7 })

    expect(report.summary.pendingUSD).toBe(125)
    expect(report.summary.overdueUSD).toBe(75)
    expect(report.summary.dueSoonUSD).toBe(50)
    expect(report.bySupplier[0]).toMatchObject({ supplierName: "Proveedor A", pendingUSD: 125, overdueUSD: 75 })
    expect(report.overdue).toHaveLength(1)
    expect(report.upcoming).toHaveLength(1)
  })

  it("calcula margen por receta y detecta top vendidos sin receta", () => {
    const report = buildProductMarginsReport({
      products: [
        { id: 1, name: "Perro Especial", category: "Perros", price: 5 },
        { id: 2, name: "Combo Familiar", category: "Combos", price: 12 },
      ],
      inventoryItems: [
        { id: "pan", name: "Pan", equivalentCostUSD: 0.5 },
        { id: "salchicha", name: "Salchicha", equivalentCostUSD: 0.9 },
      ],
      recipes: [
        { productId: 1, productName: "Perro Especial", ingredients: [
          { itemId: "pan", itemName: "Pan", quantity: 1 },
          { itemId: "salchicha", itemName: "Salchicha", quantity: 1 },
        ]},
      ],
      topProducts: [
        { name: "Perro Especial", quantity: 10, totalUSD: 50 },
        { name: "Combo Familiar", quantity: 3, totalUSD: 36 },
      ],
      lowMarginThresholdPct: 35,
    })

    expect(report.summary.productsWithRecipe).toBe(1)
    expect(report.summary.recipeCoveragePct).toBe(50)
    expect(report.items.find((p) => p.productName === "Perro Especial")?.costUSD).toBe(1.4)
    expect(report.items.find((p) => p.productName === "Perro Especial")?.estimatedGrossProfitUSD).toBe(36)
    expect(report.noRecipeTopProducts[0].name).toBe("Combo Familiar")
  })

  it("arma alertas para dueño con vencidos, bajo margen y stock bajo", () => {
    const payables = buildSupplierPayablesReport([
      { id: "p1", supplierName: "Proveedor", dueDate: "2026-06-01", totalUSD: 40, paidUSD: 0 },
    ], { today: "2026-06-30" })
    const margins = buildProductMarginsReport({
      products: [{ id: 1, name: "Producto", price: 5 }],
      inventoryItems: [{ id: "i1", equivalentCostUSD: 4 }],
      recipes: [{ productId: 1, productName: "Producto", ingredients: [{ itemId: "i1", quantity: 1 }] }],
      topProducts: [{ name: "Sin receta", quantity: 2, totalUSD: 20 }],
      lowMarginThresholdPct: 35,
    })
    const inventory = buildInventoryHealthReport({
      inventoryItems: [{ id: "i1", name: "Harina", quantity: 1, minimumStock: 5, unit: "kg" }],
      recipes: [],
    })

    const alerts = buildManagerAlerts({ payables, margins, inventory })
    expect(alerts.some((a) => a.title.includes("vencida"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("margen bajo"))).toBe(true)
    expect(alerts.some((a) => a.title.includes("bajo mínimo"))).toBe(true)
  })
})
