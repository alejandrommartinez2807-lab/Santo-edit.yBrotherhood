// Lógica pura del editor de menú avanzado: tipos, normalizadores y helpers.
// Sin React ni fetch directo, para poder probarla con vitest.

import {
  type Product,
  type ProductPaymentMode,
  type ProductSalesChannel,
  type ProductType,
} from "@/data/products"

export const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

export const SALES_CHANNEL_OPTIONS: {
  value: ProductSalesChannel
  label: string
}[] = [
  { value: "local", label: "Local" },
  { value: "takeaway", label: "Para llevar" },
  { value: "delivery", label: "Delivery" },
]

export const PRODUCT_TYPE_OPTIONS: {
  value: ProductType
  label: string
  helper: string
}[] = [
  {
    value: "normal",
    label: "Normal",
    helper: "Producto directo con precio fijo.",
  },
  {
    value: "variations",
    label: "Con variaciones",
    helper: "Tamaños, sabores o presentaciones con posible ajuste de precio.",
  },
  {
    value: "addons",
    label: "Con adicionales",
    helper: "Extras que pueden sumarse al producto.",
  },
  {
    value: "buildable",
    label: "Armable",
    helper: "Producto armado por partes, ingredientes o selección del personal.",
  },
  {
    value: "combo",
    label: "Combo",
    helper: "Producto compuesto por varios artículos del menú.",
  },
]

export type OptionValue = {
  id?: string
  name: string
  priceDelta?: number
  price?: number
  isActive?: boolean
  sortOrder?: number
  maxQuantity?: number
  category?: string
  included?: boolean
  removable?: boolean
  extraPrice?: number
  // Vínculo opcional con un insumo del inventario (para descuento de stock real).
  inventoryItemId?: string | null
  inventoryUnit?: string
  inventoryQuantity?: number
}

export type InventoryOption = {
  id: string
  name: string
  unit: string
}

// Artículo que compone un combo. productId referencia al producto del menú;
// name queda denormalizado para que cocina/caja lo vean aunque el menú cambie.
export type ComboItemRow = {
  id?: string
  productId?: number
  name: string
  quantity?: number
  sortOrder?: number
}

export type VariationGroup = {
  id?: string
  name: string
  type: "single" | "multiple"
  required: boolean
  minSelections: number
  maxSelections: number
  values: OptionValue[]
  sortOrder?: number
}

export type SelectionRules = {
  notes?: string
  minAddons?: number
  maxAddons?: number
  requiresStaffReview?: boolean
}

export type MenuProduct = Product & {
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type AdvancedForm = {
  productType: ProductType
  salesChannels: ProductSalesChannel[]
  variations: VariationGroup[]
  addons: OptionValue[]
  comboItems: ComboItemRow[]
  includedIngredients: OptionValue[]
  removableIngredients: OptionValue[]
  preparationMinutes: string
  requiresWaiterConfirmation: boolean
  inventoryDiscountEnabled: boolean
  maxAddons: string
  internalRulesNote: string
}

export type ApiResponse = {
  ok?: boolean
  error?: string
  menuProducts?: MenuProduct[]
  menuProduct?: MenuProduct
  access?: {
    allowed?: boolean
    message?: string
    reason?: string
    moduleLabel?: string
    minimumPlanLabel?: string
  }
}

export const EMPTY_FORM: AdvancedForm = {
  productType: "normal",
  salesChannels: ["local", "takeaway", "delivery"],
  variations: [],
  addons: [],
  comboItems: [],
  includedIngredients: [],
  removableIngredients: [],
  preparationMinutes: "",
  requiresWaiterConfirmation: false,
  inventoryDiscountEnabled: true,
  maxAddons: "",
  internalRulesNote: "",
}

export function randomRowId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeNumber(value: unknown) {
  const numberValue = Number(String(value || "").replace(",", "."))

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

export function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round(numberValue)
}

export function normalizePaymentMode(value: unknown): ProductPaymentMode {
  return value === "divisa" ? "divisa" : "mixto"
}

export function normalizeProductType(value: unknown): ProductType {
  if (
    value === "variations" ||
    value === "addons" ||
    value === "buildable" ||
    value === "combo"
  ) {
    return value
  }

  return "normal"
}

export function normalizeSalesChannels(value: unknown): ProductSalesChannel[] {
  const allowedChannels = SALES_CHANNEL_OPTIONS.map((channel) => channel.value)
  const rawList = Array.isArray(value) ? value : []
  const selectedChannels = rawList
    .map((item) => String(item || "").trim())
    .filter((item): item is ProductSalesChannel =>
      allowedChannels.includes(item as ProductSalesChannel)
    )

  return selectedChannels.length
    ? Array.from(new Set(selectedChannels))
    : ["local", "takeaway", "delivery"]
}

export function normalizeUnknownArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value

  const rawValue = String(value || "").trim()

  if (!rawValue) return []

  try {
    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

export function normalizeSelectionRules(value: unknown): SelectionRules {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as SelectionRules
  }

  return {}
}

export function normalizeMenuProduct(value: unknown): MenuProduct | null {
  const source = (value || {}) as Partial<MenuProduct>
  const id = Number(source.id || 0)

  if (!Number.isFinite(id) || id <= 0 || !source.name) return null

  return {
    id: Math.round(id),
    name: String(source.name || "").trim(),
    category: String(source.category || "Otros").trim() || "Otros",
    description: String(source.description || "").trim(),
    price: normalizeNumber(source.price),
    image: String(source.image || "").trim(),
    paymentMode: normalizePaymentMode(source.paymentMode),
    isActive: source.isActive !== false,
    isFeatured: source.isFeatured === true,
    sortOrder: normalizeNumber(source.sortOrder || source.id || 9999),
    createdAt: String(source.createdAt || "").trim(),
    updatedAt: String(source.updatedAt || "").trim(),
    productType: normalizeProductType(source.productType),
    salesChannels: normalizeSalesChannels(source.salesChannels),
    variations: normalizeUnknownArray(source.variations),
    addons: normalizeUnknownArray(source.addons),
    includedIngredients: normalizeUnknownArray(source.includedIngredients),
    removableIngredients: normalizeUnknownArray(source.removableIngredients),
    comboItems: normalizeUnknownArray(source.comboItems),
    selectionRules: normalizeSelectionRules(source.selectionRules),
    preparationMinutes: normalizePositiveInteger(source.preparationMinutes),
    requiresWaiterConfirmation: source.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: source.inventoryDiscountEnabled !== false,
    premiumSummary: String(source.premiumSummary || "").trim(),
  }
}

export function normalizeMenuProducts(value: unknown): MenuProduct[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeMenuProduct)
    .filter((product): product is MenuProduct => Boolean(product))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })
}

export function normalizeTextName(value: unknown) {
  return String(value || "").trim()
}

export function optionId(prefix: string, index: number, name: string) {
  return `${prefix}-${index + 1}-${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 28)}`
}

// --- Normalizadores estructurados ---
// Leen lo guardado (arrays en la columna `config`) hacia el estado del editor,
// tolerando datos viejos con campos faltantes y aplicando defaults sensatos.

export function normalizeVariationGroups(value: unknown): VariationGroup[] {
  return normalizeUnknownArray(value)
    .map((raw, groupIndex): VariationGroup | null => {
      if (!raw || typeof raw !== "object") return null

      const source = raw as Partial<VariationGroup> & { values?: unknown }
      const name = normalizeTextName(source.name)
      const type: "single" | "multiple" = source.type === "multiple" ? "multiple" : "single"

      const values = normalizeUnknownArray(source.values)
        .map((rawValue, valueIndex): OptionValue | null => {
          if (!rawValue || typeof rawValue !== "object") return null

          const child = rawValue as Partial<OptionValue>
          const valueName = normalizeTextName(child.name)

          if (!valueName) return null

          return {
            id: normalizeTextName(child.id) || optionId("opcion", valueIndex, valueName),
            name: valueName,
            priceDelta: normalizeNumber(child.priceDelta),
            isActive: child.isActive !== false,
            sortOrder: valueIndex + 1,
          }
        })
        .filter((item): item is OptionValue => Boolean(item))

      const maxSelections = normalizePositiveInteger(source.maxSelections)
      const minSelections = normalizePositiveInteger(source.minSelections)

      return {
        id: normalizeTextName(source.id) || optionId("grupo", groupIndex, name || "grupo"),
        name,
        type,
        required: source.required === true,
        minSelections,
        maxSelections: type === "single" ? 1 : maxSelections || 0,
        values,
        sortOrder: groupIndex + 1,
      }
    })
    .filter((group): group is VariationGroup => Boolean(group))
}

export function normalizeAddonRows(value: unknown): OptionValue[] {
  return normalizeUnknownArray(value)
    .map((raw, index): OptionValue | null => {
      if (!raw || typeof raw !== "object") return null

      const source = raw as Partial<OptionValue>
      const name = normalizeTextName(source.name)

      return {
        id: normalizeTextName(source.id) || optionId("adicional", index, name || "adicional"),
        name,
        price: normalizeNumber(source.price ?? source.priceDelta),
        category: normalizeTextName(source.category),
        maxQuantity: normalizePositiveInteger(source.maxQuantity) || 1,
        isActive: source.isActive !== false,
        sortOrder: index + 1,
      }
    })
    .filter((item): item is OptionValue => Boolean(item))
}

export function normalizeIngredientRows(value: unknown, mode: "included" | "removable"): OptionValue[] {
  return normalizeUnknownArray(value)
    .map((raw, index): OptionValue | null => {
      if (!raw || typeof raw !== "object") return null

      const source = raw as Partial<OptionValue>
      const name = normalizeTextName(source.name)
      const inventoryItemId = normalizeTextName(source.inventoryItemId)

      return {
        id: normalizeTextName(source.id) || optionId(mode === "included" ? "incluido" : "removible", index, name || "ingrediente"),
        name,
        included: mode === "included",
        removable: mode === "removable",
        extraPrice: normalizeNumber(source.extraPrice),
        inventoryItemId: inventoryItemId || null,
        inventoryUnit: normalizeTextName(source.inventoryUnit),
        inventoryQuantity: normalizeNumber(source.inventoryQuantity),
        isActive: source.isActive !== false,
        sortOrder: index + 1,
      }
    })
    .filter((item): item is OptionValue => Boolean(item))
}

export function normalizeComboRows(value: unknown): ComboItemRow[] {
  return normalizeUnknownArray(value)
    .map((raw, index): ComboItemRow | null => {
      if (!raw || typeof raw !== "object") return null

      const source = raw as Partial<ComboItemRow>
      const name = normalizeTextName(source.name)
      const productId = Number(source.productId || 0)

      return {
        id: normalizeTextName(source.id) || optionId("combo", index, name || "articulo"),
        productId: Number.isFinite(productId) && productId > 0 ? Math.round(productId) : undefined,
        name,
        quantity: normalizePositiveInteger(source.quantity) || 1,
        sortOrder: index + 1,
      }
    })
    .filter((item): item is ComboItemRow => Boolean(item))
}

export function cleanComboRowsForSave(rows: ComboItemRow[]): ComboItemRow[] {
  return rows.filter((row) => normalizeTextName(row.name))
}

// Limpia el estado del editor antes de guardar: descarta filas sin nombre y
// mantiene min ≤ máx coherente por grupo.
export function cleanVariationGroupsForSave(groups: VariationGroup[]): VariationGroup[] {
  return groups
    .map((group) => {
      const values = group.values.filter((value) => normalizeTextName(value.name))
      const maxSelections = group.type === "single" ? 1 : normalizePositiveInteger(group.maxSelections)
      const minSelections = Math.min(
        normalizePositiveInteger(group.minSelections),
        maxSelections || values.length,
      )

      return {
        ...group,
        name: normalizeTextName(group.name),
        values,
        maxSelections,
        minSelections: group.required ? Math.max(1, minSelections) : minSelections,
      }
    })
    .filter((group) => group.name && group.values.length > 0)
}

export function cleanRowsForSave(rows: OptionValue[]): OptionValue[] {
  return rows.filter((row) => normalizeTextName(row.name))
}

export function buildPremiumSummary(input: {
  productType: ProductType
  salesChannels: ProductSalesChannel[]
  variations: VariationGroup[]
  addons: OptionValue[]
  comboItems: ComboItemRow[]
  removableIngredients: OptionValue[]
  preparationMinutes: number
  requiresWaiterConfirmation: boolean
  inventoryDiscountEnabled: boolean
}) {
  const details: string[] = []
  const typeLabel = PRODUCT_TYPE_OPTIONS.find((option) => option.value === input.productType)?.label || "Normal"

  if (input.productType !== "normal") details.push(typeLabel)
  if (input.salesChannels.length < SALES_CHANNEL_OPTIONS.length) {
    details.push(`Canales: ${input.salesChannels.map((channel) => SALES_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label || channel).join(", ")}`)
  }
  if (input.variations.length) details.push(`Variaciones: ${input.variations.reduce((total, group) => total + group.values.length, 0)}`)
  if (input.addons.length) details.push(`Adicionales: ${input.addons.length}`)
  if (input.comboItems.length) {
    const totalArticles = input.comboItems.reduce((total, item) => total + (item.quantity || 1), 0)
    details.push(`Combo: ${totalArticles} artículo(s)`)
  }
  if (input.removableIngredients.length) details.push(`Removibles: ${input.removableIngredients.length}`)
  if (input.preparationMinutes > 0) details.push(`${input.preparationMinutes} min`)
  if (input.requiresWaiterConfirmation) details.push("Confirma mesonero")
  if (!input.inventoryDiscountEnabled) details.push("Sin descuento automático")

  return details.join(" · ") || "Configuración básica"
}

export function buildFormFromProduct(product: MenuProduct): AdvancedForm {
  const selectionRules = normalizeSelectionRules(product.selectionRules)

  return {
    productType: normalizeProductType(product.productType),
    salesChannels: normalizeSalesChannels(product.salesChannels),
    variations: normalizeVariationGroups(product.variations),
    addons: normalizeAddonRows(product.addons),
    comboItems: normalizeComboRows(product.comboItems),
    includedIngredients: normalizeIngredientRows(product.includedIngredients, "included"),
    removableIngredients: normalizeIngredientRows(product.removableIngredients, "removable"),
    preparationMinutes: product.preparationMinutes ? String(product.preparationMinutes) : "",
    requiresWaiterConfirmation: product.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: product.inventoryDiscountEnabled !== false,
    maxAddons: selectionRules.maxAddons ? String(selectionRules.maxAddons) : "",
    internalRulesNote: String(selectionRules.notes || ""),
  }
}

// Compara el formulario actual contra lo que produce el producto guardado.
// buildFormFromProduct es determinista, así que la igualdad estructural
// detecta con fiabilidad si hay cambios sin guardar.
export function isFormDirty(form: AdvancedForm, product: MenuProduct | null): boolean {
  if (!product) return false

  return JSON.stringify(form) !== JSON.stringify(buildFormFromProduct(product))
}

// Advertencias de configuración incoherente que se muestran antes de guardar.
export function buildConfigWarnings(form: AdvancedForm): string[] {
  const warnings: string[] = []

  if (form.productType === "variations" && form.variations.length === 0) {
    warnings.push("Este producto está marcado con variaciones, pero no tiene opciones registradas.")
  }
  if (form.productType === "addons" && form.addons.length === 0) {
    warnings.push("Este producto está marcado con adicionales, pero no tiene adicionales registrados.")
  }
  if (form.productType === "buildable" && form.includedIngredients.length === 0 && form.addons.length === 0) {
    warnings.push("Un producto armable debería tener ingredientes, adicionales o reglas para el personal.")
  }
  if (form.productType === "combo" && form.comboItems.length === 0) {
    warnings.push("Un combo debería tener artículos del menú asignados.")
  }
  if (form.salesChannels.length === 0) {
    warnings.push("Selecciona al menos un canal de venta.")
  }

  return warnings
}

export async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text) as ApiResponse
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180)

    throw new Error(
      preview
        ? `El servidor no devolvió datos válidos. Respuesta: ${preview}`
        : "El servidor no devolvió datos válidos."
    )
  }
}

export function formatDate(value?: string) {
  if (!value) return "Sin actualización"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(date)
}

export function numberFromInput(value: string) {
  const parsed = Number(String(value || "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}
