export type SupplierPaymentStatus = "Pendiente" | "Parcial" | "Pagado"

export type SupplierPayableInput = {
  id?: string
  supplierId?: string | null
  supplierName?: string
  purchaseDate?: string
  dueDate?: string | null
  documentNumber?: string
  totalUSD?: unknown
  totalVES?: unknown
  paidUSD?: unknown
  paidVES?: unknown
  paymentStatus?: string
}

export type SupplierPayableRow = {
  id: string
  supplierId: string | null
  supplierName: string
  purchaseDate: string
  dueDate: string
  documentNumber: string
  totalUSD: number
  totalVES: number
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  paymentStatus: SupplierPaymentStatus
  isOverdue: boolean
  isDueSoon: boolean
}

export type SupplierPayablesSummary = {
  purchases: number
  totalUSD: number
  totalVES: number
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  overdueCount: number
  overdueUSD: number
  overdueVES: number
  dueSoonCount: number
  dueSoonUSD: number
  dueSoonVES: number
}

export type SupplierPayablesReport = {
  summary: SupplierPayablesSummary
  byStatus: { status: SupplierPaymentStatus; count: number; totalUSD: number; pendingUSD: number }[]
  bySupplier: {
    supplierId: string | null
    supplierName: string
    count: number
    totalUSD: number
    paidUSD: number
    pendingUSD: number
    overdueUSD: number
  }[]
  overdue: SupplierPayableRow[]
  upcoming: SupplierPayableRow[]
}

export type ProductMarginInput = {
  id: number
  name: string
  category?: string
  price?: unknown
  isActive?: boolean
  // Respaldo de costo cuando el producto no tiene receta formal: ingredientes
  // incluidos vinculados a un insumo del inventario (con cantidad por unidad).
  includedIngredients?: {
    inventoryItemId?: string | null
    inventoryQuantity?: unknown
  }[]
}

export type InventoryCostInput = {
  id: string
  name?: string
  unit?: string
  equivalentCostUSD?: unknown
  costUSD?: unknown
  quantity?: unknown
  minimumStock?: unknown
  isActive?: boolean
}

export type InventoryRecipeInput = {
  id?: string
  productId: number
  productName: string
  productCategory?: string
  ingredients: { itemId: string; itemName?: string; quantity?: unknown; unit?: string }[]
  isActive?: boolean
}

export type SoldProductInput = {
  name: string
  quantity?: unknown
  totalUSD?: unknown
}

export type ProductMarginRow = {
  productId: number
  productName: string
  category: string
  salePriceUSD: number
  costUSD: number
  marginUSD: number
  marginPct: number | null
  hasRecipe: boolean
  missingIngredients: string[]
  unitsSold: number
  revenueUSD: number
  estimatedGrossProfitUSD: number
}

export type ProductMarginsReport = {
  summary: {
    menuProducts: number
    productsWithRecipe: number
    recipeCoveragePct: number
    avgMarginPct: number | null
    lowMarginCount: number
    noRecipeTopProductsCount: number
    estimatedGrossProfitUSD: number
  }
  items: ProductMarginRow[]
  lowMargin: ProductMarginRow[]
  noRecipeTopProducts: SoldProductInput[]
}

export type InventoryHealthReport = {
  lowStockCount: number
  lowStockItems: {
    id: string
    name: string
    quantity: number
    minimumStock: number
    unit: string
  }[]
  inactiveRecipes: number
  activeRecipes: number
}

export type ManagerAlert = {
  level: "danger" | "warning" | "info"
  title: string
  detail: string
  action: string
}

export function money(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function pct(value: number, total: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null
  return Math.round(((value / total) * 100 + Number.EPSILON) * 100) / 100
}

function normalizeStatus(value: unknown): SupplierPaymentStatus {
  const text = String(value || "").trim().toLowerCase()
  if (text === "pagado") return "Pagado"
  if (text === "parcial") return "Parcial"
  return "Pendiente"
}

function isoDate(value: unknown) {
  const text = String(value || "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function buildSupplierPayablesReport(
  purchases: SupplierPayableInput[],
  options: { today?: string; dueSoonDays?: number; limit?: number } = {},
): SupplierPayablesReport {
  const today = isoDate(options.today) || new Date().toISOString().slice(0, 10)
  const dueSoonEnd = addDays(today, Math.max(1, Number(options.dueSoonDays || 7)))
  const limit = Math.max(1, Math.round(Number(options.limit || 8)))

  const rows: SupplierPayableRow[] = purchases.map((p) => {
    const totalUSD = money(p.totalUSD)
    const totalVES = money(p.totalVES)
    const paidUSD = money(p.paidUSD)
    const paidVES = money(p.paidVES)
    const pendingUSD = Math.max(0, money(totalUSD - paidUSD))
    const pendingVES = Math.max(0, money(totalVES - paidVES))
    const status = pendingUSD <= 0.01 && pendingVES <= 0.01 && (totalUSD > 0 || totalVES > 0)
      ? "Pagado"
      : normalizeStatus(p.paymentStatus)
    const dueDate = isoDate(p.dueDate)
    const isOpen = status !== "Pagado" && (pendingUSD > 0.01 || pendingVES > 0.01)
    const isOverdue = isOpen && !!dueDate && dueDate < today
    const isDueSoon = isOpen && !!dueDate && dueDate >= today && dueDate <= dueSoonEnd

    return {
      id: String(p.id || ""),
      supplierId: p.supplierId ? String(p.supplierId) : null,
      supplierName: String(p.supplierName || "Sin proveedor").trim() || "Sin proveedor",
      purchaseDate: isoDate(p.purchaseDate),
      dueDate,
      documentNumber: String(p.documentNumber || "").trim(),
      totalUSD,
      totalVES,
      paidUSD,
      paidVES,
      pendingUSD,
      pendingVES,
      paymentStatus: status,
      isOverdue,
      isDueSoon,
    }
  })

  const summary = rows.reduce<SupplierPayablesSummary>((acc, row) => {
    acc.purchases += 1
    acc.totalUSD += row.totalUSD
    acc.totalVES += row.totalVES
    acc.paidUSD += row.paidUSD
    acc.paidVES += row.paidVES
    acc.pendingUSD += row.pendingUSD
    acc.pendingVES += row.pendingVES
    if (row.isOverdue) {
      acc.overdueCount += 1
      acc.overdueUSD += row.pendingUSD
      acc.overdueVES += row.pendingVES
    }
    if (row.isDueSoon) {
      acc.dueSoonCount += 1
      acc.dueSoonUSD += row.pendingUSD
      acc.dueSoonVES += row.pendingVES
    }
    return acc
  }, {
    purchases: 0,
    totalUSD: 0,
    totalVES: 0,
    paidUSD: 0,
    paidVES: 0,
    pendingUSD: 0,
    pendingVES: 0,
    overdueCount: 0,
    overdueUSD: 0,
    overdueVES: 0,
    dueSoonCount: 0,
    dueSoonUSD: 0,
    dueSoonVES: 0,
  })

  summary.totalUSD = money(summary.totalUSD)
  summary.totalVES = money(summary.totalVES)
  summary.paidUSD = money(summary.paidUSD)
  summary.paidVES = money(summary.paidVES)
  summary.pendingUSD = money(summary.pendingUSD)
  summary.pendingVES = money(summary.pendingVES)
  summary.overdueUSD = money(summary.overdueUSD)
  summary.overdueVES = money(summary.overdueVES)
  summary.dueSoonUSD = money(summary.dueSoonUSD)
  summary.dueSoonVES = money(summary.dueSoonVES)

  const statusOrder: SupplierPaymentStatus[] = ["Pendiente", "Parcial", "Pagado"]
  const byStatusMap = new Map<SupplierPaymentStatus, { status: SupplierPaymentStatus; count: number; totalUSD: number; pendingUSD: number }>()
  const bySupplierMap = new Map<string, SupplierPayablesReport["bySupplier"][number]>()

  for (const row of rows) {
    const s = byStatusMap.get(row.paymentStatus) || { status: row.paymentStatus, count: 0, totalUSD: 0, pendingUSD: 0 }
    s.count += 1
    s.totalUSD += row.totalUSD
    s.pendingUSD += row.pendingUSD
    byStatusMap.set(row.paymentStatus, s)

    const supplierKey = row.supplierId || row.supplierName
    const supplier = bySupplierMap.get(supplierKey) || {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      count: 0,
      totalUSD: 0,
      paidUSD: 0,
      pendingUSD: 0,
      overdueUSD: 0,
    }
    supplier.count += 1
    supplier.totalUSD += row.totalUSD
    supplier.paidUSD += row.paidUSD
    supplier.pendingUSD += row.pendingUSD
    if (row.isOverdue) supplier.overdueUSD += row.pendingUSD
    bySupplierMap.set(supplierKey, supplier)
  }

  return {
    summary,
    byStatus: [...byStatusMap.values()]
      .map((row) => ({ ...row, totalUSD: money(row.totalUSD), pendingUSD: money(row.pendingUSD) }))
      .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)),
    bySupplier: [...bySupplierMap.values()]
      .map((row) => ({
        ...row,
        totalUSD: money(row.totalUSD),
        paidUSD: money(row.paidUSD),
        pendingUSD: money(row.pendingUSD),
        overdueUSD: money(row.overdueUSD),
      }))
      .sort((a, b) => b.pendingUSD - a.pendingUSD)
      .slice(0, limit),
    overdue: rows
      .filter((row) => row.isOverdue)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.pendingUSD - a.pendingUSD)
      .slice(0, limit),
    upcoming: rows
      .filter((row) => row.isDueSoon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.pendingUSD - a.pendingUSD)
      .slice(0, limit),
  }
}

export function buildProductMarginsReport(input: {
  products: ProductMarginInput[]
  recipes: InventoryRecipeInput[]
  inventoryItems: InventoryCostInput[]
  topProducts?: SoldProductInput[]
  lowMarginThresholdPct?: number
}): ProductMarginsReport {
  const lowMarginThreshold = Number.isFinite(Number(input.lowMarginThresholdPct))
    ? Number(input.lowMarginThresholdPct)
    : 35
  const itemMap = new Map(input.inventoryItems.map((item) => [String(item.id), item]))
  const recipeByProductId = new Map(input.recipes.filter((recipe) => recipe.isActive !== false).map((recipe) => [Number(recipe.productId), recipe]))
  const soldByName = new Map((input.topProducts || []).map((sold) => [String(sold.name || "").trim().toLowerCase(), sold]))

  const items: ProductMarginRow[] = input.products
    .filter((product) => product.isActive !== false)
    .map((product) => {
      const recipe = recipeByProductId.get(Number(product.id))
      const missingIngredients: string[] = []
      let costUSD = 0
      // Respaldo: si no hay receta, usa los ingredientes incluidos que estén
      // vinculados a un insumo del inventario (mismo cálculo de costo).
      const linkedIngredients = recipe
        ? []
        : (product.includedIngredients || []).filter((ingredient) => String(ingredient.inventoryItemId || "").trim())
      const hasCostSource = Boolean(recipe) || linkedIngredients.length > 0
      if (recipe) {
        for (const ingredient of recipe.ingredients || []) {
          const item = itemMap.get(String(ingredient.itemId))
          const qty = money(ingredient.quantity)
          if (!item) {
            missingIngredients.push(String(ingredient.itemName || ingredient.itemId || "Insumo sin nombre"))
            continue
          }
          const unitCost = money(item.equivalentCostUSD) || money(item.costUSD)
          costUSD += unitCost * qty
        }
      } else {
        for (const ingredient of linkedIngredients) {
          const item = itemMap.get(String(ingredient.inventoryItemId))
          const qty = money(ingredient.inventoryQuantity) || 1
          if (!item) continue
          const unitCost = money(item.equivalentCostUSD) || money(item.costUSD)
          costUSD += unitCost * qty
        }
      }
      const salePriceUSD = money(product.price)
      const marginUSD = money(salePriceUSD - costUSD)
      const marginPct = salePriceUSD > 0 ? money((marginUSD / salePriceUSD) * 100) : null
      const sold = soldByName.get(String(product.name || "").trim().toLowerCase())
      const unitsSold = sold ? money(sold.quantity) : 0
      const revenueUSD = sold ? money(sold.totalUSD) : 0
      const estimatedGrossProfitUSD = unitsSold > 0 ? money(marginUSD * unitsSold) : 0

      return {
        productId: Number(product.id),
        productName: String(product.name || "Producto sin nombre"),
        category: String(product.category || "Otros"),
        salePriceUSD,
        costUSD: money(costUSD),
        marginUSD,
        marginPct,
        hasRecipe: hasCostSource,
        missingIngredients,
        unitsSold,
        revenueUSD,
        estimatedGrossProfitUSD,
      }
    })

  const withMargin = items.filter((item) => item.hasRecipe && item.marginPct !== null)
  const avgMarginPct = withMargin.length
    ? money(withMargin.reduce((sum, item) => sum + Number(item.marginPct || 0), 0) / withMargin.length)
    : null
  const topNamesWithoutRecipe = (input.topProducts || []).filter((sold) => {
    const name = String(sold.name || "").trim().toLowerCase()
    return !!name && !items.some((item) => item.productName.trim().toLowerCase() === name && item.hasRecipe)
  })

  return {
    summary: {
      menuProducts: items.length,
      productsWithRecipe: withMargin.length,
      recipeCoveragePct: items.length ? money((withMargin.length / items.length) * 100) : 0,
      avgMarginPct,
      lowMarginCount: items.filter((item) => item.hasRecipe && item.marginPct !== null && item.marginPct < lowMarginThreshold).length,
      noRecipeTopProductsCount: topNamesWithoutRecipe.length,
      estimatedGrossProfitUSD: money(items.reduce((sum, item) => sum + item.estimatedGrossProfitUSD, 0)),
    },
    items: [...items].sort((a, b) => {
      const aPct = a.marginPct ?? 999
      const bPct = b.marginPct ?? 999
      return aPct - bPct
    }),
    lowMargin: items
      .filter((item) => item.hasRecipe && item.marginPct !== null && item.marginPct < lowMarginThreshold)
      .sort((a, b) => Number(a.marginPct || 0) - Number(b.marginPct || 0))
      .slice(0, 8),
    noRecipeTopProducts: topNamesWithoutRecipe.slice(0, 8),
  }
}

export function buildInventoryHealthReport(input: {
  inventoryItems: InventoryCostInput[]
  recipes: InventoryRecipeInput[]
}): InventoryHealthReport {
  const lowStockItems = input.inventoryItems
    .filter((item) => item.isActive !== false)
    .map((item) => ({
      id: String(item.id || ""),
      name: String(item.name || "Insumo"),
      quantity: money(item.quantity),
      minimumStock: money(item.minimumStock),
      unit: String(item.unit || "unidades"),
    }))
    .filter((item) => item.minimumStock > 0 && item.quantity <= item.minimumStock)
    .sort((a, b) => (a.quantity / Math.max(1, a.minimumStock)) - (b.quantity / Math.max(1, b.minimumStock)))
    .slice(0, 10)

  return {
    lowStockCount: lowStockItems.length,
    lowStockItems,
    inactiveRecipes: input.recipes.filter((recipe) => recipe.isActive === false).length,
    activeRecipes: input.recipes.filter((recipe) => recipe.isActive !== false).length,
  }
}

export function buildManagerAlerts(input: {
  payables: SupplierPayablesReport
  margins: ProductMarginsReport
  inventory: InventoryHealthReport
}): ManagerAlert[] {
  const alerts: ManagerAlert[] = []
  if (input.payables.summary.overdueCount > 0) {
    alerts.push({
      level: "danger",
      title: `${input.payables.summary.overdueCount} cuenta(s) vencida(s)` ,
      detail: `Hay ${money(input.payables.summary.overdueUSD)} USD pendientes vencidos a proveedores.`,
      action: "Revisa Compras y registra abonos o renegocia vencimientos.",
    })
  }
  if (input.payables.summary.dueSoonCount > 0) {
    alerts.push({
      level: "warning",
      title: `${input.payables.summary.dueSoonCount} pago(s) vencen pronto`,
      detail: `Vencen en los próximos días ${money(input.payables.summary.dueSoonUSD)} USD pendientes.`,
      action: "Prioriza caja para pagos cercanos y evita atrasos con proveedores.",
    })
  }
  if (input.margins.summary.lowMarginCount > 0) {
    alerts.push({
      level: "warning",
      title: `${input.margins.summary.lowMarginCount} producto(s) con margen bajo`,
      detail: "Hay recetas cuyo costo deja poco margen frente al precio de venta.",
      action: "Ajusta precio, porción o costo de insumos en Inventario/Recetas.",
    })
  }
  if (input.margins.summary.noRecipeTopProductsCount > 0) {
    alerts.push({
      level: "info",
      title: "Top productos sin receta",
      detail: `${input.margins.summary.noRecipeTopProductsCount} producto(s) vendidos no tienen receta activa para estimar margen.`,
      action: "Crea recetas para que el reporte de margen sea más exacto.",
    })
  }
  if (input.inventory.lowStockCount > 0) {
    alerts.push({
      level: "danger",
      title: `${input.inventory.lowStockCount} insumo(s) bajo mínimo`,
      detail: "Hay insumos activos por debajo o al nivel del stock mínimo.",
      action: "Revisa Inventario y registra compra o ajuste antes de quedarte sin stock.",
    })
  }
  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      title: "Sin alertas críticas",
      detail: "No se detectaron vencimientos, bajo stock ni márgenes bajos con los datos actuales.",
      action: "Mantén recetas y compras actualizadas para que este panel siga siendo útil.",
    })
  }
  return alerts.slice(0, 8)
}
