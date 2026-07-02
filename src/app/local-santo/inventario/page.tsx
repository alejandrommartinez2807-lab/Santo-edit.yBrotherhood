"use client"

import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { formatUSD, formatVES } from "@/utils/formatCurrency"
import { products as baseMenuProducts } from "@/data/products"
import {
  getModulePlanAccess,
  normalizeLocalModuleList,
  normalizeLocalPlanKey,
  normalizeLocalPlanMode,
  type LocalModuleKey,
  type LocalPlanKey,
  type LocalPlanMode,
} from "@/lib/localPlans"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"
const INVENTORY_QUICK_ITEMS_STORAGE_KEY = "santo_perrito_inventory_quick_items_v1"

type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minimumStock: number
  costUSD: number
  costVES: number
  equivalentCostUSD: number
  note: string
  isActive: boolean
  updatedAt: string
}

type InventoryMovement = {
  id: string
  dateLabel: string
  itemId: string
  itemName: string
  movementType: string
  previousQuantity: number
  quantityMoved: number
  finalQuantity: number
  unit: string
  reason: string
  relatedExpense: boolean
  expenseId: string
  note: string
  createdAt: string
}

type InventoryRecipeIngredient = {
  itemId: string
  itemName: string
  quantity: number
  unit: string
}

type InventoryRecipe = {
  id: string
  productId: number
  productName: string
  productCategory: string
  ingredients: InventoryRecipeIngredient[]
  note: string
  isActive: boolean
  updatedAt: string
}

type RecipeMenuProduct = {
  id: number
  name: string
  category: string
  isActive: boolean
  sortOrder: number
}

type RecipeForm = {
  id: string
  productId: string
  ingredientItemId: string
  ingredientQuantity: string
  ingredients: InventoryRecipeIngredient[]
  note: string
}

type InventoryForm = {
  id: string
  name: string
  category: string
  quantity: string
  originalQuantity: string
  unit: string
  minimumStock: string
  costUSD: string
  costVES: string
  equivalentCostUSD: string
  note: string
}

type InventoryExpenseForm = {
  concept: string
  category: string
  amountUSD: string
  amountVES: string
  equivalentUSD: string
  method: string
  note: string
}

type InventoryQuickItem = {
  id: string
  name: string
  category: string
  unit: string
  minimumStock: string
  note: string
}

type BusinessConfig = {
  businessName: string
  membershipPlan: LocalPlanKey
  membershipPlanMode: LocalPlanMode
  customIncludedModules: LocalModuleKey[]
  customBlockedModules: LocalModuleKey[]
  inventoryModuleEnabled: boolean
  expensesModuleEnabled: boolean
}

type InventoryModuleKey =
  | "movimientos"
  | "productos"
  | "nuevo"
  | "recetas"
  | "conteo"
  | "alertas"

const INVENTORY_MODULES: {
  key: InventoryModuleKey
  label: string
  description: string
}[] = [
  {
    key: "movimientos",
    label: "Movimientos",
    description: "Auditoría de entradas, salidas, ventas, reinicios y ajustes.",
  },
  {
    key: "productos",
    label: "Insumos",
    description: "Lista de productos de inventario, stock, costos y acciones.",
  },
  {
    key: "nuevo",
    label: "Nuevo / ajuste",
    description: "Registrar insumos, entradas, salidas y compras ligadas a gastos.",
  },
  {
    key: "recetas",
    label: "Recetas",
    description: "Conectar productos del menú con insumos reales para descontar stock.",
  },
  {
    key: "conteo",
    label: "Conteo físico",
    description: "Comparar lo contado en el local contra lo que dice el sistema.",
  },
  {
    key: "alertas",
    label: "Alertas",
    description: "Agotados, stock bajo, costos faltantes y compras sugeridas.",
  },
]

const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: BRAND.name,
  membershipPlan: "complete",
  membershipPlanMode: "plan",
  customIncludedModules: [],
  customBlockedModules: [],
  inventoryModuleEnabled: true,
  expensesModuleEnabled: true,
}

const EMPTY_FORM: InventoryForm = {
  id: "",
  name: "",
  category: "Materia prima",
  quantity: "",
  originalQuantity: "0",
  unit: "unidades",
  minimumStock: "",
  costUSD: "",
  costVES: "",
  equivalentCostUSD: "",
  note: "",
}

const INVENTORY_CATEGORIES = [
  "Materia prima",
  "Bebidas",
  "Empaques",
  "Salsas",
  "Limpieza",
  "Operación",
  "Otros",
]

const EXPENSE_CATEGORIES = [
  "Materia prima",
  "Compra de productos",
  "Pago motorizado",
  "Pago empleado",
  "Servicios",
  "Transporte",
  "Mantenimiento",
  "Otros",
]

const EXPENSE_METHODS = [
  "Sin registrar",
  "Efectivo divisas",
  "Zelle",
  "Binance / USDT",
  "Pago móvil",
  "Punto",
  "Transferencia",
  "Efectivo Bs",
  "Mixto",
  "Otro",
]

const EMPTY_EXPENSE_FORM: InventoryExpenseForm = {
  concept: "",
  category: "Materia prima",
  amountUSD: "",
  amountVES: "",
  equivalentUSD: "",
  method: "Sin registrar",
  note: "",
}

const EMPTY_RECIPE_FORM: RecipeForm = {
  id: "",
  productId: "",
  ingredientItemId: "",
  ingredientQuantity: "",
  ingredients: [],
  note: "",
}

const UNIT_OPTIONS = [
  "unidades",
  "paquetes",
  "cajas",
  "kg",
  "gramos",
  "litros",
  "ml",
  "bolsas",
  "porciones",
]

const DEFAULT_INVENTORY_QUICK_ITEMS: InventoryQuickItem[] = [
  { id: "pan-de-perro", name: "Pan de perro", category: "Materia prima", unit: "paquetes", minimumStock: "5", note: "" },
  { id: "salchichas", name: "Salchichas", category: "Materia prima", unit: "paquetes", minimumStock: "5", note: "" },
  { id: "papas", name: "Papas", category: "Materia prima", unit: "kg", minimumStock: "5", note: "" },
  { id: "queso-amarillo", name: "Queso amarillo", category: "Materia prima", unit: "paquetes", minimumStock: "2", note: "" },
  { id: "tocineta", name: "Tocineta", category: "Materia prima", unit: "paquetes", minimumStock: "2", note: "" },
  { id: "salsas", name: "Salsas", category: "Salsas", unit: "unidades", minimumStock: "3", note: "" },
  { id: "maiz", name: "Maíz", category: "Materia prima", unit: "unidades", minimumStock: "3", note: "" },
  { id: "ensalada", name: "Ensalada", category: "Materia prima", unit: "porciones", minimumStock: "5", note: "" },
  { id: "refrescos", name: "Refrescos", category: "Bebidas", unit: "unidades", minimumStock: "6", note: "" },
  { id: "malta", name: "Malta", category: "Bebidas", unit: "unidades", minimumStock: "6", note: "" },
  { id: "nestea", name: "Nestea", category: "Bebidas", unit: "unidades", minimumStock: "6", note: "" },
  { id: "empaques", name: "Empaques", category: "Empaques", unit: "paquetes", minimumStock: "2", note: "" },
  { id: "bolsas", name: "Bolsas", category: "Empaques", unit: "paquetes", minimumStock: "2", note: "" },
  { id: "servilletas", name: "Servilletas", category: "Empaques", unit: "paquetes", minimumStock: "2", note: "" },
]

function createQuickInventoryItemId(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${base || "insumo"}-${Date.now()}`
}

function normalizeQuickInventoryItems(value: unknown): InventoryQuickItem[] {
  if (!Array.isArray(value)) return DEFAULT_INVENTORY_QUICK_ITEMS

  const seen = new Set<string>()
  const items: InventoryQuickItem[] = []

  value.forEach((item) => {
    const source = (item || {}) as Partial<InventoryQuickItem>
    const name = String(source.name || "").trim()
    const id = String(source.id || createQuickInventoryItemId(name)).trim()

    if (!name || !id || seen.has(id)) return

    seen.add(id)
    items.push({
      id,
      name,
      category: String(source.category || "Materia prima").trim() || "Materia prima",
      unit: String(source.unit || "unidades").trim() || "unidades",
      minimumStock: String(source.minimumStock || "").trim(),
      note: String(source.note || "").trim(),
    })
  })

  return items.length ? items : DEFAULT_INVENTORY_QUICK_ITEMS
}


function normalizeComparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function inventoryItemToQuickInventoryItem(item: InventoryItem): InventoryQuickItem {
  return {
    id: `inventory-${item.id}`,
    name: item.name,
    category: item.category || "Materia prima",
    unit: item.unit || "unidades",
    minimumStock: item.minimumStock > 0 ? String(item.minimumStock) : "",
    note: item.note || "",
  }
}

function mergeQuickInventoryItemsWithInventory(
  quickItems: InventoryQuickItem[],
  inventoryItems: InventoryItem[]
) {
  const merged = normalizeQuickInventoryItems(quickItems)
  const seenNames = new Set(
    merged.map((item) => normalizeComparableText(item.name))
  )

  inventoryItems.forEach((item) => {
    const key = normalizeComparableText(item.name)

    if (!item.id || !item.name || !key || seenNames.has(key)) {
      return
    }

    merged.push(inventoryItemToQuickInventoryItem(item))
    seenNames.add(key)
  })

  return merged
}

function findInventoryItemByName(items: InventoryItem[], name: string) {
  const target = normalizeComparableText(name)

  if (!target) return undefined

  return items.find((item) => normalizeComparableText(item.name) === target)
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeSignedNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue)) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value

  const normalized = String(value || "").trim().toLowerCase()

  if (["true", "1", "si", "sí", "activo", "activa", "activado", "activada"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "desactivado", "desactivada"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeInventoryItem(value: unknown): InventoryItem {
  const source = (value || {}) as Partial<InventoryItem>

  return {
    id: String(source.id || "").trim(),
    name: String(source.name || "").trim(),
    category: String(source.category || "General").trim() || "General",
    quantity: normalizeNumber(source.quantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
    minimumStock: normalizeNumber(source.minimumStock),
    costUSD: normalizeNumber(source.costUSD),
    costVES: normalizeNumber(source.costVES),
    equivalentCostUSD: normalizeNumber(source.equivalentCostUSD || source.costUSD),
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  }
}

function normalizeInventoryMovement(value: unknown): InventoryMovement {
  const source = (value || {}) as Partial<InventoryMovement>

  return {
    id: String(source.id || "").trim(),
    dateLabel: String(source.dateLabel || "").trim(),
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    movementType: String(source.movementType || "Ajuste").trim() || "Ajuste",
    previousQuantity: normalizeNumber(source.previousQuantity),
    quantityMoved: normalizeNumber(source.quantityMoved),
    finalQuantity: normalizeNumber(source.finalQuantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
    reason: String(source.reason || "Movimiento manual").trim(),
    relatedExpense: source.relatedExpense === true,
    expenseId: String(source.expenseId || "").trim(),
    note: String(source.note || "").trim(),
    createdAt: String(source.createdAt || "").trim(),
  }
}

function normalizeRecipeIngredient(value: unknown): InventoryRecipeIngredient {
  const source = (value || {}) as Partial<InventoryRecipeIngredient>

  return {
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    quantity: normalizeNumber(source.quantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
  }
}

function normalizeInventoryRecipe(value: unknown): InventoryRecipe {
  const source = (value || {}) as Partial<InventoryRecipe>
  const productId = Number(source.productId || 0)
  const ingredientsSource = Array.isArray(source.ingredients)
    ? source.ingredients
    : []

  return {
    id: String(source.id || "").trim(),
    productId: Number.isFinite(productId) ? productId : 0,
    productName: String(source.productName || "").trim(),
    productCategory: String(source.productCategory || "").trim(),
    ingredients: ingredientsSource
      .map(normalizeRecipeIngredient)
      .filter((ingredient: InventoryRecipeIngredient) => ingredient.itemId && ingredient.itemName && ingredient.quantity > 0),
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  }
}

function normalizeRecipeMenuProduct(value: unknown): RecipeMenuProduct | null {
  const source = (value || {}) as Partial<RecipeMenuProduct>
  const id = Number(source.id || 0)
  const name = String(source.name || "").trim()

  if (!Number.isFinite(id) || id <= 0 || !name) return null

  return {
    id: Math.round(id),
    name,
    category: String(source.category || "Producto").trim() || "Producto",
    isActive: source.isActive !== false,
    sortOrder: normalizeNumber(source.sortOrder || source.id || 9999),
  }
}

function normalizeRecipeMenuProducts(value: unknown): RecipeMenuProduct[] {
  if (!Array.isArray(value)) return normalizeRecipeMenuProducts(baseMenuProducts)

  return value
    .map(normalizeRecipeMenuProduct)
    .filter((product): product is RecipeMenuProduct => Boolean(product))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })
}

function normalizeBusinessConfig(value: unknown): BusinessConfig {
  const source = (value || {}) as Record<string, unknown>

  return {
    businessName:
      String(source.businessName || "").trim() ||
      DEFAULT_BUSINESS_CONFIG.businessName,
    membershipPlan: normalizeLocalPlanKey(source.membershipPlan),
    membershipPlanMode: normalizeLocalPlanMode(source.membershipPlanMode),
    customIncludedModules: normalizeLocalModuleList(source.customIncludedModules),
    customBlockedModules: normalizeLocalModuleList(source.customBlockedModules),
    inventoryModuleEnabled: normalizeBoolean(
      source.inventoryModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.inventoryModuleEnabled
    ),
    expensesModuleEnabled: normalizeBoolean(
      source.expensesModuleEnabled,
      DEFAULT_BUSINESS_CONFIG.expensesModuleEnabled
    ),
  }
}

function parseNumberInput(value: string) {
  const normalizedValue = String(value || "").trim().replace(",", ".")
  const numberValue = Number(normalizedValue)

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function formatDate(value: string) {
  if (!value) return "Sin actualización"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(date)
}

function getDateKeyInCaracas(value: string) {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value || "0000"
  const month = parts.find((part) => part.type === "month")?.value || "00"
  const day = parts.find((part) => part.type === "day")?.value || "00"

  return `${year}-${month}-${day}`
}

function getTodayDateKeyInCaracas() {
  return getDateKeyInCaracas(new Date().toISOString())
}

function getInventoryMovementTone(movement: InventoryMovement) {
  const movementType = movement.movementType.toLowerCase()

  if (movementType.includes("elimin")) {
    return "border-red-500/35 bg-red-50 text-red-800"
  }

  if (movementType.includes("salida")) {
    return "border-orange-400 bg-orange-50 text-orange-800"
  }

  if (movementType.includes("entrada")) {
    return "border-green-500/35 bg-green-50 text-green-800"
  }

  return "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
}

function getInventoryMovementOriginLabel(movement: InventoryMovement) {
  const movementType = movement.movementType.toLowerCase()
  const reason = movement.reason.toLowerCase()
  const note = movement.note.toLowerCase()

  if (movement.relatedExpense || reason.includes("gasto") || note.includes("gasto")) {
    return "Gasto"
  }

  if (reason.includes("reinicio") || note.includes("reinicio")) {
    return "Reinicio"
  }

  if (reason.includes("venta") || note.includes("pedido")) {
    return "Venta"
  }

  if (movementType.includes("entrada")) return "Entrada manual"
  if (movementType.includes("salida")) return "Salida manual"
  if (movementType.includes("elimin")) return "Eliminación"

  return "Ajuste manual"
}

function getStockStatus(item: InventoryItem) {
  if (item.quantity <= 0) {
    return {
      label: "Agotado",
      tone: "danger" as const,
    }
  }

  if (item.minimumStock > 0 && item.quantity <= item.minimumStock) {
    return {
      label: "Stock bajo",
      tone: "warning" as const,
    }
  }

  return {
    label: "Suficiente",
    tone: "good" as const,
  }
}

function buildFormFromItem(item: InventoryItem): InventoryForm {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: String(item.quantity || ""),
    originalQuantity: String(item.quantity || 0),
    unit: item.unit,
    minimumStock: String(item.minimumStock || ""),
    costUSD: String(item.costUSD || ""),
    costVES: String(item.costVES || ""),
    equivalentCostUSD: String(item.equivalentCostUSD || ""),
    note: item.note,
  }
}

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error("El servidor no devolvió datos válidos. Revisa la conexión con Supabase y vuelve a intentar.")
  }
}

export default function InventoryPage() {
  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Inventario">
      <InventoryPageContent />
    </ModuleAccessGuard>
  )
}

function InventoryPageContent() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(
    DEFAULT_BUSINESS_CONFIG
  )
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([])
  const [inventoryRecipes, setInventoryRecipes] = useState<InventoryRecipe[]>([])
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(EMPTY_RECIPE_FORM)
  const [recipeIngredientSearch, setRecipeIngredientSearch] = useState("")
  const [recipeMenuProducts, setRecipeMenuProducts] = useState<RecipeMenuProduct[]>(() =>
    normalizeRecipeMenuProducts(baseMenuProducts)
  )
  const [isRecipesVisible, setIsRecipesVisible] = useState(true)
  const [isSavingRecipe, setIsSavingRecipe] = useState(false)
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null)
  const [areMovementsVisible, setAreMovementsVisible] = useState(true)
  const [movementSearchText, setMovementSearchText] = useState("")
  const [movementTypeFilter, setMovementTypeFilter] = useState("Todos")
  const [movementItemFilter, setMovementItemFilter] = useState("Todos")
  const [movementOriginFilter, setMovementOriginFilter] = useState("Todos")
  const [movementDateFilter, setMovementDateFilter] = useState("")
  const [areMovementFiltersVisible, setAreMovementFiltersVisible] = useState(false)
  const [movementSortMode, setMovementSortMode] = useState<"recent" | "oldest">("recent")
  const [form, setForm] = useState<InventoryForm>(EMPTY_FORM)
  const [registerExpenseWithEntry, setRegisterExpenseWithEntry] = useState(false)
  const [expenseForm, setExpenseForm] = useState<InventoryExpenseForm>(EMPTY_EXPENSE_FORM)
  const [searchText, setSearchText] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todas")
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false)
  const [areInventoryFiltersVisible, setAreInventoryFiltersVisible] = useState(false)
  const [isMovementProductSummaryVisible, setIsMovementProductSummaryVisible] = useState(true)
  const [isFormVisible, setIsFormVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetInventoryOpen, setIsResetInventoryOpen] = useState(false)
  const [resetInventoryConfirmation, setResetInventoryConfirmation] = useState("")
  const [isResettingInventory, setIsResettingInventory] = useState(false)
  const [isPhysicalCountVisible, setIsPhysicalCountVisible] = useState(false)
  const [physicalCountValues, setPhysicalCountValues] = useState<Record<string, string>>({})
  const [physicalCountNote, setPhysicalCountNote] = useState("")
  const [showOnlyPhysicalCountDifferences, setShowOnlyPhysicalCountDifferences] = useState(false)
  const [isApplyingPhysicalCount, setIsApplyingPhysicalCount] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [quickInventoryItems, setQuickInventoryItems] = useState<InventoryQuickItem[]>(DEFAULT_INVENTORY_QUICK_ITEMS)
  const [selectedQuickInventoryId, setSelectedQuickInventoryId] = useState("")
  const [newQuickItemName, setNewQuickItemName] = useState("")
  const [newQuickItemCategory, setNewQuickItemCategory] = useState("Materia prima")
  const [newQuickItemUnit, setNewQuickItemUnit] = useState("unidades")
  const [areQuickItemsVisible, setAreQuickItemsVisible] = useState(false)
  const [activeInventoryModule, setActiveInventoryModule] = useState<InventoryModuleKey>("movimientos")

  const isLoggedIn = adminPassword.length > 0
  const inventoryAccess = getModulePlanAccess(businessConfig, "inventory")
  const expensesAccess = getModulePlanAccess(businessConfig, "expenses")
  const canUseInventory = inventoryAccess.effectiveEnabled
  const canRegisterExpenses = expensesAccess.effectiveEnabled
  const activeInventoryModuleInfo =
    INVENTORY_MODULES.find((module) => module.key === activeInventoryModule) ||
    INVENTORY_MODULES[0]

  const activeInventoryItems = useMemo(() => {
    return inventory
      .filter((item) => item.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [inventory])

  const categories = useMemo(() => {
    return [
      "Todas",
      ...Array.from(new Set(inventory.map((item) => item.category).filter(Boolean))),
    ]
  }, [inventory])

  const inventoryTotals = useMemo(() => {
    const activeItems = inventory.filter((item) => item.isActive !== false)
    const lowItems = activeItems.filter((item) => getStockStatus(item).tone === "warning")
    const outItems = activeItems.filter((item) => getStockStatus(item).tone === "danger")
    const estimatedValueUSD = activeItems.reduce(
      (total, item) => total + item.quantity * (item.equivalentCostUSD || item.costUSD),
      0
    )
    const estimatedValueVES = activeItems.reduce(
      (total, item) => total + item.quantity * item.costVES,
      0
    )

    return {
      activeItems: activeItems.length,
      lowItems: lowItems.length,
      outItems: outItems.length,
      estimatedValueUSD,
      estimatedValueVES,
    }
  }, [inventory])

  const inventoryAlertSummary = useMemo(() => {
    const activeItems = inventory.filter((item) => item.isActive !== false)
    const outItems = activeItems.filter((item) => item.quantity <= 0)
    const lowItems = activeItems.filter(
      (item) => item.quantity > 0 && item.minimumStock > 0 && item.quantity <= item.minimumStock
    )
    const missingMinimumItems = activeItems.filter((item) => item.minimumStock <= 0)
    const missingCostItems = activeItems.filter(
      (item) => item.costUSD <= 0 && item.costVES <= 0 && item.equivalentCostUSD <= 0
    )
    const purchaseSuggestions = [...outItems, ...lowItems]
      .map((item) => {
        const suggestedQuantity = Math.max(
          item.minimumStock > 0 ? item.minimumStock * 2 - item.quantity : 1,
          1
        )

        return {
          ...item,
          suggestedQuantity: normalizeNumber(suggestedQuantity),
        }
      })
      .sort((a, b) => {
        if (a.quantity !== b.quantity) return a.quantity - b.quantity
        return a.name.localeCompare(b.name)
      })

    return {
      outItems,
      lowItems,
      missingMinimumItems,
      missingCostItems,
      purchaseSuggestions,
      hasAlerts:
        outItems.length > 0 ||
        lowItems.length > 0 ||
        missingMinimumItems.length > 0 ||
        missingCostItems.length > 0,
    }
  }, [inventory])

  const filteredInventory = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return inventory
      .filter((item) => item.isActive !== false)
      .filter((item) => {
        if (categoryFilter !== "Todas" && item.category !== categoryFilter) {
          return false
        }

        if (showOnlyAlerts && getStockStatus(item).tone === "good") {
          return false
        }

        if (!query) return true

        return [item.name, item.category, item.unit, item.note]
          .join(" ")
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) => {
        const statusA = getStockStatus(a).tone
        const statusB = getStockStatus(b).tone
        const priority = { danger: 0, warning: 1, good: 2 }

        if (priority[statusA] !== priority[statusB]) {
          return priority[statusA] - priority[statusB]
        }

        return a.name.localeCompare(b.name)
      })
  }, [categoryFilter, inventory, searchText, showOnlyAlerts])

  const hasActiveInventoryFilters = useMemo(() => {
    return (
      searchText.trim().length > 0 ||
      categoryFilter !== "Todas" ||
      showOnlyAlerts
    )
  }, [categoryFilter, searchText, showOnlyAlerts])


  const recipeAvailableInventory = useMemo(() => {
    const query = normalizeComparableText(recipeIngredientSearch)

    return inventory
      .filter((item) => item.isActive !== false)
      .filter((item) => {
        if (!query) return true

        return normalizeComparableText(
          [item.name, item.category, item.unit, item.note].join(" ")
        ).includes(query)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [inventory, recipeIngredientSearch])

  const selectedRecipeIngredient = useMemo(() => {
    if (!recipeForm.ingredientItemId) return undefined

    return inventory.find((item) => item.id === recipeForm.ingredientItemId)
  }, [inventory, recipeForm.ingredientItemId])

  const movementTypeOptions = useMemo(() => {
    return [
      "Todos",
      ...Array.from(
        new Set(
          inventoryMovements
            .map((movement) => movement.movementType)
            .filter(Boolean)
        )
      ),
    ]
  }, [inventoryMovements])

  const movementItemOptions = useMemo(() => {
    return [
      "Todos",
      ...Array.from(
        new Set(
          inventoryMovements
            .map((movement) => movement.itemName)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    ]
  }, [inventoryMovements])

  const filteredInventoryMovements = useMemo(() => {
    const query = normalizeComparableText(movementSearchText)

    return inventoryMovements
      .filter((movement) => {
        if (movementTypeFilter !== "Todos" && movement.movementType !== movementTypeFilter) {
          return false
        }

        if (movementItemFilter !== "Todos" && movement.itemName !== movementItemFilter) {
          return false
        }

        if (movementOriginFilter !== "Todos") {
          const origin = getInventoryMovementOriginLabel(movement)

          if (origin !== movementOriginFilter) {
            return false
          }
        }

        if (movementDateFilter) {
          const movementDate = getDateKeyInCaracas(movement.createdAt)

          if (movementDate !== movementDateFilter) {
            return false
          }
        }

        if (!query) return true

        return normalizeComparableText(
          [
            movement.itemName,
            movement.movementType,
            movement.reason,
            movement.note,
            movement.dateLabel,
            movement.unit,
            getInventoryMovementOriginLabel(movement),
          ].join(" ")
        ).includes(query)
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime() || 0
        const dateB = new Date(b.createdAt).getTime() || 0

        return movementSortMode === "oldest" ? dateA - dateB : dateB - dateA
      })
  }, [
    inventoryMovements,
    movementDateFilter,
    movementItemFilter,
    movementOriginFilter,
    movementSearchText,
    movementSortMode,
    movementTypeFilter,
  ])

  const filteredMovementSummary = useMemo(() => {
    return filteredInventoryMovements.reduce(
      (summary, movement) => {
        const movementType = movement.movementType.toLowerCase()

        if (movementType.includes("entrada")) summary.entries += 1
        else if (movementType.includes("salida")) summary.outputs += 1
        else if (movementType.includes("elimin")) summary.deletions += 1
        else summary.adjustments += 1

        return summary
      },
      {
        entries: 0,
        outputs: 0,
        adjustments: 0,
        deletions: 0,
      }
    )
  }, [filteredInventoryMovements])

  const movementProductSummary = useMemo(() => {
    const summaryByProduct = new Map<
      string,
      {
        itemName: string
        entries: number
        outputs: number
        adjustments: number
        deletions: number
        movements: number
        latestDate: string
        latestType: string
      }
    >()

    filteredInventoryMovements.forEach((movement) => {
      const key = movement.itemId || movement.itemName
      const currentSummary = summaryByProduct.get(key) || {
        itemName: movement.itemName || "Producto sin nombre",
        entries: 0,
        outputs: 0,
        adjustments: 0,
        deletions: 0,
        movements: 0,
        latestDate: "",
        latestType: "",
      }
      const movementType = movement.movementType.toLowerCase()

      if (movementType.includes("entrada")) currentSummary.entries += 1
      else if (movementType.includes("salida")) currentSummary.outputs += 1
      else if (movementType.includes("elimin")) currentSummary.deletions += 1
      else currentSummary.adjustments += 1

      currentSummary.movements += 1

      const currentDate = new Date(currentSummary.latestDate).getTime() || 0
      const nextDate = new Date(movement.createdAt).getTime() || 0

      if (!currentSummary.latestDate || nextDate >= currentDate) {
        currentSummary.latestDate = movement.createdAt
        currentSummary.latestType = movement.movementType
      }

      summaryByProduct.set(key, currentSummary)
    })

    return Array.from(summaryByProduct.values()).sort((a, b) => {
      if (b.movements !== a.movements) return b.movements - a.movements
      return a.itemName.localeCompare(b.itemName)
    })
  }, [filteredInventoryMovements])


  const hasActiveMovementFilters = useMemo(() => {
    return (
      movementSearchText.trim().length > 0 ||
      movementTypeFilter !== "Todos" ||
      movementItemFilter !== "Todos" ||
      movementOriginFilter !== "Todos" ||
      movementDateFilter.length > 0
    )
  }, [
    movementDateFilter,
    movementItemFilter,
    movementOriginFilter,
    movementSearchText,
    movementTypeFilter,
  ])

  const physicalCountRows = useMemo(() => {
    return activeInventoryItems.map((item) => {
      const rawValue = physicalCountValues[item.id] ?? ""
      const hasValue = rawValue.trim().length > 0
      const countedQuantity = hasValue ? parseNumberInput(rawValue) : item.quantity
      const difference = hasValue
        ? normalizeSignedNumber(countedQuantity - item.quantity)
        : 0

      return {
        item,
        rawValue,
        hasValue,
        countedQuantity,
        difference,
      }
    })
  }, [activeInventoryItems, physicalCountValues])

  const physicalCountSummary = useMemo(() => {
    const reviewedRows = physicalCountRows.filter((row) => row.hasValue)
    const changedRows = reviewedRows.filter((row) => row.difference !== 0)
    const positiveAdjustments = changedRows.reduce(
      (total, row) => total + Math.max(row.difference, 0),
      0
    )
    const negativeAdjustments = changedRows.reduce(
      (total, row) => total + Math.abs(Math.min(row.difference, 0)),
      0
    )

    return {
      reviewedCount: reviewedRows.length,
      changedCount: changedRows.length,
      positiveAdjustments: normalizeNumber(positiveAdjustments),
      negativeAdjustments: normalizeNumber(negativeAdjustments),
    }
  }, [physicalCountRows])

  const visiblePhysicalCountRows = useMemo(() => {
    if (!showOnlyPhysicalCountDifferences) return physicalCountRows

    return physicalCountRows.filter((row) => row.hasValue && row.difference !== 0)
  }, [physicalCountRows, showOnlyPhysicalCountDifferences])

  const currentQuantityValue = parseNumberInput(form.quantity)
  const originalQuantityValue = parseNumberInput(form.originalQuantity)
  const entryQuantityDelta = Math.max(
    0,
    normalizeNumber(currentQuantityValue - originalQuantityValue)
  )
  const canShowExpenseLink = canRegisterExpenses && entryQuantityDelta > 0

  function saveQuickInventoryItems(nextItems: InventoryQuickItem[]) {
    const cleanItems = normalizeQuickInventoryItems(nextItems)

    setQuickInventoryItems(cleanItems)

    try {
      window.localStorage.setItem(
        INVENTORY_QUICK_ITEMS_STORAGE_KEY,
        JSON.stringify(cleanItems)
      )
    } catch {
      // Si el navegador bloquea localStorage, el formulario sigue funcionando.
    }
  }

  function applyQuickInventoryItem(itemId: string) {
    setSelectedQuickInventoryId(itemId)

    if (!itemId || itemId === "custom") {
      return
    }

    const selectedItem = quickInventoryItems.find((item) => item.id === itemId)

    if (!selectedItem) return

    const matchedInventoryItem = findInventoryItemByName(inventory, selectedItem.name)

    if (matchedInventoryItem) {
      setForm(buildFormFromItem(matchedInventoryItem))
      setSuccessMessage(
        "Insumo encontrado en el inventario real. Se cargó para evitar duplicados."
      )
    } else {
      setForm((currentForm) => ({
        ...currentForm,
        id: "",
        originalQuantity: "0",
        name: selectedItem.name,
        category: selectedItem.category,
        unit: selectedItem.unit,
        minimumStock: selectedItem.minimumStock || currentForm.minimumStock,
        note: selectedItem.note || currentForm.note,
      }))
      setSuccessMessage(null)
    }

    setExpenseForm((currentExpenseForm) => ({
      ...currentExpenseForm,
      concept: `Compra de ${selectedItem.name}`,
      category: selectedItem.category === "Bebidas" ? "Compra de productos" : "Materia prima",
      note: currentExpenseForm.note || `Entrada de inventario: ${selectedItem.name}.`,
    }))
    setErrorMessage(null)
  }

  function addQuickInventoryItem() {
    const name = newQuickItemName.trim()

    if (!name) {
      setErrorMessage("Escribe el nombre del insumo rápido que quieres agregar.")
      return
    }

    const alreadyExists = quickInventoryItems.some(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase()
    )

    if (alreadyExists) {
      setErrorMessage("Ese insumo rápido ya existe en la lista.")
      return
    }

    const nextItem: InventoryQuickItem = {
      id: createQuickInventoryItemId(name),
      name,
      category: newQuickItemCategory,
      unit: newQuickItemUnit,
      minimumStock: "",
      note: "",
    }

    saveQuickInventoryItems([...quickInventoryItems, nextItem])
    setNewQuickItemName("")
    setNewQuickItemCategory("Materia prima")
    setNewQuickItemUnit("unidades")
    setSuccessMessage("Insumo rápido agregado correctamente.")
    setErrorMessage(null)
  }

  function removeQuickInventoryItem(itemId: string) {
    saveQuickInventoryItems(quickInventoryItems.filter((item) => item.id !== itemId))
    if (selectedQuickInventoryId === itemId) {
      setSelectedQuickInventoryId("")
    }
    setSuccessMessage("Insumo rápido eliminado de la lista.")
    setErrorMessage(null)
  }

  function restoreDefaultQuickInventoryItems() {
    saveQuickInventoryItems(DEFAULT_INVENTORY_QUICK_ITEMS)
    setSelectedQuickInventoryId("")
    setSuccessMessage("Lista de insumos rápidos restaurada.")
    setErrorMessage(null)
  }

  function openInventoryModule(moduleKey: InventoryModuleKey) {
    setActiveInventoryModule(moduleKey)

    if (moduleKey === "movimientos") {
      setAreMovementsVisible(true)
    }

    if (moduleKey === "recetas") {
      setIsRecipesVisible(true)
    }

    if (moduleKey === "nuevo") {
      setIsFormVisible(true)
    }

    if (moduleKey === "conteo") {
      setIsPhysicalCountVisible(true)
    }

    requestAnimationFrame(() => {
      document
        .getElementById("inventario-modulo-activo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  async function loadBusinessConfig(password = adminPassword) {
    if (!password) return undefined

    const response = await fetch("/api/business-config", {
      headers: {
        "x-admin-password": password,
      },
      cache: "no-store",
    })

    const data = await readApiResponse(response)

    if (!response.ok) {
      throw new Error(data.error || "No se pudo cargar la configuración del negocio")
    }

    const nextConfig = normalizeBusinessConfig(data.businessConfig || data.config || data)

    setBusinessConfig(nextConfig)

    return nextConfig
  }

  async function loadMenuProductsForRecipes(password = adminPassword) {
    if (!password) {
      setRecipeMenuProducts(normalizeRecipeMenuProducts(baseMenuProducts))
      return []
    }

    try {
      const response = await fetch("/api/menu-products", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el menú editable para recetas")
      }

      const cleanMenuProducts = normalizeRecipeMenuProducts(data.menuProducts || [])
      const nextMenuProducts = cleanMenuProducts.length
        ? cleanMenuProducts
        : normalizeRecipeMenuProducts(baseMenuProducts)

      setRecipeMenuProducts(nextMenuProducts)

      return nextMenuProducts
    } catch {
      const fallbackMenuProducts = normalizeRecipeMenuProducts(baseMenuProducts)

      setRecipeMenuProducts(fallbackMenuProducts)

      return fallbackMenuProducts
    }
  }

  async function loadInventory(password = adminPassword) {
    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const config = await loadBusinessConfig(password)
      const access = getModulePlanAccess(config || businessConfig, "inventory")

      if (!access.effectiveEnabled) {
        setInventory([])
        setInventoryMovements([])
        return
      }

      await loadMenuProductsForRecipes(password)

      const response = await fetch("/api/inventory", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el inventario")
      }

      const cleanInventory = Array.isArray(data.inventory)
        ? data.inventory.map(normalizeInventoryItem).filter((item: InventoryItem) => item.id && item.name)
        : []
      const cleanMovements = Array.isArray(data.inventoryMovements)
        ? data.inventoryMovements
            .map(normalizeInventoryMovement)
            .filter((movement: InventoryMovement) => movement.id && movement.itemId)
        : []

      setInventory(cleanInventory)
      setInventoryMovements(cleanMovements)
      saveQuickInventoryItems(
        mergeQuickInventoryItemsWithInventory(quickInventoryItems, cleanInventory)
      )

      const recipesResponse = await fetch("/api/inventory-recipes", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })

      const recipesData = await readApiResponse(recipesResponse)

      if (recipesResponse.ok) {
        const cleanRecipes = Array.isArray(recipesData.inventoryRecipes)
          ? recipesData.inventoryRecipes
              .map(normalizeInventoryRecipe)
              .filter((recipe: InventoryRecipe) => recipe.id && recipe.productName)
          : []

        setInventoryRecipes(cleanRecipes)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el inventario"
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogin() {
    const password = passwordInput.trim()

    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
      setAdminPassword(password)
      setPasswordInput(password)
      await loadInventory(password)
    } catch (error) {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
      setAdminPassword("")
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo validar el acceso"
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminPassword("")
    setPasswordInput("")
    setInventory([])
    setInventoryMovements([])
    setInventoryRecipes([])
    setRecipeForm(EMPTY_RECIPE_FORM)
    setRecipeMenuProducts(normalizeRecipeMenuProducts(baseMenuProducts))
    setForm(EMPTY_FORM)
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setRegisterExpenseWithEntry(false)
    setSelectedQuickInventoryId("")
    setIsResetInventoryOpen(false)
    setResetInventoryConfirmation("")
    setPhysicalCountValues({})
    setPhysicalCountNote("")
    setShowOnlyPhysicalCountDifferences(false)
    setIsPhysicalCountVisible(false)
    setErrorMessage(null)
    setSuccessMessage(null)
    setBusinessConfig(DEFAULT_BUSINESS_CONFIG)
  }

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      const savedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)

      if (!savedPassword) return

      setAdminPassword(savedPassword)
      setPasswordInput(savedPassword)
      loadInventory(savedPassword)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedQuickItems = window.localStorage.getItem(INVENTORY_QUICK_ITEMS_STORAGE_KEY)

        if (!savedQuickItems) return

        setQuickInventoryItems(normalizeQuickInventoryItems(JSON.parse(savedQuickItems)))
      } catch {
        setQuickInventoryItems(DEFAULT_INVENTORY_QUICK_ITEMS)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  function updateForm<K extends keyof InventoryForm>(field: K, value: InventoryForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setRegisterExpenseWithEntry(false)
    setSelectedQuickInventoryId("")
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function updateExpenseForm<K extends keyof InventoryExpenseForm>(
    field: K,
    value: InventoryExpenseForm[K]
  ) {
    setExpenseForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  async function saveInventoryEntryExpense(savedItem: InventoryItem, quantityDelta: number) {
    const amountUSD = parseNumberInput(expenseForm.amountUSD)
    const amountVES = parseNumberInput(expenseForm.amountVES)
    const manualEquivalentUSD = parseNumberInput(expenseForm.equivalentUSD)
    const equivalentUSD = manualEquivalentUSD > 0 ? manualEquivalentUSD : amountUSD

    const response = await fetch("/api/day-expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPassword,
      },
      body: JSON.stringify({
        concept:
          expenseForm.concept.trim() ||
          `Compra de ${savedItem.name}`,
        category: expenseForm.category || "Materia prima",
        amountUSD,
        amountVES,
        equivalentUSD,
        method: expenseForm.method || "Sin registrar",
        note:
          expenseForm.note.trim() ||
          `Entrada de inventario: +${quantityDelta} ${savedItem.unit}. Producto: ${savedItem.name}.`,
      }),
    })

    const data = await readApiResponse(response)

    if (!response.ok) {
      throw new Error(data.error || "No se pudo registrar el gasto de esta entrada")
    }

    return data
  }

  async function saveItem() {
    if (!adminPassword) return

    const name = form.name.trim()

    if (!name) {
      setErrorMessage("Escribe el nombre del producto de inventario.")
      return
    }

    const existingInventoryItem = !form.id
      ? findInventoryItemByName(inventory, name)
      : undefined

    if (existingInventoryItem) {
      setForm(buildFormFromItem(existingInventoryItem))
      setSelectedQuickInventoryId(`inventory-${existingInventoryItem.id}`)
      setErrorMessage(
        `Ese insumo ya existe como ${existingInventoryItem.name}. Se cargó el producto real para evitar duplicados. Ajusta la cantidad y guarda.`
      )
      setIsFormVisible(true)
      return
    }

    const nextQuantity = parseNumberInput(form.quantity)
    const previousQuantity = parseNumberInput(form.originalQuantity)
    const quantityDelta = Math.max(0, normalizeNumber(nextQuantity - previousQuantity))
    const shouldRegisterExpense =
      canRegisterExpenses && registerExpenseWithEntry && quantityDelta > 0

    if (registerExpenseWithEntry && !canRegisterExpenses) {
      setErrorMessage("Gastos no está activo en este plan o está apagado en configuración.")
      return
    }

    if (shouldRegisterExpense) {
      const amountUSD = parseNumberInput(expenseForm.amountUSD)
      const amountVES = parseNumberInput(expenseForm.amountVES)
      const equivalentUSD = parseNumberInput(expenseForm.equivalentUSD)

      if (amountUSD <= 0 && amountVES <= 0 && equivalentUSD <= 0) {
        setErrorMessage(
          "Para registrar la entrada como gasto, escribe el monto pagado en divisas, bolívares o equivalente USD."
        )
        return
      }

      if (amountVES > 0 && equivalentUSD <= 0) {
        setErrorMessage(
          "Si el gasto incluye bolívares, escribe el equivalente total en USD para que el cierre calcule bien el neto."
        )
        return
      }
    }

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          id: form.id || undefined,
          name,
          category: form.category,
          quantity: nextQuantity,
          unit: form.unit,
          minimumStock: parseNumberInput(form.minimumStock),
          costUSD: parseNumberInput(form.costUSD),
          costVES: parseNumberInput(form.costVES),
          equivalentCostUSD: parseNumberInput(form.equivalentCostUSD) || parseNumberInput(form.costUSD),
          note: form.note,
          isActive: true,
          movementType: !form.id
            ? "Entrada inicial"
            : nextQuantity > previousQuantity
              ? "Entrada"
              : nextQuantity < previousQuantity
                ? "Salida"
                : "Ajuste",
          movementReason: shouldRegisterExpense
            ? "Compra registrada como gasto"
            : !form.id
              ? "Registro inicial"
              : nextQuantity > previousQuantity
                ? "Entrada manual"
                : nextQuantity < previousQuantity
                  ? "Salida manual"
                  : "Actualización manual",
          movementNote: expenseForm.note || form.note,
          relatedExpense: shouldRegisterExpense,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el producto")
      }

      const savedItem = normalizeInventoryItem(data.inventoryItem)
      const savedMovement = data.inventoryMovement
        ? normalizeInventoryMovement(data.inventoryMovement)
        : null

      if (savedMovement && savedMovement.id) {
        setInventoryMovements((currentMovements) => [savedMovement, ...currentMovements])
      }

      setInventory((currentInventory) => {
        const exists = currentInventory.some((item) => item.id === savedItem.id)

        if (exists) {
          return currentInventory.map((item) =>
            item.id === savedItem.id ? savedItem : item
          )
        }

        return [savedItem, ...currentInventory]
      })
      setRecipeForm((currentRecipeForm) => {
        const alreadyAdded = currentRecipeForm.ingredients.some(
          (ingredient) => ingredient.itemId === savedItem.id
        )

        if (alreadyAdded || currentRecipeForm.ingredientItemId) {
          return currentRecipeForm
        }

        return {
          ...currentRecipeForm,
          ingredientItemId: savedItem.id,
        }
      })
      setRecipeIngredientSearch(savedItem.name)
      saveQuickInventoryItems(
        mergeQuickInventoryItemsWithInventory(quickInventoryItems, [savedItem])
      )
      let expenseWasRegistered = false
      let expenseErrorMessage = ""

      if (shouldRegisterExpense) {
        try {
          await saveInventoryEntryExpense(savedItem, quantityDelta)
          expenseWasRegistered = true
        } catch (expenseError) {
          expenseErrorMessage =
            expenseError instanceof Error
              ? expenseError.message
              : "No se pudo registrar el gasto de esta entrada"
        }
      }

      setForm(EMPTY_FORM)
      setExpenseForm(EMPTY_EXPENSE_FORM)
      setRegisterExpenseWithEntry(false)
      setSelectedQuickInventoryId("")
      setActiveInventoryModule("movimientos")
      setAreMovementsVisible(true)
      setSuccessMessage(
        expenseWasRegistered
          ? "Inventario actualizado y gasto registrado correctamente."
          : "Producto de inventario guardado correctamente."
      )
      if (expenseErrorMessage) {
        setErrorMessage(
          `Inventario actualizado, pero el gasto no se registró: ${expenseErrorMessage}`
        )
      }
      setIsFormVisible(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo guardar el producto"
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!adminPassword || !itemId) return

    try {
      setDeletingItemId(itemId)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/inventory?id=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword,
        },
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar el producto")
      }

      const deletedMovement = data.inventoryMovement
        ? normalizeInventoryMovement(data.inventoryMovement)
        : null

      if (deletedMovement && deletedMovement.id) {
        setInventoryMovements((currentMovements) => [deletedMovement, ...currentMovements])
      }

      setInventory((currentInventory) =>
        currentInventory.filter((item) => item.id !== itemId)
      )
      setSuccessMessage(data.message || "Producto eliminado del inventario.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo eliminar el producto"
      )
    } finally {
      setDeletingItemId(null)
    }
  }

  async function resetInventoryQuantities() {
    if (!adminPassword) return

    const confirmation = resetInventoryConfirmation.trim().toUpperCase()

    if (confirmation !== "REINICIAR") {
      setErrorMessage("Escribe REINICIAR para confirmar el reinicio de cantidades.")
      return
    }

    const itemsToReset = inventory.filter(
      (item) => item.isActive !== false && item.quantity > 0
    )

    if (!itemsToReset.length) {
      setIsResetInventoryOpen(false)
      setResetInventoryConfirmation("")
      setSuccessMessage("No había cantidades por reiniciar. El inventario ya estaba en cero.")
      setErrorMessage(null)
      return
    }

    try {
      setIsResettingInventory(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const updatedItems: InventoryItem[] = []
      const createdMovements: InventoryMovement[] = []
      const failedItems: string[] = []

      for (const item of itemsToReset) {
        try {
          const response = await fetch("/api/inventory", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-password": adminPassword,
            },
            body: JSON.stringify({
              id: item.id,
              name: item.name,
              category: item.category,
              quantity: 0,
              unit: item.unit,
              minimumStock: item.minimumStock,
              costUSD: item.costUSD,
              costVES: item.costVES,
              equivalentCostUSD: item.equivalentCostUSD || item.costUSD,
              note: item.note,
              isActive: true,
              movementType: "Ajuste",
              movementReason: "Reinicio de cantidades",
              movementNote: `Reinicio seguro de inventario. Cantidad anterior: ${item.quantity} ${item.unit}.`,
              relatedExpense: false,
            }),
          })

          const data = await readApiResponse(response)

          if (!response.ok) {
            throw new Error(data.error || "No se pudo reiniciar este producto")
          }

          const savedItem = normalizeInventoryItem(data.inventoryItem)
          const savedMovement = data.inventoryMovement
            ? normalizeInventoryMovement(data.inventoryMovement)
            : null

          updatedItems.push(savedItem)

          if (savedMovement && savedMovement.id) {
            createdMovements.push(savedMovement)
          }
        } catch {
          failedItems.push(item.name)
        }
      }

      if (updatedItems.length) {
        setInventory((currentInventory) =>
          currentInventory.map((currentItem) => {
            const updatedItem = updatedItems.find(
              (item) => item.id === currentItem.id
            )

            return updatedItem || currentItem
          })
        )
      }

      if (createdMovements.length) {
        setInventoryMovements((currentMovements) => [
          ...createdMovements,
          ...currentMovements,
        ])
      }

      setIsResetInventoryOpen(false)
      setResetInventoryConfirmation("")
      setActiveInventoryModule("movimientos")
      setAreMovementsVisible(true)

      if (failedItems.length) {
        setErrorMessage(
          `Algunas cantidades no se reiniciaron: ${failedItems.join(", ")}. Revisa esos productos manualmente.`
        )
        setSuccessMessage(
          `Se reiniciaron ${updatedItems.length} producto(s). Las recetas, costos y stock mínimo se conservaron.`
        )
      } else {
        setSuccessMessage(
          `Inventario reiniciado correctamente. Se pusieron en cero ${updatedItems.length} producto(s) y se guardó historial de ajuste.`
        )
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo reiniciar el inventario"
      )
    } finally {
      setIsResettingInventory(false)
    }
  }

  function editItem(item: InventoryItem) {
    setForm(buildFormFromItem(item))
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setRegisterExpenseWithEntry(false)
    setIsFormVisible(true)
    setActiveInventoryModule("nuevo")
    setSuccessMessage(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function adjustItemQuantity(item: InventoryItem, delta: number) {
    const nextQuantity = Math.max(0, normalizeNumber(item.quantity + delta))
    const isEntry = delta > 0

    setForm({
      ...buildFormFromItem(item),
      quantity: String(nextQuantity),
    })
    setExpenseForm({
      ...EMPTY_EXPENSE_FORM,
      concept: isEntry ? `Compra de ${item.name}` : "",
      category:
        item.category === "Materia prima" || item.category === "Bebidas"
          ? item.category
          : "Compra de productos",
      note: isEntry
        ? `Entrada de inventario: +${Math.max(0, normalizeNumber(nextQuantity - item.quantity))} ${item.unit}. Producto: ${item.name}.`
        : "",
    })
    setRegisterExpenseWithEntry(isEntry && canRegisterExpenses)
    setIsFormVisible(true)
    setActiveInventoryModule("nuevo")
    setSuccessMessage(
      isEntry
        ? "Revisa la entrada. Puedes registrarla también como gasto del día."
        : "Revisa la nueva cantidad y presiona Guardar inventario."
    )
    setErrorMessage(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }


  function updatePhysicalCountValue(itemId: string, value: string) {
    setPhysicalCountValues((currentValues) => ({
      ...currentValues,
      [itemId]: value,
    }))
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function fillPhysicalCountWithCurrentInventory() {
    const nextValues: Record<string, string> = {}

    activeInventoryItems.forEach((item) => {
      nextValues[item.id] = String(item.quantity || 0)
    })

    setPhysicalCountValues(nextValues)
    setSuccessMessage("Conteo preparado con las cantidades actuales. Cambia solo lo que cuentes distinto.")
    setErrorMessage(null)
  }

  function clearPhysicalCount() {
    setPhysicalCountValues({})
    setPhysicalCountNote("")
    setShowOnlyPhysicalCountDifferences(false)
    setSuccessMessage("Conteo físico limpiado. No se cambió el inventario.")
    setErrorMessage(null)
  }

  async function applyPhysicalCount() {
    if (!adminPassword) return

    const reviewedRows = physicalCountRows.filter((row) => row.hasValue)
    const rowsToAdjust = reviewedRows.filter((row) => row.difference !== 0)

    if (!reviewedRows.length) {
      setErrorMessage("Escribe al menos una cantidad contada antes de aplicar el conteo físico.")
      return
    }

    if (!rowsToAdjust.length) {
      setSuccessMessage("Conteo revisado sin diferencias. No se cambió el inventario.")
      setErrorMessage(null)
      return
    }

    try {
      setIsApplyingPhysicalCount(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const updatedItems: InventoryItem[] = []
      const createdMovements: InventoryMovement[] = []
      const failedItems: string[] = []

      for (const row of rowsToAdjust) {
        try {
          const item = row.item
          const response = await fetch("/api/inventory", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-password": adminPassword,
            },
            body: JSON.stringify({
              id: item.id,
              name: item.name,
              category: item.category,
              quantity: row.countedQuantity,
              unit: item.unit,
              minimumStock: item.minimumStock,
              costUSD: item.costUSD,
              costVES: item.costVES,
              equivalentCostUSD: item.equivalentCostUSD || item.costUSD,
              note: item.note,
              isActive: true,
              movementType: "Ajuste",
              movementReason: "Conteo físico",
              movementNote: [
                `Conteo físico registrado. Sistema: ${item.quantity} ${item.unit}. Conteo: ${row.countedQuantity} ${item.unit}.`,
                physicalCountNote.trim(),
              ]
                .filter(Boolean)
                .join(" "),
              relatedExpense: false,
            }),
          })

          const data = await readApiResponse(response)

          if (!response.ok) {
            throw new Error(data.error || "No se pudo aplicar este ajuste")
          }

          const savedItem = normalizeInventoryItem(data.inventoryItem)
          const savedMovement = data.inventoryMovement
            ? normalizeInventoryMovement(data.inventoryMovement)
            : null

          updatedItems.push(savedItem)

          if (savedMovement && savedMovement.id) {
            createdMovements.push(savedMovement)
          }
        } catch {
          failedItems.push(row.item.name)
        }
      }

      if (updatedItems.length) {
        setInventory((currentInventory) =>
          currentInventory.map((currentItem) => {
            const updatedItem = updatedItems.find((item) => item.id === currentItem.id)

            return updatedItem || currentItem
          })
        )
      }

      if (createdMovements.length) {
        setInventoryMovements((currentMovements) => [
          ...createdMovements,
          ...currentMovements,
        ])
      }

      setPhysicalCountValues({})
      setPhysicalCountNote("")
      setShowOnlyPhysicalCountDifferences(false)
      setActiveInventoryModule("movimientos")
      setAreMovementsVisible(true)

      if (failedItems.length) {
        setErrorMessage(
          `Algunos ajustes no se aplicaron: ${failedItems.join(", ")}. Revisa esos productos manualmente.`
        )
        setSuccessMessage(
          `Conteo físico aplicado en ${updatedItems.length} producto(s). Se guardaron movimientos de ajuste.`
        )
      } else {
        setSuccessMessage(
          `Conteo físico aplicado correctamente. Se ajustaron ${updatedItems.length} producto(s) y quedó registrado en historial.`
        )
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo aplicar el conteo físico"
      )
    } finally {
      setIsApplyingPhysicalCount(false)
    }
  }


  async function refreshRecipeInventoryOptions() {
    await loadInventory()
    setSuccessMessage(
      "Insumos y productos del menú actualizados. Ya puedes crear recetas para productos nuevos del menú editable."
    )
    setErrorMessage(null)
  }

  function updateRecipeForm<K extends keyof RecipeForm>(field: K, value: RecipeForm[K]) {
    setRecipeForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function addRecipeIngredient() {
    const item = inventory.find((currentItem) => currentItem.id === recipeForm.ingredientItemId)
    const quantity = parseNumberInput(recipeForm.ingredientQuantity)

    if (!item) {
      setErrorMessage("Selecciona un insumo del inventario para agregar a la receta.")
      return
    }

    if (quantity <= 0) {
      setErrorMessage("Escribe la cantidad que consume esta receta.")
      return
    }

    const nextIngredient: InventoryRecipeIngredient = {
      itemId: item.id,
      itemName: item.name,
      quantity,
      unit: item.unit,
    }

    setRecipeForm((currentForm) => {
      const exists = currentForm.ingredients.some(
        (ingredient) => ingredient.itemId === item.id
      )

      return {
        ...currentForm,
        ingredientItemId: "",
        ingredientQuantity: "",
        ingredients: exists
          ? currentForm.ingredients.map((ingredient) =>
              ingredient.itemId === item.id ? nextIngredient : ingredient
            )
          : [...currentForm.ingredients, nextIngredient],
      }
    })
    setErrorMessage(null)
  }

  function removeRecipeIngredient(itemId: string) {
    setRecipeForm((currentForm) => ({
      ...currentForm,
      ingredients: currentForm.ingredients.filter((ingredient) => ingredient.itemId !== itemId),
    }))
  }

  function resetRecipeForm() {
    setRecipeForm(EMPTY_RECIPE_FORM)
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function editRecipe(recipe: InventoryRecipe) {
    setRecipeForm({
      id: recipe.id,
      productId: String(recipe.productId || ""),
      ingredientItemId: "",
      ingredientQuantity: "",
      ingredients: recipe.ingredients,
      note: recipe.note,
    })
    setIsRecipesVisible(true)
    setActiveInventoryModule("recetas")
    setSuccessMessage("Receta cargada. Puedes editar los insumos y guardar.")
    setErrorMessage(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveRecipe() {
    if (!adminPassword) return

    const productId = Number(recipeForm.productId || 0)
    const product = recipeMenuProducts.find((menuProduct) => menuProduct.id === productId)

    if (!product) {
      setErrorMessage("Selecciona el producto del menú al que pertenece esta receta.")
      return
    }

    if (!recipeForm.ingredients.length) {
      setErrorMessage("Agrega al menos un insumo real del inventario. La nota interna no cuenta como receta ni descuenta stock.")
      return
    }

    try {
      setIsSavingRecipe(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch("/api/inventory-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          id: recipeForm.id || undefined,
          productId: product.id,
          productName: product.name,
          productCategory: product.category,
          ingredients: recipeForm.ingredients,
          note: recipeForm.note,
          isActive: true,
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar la receta")
      }

      const savedRecipe = normalizeInventoryRecipe(data.inventoryRecipe)

      setInventoryRecipes((currentRecipes) => {
        const exists = currentRecipes.some((recipe) => recipe.id === savedRecipe.id)

        if (exists) {
          return currentRecipes.map((recipe) =>
            recipe.id === savedRecipe.id ? savedRecipe : recipe
          )
        }

        return [savedRecipe, ...currentRecipes]
      })
      setRecipeForm(EMPTY_RECIPE_FORM)
      setSuccessMessage("Receta guardada correctamente.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la receta")
    } finally {
      setIsSavingRecipe(false)
    }
  }

  async function deleteRecipe(recipeId: string) {
    if (!adminPassword || !recipeId) return

    try {
      setDeletingRecipeId(recipeId)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/inventory-recipes?id=${encodeURIComponent(recipeId)}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword,
        },
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar la receta")
      }

      setInventoryRecipes((currentRecipes) =>
        currentRecipes.filter((recipe) => recipe.id !== recipeId)
      )
      setSuccessMessage(data.message || "Receta eliminada correctamente.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la receta")
    } finally {
      setDeletingRecipeId(null)
    }
  }

  async function copyInventoryMovementSummary() {
    const movementLines = filteredInventoryMovements.slice(0, 80).map((movement) => {
      const origin = getInventoryMovementOriginLabel(movement)
      const dateLabel = movement.dateLabel || formatDate(movement.createdAt)

      return `${dateLabel} | ${movement.itemName} | ${movement.movementType} · ${origin} | ${movement.previousQuantity} → ${movement.finalQuantity} ${movement.unit} | ${movement.reason || "Movimiento manual"}`
    })

    if (filteredInventoryMovements.length > 80) {
      movementLines.push(`... ${filteredInventoryMovements.length - 80} movimiento(s) más no incluidos en este resumen.`)
    }

    const textToCopy = [
      "HISTORIAL DE INVENTARIO - SANTO PERRITO",
      `Movimientos guardados: ${inventoryMovements.length}`,
      `Movimientos mostrados: ${filteredInventoryMovements.length}`,
      `Entradas: ${filteredMovementSummary.entries}`,
      `Salidas: ${filteredMovementSummary.outputs}`,
      `Ajustes: ${filteredMovementSummary.adjustments}`,
      `Eliminaciones: ${filteredMovementSummary.deletions}`,
      "",
      "RESUMEN POR PRODUCTO",
      movementProductSummary.length
        ? movementProductSummary
            .map((item) => `${item.itemName}: ${item.movements} movimiento(s), entradas ${item.entries}, salidas ${item.outputs}, ajustes ${item.adjustments}, eliminados ${item.deletions}`)
            .join("\n")
        : "No hay productos con los filtros actuales.",
      "",
      "DETALLE",
      movementLines.length ? movementLines.join("\n") : "No hay movimientos con los filtros actuales.",
    ].join("\n")

    try {
      await navigator.clipboard.writeText(textToCopy)
      setSuccessMessage("Resumen del historial copiado correctamente.")
      setErrorMessage(null)
    } catch {
      setErrorMessage("No se pudo copiar el resumen. El navegador bloqueó el portapapeles.")
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="px-6 py-6">
            <a
              href="/local-santo"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
            >
              <ArrowLeft size={16} />
              Volver
            </a>

            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Inventario
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Control de stock
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada para revisar y actualizar el inventario del negocio.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Clave de acceso
              </label>

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleLogin()
                  }}
                  placeholder="Ingresa la clave del local"
                  className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-[1.02] disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={21} className="animate-spin" /> : <LogIn size={21} />}
              {isLoading ? "Validando acceso" : "Entrar al inventario"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      {isResetInventoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--brand-ink-3)]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[1.6rem] border-4 border-red-700 bg-white shadow-2xl">
            <div className="h-4 bg-red-700" />
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700">
                Reinicio seguro de inventario
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase leading-tight text-[var(--brand-primary)]">
                Reiniciar cantidades a cero
              </h2>
              <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                Esta acción conserva productos, costos, stock mínimo, recetas e historial. Solo coloca en cero las cantidades actuales y guarda un movimiento de ajuste por cada producto con stock.
              </p>

              <div className="mt-4 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-sm font-black leading-6 text-[var(--brand-amber)]">
                No borra recetas ni elimina productos. Sirve para empezar un conteo físico desde cero sin perder configuración.
              </div>

              <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Escribe REINICIAR para confirmar
              </label>
              <input
                value={resetInventoryConfirmation}
                onChange={(event) => setResetInventoryConfirmation(event.target.value)}
                placeholder="REINICIAR"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-black uppercase text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetInventoryOpen(false)
                    setResetInventoryConfirmation("")
                  }}
                  disabled={isResettingInventory}
                  className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={resetInventoryQuantities}
                  disabled={isResettingInventory}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-red-700 bg-red-100 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
                >
                  {isResettingInventory ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {isResettingInventory ? "Reiniciando" : "Reiniciar cantidades"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/local-santo"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <button
                    type="button"
                    onClick={() => loadInventory()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsResetInventoryOpen(true)}
                    disabled={isResettingInventory || inventoryTotals.activeItems === 0}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-red-600 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={15} />
                    Reiniciar cantidades
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {businessConfig.businessName}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Inventario real
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Controla insumos, costos, movimientos, alertas y recetas reales sin afectar pedidos, carrito, caja ni cierre del día.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[620px]">
                <MetricCard label="Productos" value={inventoryTotals.activeItems} />
                <MetricCard label="Stock bajo" value={inventoryTotals.lowItems} tone={inventoryTotals.lowItems > 0 ? "warning" : "soft"} />
                <MetricCard label="Agotados" value={inventoryTotals.outItems} tone={inventoryTotals.outItems > 0 ? "danger" : "soft"} />
                <MetricCard label="Valor estimado USD" value={formatUSD(inventoryTotals.estimatedValueUSD)} />
              <MetricCard label="Valor estimado Bs" value={`Bs ${formatVES(inventoryTotals.estimatedValueVES)}`} />
              </div>
            </div>
          </div>
        </header>

        {!canUseInventory && (
          <section className="mt-4 rounded-[1.5rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-[var(--brand-amber)]" size={26} />
              <div>
                <p className="text-sm font-black uppercase text-[var(--brand-amber)]">
                  Inventario no activo
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Inventario básico está disponible desde {inventoryAccess.minimumPlanLabel}. Si el plan ya lo incluye, actívalo desde configuración del negocio.
                </p>
              </div>
            </div>
          </section>
        )}

        {canUseInventory && (
          <>
            <section className="sticky top-0 z-40 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Módulos de inventario
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Abre solo la parte que necesitas. Por defecto se muestran los movimientos para revisar qué cambió.
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[720px] xl:grid-cols-6">
                  {INVENTORY_MODULES.map((module) => (
                    <InventoryModuleButton
                      key={module.key}
                      label={module.label}
                      active={activeInventoryModule === module.key}
                      onClick={() => openInventoryModule(module.key)}
                    />
                  ))}
                </div>
              </div>

              <div id="inventario-modulo-activo" className="mt-3 rounded-[1.1rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Vista actual
                </p>
                <p className="mt-1 text-sm font-black text-[var(--brand-ink-3)]">
                  {activeInventoryModuleInfo.label}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                  {activeInventoryModuleInfo.description}
                </p>
              </div>
            </section>

            {activeInventoryModule === "alertas" && (
            <section id="inventario-alertas" className="scroll-mt-28 mt-4 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Alertas reales y compra sugerida
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Revisa qué está agotado, qué está bajo, qué no tiene costo configurado y qué conviene comprar antes de abrir o antes del fin de semana.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowOnlyAlerts(true)
                    setActiveInventoryModule("productos")
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                >
                  <AlertTriangle size={16} />
                  Ver productos con alerta
                </button>
              </div>

              {!inventoryAlertSummary.hasAlerts ? (
                <div className="mt-4 rounded-[1.3rem] border-2 border-green-500/35 bg-green-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-black uppercase text-green-800">
                    <CheckCircle2 size={18} />
                    Inventario sin alertas críticas
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    No hay productos agotados, bajos, sin stock mínimo ni sin costo configurado.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  <InventoryAlertBox
                    title="Agotados"
                    items={inventoryAlertSummary.outItems.map((item) => `${item.name} · 0 ${item.unit}`)}
                    emptyText="Sin agotados"
                    tone="danger"
                  />
                  <InventoryAlertBox
                    title="Stock bajo"
                    items={inventoryAlertSummary.lowItems.map((item) => `${item.name}: ${item.quantity}/${item.minimumStock} ${item.unit}`)}
                    emptyText="Sin stock bajo"
                    tone="warning"
                  />
                  <InventoryAlertBox
                    title="Sin costo"
                    items={inventoryAlertSummary.missingCostItems.map((item) => item.name)}
                    emptyText="Todos tienen costo"
                    tone="warning"
                  />
                  <InventoryAlertBox
                    title="Compra sugerida"
                    items={inventoryAlertSummary.purchaseSuggestions.map((item) => `Comprar ${item.suggestedQuantity} ${item.unit} de ${item.name}`)}
                    emptyText="Sin compras sugeridas"
                    tone="soft"
                  />
                </div>
              )}
            </section>

                        )}

            {activeInventoryModule === "conteo" && (
            <section id="inventario-conteo" className="scroll-mt-28 mt-4 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Conteo físico y ajustes de cierre
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Compara lo que dice el sistema con lo que realmente se contó en el local. Solo se ajustan los productos con diferencia y cada cambio queda guardado en el historial.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsPhysicalCountVisible((currentValue) => !currentValue)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                  >
                    {isPhysicalCountVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {isPhysicalCountVisible ? "Ocultar conteo" : "Abrir conteo"}
                  </button>

                  {isPhysicalCountVisible && (
                    <button
                      type="button"
                      onClick={fillPhysicalCountWithCurrentInventory}
                      disabled={!activeInventoryItems.length || isApplyingPhysicalCount}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                    >
                      <RefreshCw size={16} />
                      Preparar conteo
                    </button>
                  )}
                </div>
              </div>

              {isPhysicalCountVisible && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="Revisados" value={physicalCountSummary.reviewedCount} />
                    <MetricCard label="Con diferencia" value={physicalCountSummary.changedCount} tone={physicalCountSummary.changedCount > 0 ? "warning" : "soft"} />
                    <MetricCard label="Entradas por conteo" value={physicalCountSummary.positiveAdjustments} tone={physicalCountSummary.positiveAdjustments > 0 ? "success" : "soft"} />
                    <MetricCard label="Salidas por conteo" value={physicalCountSummary.negativeAdjustments} tone={physicalCountSummary.negativeAdjustments > 0 ? "danger" : "soft"} />
                  </div>

                  <div className="rounded-[1.3rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-sm font-black leading-6 text-[var(--brand-amber)]">
                    Usa este conteo al cerrar o al iniciar el día. No borra productos ni recetas; solo corrige cantidades y deja auditoría.
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                    <input
                      value={physicalCountNote}
                      onChange={(event) => setPhysicalCountNote(event.target.value)}
                      placeholder="Nota general del conteo: Ej. conteo de cierre, revisión de nevera, conteo antes de abrir"
                      className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                    />

                    <button
                      type="button"
                      onClick={() => setShowOnlyPhysicalCountDifferences((currentValue) => !currentValue)}
                      className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                    >
                      {showOnlyPhysicalCountDifferences ? "Ver todos" : "Solo diferencias"}
                    </button>

                    <button
                      type="button"
                      onClick={clearPhysicalCount}
                      disabled={isApplyingPhysicalCount}
                      className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                    >
                      Limpiar conteo
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {visiblePhysicalCountRows.map((row) => {
                      const differenceLabel = row.difference > 0
                        ? `+${row.difference}`
                        : String(row.difference)
                      const differenceTone = row.difference > 0
                        ? "border-green-500/35 bg-green-50 text-green-800"
                        : row.difference < 0
                          ? "border-orange-400 bg-orange-50 text-orange-800"
                          : "border-[var(--brand-primary)]/15 bg-white text-[var(--brand-ink-2)]/65"

                      return (
                        <div
                          key={row.item.id}
                          className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                                {row.item.category}
                              </p>
                              <h3 className="mt-1 text-lg font-black uppercase text-[var(--brand-primary)]">
                                {row.item.name}
                              </h3>
                              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                                Sistema: {row.item.quantity} {row.item.unit} · mínimo {row.item.minimumStock} {row.item.unit}
                              </p>
                            </div>

                            <span className={`rounded-full border-2 px-3 py-1 text-xs font-black ${differenceTone}`}>
                              Diferencia: {row.hasValue ? `${differenceLabel} ${row.item.unit}` : "sin revisar"}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.rawValue}
                              onChange={(event) => updatePhysicalCountValue(row.item.id, event.target.value)}
                              placeholder={`Contado real en ${row.item.unit}`}
                              className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-base font-black text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]"
                            />

                            <button
                              type="button"
                              onClick={() => updatePhysicalCountValue(row.item.id, String(row.item.quantity || 0))}
                              className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                            >
                              Igual
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {visiblePhysicalCountRows.length === 0 && (
                    <div className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 text-sm font-black text-[var(--brand-ink-2)]/65">
                      No hay diferencias para mostrar. Cambia una cantidad contada o desactiva “Solo diferencias”.
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={applyPhysicalCount}
                      disabled={isApplyingPhysicalCount || physicalCountSummary.reviewedCount === 0}
                      className="inline-flex min-h-[48px] w-full max-w-[320px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                    >
                      {isApplyingPhysicalCount ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                      Aplicar conteo físico
                    </button>

                    <p className="max-w-2xl text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                      Solo se guardarán movimientos para productos con diferencia. Si el conteo coincide con el sistema, no se cambia nada.
                    </p>
                  </div>
                </div>
              )}
            </section>

                        )}

            {activeInventoryModule === "recetas" && (
            <section id="inventario-recetas" className="scroll-mt-28 mt-4 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Recetas de productos
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    El dueño puede definir qué insumos consume cada producto del menú. Esto prepara el descuento automático sin usar recetas genéricas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRecipesVisible((currentValue) => !currentValue)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                >
                  {isRecipesVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isRecipesVisible ? "Ocultar recetas" : "Mostrar recetas"}
                </button>
              </div>

              {isRecipesVisible && (
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Crear o editar receta
                    </p>

                    <div className="mt-3 grid gap-3">
                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Producto del menú
                          </label>
                          <button
                            type="button"
                            onClick={() => loadMenuProductsForRecipes()}
                            disabled={isLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            Actualizar menú
                          </button>
                        </div>
                        <select
                          value={recipeForm.productId}
                          onChange={(event) => updateRecipeForm("productId", event.target.value)}
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          <option value="">Selecciona un producto</option>
                          {recipeMenuProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} · {product.category}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                          Si creaste un producto nuevo en Menú editable y no aparece aquí, presiona Actualizar menú. Este selector ya no depende solo del menú escrito en código.
                        </p>
                      </div>

                      <div className="rounded-[1.2rem] border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-sm font-black leading-6 text-[var(--brand-amber)]">
                        La receta se arma seleccionando insumos reales del inventario y presionando Agregar. La nota interna no descuenta inventario y no debe usarse para escribir cantidades como “1 salchicha”.
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                        <div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Insumo real del inventario
                            </label>
                            <button
                              type="button"
                              onClick={refreshRecipeInventoryOptions}
                              disabled={isLoading}
                              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              Actualizar insumos
                            </button>
                          </div>

                          <input
                            value={recipeIngredientSearch}
                            onChange={(event) => setRecipeIngredientSearch(event.target.value)}
                            placeholder="Buscar insumo: pan, salchicha polaca, queso..."
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />

                          <select
                            value={recipeForm.ingredientItemId}
                            onChange={(event) => updateRecipeForm("ingredientItemId", event.target.value)}
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            <option value="">Selecciona un insumo guardado</option>
                            {selectedRecipeIngredient &&
                              !recipeAvailableInventory.some((item) => item.id === selectedRecipeIngredient.id) && (
                                <option value={selectedRecipeIngredient.id}>
                                  {selectedRecipeIngredient.name} · {selectedRecipeIngredient.unit}
                                </option>
                              )}
                            {recipeAvailableInventory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · {item.category} · {item.unit}
                              </option>
                            ))}
                          </select>

                          {recipeAvailableInventory.length === 0 && (
                            <p className="mt-2 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                              No hay insumos que coincidan con esa búsqueda. Créalo primero en “Nuevo producto o ajuste”, guarda inventario y luego presiona Actualizar insumos.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Cantidad que descuenta
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={recipeForm.ingredientQuantity}
                            onChange={(event) => updateRecipeForm("ingredientQuantity", event.target.value)}
                            placeholder="Ej: 1"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={addRecipeIngredient}
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                        >
                          <Plus size={16} />
                          Agregar insumo
                        </button>
                      </div>

                      <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Insumos de esta receta
                        </p>

                        {recipeForm.ingredients.length === 0 ? (
                          <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                            Todavía no agregaste insumos. Selecciona un insumo real del inventario, escribe la cantidad que consume y presiona Agregar insumo.
                          </p>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recipeForm.ingredients.map((ingredient) => (
                              <span
                                key={ingredient.itemId}
                                className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-2 text-xs font-black text-[var(--brand-ink)]"
                              >
                                {ingredient.itemName}: {ingredient.quantity} {ingredient.unit}
                                <button
                                  type="button"
                                  onClick={() => removeRecipeIngredient(ingredient.itemId)}
                                  className="rounded-full bg-red-100 p-1 text-red-700"
                                  aria-label={`Quitar ${ingredient.itemName} de la receta`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Nota interna de receta · no descuenta inventario
                        </label>
                        <input
                          value={recipeForm.note}
                          onChange={(event) => updateRecipeForm("note", event.target.value)}
                          placeholder="Ej: usar poca salsa, queso opcional o revisar porciones reales"
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                        />
                        <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                          Esta nota es solo informativa. Para que el inventario descuente, el insumo debe aparecer arriba en “Insumos de esta receta”.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={saveRecipe}
                          disabled={isSavingRecipe}
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                        >
                          {isSavingRecipe ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                          Guardar receta
                        </button>

                        <button
                          type="button"
                          onClick={resetRecipeForm}
                          disabled={isSavingRecipe}
                          className="min-h-[46px] rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          Limpiar receta
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Recetas guardadas
                    </p>
                    {inventoryRecipes.length === 0 ? (
                      <p className="mt-3 rounded-2xl bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                        Todavía no hay recetas guardadas. Define una receta por producto para poder descontar inventario automáticamente en una fase posterior.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {inventoryRecipes.map((recipe) => (
                          <article key={recipe.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                                  {recipe.productCategory || "Producto"}
                                </p>
                                <h3 className="mt-1 text-lg font-black uppercase text-[var(--brand-ink-3)]">
                                  {recipe.productName}
                                </h3>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => editRecipe(recipe)}
                                  className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRecipe(recipe.id)}
                                  disabled={deletingRecipeId === recipe.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
                                >
                                  {deletingRecipeId === recipe.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  Eliminar
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {recipe.ingredients.map((ingredient) => (
                                <span key={ingredient.itemId} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[var(--brand-ink)]">
                                  {ingredient.itemName}: {ingredient.quantity} {ingredient.unit}
                                </span>
                              ))}
                            </div>

                            {recipe.note && (
                              <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                                {recipe.note}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

                        )}

            {activeInventoryModule === "nuevo" && (
            <section id="inventario-nuevo" className="scroll-mt-28 mt-4 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Nuevo producto o ajuste
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                    Puedes registrar insumos, bebidas, empaques o productos internos. Las entradas pueden registrarse también como gasto del día cuando el módulo de gastos esté activo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormVisible((currentValue) => !currentValue)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  {isFormVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  {isFormVisible ? "Ocultar formulario" : "Mostrar formulario"}
                </button>
              </div>

              {isFormVisible && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="lg:col-span-2 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Producto rápido
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                          Abre la lista para elegir insumos frecuentes como pan, salchichas, papas o bebidas. También puedes elegir Escribir otro y escribirlo manualmente.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAreQuickItemsVisible((currentValue) => !currentValue)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                      >
                        {areQuickItemsVisible ? <EyeOff size={16} /> : <Plus size={16} />}
                        {areQuickItemsVisible ? "Ocultar lista" : "Editar lista"}
                      </button>
                    </div>

                    <select
                      value={selectedQuickInventoryId}
                      onChange={(event) => applyQuickInventoryItem(event.target.value)}
                      className="mt-3 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    >
                      <option value="">Selecciona un producto rápido</option>
                      {quickInventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.category} · {item.unit}
                        </option>
                      ))}
                      <option value="custom">Escribir otro</option>
                    </select>

                    {areQuickItemsVisible && (
                      <div className="mt-4 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Administrar insumos rápidos
                        </p>

                        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_170px_150px_auto]">
                          <input
                            value={newQuickItemName}
                            onChange={(event) => setNewQuickItemName(event.target.value)}
                            placeholder="Ej: Carbón, salsa de ajo, envases"
                            className="rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />

                          <select
                            value={newQuickItemCategory}
                            onChange={(event) => setNewQuickItemCategory(event.target.value)}
                            className="rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {INVENTORY_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>

                          <select
                            value={newQuickItemUnit}
                            onChange={(event) => setNewQuickItemUnit(event.target.value)}
                            className="rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={addQuickInventoryItem}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                          >
                            <Plus size={15} />
                            Agregar
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {quickInventoryItems.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-xs font-black text-[var(--brand-ink)]"
                            >
                              {item.name}
                              <button
                                type="button"
                                onClick={() => removeQuickInventoryItem(item.id)}
                                className="rounded-full bg-red-100 p-1 text-red-700"
                                aria-label={`Eliminar ${item.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={restoreDefaultQuickInventoryItems}
                          className="mt-3 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Restaurar lista base
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Nombre
                    </label>
                    <input
                      value={form.name}
                      onChange={(event) => {
                        setSelectedQuickInventoryId("custom")
                        updateForm("name", event.target.value)
                      }}
                      placeholder="Ej: Pan de perro, salchichas, papas, refrescos"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Categoría
                    </label>
                    <select
                      value={form.category}
                      onChange={(event) => updateForm("category", event.target.value)}
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    >
                      {!INVENTORY_CATEGORIES.includes(form.category) && (
                        <option value={form.category}>{form.category}</option>
                      )}
                      {INVENTORY_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Unidad
                    </label>
                    <select
                      value={form.unit}
                      onChange={(event) => updateForm("unit", event.target.value)}
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    >
                      {!UNIT_OPTIONS.includes(form.unit) && (
                        <option value={form.unit}>{form.unit}</option>
                      )}
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Cantidad actual
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.quantity}
                      onChange={(event) => updateForm("quantity", event.target.value)}
                      placeholder="Ej: 24"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Stock mínimo
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.minimumStock}
                      onChange={(event) => updateForm("minimumStock", event.target.value)}
                      placeholder="Ej: 5"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Costo aproximado USD
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.costUSD}
                      onChange={(event) => updateForm("costUSD", event.target.value)}
                      placeholder="Opcional"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Costo aproximado Bs
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.costVES}
                      onChange={(event) => updateForm("costVES", event.target.value)}
                      placeholder="Opcional"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Equiv. costo USD
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.equivalentCostUSD}
                      onChange={(event) => updateForm("equivalentCostUSD", event.target.value)}
                      placeholder="Opcional si ya escribiste USD"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Nota
                    </label>
                    <input
                      value={form.note}
                      onChange={(event) => updateForm("note", event.target.value)}
                      placeholder="Ej: comprar antes del fin de semana"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div className="lg:col-span-2 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Relación con gastos
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                          Si esta entrada viene de una compra, puedes guardar el movimiento de inventario y registrar el gasto del día en el mismo paso.
                        </p>
                        {entryQuantityDelta > 0 && (
                          <p className="mt-2 rounded-2xl bg-[var(--brand-cream)] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                            Entrada detectada: +{entryQuantityDelta} {form.unit}
                          </p>
                        )}
                      </div>

                      <label className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] ${
                        canShowExpenseLink
                          ? "cursor-pointer border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                          : "cursor-not-allowed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)]/55"
                      }`}>
                        <input
                          type="checkbox"
                          checked={registerExpenseWithEntry && canShowExpenseLink}
                          onChange={(event) =>
                            setRegisterExpenseWithEntry(event.target.checked)
                          }
                          disabled={!canShowExpenseLink}
                          className="h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        Registrar como gasto
                      </label>
                    </div>

                    {!canRegisterExpenses && (
                      <p className="mt-3 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-xs font-black leading-5 text-[var(--brand-amber)]">
                        El módulo de gastos no está activo. Puedes mover inventario, pero no registrar gasto automático desde aquí.
                      </p>
                    )}

                    {canRegisterExpenses && entryQuantityDelta <= 0 && (
                      <p className="mt-3 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                        Para registrar un gasto desde inventario, la cantidad actual debe quedar mayor que la cantidad anterior.
                      </p>
                    )}

                    {registerExpenseWithEntry && canShowExpenseLink && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="lg:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Concepto del gasto
                          </label>
                          <input
                            value={expenseForm.concept}
                            onChange={(event) => updateExpenseForm("concept", event.target.value)}
                            placeholder={`Compra de ${form.name || "producto"}`}
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Categoría del gasto
                          </label>
                          <select
                            value={expenseForm.category}
                            onChange={(event) => updateExpenseForm("category", event.target.value)}
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {EXPENSE_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Método
                          </label>
                          <select
                            value={expenseForm.method}
                            onChange={(event) => updateExpenseForm("method", event.target.value)}
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          >
                            {EXPENSE_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Monto en divisas
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expenseForm.amountUSD}
                            onChange={(event) => updateExpenseForm("amountUSD", event.target.value)}
                            placeholder="Ej: 18.00"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Monto en bolívares
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expenseForm.amountVES}
                            onChange={(event) => updateExpenseForm("amountVES", event.target.value)}
                            placeholder="Ej: 1200,00"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Equivalente total USD
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expenseForm.equivalentUSD}
                            onChange={(event) => updateExpenseForm("equivalentUSD", event.target.value)}
                            placeholder="Obligatorio si el gasto incluye bolívares"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                          <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                            Si pagaste solo en divisas, el sistema usa ese monto como equivalente. Si pagaste bolívares o mixto, escribe el equivalente total para que el cierre calcule bien el neto.
                          </p>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                            Nota del gasto
                          </label>
                          <input
                            value={expenseForm.note}
                            onChange={(event) => updateExpenseForm("note", event.target.value)}
                            placeholder="Ej: compra de insumos para el fin de semana"
                            className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={saveItem}
                      disabled={isSaving}
                      className="inline-flex min-h-[48px] w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                      Guardar inventario
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isSaving}
                      className="min-h-[48px] w-full max-w-[280px] rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                    >
                      Limpiar formulario
                    </button>
                  </div>
                </div>
              )}
            </section>

                        )}

            {(errorMessage || successMessage) && (
              <section className="mt-4">
                {errorMessage && (
                  <div className="rounded-2xl border-2 border-red-500/35 bg-red-100 px-4 py-3">
                    <p className="text-sm font-black text-red-800">{errorMessage}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-2xl border-2 border-green-500/35 bg-green-50 px-4 py-3">
                    <p className="text-sm font-black text-green-800">{successMessage}</p>
                  </div>
                )}
              </section>
            )}

            {activeInventoryModule === "productos" && (
            <section id="inventario-productos" className="scroll-mt-28 sticky top-0 z-30 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-3 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Productos de inventario
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Mostrando {filteredInventory.length} de {inventoryTotals.activeItems} producto(s)
                    {hasActiveInventoryFilters ? " · filtros activos" : " · sin filtros activos"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreInventoryFiltersVisible((currentValue) => !currentValue)}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                      areInventoryFiltersVisible || hasActiveInventoryFilters
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
                    }`}
                  >
                    <Search size={16} />
                    {areInventoryFiltersVisible ? "Ocultar búsqueda" : "Buscar / filtrar"}
                  </button>

                  {hasActiveInventoryFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText("")
                        setCategoryFilter("Todas")
                        setShowOnlyAlerts(false)
                      }}
                      className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {areInventoryFiltersVisible ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                    />
                    <input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Buscar por nombre, categoría, unidad o nota"
                      className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowOnlyAlerts((currentValue) => !currentValue)}
                    className={`rounded-full border-2 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                      showOnlyAlerts
                        ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                    }`}
                  >
                    Alertas
                  </button>
                </div>
              ) : hasActiveInventoryFilters ? (
                <div className="mt-3 rounded-[1.1rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                  <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                    Filtros activos:
                    {searchText.trim() ? ` búsqueda “${searchText.trim()}”` : ""}
                    {categoryFilter !== "Todas" ? ` · categoría ${categoryFilter}` : ""}
                    {showOnlyAlerts ? " · solo alertas" : ""}
                  </p>
                </div>
              ) : null}
            </section>

                        )}

            {activeInventoryModule === "movimientos" && (
            <section id="inventario-historial" className="scroll-mt-28 mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Historial completo de inventario
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Auditoría completa de entradas, salidas, reinicios, ajustes, gastos y eliminaciones. Los filtros se pueden ocultar para revisar el historial sin ocupar tanta pantalla.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreMovementsVisible((currentValue) => !currentValue)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                  >
                    {areMovementsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {areMovementsVisible ? "Ocultar" : "Mostrar"}
                  </button>

                  {areMovementsVisible && (
                    <button
                      type="button"
                      onClick={() => setAreMovementFiltersVisible((currentValue) => !currentValue)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                        areMovementFiltersVisible || hasActiveMovementFilters
                          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                          : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
                      }`}
                    >
                      <Search size={16} />
                      {areMovementFiltersVisible ? "Ocultar filtros" : "Mostrar filtros"}
                    </button>
                  )}

                  {areMovementsVisible && (
                    <button
                      type="button"
                      onClick={copyInventoryMovementSummary}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                    >
                      Copiar resumen
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => loadInventory()}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
                  </button>
                </div>
              </div>

              {areMovementsVisible ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <MovementSummaryBox label="Guardados" value={inventoryMovements.length} />
                    <MovementSummaryBox label="Mostrando" value={filteredInventoryMovements.length} />
                    <MovementSummaryBox label="Entradas" value={filteredMovementSummary.entries} />
                    <MovementSummaryBox label="Salidas" value={filteredMovementSummary.outputs} />
                    <MovementSummaryBox label="Ajustes" value={filteredMovementSummary.adjustments} />
                    <MovementSummaryBox label="Eliminados" value={filteredMovementSummary.deletions} />
                  </div>

                  <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Resumen por producto
                        </p>
                        <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                          Agrupa el historial filtrado para saber qué productos tuvieron más movimientos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMovementProductSummaryVisible((currentValue) => !currentValue)}
                        className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                      >
                        {isMovementProductSummaryVisible ? "Ocultar resumen" : "Ver resumen"}
                      </button>
                    </div>

                    {isMovementProductSummaryVisible && (
                      <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                        {movementProductSummary.length === 0 ? (
                          <p className="rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                            No hay productos para resumir con los filtros actuales.
                          </p>
                        ) : (
                          movementProductSummary.slice(0, 9).map((productSummary) => (
                            <div
                              key={productSummary.itemName}
                              className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3"
                            >
                              <p className="text-sm font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                                {productSummary.itemName}
                              </p>
                              <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                                {productSummary.movements} movimiento(s)
                              </p>
                              <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                                Entradas: {productSummary.entries} · Salidas: {productSummary.outputs} · Ajustes: {productSummary.adjustments} · Eliminados: {productSummary.deletions}
                              </p>
                              <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                                Último: {productSummary.latestType || "—"} · {formatDate(productSummary.latestDate)}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {!areMovementFiltersVisible && (
                    <div className="flex flex-col gap-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                        {hasActiveMovementFilters
                          ? "Hay filtros activos. Presiona Mostrar filtros para cambiarlos o Limpiar filtros para ver todo."
                          : "Filtros ocultos. Estás viendo el historial completo ordenado por movimientos más recientes."}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {hasActiveMovementFilters && (
                          <button
                            type="button"
                            onClick={() => {
                              setMovementSearchText("")
                              setMovementItemFilter("Todos")
                              setMovementTypeFilter("Todos")
                              setMovementOriginFilter("Todos")
                              setMovementDateFilter("")
                            }}
                            className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                          >
                            Limpiar filtros
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAreMovementFiltersVisible(true)}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                        >
                          Mostrar filtros
                        </button>
                      </div>
                    </div>
                  )}

                  {areMovementFiltersVisible && (
                    <div className="rounded-[1.3rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Filtros del historial
                        </p>
                        <button
                          type="button"
                          onClick={() => setAreMovementFiltersVisible(false)}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Minimizar filtros
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_180px_180px_180px_160px_160px]">
                        <div className="relative">
                          <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
                          />
                          <input
                            value={movementSearchText}
                            onChange={(event) => setMovementSearchText(event.target.value)}
                            placeholder="Buscar movimiento, producto, motivo o nota"
                            className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                          />
                        </div>

                        <select
                          value={movementItemFilter}
                          onChange={(event) => setMovementItemFilter(event.target.value)}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          {movementItemOptions.map((itemName) => (
                            <option key={itemName} value={itemName}>
                              {itemName === "Todos" ? "Todos los productos" : itemName}
                            </option>
                          ))}
                        </select>

                        <select
                          value={movementTypeFilter}
                          onChange={(event) => setMovementTypeFilter(event.target.value)}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          {movementTypeOptions.map((movementType) => (
                            <option key={movementType} value={movementType}>
                              {movementType === "Todos" ? "Todos los tipos" : movementType}
                            </option>
                          ))}
                        </select>

                        <select
                          value={movementOriginFilter}
                          onChange={(event) => setMovementOriginFilter(event.target.value)}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          {[
                            "Todos",
                            "Gasto",
                            "Reinicio",
                            "Venta",
                            "Entrada manual",
                            "Salida manual",
                            "Ajuste manual",
                            "Eliminación",
                          ].map((origin) => (
                            <option key={origin} value={origin}>
                              {origin === "Todos" ? "Todos los orígenes" : origin}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={movementDateFilter}
                          onChange={(event) => setMovementDateFilter(event.target.value)}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                        />

                        <select
                          value={movementSortMode}
                          onChange={(event) => setMovementSortMode(event.target.value as "recent" | "oldest")}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                        >
                          <option value="recent">Más recientes</option>
                          <option value="oldest">Más antiguos</option>
                        </select>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setMovementDateFilter(getTodayDateKeyInCaracas())}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovementOriginFilter("Gasto")}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Solo gastos
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovementOriginFilter("Reinicio")}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Reinicios
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovementOriginFilter("Venta")}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Ventas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMovementSearchText("")
                            setMovementItemFilter("Todos")
                            setMovementTypeFilter("Todos")
                            setMovementOriginFilter("Todos")
                            setMovementDateFilter("")
                            setMovementSortMode("recent")
                          }}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    </div>
                  )}

                  {inventoryMovements.length === 0 ? (
                    <p className="rounded-2xl bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                      Todavía no hay movimientos guardados. Cuando registres una entrada, salida, ajuste, reinicio o eliminación, aparecerá aquí.
                    </p>
                  ) : filteredInventoryMovements.length === 0 ? (
                    <p className="rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-amber)]">
                      No hay movimientos que coincidan con los filtros actuales. Limpia los filtros para ver el historial completo.
                    </p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {filteredInventoryMovements.map((movement) => {
                        const movementTone = getInventoryMovementTone(movement)
                        const originLabel = getInventoryMovementOriginLabel(movement)

                        return (
                          <article
                            key={movement.id}
                            className={`rounded-2xl border-2 p-4 ${movementTone}`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
                                  {movement.movementType} · {originLabel}
                                </p>
                                <h3 className="mt-1 text-base font-black uppercase text-[var(--brand-ink-3)]">
                                  {movement.itemName}
                                </h3>
                                <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                                  {movement.reason || "Movimiento manual"}
                                </p>
                              </div>

                              <div className="text-left sm:text-right">
                                <p className="text-lg font-black text-[var(--brand-primary)]">
                                  {movement.previousQuantity} → {movement.finalQuantity}
                                </p>
                                <p className="text-xs font-black text-[var(--brand-ink-2)]/65">
                                  Movido: {movement.quantityMoved} {movement.unit}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-4">
                              <InfoBox label="Origen" value={originLabel} />
                              <InfoBox label="Antes" value={`${movement.previousQuantity} ${movement.unit}`} />
                              <InfoBox label="Movimiento" value={`${movement.quantityMoved} ${movement.unit}`} />
                              <InfoBox label="Después" value={`${movement.finalQuantity} ${movement.unit}`} />
                            </div>

                            {(movement.relatedExpense || movement.expenseId || movement.note) && (
                              <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                                {movement.relatedExpense ? "Relacionado con gasto. " : ""}
                                {movement.expenseId ? `ID gasto: ${movement.expenseId}. ` : ""}
                                {movement.note}
                              </p>
                            )}

                            <p className="mt-2 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                              {movement.dateLabel || formatDate(movement.createdAt)}
                            </p>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-amber)]">
                  Historial oculto. Hay {inventoryMovements.length} movimiento(s) guardado(s).
                </p>
              )}
            </section>

                        )}

            {activeInventoryModule === "productos" && (filteredInventory.length === 0 ? (
              <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white px-6 py-14 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]">
                <PackageCheck className="mx-auto text-[var(--brand-primary)]" size={54} />
                <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
                  Sin productos de inventario
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Registra el primer producto de inventario desde el formulario superior.
                </p>
              </section>
            ) : (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item)
                  const statusClasses =
                    status.tone === "danger"
                      ? "border-red-500 bg-red-50 text-red-800"
                      : status.tone === "warning"
                        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
                        : "border-green-500/40 bg-green-50 text-green-800"

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)]"
                    >
                      <div className="border-b-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              {item.category}
                            </p>
                            <h2 className="mt-1 text-2xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_2px_0_rgba(var(--brand-accent-rgb),0.75)]">
                              {item.name}
                            </h2>
                          </div>

                          <span className={`inline-flex w-fit items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${statusClasses}`}>
                            {status.tone === "good" ? <CheckCircle2 size={15} /> : status.tone === "warning" ? <AlertTriangle size={15} /> : <XCircle size={15} />}
                            {status.label}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <InfoBox label="Cantidad" value={`${item.quantity} ${item.unit}`} />
                          <InfoBox label="Stock mínimo" value={`${item.minimumStock} ${item.unit}`} />
                          <InfoBox label="Costo USD" value={formatUSD(item.costUSD)} />
                          <InfoBox label="Costo Bs" value={`Bs ${formatVES(item.costVES)}`} />
                          <InfoBox label="Equiv. USD" value={formatUSD(item.equivalentCostUSD || item.costUSD)} />
                        </div>

                        {item.note && (
                          <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
                            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                              Nota
                            </p>
                            <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                              {item.note}
                            </p>
                          </div>
                        )}

                        <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">
                          Actualizado: {formatDate(item.updatedAt)}
                        </p>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item, 1)}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink)]"
                          >
                            <Plus size={16} />
                            Entrada
                          </button>

                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item, -1)}
                            className="min-h-[44px] rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"
                          >
                            Salida
                          </button>

                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="min-h-[44px] rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            disabled={deletingItemId === item.id}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-red-100 px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-50"
                          >
                            {deletingItemId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  )
}

function InventoryModuleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[42px] w-full items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-[0.66rem] font-black uppercase leading-tight tracking-[0.1em] transition ${
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.16)]"
          : "border-[var(--brand-primary)]/35 bg-[var(--brand-cream)] text-[var(--brand-primary)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
      }`}
    >
      {label}
    </button>
  )
}

function InventoryAlertBox({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string
  items: string[]
  emptyText: string
  tone: "danger" | "warning" | "soft"
}) {
  const style =
    tone === "danger"
      ? "border-red-500/45 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
        : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]"

  return (
    <div className={`rounded-[1.2rem] border-2 p-4 ${style}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em]">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm font-bold leading-6 opacity-75">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item} className="text-sm font-black leading-5">
              {item}
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-xs font-black uppercase tracking-[0.12em] opacity-70">
              +{items.length - 5} más
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = "soft",
}: {
  label: string
  value: string | number
  tone?: "soft" | "warning" | "danger" | "success"
}) {
  const style =
    tone === "danger"
      ? "border-red-500/45 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
        : tone === "success"
          ? "border-green-500/45 bg-green-50 text-green-800"
          : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"

  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.2rem] border-2 p-3 ${style}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 break-words text-xl font-black leading-tight sm:text-2xl">{value}</p>
    </div>
  )
}

function MovementSummaryBox({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-[1.1rem] border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3">
      <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[var(--brand-ink-3)]">{value}</p>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[var(--brand-ink-3)]">
        {value || "—"}
      </p>
    </div>
  )
}
