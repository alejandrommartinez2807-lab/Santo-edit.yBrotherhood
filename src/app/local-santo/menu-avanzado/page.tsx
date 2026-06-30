"use client"

import { BRAND } from "@/lib/brand"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react"
import {
  type Product,
  type ProductPaymentMode,
  type ProductSalesChannel,
  type ProductType,
} from "@/data/products"
import { formatUSD } from "@/utils/formatCurrency"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

const SALES_CHANNEL_OPTIONS: {
  value: ProductSalesChannel
  label: string
}[] = [
  { value: "local", label: "Local" },
  { value: "takeaway", label: "Para llevar" },
  { value: "delivery", label: "Delivery" },
]

const PRODUCT_TYPE_OPTIONS: {
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

type OptionValue = {
  id?: string
  name: string
  priceDelta?: number
  price?: number
  isActive?: boolean
  sortOrder?: number
  maxQuantity?: number
  included?: boolean
  removable?: boolean
  extraPrice?: number
}

type VariationGroup = {
  id?: string
  name: string
  type: "single" | "multiple"
  required: boolean
  minSelections: number
  maxSelections: number
  values: OptionValue[]
  sortOrder?: number
}

type SelectionRules = {
  notes?: string
  minAddons?: number
  maxAddons?: number
  requiresStaffReview?: boolean
}

type MenuProduct = Product & {
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

type AdvancedForm = {
  productType: ProductType
  salesChannels: ProductSalesChannel[]
  variationsText: string
  addonsText: string
  includedIngredientsText: string
  removableIngredientsText: string
  preparationMinutes: string
  requiresWaiterConfirmation: boolean
  inventoryDiscountEnabled: boolean
  maxAddons: string
  internalRulesNote: string
}

type ApiResponse = {
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

const EMPTY_FORM: AdvancedForm = {
  productType: "normal",
  salesChannels: ["local", "takeaway", "delivery"],
  variationsText: "",
  addonsText: "",
  includedIngredientsText: "",
  removableIngredientsText: "",
  preparationMinutes: "",
  requiresWaiterConfirmation: false,
  inventoryDiscountEnabled: true,
  maxAddons: "",
  internalRulesNote: "",
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(String(value || "").replace(",", "."))

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round(numberValue)
}

function normalizePaymentMode(value: unknown): ProductPaymentMode {
  return value === "divisa" ? "divisa" : "mixto"
}

function normalizeProductType(value: unknown): ProductType {
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

function normalizeSalesChannels(value: unknown): ProductSalesChannel[] {
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

function normalizeUnknownArray(value: unknown): unknown[] {
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

function normalizeSelectionRules(value: unknown): SelectionRules {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as SelectionRules
  }

  return {}
}

function normalizeMenuProduct(value: unknown): MenuProduct | null {
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
    selectionRules: normalizeSelectionRules(source.selectionRules),
    preparationMinutes: normalizePositiveInteger(source.preparationMinutes),
    requiresWaiterConfirmation: source.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: source.inventoryDiscountEnabled !== false,
    premiumSummary: String(source.premiumSummary || "").trim(),
  }
}

function normalizeMenuProducts(value: unknown): MenuProduct[] {
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

function splitCleanLines(value: string) {
  return value
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeLineParts(line: string) {
  return line
    .split("|")
    .map((part) => part.trim())
    .filter((part, index) => index === 0 || part.length > 0)
}

function normalizeTextName(value: unknown) {
  return String(value || "").trim()
}

function optionId(prefix: string, index: number, name: string) {
  return `${prefix}-${index + 1}-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 28)}`
}

function parseVariationGroupsFromText(value: string): VariationGroup[] {
  const groups: VariationGroup[] = []
  let currentGroup: VariationGroup | null = null

  splitCleanLines(value).forEach((line) => {
    const groupMatch = line.match(/^\[(.+)]$/)

    if (groupMatch) {
      const groupName = groupMatch[1].trim()

      if (!groupName) return

      currentGroup = {
        id: optionId("grupo", groups.length, groupName),
        name: groupName,
        type: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: [],
        sortOrder: groups.length + 1,
      }
      groups.push(currentGroup)
      return
    }

    const [rawName, rawPriceDelta] = normalizeLineParts(line)
    const name = normalizeTextName(rawName)

    if (!name) return

    if (!currentGroup) {
      currentGroup = {
        id: "grupo-opciones-producto",
        name: "Opciones del producto",
        type: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: [],
        sortOrder: groups.length + 1,
      }
      groups.push(currentGroup)
    }

    currentGroup.values.push({
      id: optionId("opcion", currentGroup.values.length, name),
      name,
      priceDelta: normalizeNumber(rawPriceDelta),
      isActive: true,
      sortOrder: currentGroup.values.length + 1,
    })
  })

  return groups.filter((group) => group.values.length > 0)
}

function parseAddonsFromText(value: string): OptionValue[] {
  return splitCleanLines(value).map((line, index) => {
    const [rawName, rawPrice, rawMaxQuantity] = normalizeLineParts(line)
    const name = normalizeTextName(rawName)
    const maxQuantity = normalizePositiveInteger(rawMaxQuantity) || 1

    return {
      id: optionId("adicional", index, name),
      name,
      price: normalizeNumber(rawPrice),
      isActive: true,
      maxQuantity,
      sortOrder: index + 1,
    }
  }).filter((item) => item.name)
}

function parseIngredientsFromText(value: string, mode: "included" | "removable"): OptionValue[] {
  return splitCleanLines(value).map((line, index) => {
    const [rawName, rawExtraPrice] = normalizeLineParts(line)
    const name = normalizeTextName(rawName)

    return {
      id: optionId(mode === "included" ? "incluido" : "removible", index, name),
      name,
      included: mode === "included",
      removable: mode === "removable",
      extraPrice: normalizeNumber(rawExtraPrice),
      isActive: true,
      sortOrder: index + 1,
    }
  }).filter((item) => item.name)
}

function variationGroupsToText(value: unknown) {
  const lines: string[] = []

  normalizeUnknownArray(value).forEach((group) => {
    if (!group || typeof group !== "object") return

    const source = group as { name?: unknown; values?: unknown[] }
    const groupName = normalizeTextName(source.name)

    if (groupName) lines.push(`[${groupName}]`)

    if (Array.isArray(source.values)) {
      source.values.forEach((option) => {
        if (!option || typeof option !== "object") return

        const child = option as { name?: unknown; priceDelta?: unknown }
        const name = normalizeTextName(child.name)
        const priceDelta = normalizeNumber(child.priceDelta)

        if (name) lines.push(`${name} | ${priceDelta}`)
      })
      return
    }

    const direct = group as { name?: unknown; priceDelta?: unknown }
    const name = normalizeTextName(direct.name)

    if (name && name !== groupName) {
      lines.push(`${name} | ${normalizeNumber(direct.priceDelta)}`)
    }
  })

  return lines.join("\n")
}

function addonsToText(value: unknown) {
  return normalizeUnknownArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") return ""

      const source = item as { name?: unknown; price?: unknown; priceDelta?: unknown; maxQuantity?: unknown }
      const name = normalizeTextName(source.name)

      if (!name) return ""

      const price = normalizeNumber(source.price ?? source.priceDelta)
      const maxQuantity = normalizePositiveInteger(source.maxQuantity) || 1

      return `${name} | ${price} | ${maxQuantity}`
    })
    .filter(Boolean)
    .join("\n")
}

function ingredientsToText(value: unknown) {
  return normalizeUnknownArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") return ""

      const source = item as { name?: unknown; extraPrice?: unknown }
      const name = normalizeTextName(source.name)

      if (!name) return ""

      const extraPrice = normalizeNumber(source.extraPrice)

      return extraPrice > 0 ? `${name} | ${extraPrice}` : name
    })
    .filter(Boolean)
    .join("\n")
}

function buildPremiumSummary(input: {
  productType: ProductType
  salesChannels: ProductSalesChannel[]
  variations: VariationGroup[]
  addons: OptionValue[]
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
  if (input.removableIngredients.length) details.push(`Removibles: ${input.removableIngredients.length}`)
  if (input.preparationMinutes > 0) details.push(`${input.preparationMinutes} min`)
  if (input.requiresWaiterConfirmation) details.push("Confirma mesonero")
  if (!input.inventoryDiscountEnabled) details.push("Sin descuento automático")

  return details.join(" · ") || "Configuración básica"
}

function buildFormFromProduct(product: MenuProduct): AdvancedForm {
  const selectionRules = normalizeSelectionRules(product.selectionRules)

  return {
    productType: normalizeProductType(product.productType),
    salesChannels: normalizeSalesChannels(product.salesChannels),
    variationsText: variationGroupsToText(product.variations),
    addonsText: addonsToText(product.addons),
    includedIngredientsText: ingredientsToText(product.includedIngredients),
    removableIngredientsText: ingredientsToText(product.removableIngredients),
    preparationMinutes: product.preparationMinutes ? String(product.preparationMinutes) : "",
    requiresWaiterConfirmation: product.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: product.inventoryDiscountEnabled !== false,
    maxAddons: selectionRules.maxAddons ? String(selectionRules.maxAddons) : "",
    internalRulesNote: String(selectionRules.notes || ""),
  }
}

async function readApiResponse(response: Response) {
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

function formatDate(value?: string) {
  if (!value) return "Sin actualización"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(date)
}

export default function AdvancedMenuPage() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [products, setProducts] = useState<MenuProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [form, setForm] = useState<AdvancedForm>(EMPTY_FORM)
  const [searchText, setSearchText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const isLoggedIn = adminPassword.length > 0

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === selectedProductId) || null
  }, [products, selectedProductId])

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    if (!query) return products

    return products.filter((product) => {
      return [product.name, product.category, product.description, product.premiumSummary]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [products, searchText])

  const parsedVariations = useMemo(
    () => parseVariationGroupsFromText(form.variationsText),
    [form.variationsText]
  )
  const parsedAddons = useMemo(() => parseAddonsFromText(form.addonsText), [form.addonsText])
  const parsedIncludedIngredients = useMemo(
    () => parseIngredientsFromText(form.includedIngredientsText, "included"),
    [form.includedIngredientsText]
  )
  const parsedRemovableIngredients = useMemo(
    () => parseIngredientsFromText(form.removableIngredientsText, "removable"),
    [form.removableIngredientsText]
  )
  const preparationMinutes = normalizePositiveInteger(form.preparationMinutes)
  const maxAddons = normalizePositiveInteger(form.maxAddons)
  const premiumSummary = buildPremiumSummary({
    productType: form.productType,
    salesChannels: form.salesChannels,
    variations: parsedVariations,
    addons: parsedAddons,
    removableIngredients: parsedRemovableIngredients,
    preparationMinutes,
    requiresWaiterConfirmation: form.requiresWaiterConfirmation,
    inventoryDiscountEnabled: form.inventoryDiscountEnabled,
  })

  const warnings = useMemo(() => {
    const result: string[] = []

    if (!selectedProduct) return result
    if (form.productType === "variations" && parsedVariations.length === 0) {
      result.push("Este producto está marcado con variaciones, pero no tiene opciones registradas.")
    }
    if (form.productType === "addons" && parsedAddons.length === 0) {
      result.push("Este producto está marcado con adicionales, pero no tiene adicionales registrados.")
    }
    if (form.productType === "buildable" && parsedIncludedIngredients.length === 0 && parsedAddons.length === 0) {
      result.push("Un producto armable debería tener ingredientes, adicionales o reglas para el personal.")
    }
    if (form.salesChannels.length === 0) {
      result.push("Selecciona al menos un canal de venta.")
    }

    return result
  }, [form.productType, form.salesChannels.length, parsedAddons.length, parsedIncludedIngredients.length, parsedVariations.length, selectedProduct])

  function updateForm<K extends keyof AdvancedForm>(field: K, value: AdvancedForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  function toggleSalesChannel(channel: ProductSalesChannel) {
    const currentChannels = normalizeSalesChannels(form.salesChannels)
    const exists = currentChannels.includes(channel)
    const nextChannels = exists
      ? currentChannels.filter((item) => item !== channel)
      : [...currentChannels, channel]

    updateForm("salesChannels", nextChannels.length ? nextChannels : [channel])
  }

  function selectProduct(product: MenuProduct) {
    setSelectedProductId(product.id)
    setForm(buildFormFromProduct(product))
    setSuccessMessage(`${product.name} cargado para configurar.`)
    setErrorMessage(null)
  }

  async function validateAccess(password: string) {
    const response = await fetch("/api/local-auth?moduleKey=advancedMenu", {
      headers: {
        "x-admin-password": password,
      },
      cache: "no-store",
    })
    const data = await readApiResponse(response)

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          data.access?.message ||
          "El menú avanzado no está activo para este negocio."
      )
    }

    return data
  }

  async function loadProducts(password = adminPassword) {
    if (!password) return

    try {
      setIsLoading(true)
      setErrorMessage(null)

      const response = await fetch("/api/menu-products", {
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el menú editable")
      }

      const nextProducts = normalizeMenuProducts(data.menuProducts || [])
      setProducts(nextProducts)

      if (selectedProductId) {
        const updatedSelectedProduct = nextProducts.find((product) => product.id === selectedProductId)

        if (updatedSelectedProduct) {
          setForm(buildFormFromProduct(updatedSelectedProduct))
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el menú editable"
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
      await validateAccess(password)
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
      setAdminPassword(password)
      setPasswordInput(password)
      await loadProducts(password)
    } catch (error) {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
      setAdminPassword("")
      setProducts([])
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
    setProducts([])
    setSelectedProductId(null)
    setForm(EMPTY_FORM)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  useEffect(() => {
    const storedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)
    const savedPassword = typeof storedPassword === "string" ? storedPassword.trim() : ""

    if (!savedPassword) return

    async function restoreSession() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        await validateAccess(savedPassword)
        setAdminPassword(savedPassword)
        setPasswordInput(savedPassword)
        await loadProducts(savedPassword)
      } catch (error) {
        window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
        setAdminPassword("")
        setPasswordInput("")
        setProducts([])
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo restaurar el acceso al menú avanzado"
        )
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  async function saveAdvancedConfiguration() {
    if (!adminPassword || !selectedProduct) return

    if (!form.salesChannels.length) {
      setErrorMessage("Selecciona al menos un canal de venta.")
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const selectionRules: SelectionRules = {
        ...normalizeSelectionRules(selectedProduct.selectionRules),
        maxAddons: maxAddons || undefined,
        notes: form.internalRulesNote.trim() || undefined,
        requiresStaffReview: form.requiresWaiterConfirmation,
      }

      const response = await fetch("/api/menu-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          ...selectedProduct,
          productType: form.productType,
          salesChannels: normalizeSalesChannels(form.salesChannels),
          variations: parsedVariations,
          addons: parsedAddons,
          includedIngredients: parsedIncludedIngredients,
          removableIngredients: parsedRemovableIngredients,
          selectionRules,
          preparationMinutes,
          requiresWaiterConfirmation: form.requiresWaiterConfirmation,
          inventoryDiscountEnabled: form.inventoryDiscountEnabled,
          premiumSummary,
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar la configuración avanzada")
      }

      const savedProduct = normalizeMenuProduct(data.menuProduct)

      if (!savedProduct) {
        throw new Error("El servidor no devolvió el producto actualizado")
      }

      setProducts((currentProducts) =>
        normalizeMenuProducts(
          currentProducts.map((product) =>
            product.id === savedProduct.id ? savedProduct : product
          )
        )
      )
      setSelectedProductId(savedProduct.id)
      setForm(buildFormFromProduct(savedProduct))
      setSuccessMessage("Configuración avanzada guardada correctamente.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración avanzada"
      )
    } finally {
      setIsSaving(false)
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

            <img
              src={BRAND.logoUrl || (BRAND.logoUrl || "/logoremovebg.png")}
              alt={BRAND.name}
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Menú avanzado
            </p>

            <h1 className="mt-2 text-center text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
              Productos configurables
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada. Este módulo permite preparar variaciones, adicionales, ingredientes y reglas internas del menú premium.
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
              {isLoading ? "Validando acceso" : "Entrar al menú avanzado"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/local-santo"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <a
                    href="/local-santo/menu"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <PackageCheck size={16} />
                    Menú editable
                  </a>

                  <button
                    type="button"
                    onClick={() => loadProducts()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
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
                  {BRAND.name}
                </p>

                <h1 className="mt-1 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Productos configurables
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Prepara variaciones, adicionales, ingredientes removibles, canales de venta y reglas internas. Esta fase guarda la configuración premium, pero no cambia todavía el carrito público.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
                <MetricCard label="Productos" value={products.length} />
                <MetricCard label="Configurables" value={products.filter((product) => normalizeProductType(product.productType) !== "normal").length} />
                <MetricCard label="Con adicionales" value={products.filter((product) => normalizeUnknownArray(product.addons).length > 0).length} />
              </div>
            </div>
          </div>
        </header>

        {(errorMessage || successMessage) && (
          <section className="mt-4 space-y-3">
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

        <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Seleccionar producto
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                  Escoge un producto ya creado para completar su configuración avanzada.
                </p>
              </div>
              <SlidersHorizontal className="shrink-0 text-[var(--brand-primary)]" size={26} />
            </div>

            <div className="relative mt-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar producto"
                className="w-full rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
              />
            </div>

            <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4 text-center">
                  <p className="text-sm font-black text-[var(--brand-primary)]">
                    No hay productos para mostrar.
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = product.id === selectedProductId
                  const typeLabel = PRODUCT_TYPE_OPTIONS.find((option) => option.value === normalizeProductType(product.productType))?.label || "Normal"

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      className={`w-full rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] ${
                        isSelected
                          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]"
                          : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] text-[var(--brand-ink-2)] hover:border-[var(--brand-primary)] hover:bg-yellow-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--brand-primary)]/20 bg-white">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <PackageCheck size={20} className="text-[var(--brand-primary)]/50" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-black uppercase leading-tight">
                            {product.name}
                          </p>
                          <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/75">
                            {product.category} · {formatUSD(product.price)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                            {typeLabel}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
            {!selectedProduct ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[1.4rem] border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-6 py-14 text-center">
                <SlidersHorizontal size={54} className="text-[var(--brand-primary)]" />
                <h2 className="mt-5 text-3xl font-black uppercase text-[var(--brand-primary)]">
                  Selecciona un producto
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Primero crea el producto básico desde Menú editable. Luego entra aquí para preparar variaciones, adicionales y reglas premium.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 border-b-2 border-[var(--brand-primary)]/15 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Configurando
                    </p>
                    <h2 className="mt-1 text-3xl font-black uppercase leading-none text-[var(--brand-primary)]">
                      {selectedProduct.name}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                      {selectedProduct.category} · {formatUSD(selectedProduct.price)} · Actualizado: {formatDate(selectedProduct.updatedAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 lg:w-[320px]">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Resumen
                    </p>
                    <p className="mt-1 text-sm font-black leading-5 text-[var(--brand-ink-2)]">
                      {premiumSummary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Tipo de producto
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {PRODUCT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateForm("productType", option.value)}
                          className={`rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] ${
                            form.productType === option.value
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)] hover:border-[var(--brand-primary)]"
                          }`}
                        >
                          <p className="text-xs font-black uppercase tracking-[0.12em]">
                            {option.label}
                          </p>
                          <p className="mt-2 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/65">
                            {option.helper}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="xl:col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Canales de venta
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {SALES_CHANNEL_OPTIONS.map((option) => {
                        const checked = form.salesChannels.includes(option.value)

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleSalesChannel(option.value)}
                            className={`rounded-2xl border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] ${
                              checked
                                ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                                : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"
                            }`}
                          >
                            {checked ? "Activo · " : "Pausado · "}
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <AdvancedTextArea
                    label="Variaciones"
                    value={form.variationsText}
                    onChange={(value) => updateForm("variationsText", value)}
                    placeholder={"[Tamaño]\nNormal | 0\nGrande | 1\n[Proteína]\nPolaca | 0.5"}
                    helper="Usa un grupo entre corchetes y luego una opción por línea. Formato: Nombre | ajuste en USD."
                  />

                  <AdvancedTextArea
                    label="Adicionales"
                    value={form.addonsText}
                    onChange={(value) => updateForm("addonsText", value)}
                    placeholder={"Tocineta | 1 | 2\nQueso extra | 0.5 | 3\nSalsa especial | 0.5 | 1"}
                    helper="Formato: Nombre | precio USD | cantidad máxima."
                  />

                  <AdvancedTextArea
                    label="Ingredientes incluidos"
                    value={form.includedIngredientsText}
                    onChange={(value) => updateForm("includedIngredientsText", value)}
                    placeholder={"Papas\nCebolla\nEnsalada\nSalsa de la casa"}
                    helper="Ingredientes base del producto. Una línea por ingrediente."
                  />

                  <AdvancedTextArea
                    label="Ingredientes removibles"
                    value={form.removableIngredientsText}
                    onChange={(value) => updateForm("removableIngredientsText", value)}
                    placeholder={"Sin cebolla\nSin ensalada\nSin salsa"}
                    helper="Opciones que el personal puede retirar cuando el cliente lo pida."
                  />

                  <InputField
                    label="Tiempo preparación minutos"
                    value={form.preparationMinutes}
                    onChange={(value) => updateForm("preparationMinutes", value)}
                    placeholder="Ej: 12"
                    inputMode="numeric"
                  />

                  <InputField
                    label="Máximo de adicionales"
                    value={form.maxAddons}
                    onChange={(value) => updateForm("maxAddons", value)}
                    placeholder="Ej: 3"
                    inputMode="numeric"
                  />

                  <div className="xl:col-span-2 grid gap-2 sm:grid-cols-2">
                    <ToggleCard
                      title="Confirmación del mesonero"
                      description="Marca productos que requieren revisión del personal antes de prepararse."
                      checked={form.requiresWaiterConfirmation}
                      onChange={(value) => updateForm("requiresWaiterConfirmation", value)}
                      activeLabel="Requiere"
                      inactiveLabel="No requiere"
                    />

                    <ToggleCard
                      title="Descuento automático de inventario"
                      description="Permite que este producto use recetas de inventario al entregarse."
                      checked={form.inventoryDiscountEnabled}
                      onChange={(value) => updateForm("inventoryDiscountEnabled", value)}
                      activeLabel="Activo"
                      inactiveLabel="Pausado"
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <AdvancedTextArea
                      label="Nota interna de reglas"
                      value={form.internalRulesNote}
                      onChange={(value) => updateForm("internalRulesNote", value)}
                      placeholder="Ej: Confirmar disponibilidad de tocineta antes de aceptar adicionales."
                      helper="Esta nota queda guardada como regla interna del producto."
                    />
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="mt-4 rounded-2xl border-2 border-yellow-400 bg-[var(--brand-accent-100)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-amber)]">
                      Revisión recomendada
                    </p>
                    <ul className="mt-2 space-y-1 text-sm font-bold leading-6 text-[#5a3700]">
                      {warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={saveAdvancedConfiguration}
                    disabled={isSaving || !selectedProduct}
                    className="inline-flex min-h-[50px] w-full max-w-[310px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar configuración
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPreview((value) => !value)}
                    className="inline-flex min-h-[50px] w-full max-w-[310px] items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                  >
                    {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showPreview ? "Ocultar vista técnica" : "Ver vista técnica"}
                  </button>
                </div>

                {showPreview && (
                  <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-ink-3)] p-4 text-[var(--brand-cream)]">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-accent)]">
                      Vista técnica guardada
                    </p>
                    <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-xs font-bold leading-5">
{JSON.stringify(
  {
    productType: form.productType,
    salesChannels: form.salesChannels,
    variations: parsedVariations,
    addons: parsedAddons,
    includedIngredients: parsedIncludedIngredients,
    removableIngredients: parsedRemovableIngredients,
    selectionRules: {
      maxAddons: maxAddons || undefined,
      notes: form.internalRulesNote.trim() || undefined,
      requiresStaffReview: form.requiresWaiterConfirmation,
    },
    preparationMinutes,
    requiresWaiterConfirmation: form.requiresWaiterConfirmation,
    inventoryDiscountEnabled: form.inventoryDiscountEnabled,
    premiumSummary,
  },
  null,
  2
)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.2rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-3 text-[var(--brand-primary)]">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black leading-tight">{value}</p>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: "text" | "decimal" | "numeric"
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
      />
    </div>
  )
}

function AdvancedTextArea({
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helper?: string
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={7}
        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold leading-6 text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
      />
      {helper && (
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {helper}
        </p>
      )}
    </div>
  )
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
  activeLabel,
  inactiveLabel,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${
        checked
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_3px_0_rgba(var(--brand-primary-rgb),0.10)]"
          : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:border-[var(--brand-primary)] hover:bg-yellow-50"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase leading-tight tracking-[0.13em]">
          {title}
        </span>
        <span className="mt-1 block text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {description}
        </span>
      </span>

      <span
        className={`inline-flex h-8 shrink-0 items-center rounded-xl border-2 px-3 text-[0.58rem] font-black uppercase tracking-[0.09em] ${
          checked
            ? "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
            : "border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] text-[var(--brand-primary)]/65"
        }`}
      >
        {checked ? activeLabel : inactiveLabel}
      </span>
    </button>
  )
}
