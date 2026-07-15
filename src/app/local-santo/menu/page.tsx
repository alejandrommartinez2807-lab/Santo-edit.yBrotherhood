"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react"
import NextImage from "next/image"
import { BRAND } from "@/lib/brand"
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  LogIn,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react"
import { formatUSD } from "@/utils/formatCurrency"
import CurrentBranchBanner from "@/components/local/CurrentBranchBanner"
import {
  categories as baseCategories,
  products as baseProducts,
  type Product,
  type ProductPaymentMode,
  type ProductSalesChannel,
  type ProductType,
} from "@/data/products"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "Burgers",
  customCategory: "",
  description: "",
  price: "",
  image: "",
  paymentMode: "mixto" as ProductPaymentMode,
  isActive: true,
  isFeatured: false,
  sortOrder: "",
  productType: "normal" as ProductType,
  salesChannels: ["local", "takeaway", "delivery"] as ProductSalesChannel[],
  variationText: "",
  addonRows: [] as { name: string; price: string }[],
  includedIngredientsText: "",
  removableIngredientsText: "",
  // Regla "elige al menos N / máximo N" sobre adicionales e ingredientes
  // (la aplica el customizer público). "" o 0 = sin límite.
  minAddons: "",
  maxAddons: "",
  // Resto de selectionRules (notas internas, revisión del mesonero…) que se
  // editan en Menú avanzado: se conservan tal cual al guardar desde aquí.
  selectionRulesBase: {} as Record<string, unknown>,
  preparationMinutes: "",
  requiresWaiterConfirmation: false,
  inventoryDiscountEnabled: true,
  ivaRate: "" as string, // "" = usa el IVA por defecto del negocio
}

type MenuProduct = Product & {
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

type MenuForm = typeof EMPTY_FORM

type ApiResponse = {
  ok?: boolean
  error?: string
  message?: string
  warning?: string
  access?: {
    allowed?: boolean
    moduleKey?: string
    moduleLabel?: string
    reason?: string
    requiredPlan?: string
    currentPlan?: string
    message?: string
  }
  menuProducts?: MenuProduct[]
  menuProduct?: MenuProduct
  image?: {
    imageUrl?: string
    thumbnailUrl?: string
    viewUrl?: string
    fileName?: string
    fileId?: string
    uploadedAt?: string
  }
}

const CATEGORY_OPTIONS = Array.from(
  new Set([...baseCategories.filter((category) => category !== "Todos"), "Otros"])
)

const PRODUCT_TYPE_OPTIONS: {
  value: ProductType
  label: string
  description: string
}[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Producto directo con precio fijo.",
  },
  {
    value: "variations",
    label: "Con variaciones",
    description: "Producto con tamaños, sabores o presentaciones.",
  },
  {
    value: "addons",
    label: "Con adicionales",
    description: "Producto que puede vender extras.",
  },
  {
    value: "buildable",
    label: "Armable",
    description: "Producto que el cliente o mesonero arma por partes.",
  },
  {
    value: "combo",
    label: "Combo",
    description: "Producto compuesto por varios artículos.",
  },
]

const SALES_CHANNEL_OPTIONS: {
  value: ProductSalesChannel
  label: string
  description: string
}[] = [
  { value: "local", label: "Local", description: "Disponible para comer en el negocio." },
  { value: "takeaway", label: "Para llevar", description: "Disponible para retiro o pedido para llevar." },
  { value: "delivery", label: "Delivery", description: "Disponible para entrega a domicilio." },
]

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

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round(numberValue)
}

function getProductTypeLabel(value: unknown) {
  const productType = normalizeProductType(value)

  return (
    PRODUCT_TYPE_OPTIONS.find((option) => option.value === productType)?.label ||
    "Normal"
  )
}

function getSalesChannelLabel(value: ProductSalesChannel) {
  return SALES_CHANNEL_OPTIONS.find((option) => option.value === value)?.label || value
}

function splitNamesFromText(value: string) {
  const seen = new Set<string>()

  return value
    .split(/[\n,;]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalizedItem = item.toLowerCase()

      if (seen.has(normalizedItem)) return false

      seen.add(normalizedItem)
      return true
    })
}

function extractNamesFromUnknownArray(value: unknown) {
  const names: string[] = []

  normalizeUnknownArray(value).forEach((item) => {
    if (item && typeof item === "object") {
      const source = item as { name?: unknown; values?: unknown }

      if (Array.isArray(source.values)) {
        source.values.forEach((child) => {
          if (child && typeof child === "object") {
            const childName = String((child as { name?: unknown }).name || "").trim()

            if (childName) names.push(childName)
          }
        })
      } else {
        const name = String(source.name || "").trim()

        if (name) names.push(name)
      }

      return
    }

    const name = String(item || "").trim()

    if (name) names.push(name)
  })

  return Array.from(new Set(names)).join(", ")
}

function buildVariationGroupsFromText(value: string) {
  const names = splitNamesFromText(value)

  if (!names.length) return []

  return [
    {
      name: "Opciones del producto",
      type: "single",
      required: false,
      minSelections: 0,
      maxSelections: 1,
      values: names.map((name, index) => ({
        name,
        priceDelta: 0,
        isActive: true,
        sortOrder: index + 1,
      })),
    },
  ]
}

// Filas de adicionales {nombre, precio} desde lo guardado (acepta price,
// priceDelta o extraPrice según la época en que se guardó el producto).
function extractAddonRows(value: unknown): { name: string; price: string }[] {
  return normalizeUnknownArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") {
        const name = String(item || "").trim()
        return name ? { name, price: "" } : null
      }

      const source = item as { name?: unknown; price?: unknown; priceDelta?: unknown; extraPrice?: unknown }
      const name = String(source.name || "").trim()
      if (!name) return null

      const price = Number(source.price ?? source.priceDelta ?? source.extraPrice ?? 0)
      return { name, price: Number.isFinite(price) && price > 0 ? String(price) : "" }
    })
    .filter((row): row is { name: string; price: string } => Boolean(row))
}

function buildAddonsFromRows(rows: { name: string; price: string }[]) {
  const seen = new Set<string>()

  return rows
    .map((row) => ({ name: row.name.trim(), price: Number(row.price) }))
    .filter((row) => {
      if (!row.name) return false
      const normalized = row.name.toLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    .map((row, index) => ({
      name: row.name,
      price: Number.isFinite(row.price) && row.price > 0 ? row.price : 0,
      isActive: true,
      maxQuantity: 1,
      sortOrder: index + 1,
    }))
}

function readRulePositiveInteger(value: unknown): string {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : ""
}

function buildIngredientsFromText(value: string, mode: "included" | "removable") {
  return splitNamesFromText(value).map((name, index) => ({
    name,
    included: mode === "included",
    removable: mode === "removable",
    extraPrice: 0,
    sortOrder: index + 1,
  }))
}

function buildPremiumSummary(product: {
  productType?: ProductType
  salesChannels?: ProductSalesChannel[]
  variations?: unknown[]
  addons?: unknown[]
  removableIngredients?: unknown[]
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
  inventoryDiscountEnabled?: boolean
}) {
  const details: string[] = []
  const productType = normalizeProductType(product.productType)
  const salesChannels = normalizeSalesChannels(product.salesChannels)

  if (productType !== "normal") {
    details.push(getProductTypeLabel(productType))
  }

  if (salesChannels.length && salesChannels.length < SALES_CHANNEL_OPTIONS.length) {
    details.push(`Canales: ${salesChannels.map(getSalesChannelLabel).join(", ")}`)
  }

  if (product.variations?.length) details.push(`Variaciones: ${product.variations.length}`)
  if (product.addons?.length) details.push(`Adicionales: ${product.addons.length}`)
  if (product.removableIngredients?.length) details.push(`Removibles: ${product.removableIngredients.length}`)
  if (product.preparationMinutes) details.push(`${product.preparationMinutes} min`)
  if (product.requiresWaiterConfirmation) details.push("Confirma mesonero")
  if (product.inventoryDiscountEnabled === false) details.push("Sin descuento automático")

  return details.join(" · ") || "Configuración básica"
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function normalizePaymentMode(value: unknown): ProductPaymentMode {
  return value === "divisa" ? "divisa" : "mixto"
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
    selectionRules:
      source.selectionRules && typeof source.selectionRules === "object"
        ? source.selectionRules
        : {},
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

function buildFormFromProduct(product: MenuProduct): MenuForm {
  return {
    id: String(product.id),
    name: product.name,
    category: CATEGORY_OPTIONS.includes(product.category) ? product.category : "Otros",
    customCategory: CATEGORY_OPTIONS.includes(product.category) ? "" : product.category,
    description: product.description,
    price: String(product.price || ""),
    image: product.image,
    paymentMode: product.paymentMode,
    isActive: product.isActive !== false,
    isFeatured: product.isFeatured === true,
    sortOrder: String(product.sortOrder || ""),
    productType: normalizeProductType(product.productType),
    salesChannels: normalizeSalesChannels(product.salesChannels),
    variationText: extractNamesFromUnknownArray(product.variations),
    addonRows: extractAddonRows(product.addons),
    includedIngredientsText: extractNamesFromUnknownArray(product.includedIngredients),
    removableIngredientsText: extractNamesFromUnknownArray(product.removableIngredients),
    minAddons: readRulePositiveInteger(
      (product.selectionRules as { minAddons?: unknown } | undefined)?.minAddons,
    ),
    maxAddons: readRulePositiveInteger(
      (product.selectionRules as { maxAddons?: unknown } | undefined)?.maxAddons,
    ),
    selectionRulesBase:
      product.selectionRules && typeof product.selectionRules === "object"
        ? (product.selectionRules as Record<string, unknown>)
        : {},
    preparationMinutes: product.preparationMinutes ? String(product.preparationMinutes) : "",
    requiresWaiterConfirmation: product.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: product.inventoryDiscountEnabled !== false,
    ivaRate: product.ivaRate != null ? String(product.ivaRate) : "",
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

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text) as ApiResponse
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180)

    if (response.status === 404 || preview.toLowerCase().includes("<!doctype")) {
      throw new Error(
        "La ruta /api/menu-products no está respondiendo como API. Revisa que exista src/app/api/menu-products/route.ts y reinicia npm run dev."
      )
    }

    throw new Error(
      preview
        ? `El servidor no devolvió JSON válido. Respuesta: ${preview}`
        : "El servidor no devolvió datos válidos."
    )
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("La imagen no pudo procesarse. Prueba con JPG, PNG o WEBP."))
    image.src = dataUrl
  })
}

async function prepareMenuImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen válida.")
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("La imagen es muy pesada. Usa una foto menor a 8 MB.")
  }

  const originalDataUrl = await readFileAsDataUrl(file)
  const image = await loadImageElement(originalDataUrl)
  const maxSide = 1400
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("No se pudo preparar la imagen para subirla.")
  }

  canvas.width = width
  canvas.height = height
  context.fillStyle = "var(--brand-cream)"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.84),
    mimeType: "image/jpeg",
    fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
  }
}

export default function LocalMenuPage() {
  const [adminPassword, setAdminPassword] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([])
  const [fiscal, setFiscal] = useState<{ enabled: boolean; ivaDefaultRate: number }>({
    enabled: false,
    ivaDefaultRate: 16,
  })
  // Modo hotel: el menú es la carta de room service / restaurante del hotel.
  const [hotelMode, setHotelMode] = useState(false)
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM)
  const [searchText, setSearchText] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todas")
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [isHeaderSummaryVisible, setIsHeaderSummaryVisible] = useState(false)
  const [areProductFiltersVisible, setAreProductFiltersVisible] = useState(false)
  const [isFormVisible, setIsFormVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const isLoggedIn = adminPassword.length > 0

  const activeProducts = menuProducts.filter((product) => product.isActive !== false)
  const inactiveProducts = menuProducts.filter((product) => product.isActive === false)
  const featuredProducts = activeProducts.filter((product) => product.isFeatured)

  const categories = useMemo(() => {
    return [
      "Todas",
      ...Array.from(
        new Set(
          menuProducts
            .map((product) => product.category)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    ]
  }, [menuProducts])

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return menuProducts.filter((product) => {
      if (showOnlyActive && product.isActive === false) return false
      if (categoryFilter !== "Todas" && product.category !== categoryFilter) return false

      if (!query) return true

      return [
        product.name,
        product.category,
        product.description,
        product.image,
        product.productType,
        product.premiumSummary,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [categoryFilter, menuProducts, searchText, showOnlyActive])

  const hasProductFilters =
    searchText.trim().length > 0 || categoryFilter !== "Todas" || showOnlyActive

  const productFilterSummary = hasProductFilters
    ? `${filteredProducts.length} de ${menuProducts.length} producto(s) mostrados · filtros activos`
    : `${filteredProducts.length} de ${menuProducts.length} producto(s) mostrados · sin filtros activos`

  function clearProductFilters() {
    setSearchText("")
    setCategoryFilter("Todas")
    setShowOnlyActive(false)
  }

  function toggleSalesChannel(channel: ProductSalesChannel) {
    const currentChannels = normalizeSalesChannels(form.salesChannels)
    const exists = currentChannels.includes(channel)
    const nextChannels = exists
      ? currentChannels.filter((item) => item !== channel)
      : [...currentChannels, channel]

    updateForm("salesChannels", nextChannels.length ? nextChannels : [channel])
  }


  async function validateMenuProductsAccess(password: string) {
    const response = await fetch("/api/local-auth?moduleKey=menuProducts", {
      headers: {
        "x-admin-password": password,
      },
      cache: "no-store",
    })

    const data = await readApiResponse(response)

    if (!response.ok || !data.ok || !data.access?.allowed) {
      throw new Error(
        data.error ||
          "El módulo de productos del menú no está activo para este negocio."
      )
    }

    return data
  }

  async function loadMenuProducts(password = adminPassword) {
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

      setMenuProducts(normalizeMenuProducts(data.menuProducts || []))
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
      await validateMenuProductsAccess(password)
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, password)
      setAdminPassword(password)
      setPasswordInput(password)
      await loadMenuProducts(password)
    } catch (error) {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
      setAdminPassword("")
      setMenuProducts([])
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
    setMenuProducts([])
    setForm(EMPTY_FORM)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // Config fiscal del negocio (para mostrar el IVA por producto solo si aplica)
  // + modo hotel (los textos hablan de room service).
  useEffect(() => {
    if (!adminPassword) return
    fetch("/api/business-config", { headers: { "x-admin-password": adminPassword }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.businessConfig
        if (c) {
          setFiscal({
            enabled: c.fiscalEnabled === true,
            ivaDefaultRate: Number(c.ivaDefaultRate) || 16,
          })
          setHotelMode(c.roomsModuleEnabled === true || c.hotelReservationsModuleEnabled === true)
        }
      })
      .catch(() => {})
  }, [adminPassword])

  const restoreSavedSession = useEffectEvent(() => {
    const storedPassword = window.sessionStorage.getItem(ADMIN_STORAGE_KEY)
    const savedPassword = typeof storedPassword === "string" ? storedPassword.trim() : ""

    if (!savedPassword) return

    async function restoreSession() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        await validateMenuProductsAccess(savedPassword)
        setAdminPassword(savedPassword)
        setPasswordInput(savedPassword)
        await loadMenuProducts(savedPassword)
      } catch (error) {
        window.sessionStorage.removeItem(ADMIN_STORAGE_KEY)
        setAdminPassword("")
        setPasswordInput("")
        setMenuProducts([])
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo restaurar el acceso al menú editable"
        )
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  })

  useEffect(() => {
    restoreSavedSession()
  }, [])

  function updateForm<K extends keyof MenuForm>(field: K, value: MenuForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setSuccessMessage(null)
    setErrorMessage(null)
  }


  async function handleImageUpload(file?: File) {
    if (!adminPassword) {
      setErrorMessage("Debes iniciar sesión antes de subir una imagen.")
      return
    }

    if (!file) {
      setErrorMessage("No se seleccionó ninguna imagen.")
      return
    }

    try {
      setIsUploadingImage(true)
      setErrorMessage(null)
      setSuccessMessage("Preparando imagen para subir...")

      const preparedImage = await prepareMenuImageForUpload(file)
      setSuccessMessage("Subiendo imagen. Espera unos segundos antes de guardar el producto.")

      const response = await fetch("/api/menu-products/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          ...preparedImage,
          productName: form.name || "producto-menu",
        }),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo subir la imagen")
      }

      const imageUrl = String(data.image?.imageUrl || data.image?.thumbnailUrl || "").trim()

      if (!imageUrl) {
        throw new Error("La imagen subió, pero el servidor no devolvió un enlace válido")
      }

      updateForm("image", imageUrl)
      setSuccessMessage("Imagen subida correctamente. Ahora guarda el producto para aplicarla al menú público.")
    } catch (error) {
      setSuccessMessage(null)
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir la imagen"
      )
    } finally {
      setIsUploadingImage(false)
    }
  }

  async function saveProduct(customInput?: Partial<MenuProduct>) {
    if (!adminPassword) return null

    const category =
      form.category === "Otros" && form.customCategory.trim()
        ? form.customCategory.trim()
        : form.category
    const input = customInput || {
      id: form.id ? Number(form.id) : undefined,
      name: form.name.trim(),
      category,
      description: form.description.trim(),
      price: normalizeNumber(form.price),
      image: form.image.trim(),
      paymentMode: form.paymentMode,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      sortOrder: normalizeNumber(form.sortOrder),
      productType: normalizeProductType(form.productType),
      salesChannels: normalizeSalesChannels(form.salesChannels),
      variations: buildVariationGroupsFromText(form.variationText),
      addons: buildAddonsFromRows(form.addonRows),
      includedIngredients: buildIngredientsFromText(form.includedIngredientsText, "included"),
      removableIngredients: buildIngredientsFromText(form.removableIngredientsText, "removable"),
      // Conserva las reglas del Menú avanzado y pisa solo min/máx de selección.
      selectionRules: {
        ...form.selectionRulesBase,
        minAddons: normalizePositiveInteger(form.minAddons) || undefined,
        maxAddons: normalizePositiveInteger(form.maxAddons) || undefined,
      },
      preparationMinutes: normalizePositiveInteger(form.preparationMinutes),
      requiresWaiterConfirmation: form.requiresWaiterConfirmation,
      inventoryDiscountEnabled: form.inventoryDiscountEnabled,
      ivaRate: form.ivaRate === "" ? null : Number(form.ivaRate),
    }

    if (!input.name) {
      setErrorMessage("Escribe el nombre del producto.")
      return null
    }

    if (normalizeNumber(input.price) <= 0) {
      setErrorMessage("Escribe un precio válido mayor a cero.")
      return null
    }

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch("/api/menu-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify(input),
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el producto")
      }

      const savedProduct = normalizeMenuProduct(data.menuProduct)

      if (!savedProduct) {
        throw new Error("El servidor no devolvió el producto guardado")
      }

      setMenuProducts((currentProducts) => {
        const exists = currentProducts.some((product) => product.id === savedProduct.id)

        if (exists) {
          return currentProducts.map((product) =>
            product.id === savedProduct.id ? savedProduct : product
          )
        }

        return [savedProduct, ...currentProducts]
      })

      if (!customInput) {
        setForm(EMPTY_FORM)
        setIsFormVisible(false)
        setSuccessMessage("Producto del menú guardado correctamente.")
      }

      return savedProduct
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo guardar el producto"
      )
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function importBaseMenu() {
    if (!adminPassword) return

    const existingNames = new Set(
      menuProducts.map((product) => product.name.trim().toLowerCase())
    )
    const productsToImport = baseProducts.filter(
      (product) => !existingNames.has(product.name.trim().toLowerCase())
    )

    if (!productsToImport.length) {
      setSuccessMessage("El menú base ya está cargado en el menú editable.")
      setErrorMessage(null)
      return
    }

    try {
      setIsImporting(true)
      setSuccessMessage(null)
      setErrorMessage(null)

      const savedProducts: MenuProduct[] = []
      const failedProducts: string[] = []

      for (const product of productsToImport) {
        const response = await fetch("/api/menu-products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            id: product.id,
            name: product.name,
            category: product.category,
            description: product.description,
            price: product.price,
            image: product.image,
            paymentMode: product.paymentMode,
            isActive: true,
            isFeatured: product.isFeatured === true,
            sortOrder: product.sortOrder || product.id,
            productType: product.productType || "normal",
            salesChannels: product.salesChannels || ["local", "takeaway", "delivery"],
            variations: product.variations || [],
            addons: product.addons || [],
            includedIngredients: product.includedIngredients || [],
            removableIngredients: product.removableIngredients || [],
            selectionRules: product.selectionRules || {},
            preparationMinutes: product.preparationMinutes || 0,
            requiresWaiterConfirmation: product.requiresWaiterConfirmation === true,
            inventoryDiscountEnabled: product.inventoryDiscountEnabled !== false,
          }),
        })

        const data = await readApiResponse(response)

        if (!response.ok) {
          failedProducts.push(product.name)
          continue
        }

        const savedProduct = normalizeMenuProduct(data.menuProduct)

        if (savedProduct) savedProducts.push(savedProduct)
      }

      if (savedProducts.length) {
        setMenuProducts((currentProducts) => {
          const merged = [...currentProducts]

          savedProducts.forEach((savedProduct) => {
            const index = merged.findIndex((product) => product.id === savedProduct.id)

            if (index >= 0) merged[index] = savedProduct
            else merged.push(savedProduct)
          })

          return normalizeMenuProducts(merged)
        })
      }

      if (failedProducts.length) {
        setErrorMessage(
          `Algunos productos no se importaron: ${failedProducts.join(", ")}.`
        )
      }

      setSuccessMessage(
        `Menú base importado. Productos agregados: ${savedProducts.length}.`
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo importar el menú base"
      )
    } finally {
      setIsImporting(false)
    }
  }

  async function deactivateProduct(productId: number) {
    if (!adminPassword) return

    try {
      setDeletingProductId(productId)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/menu-products?id=${encodeURIComponent(productId)}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword,
        },
      })

      const data = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || "No se pudo desactivar el producto")
      }

      setMenuProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === productId ? { ...product, isActive: false } : product
        )
      )
      setSuccessMessage(data.error || "Producto desactivado correctamente.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo desactivar el producto"
      )
    } finally {
      setDeletingProductId(null)
    }
  }

  function editProduct(product: MenuProduct) {
    setForm(buildFormFromProduct(product))
    setIsFormVisible(true)
    setSuccessMessage("Producto cargado para editar.")
    setErrorMessage(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="px-6 py-6">
            <a
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]"
            >
              <ArrowLeft size={16} />
              Volver
            </a>

            <NextImage
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Menú editable
            </p>

            <h1 className="font-serif mt-2 text-center text-4xl leading-tight text-[var(--brand-ink-3)] font-semibold">
              Productos del menú
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada. El acceso depende de que el módulo Productos del menú esté activo para este negocio.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
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
                  className="w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 pr-12 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
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
              <div className="rounded-2xl border border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold leading-6 text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-sm transition hover:scale-[1.02] disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={21} className="animate-spin" /> : <LogIn size={21} />}
              {isLoading ? "Validando acceso" : "Entrar al menú"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-3 py-4 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <button
                    type="button"
                    onClick={() => loadMenuProducts()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Actualizar
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.32em] text-[var(--brand-primary)]">
                  {BRAND.name}
                </p>

                <h1 className="font-serif mt-1 text-4xl leading-tight text-[var(--brand-ink-3)] sm:text-5xl font-semibold">
                  Menú editable
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  {hotelMode
                    ? "Crea y actualiza la carta de room service y del restaurante del hotel sin tocar código. Puedes subir fotos, cambiar precio y destacar productos."
                    : "Crea y actualiza productos del menú público sin tocar código. Puedes subir fotos, cambiar precio, destacar productos y dejar preparada la configuración premium por tipo de producto."}
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:w-[560px]">
                <button
                  type="button"
                  onClick={() => setIsHeaderSummaryVisible((value) => !value)}
                  className="inline-flex w-fit items-center justify-center gap-2 self-start rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] lg:self-end"
                >
                  {isHeaderSummaryVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isHeaderSummaryVisible ? "Ocultar resumen" : "Ver resumen"}
                </button>

                {isHeaderSummaryVisible && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MetricCard label="Activos" value={activeProducts.length} />
                    <MetricCard label="Inactivos" value={inactiveProducts.length} tone={inactiveProducts.length > 0 ? "warning" : "soft"} />
                    <MetricCard label="Destacados" value={featuredProducts.length} />
                    <MetricCard label="Total menú" value={menuProducts.length} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Sede en edición: el menú guarda por sede (x-branch-id). */}
        <CurrentBranchBanner />

        <section className="mt-4 rounded-[1.5rem] border border-[var(--brand-primary)]/40 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Crear o editar producto
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Los productos activos son los que se muestran en el menú de la página pública. Desactiva un producto para ocultarlo sin borrarlo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsFormVisible((value) => !value)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)]"
              >
                {isFormVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                {isFormVisible ? "Ocultar formulario" : "Mostrar formulario"}
              </button>

              {baseProducts.length > 0 ? (
                <button
                  type="button"
                  onClick={importBaseMenu}
                  disabled={isImporting || isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                >
                  {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Cargar menú de plantilla
                </button>
              ) : null}
            </div>
          </div>

          {isFormVisible && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <InputField label="Nombre" value={form.name} onChange={(value) => updateForm("name", value)} placeholder="Ej: Smash burger doble" full />

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {form.category === "Otros" && (
                <InputField label="Nueva categoría" value={form.customCategory} onChange={(value) => updateForm("customCategory", value)} placeholder="Ej: Hamburguesas" />
              )}

              <InputField label="Precio USD" value={form.price} onChange={(value) => updateForm("price", value)} placeholder="Ej: 4.50" inputMode="decimal" />

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Modo de pago
                </label>
                <select
                  value={form.paymentMode}
                  onChange={(event) => updateForm("paymentMode", normalizePaymentMode(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="mixto">Mixto · USD y referencia Bs</option>
                  <option value="divisa">Solo divisas</option>
                </select>
              </div>

              <InputField label="Orden" value={form.sortOrder} onChange={(value) => updateForm("sortOrder", value)} placeholder="Ej: 13" inputMode="numeric" />

              <section className="lg:col-span-2 rounded-[1.35rem] border border-[var(--brand-primary)]/40 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Opciones del producto
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                      Variaciones, adicionales e ingredientes que el cliente verá
                      al personalizar este producto en el menú público. Para
                      secciones obligatorias y precios extra, usa Menú avanzado.
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    Se ve en el menú público
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Tipo de producto
                    </label>
                    <select
                      value={form.productType}
                      onChange={(event) => updateForm("productType", normalizeProductType(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                    >
                      {PRODUCT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                      {PRODUCT_TYPE_OPTIONS.find((option) => option.value === form.productType)?.description}
                    </p>
                  </div>

                  <InputField
                    label="Tiempo de preparación"
                    value={form.preparationMinutes}
                    onChange={(value) => updateForm("preparationMinutes", value)}
                    placeholder="Ej: 12"
                    inputMode="numeric"
                  />

                  {fiscal.enabled && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        IVA del producto
                      </label>
                      <select
                        value={form.ivaRate}
                        onChange={(e) => updateForm("ivaRate", e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                      >
                        <option value="">{`Por defecto del negocio (${fiscal.ivaDefaultRate}%)`}</option>
                        <option value="16">16% (general)</option>
                        <option value="8">8% (reducido)</option>
                        <option value="0">Exento (0%)</option>
                      </select>
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Canales disponibles
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {SALES_CHANNEL_OPTIONS.map((channel) => {
                        const checked = normalizeSalesChannels(form.salesChannels).includes(channel.value)

                        return (
                          <button
                            key={channel.value}
                            type="button"
                            onClick={() => toggleSalesChannel(channel.value)}
                            className={`rounded-2xl border p-3 text-left transition ${
                              checked
                                ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                                : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)] hover:border-[var(--brand-primary)]"
                            }`}
                          >
                            <span className="block text-xs font-bold uppercase tracking-[0.12em]">
                              {channel.label}
                            </span>
                            <span className="mt-1 block text-xs font-bold leading-5 text-[var(--brand-ink-2)]/62">
                              {channel.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <TagListEditor
                    label="Variaciones"
                    value={form.variationText}
                    onChange={(value) => updateForm("variationText", value)}
                    placeholder="Escribe una opción y presiona Enter"
                    helper="Opciones simples de una sola elección (ej: tamaños). Para secciones con precio extra y obligatorias, usa Menú avanzado."
                  />

                  <AddonPriceListEditor
                    label="Adicionales"
                    rows={form.addonRows}
                    onChange={(rows) => updateForm("addonRows", rows)}
                    helper="Cada adicional puede tener precio. Los de $0 salen como ingredientes sin costo; los que tienen precio suman al total del cliente."
                  />

                  <TagListEditor
                    label="Ingredientes incluidos"
                    value={form.includedIngredientsText}
                    onChange={(value) => updateForm("includedIngredientsText", value)}
                    placeholder="Escribe un ingrediente y presiona Enter"
                    helper="Lo que trae el producto. Sirve para recetas y para informar al cliente."
                  />

                  <TagListEditor
                    label="Ingredientes removibles"
                    value={form.removableIngredientsText}
                    onChange={(value) => updateForm("removableIngredientsText", value)}
                    placeholder="Escribe un ingrediente y presiona Enter"
                    helper="El cliente podrá pedir el producto sin estos ingredientes."
                  />

                  <div className="lg:col-span-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Regla de selección de adicionales
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                      Como hacen algunos negocios: obliga al cliente a elegir una
                      cantidad mínima de adicionales/ingredientes antes de poder
                      agregar el producto, o limita el máximo. Vacío o 0 = sin regla.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <InputField
                        label="Mínimo a elegir"
                        value={form.minAddons}
                        onChange={(value) => updateForm("minAddons", value)}
                        placeholder="Ej: 2"
                        inputMode="numeric"
                      />
                      <InputField
                        label="Máximo permitido"
                        value={form.maxAddons}
                        onChange={(value) => updateForm("maxAddons", value)}
                        placeholder="Ej: 4"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 grid gap-2 sm:grid-cols-2">
                    <ToggleCard
                      title="Confirmar con mesonero"
                      description="Útil para cuentas abiertas o pedidos directos desde mesa."
                      checked={form.requiresWaiterConfirmation}
                      onChange={(value) => updateForm("requiresWaiterConfirmation", value)}
                      activeLabel="Requiere"
                      inactiveLabel="No requiere"
                      icon={<CheckCircle2 size={18} />}
                    />

                    <ToggleCard
                      title="Descontar inventario"
                      description="Permite decidir si este producto entra en recetas e inventario."
                      checked={form.inventoryDiscountEnabled}
                      onChange={(value) => updateForm("inventoryDiscountEnabled", value)}
                      activeLabel="Sí descuenta"
                      inactiveLabel="No descuenta"
                      icon={<PackageCheck size={18} />}
                    />
                  </div>
                </div>
              </section>

              <div className="lg:col-span-2 rounded-[1.25rem] border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Imagen del producto
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                      Sube una foto desde el teléfono o pega una URL. La imagen guardada se verá en el menú público con la misma tarjeta del resto de productos.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      disabled={isUploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ""
                        handleImageUpload(file)
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[var(--brand-primary)]/40 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed ${
                        isUploadingImage
                          ? "bg-[var(--brand-accent-100)] text-[var(--brand-primary)]/60"
                          : "bg-[var(--brand-accent)] text-[var(--brand-ink)] hover:bg-[var(--brand-accent-200)]"
                      }`}
                    >
                      {isUploadingImage ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <UploadCloud size={15} />
                      )}
                      {isUploadingImage ? "Subiendo" : "Subir foto"}
                    </button>
                    <p className="max-w-[230px] text-right text-[0.68rem] font-bold leading-4 text-[var(--brand-ink)]/55">
                      Al terminar verás la URL y la vista previa. Luego presiona Guardar producto.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]">
                  <InputField
                    label="Imagen URL"
                    value={form.image}
                    onChange={(value) => updateForm("image", value)}
                    placeholder="Sube una foto o pega /producto.png o https://..."
                    full
                  />

                  <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/20 bg-white">
                    {form.image ? (
                      <NextImage
                        src={form.image}
                        alt="Vista previa del producto"
                        width={640}
                        height={144}
                        unoptimized
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-36 flex-col items-center justify-center gap-2 text-center text-[var(--brand-primary)]/55">
                        <ImageIcon size={24} />
                        <span className="px-3 text-xs font-bold uppercase tracking-[0.12em]">
                          Sin imagen
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Descripción
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Describe ingredientes, presentación o condición especial del producto"
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />
              </div>

              <div className="lg:col-span-2 grid gap-2 sm:grid-cols-2">
                <ToggleCard
                  title="Producto activo"
                  description="Aparece en el menú público y puede agregarse al carrito."
                  checked={form.isActive}
                  onChange={(value) => updateForm("isActive", value)}
                  activeLabel="Visible"
                  inactiveLabel="Pausado"
                  icon={<CheckCircle2 size={18} />}
                />

                <ToggleCard
                  title="Producto destacado"
                  description="Puede mostrarse en Favoritos de la casa cuando el módulo esté activo."
                  checked={form.isFeatured}
                  onChange={(value) => updateForm("isFeatured", value)}
                  activeLabel="Destacado"
                  inactiveLabel="Normal"
                  icon={<Star size={18} />}
                />
              </div>

              <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => saveProduct()}
                  disabled={isSaving || isUploadingImage}
                  className="inline-flex min-h-[48px] w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                  Guardar producto
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="min-h-[48px] w-full max-w-[280px] rounded-2xl border border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                >
                  Limpiar formulario
                </button>
              </div>
            </div>
          )}
        </section>

        {(errorMessage || successMessage) && (
          <section className="mt-4 space-y-3">
            {errorMessage && (
              <div className="rounded-2xl border border-red-500/35 bg-red-100 px-4 py-3">
                <p className="text-sm font-bold text-red-800">{errorMessage}</p>
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-green-500/35 bg-green-50 px-4 py-3">
                <p className="text-sm font-bold text-green-800">{successMessage}</p>
              </div>
            )}
          </section>
        )}

        <section className="sticky top-0 z-30 mt-4 overflow-hidden rounded-[1.4rem] border border-[var(--brand-primary)]/40 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Productos del menú
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                {productFilterSummary}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAreProductFiltersVisible((value) => !value)}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
                  areProductFiltersVisible
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                    : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                }`}
              >
                {areProductFiltersVisible ? <EyeOff size={16} /> : <Search size={16} />}
                {areProductFiltersVisible ? "Ocultar filtros" : "Buscar / filtrar"}
              </button>

              {hasProductFilters && (
                <button
                  type="button"
                  onClick={clearProductFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                >
                  <XCircle size={16} />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {areProductFiltersVisible && (
            <div className="border-t border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Buscar producto, categoría, descripción o imagen"
                    className="w-full rounded-full border border-[var(--brand-primary)]/25 bg-white px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-full border border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowOnlyActive((value) => !value)}
                  className={`rounded-full border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
                    showOnlyActive
                      ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                      : "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
                  }`}
                >
                  Solo activos
                </button>
              </div>
            </div>
          )}
        </section>

        {filteredProducts.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border border-[var(--brand-primary)]/40 bg-white px-6 py-14 text-center shadow-sm">
            <PackageCheck className="mx-auto text-[var(--brand-primary)]" size={54} />
            <h2 className="font-serif mt-5 text-3xl text-[var(--brand-ink-3)] font-semibold">
              Sin productos del menú
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              Carga el menú actual o registra un producto nuevo desde el formulario superior.
            </p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            {filteredProducts.map((product) => {
              const activeClasses = product.isActive
                ? "border-green-500/40 bg-green-50 text-green-800"
                : "border-red-500/45 bg-red-50 text-red-800"

              return (
                <article key={product.id} className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-primary)]/40 bg-white shadow-sm">
                  <div className="border-b border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          {product.category} · Orden {product.sortOrder || product.id}
                        </p>
                        <h2 className="font-serif mt-1 text-2xl leading-tight text-[var(--brand-ink-3)] font-semibold">
                          {product.name}
                        </h2>
                      </div>

                      <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${activeClasses}`}>
                        {product.isActive ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        {product.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]">
                        {product.image ? (
                          <NextImage
                            src={product.image}
                            alt={product.name}
                            width={64}
                            height={64}
                            unoptimized
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <ImageIcon className="text-[var(--brand-primary)]/45" size={34} />
                        )}
                      </div>

                      <div className="space-y-2">
                        <InfoBox label="Precio" value={formatUSD(product.price)} />
                        <InfoBox label="Pago" value={product.paymentMode === "divisa" ? "Solo divisas" : "Mixto"} />
                        <InfoBox label="Tipo" value={getProductTypeLabel(product.productType)} />
                        <InfoBox label="Canales" value={normalizeSalesChannels(product.salesChannels).map(getSalesChannelLabel).join(", ")} />
                        <InfoBox label="Preparación" value={product.preparationMinutes ? `${product.preparationMinutes} min` : "Sin tiempo"} />
                        <InfoBox label="Destacado" value={product.isFeatured ? "Sí" : "No"} icon={product.isFeatured ? <Star size={14} /> : undefined} />
                      </div>
                    </div>

                    {product.description && (
                      <p className="rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                        {product.description}
                      </p>
                    )}

                    <div className="rounded-[1.2rem] border border-[var(--brand-primary)]/20 bg-white p-3">
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                        Resumen premium
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                        {product.premiumSummary || buildPremiumSummary(product)}
                      </p>
                    </div>

                    <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">
                      Actualizado: {formatDate(product.updatedAt)}
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => editProduct(product)}
                        className="min-h-[44px] rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-ink)]"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => saveProduct({ ...product, isFeatured: !product.isFeatured })}
                        disabled={isSaving}
                        className="min-h-[44px] rounded-2xl border border-[var(--brand-primary)]/40 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
                      >
                        {product.isFeatured ? "Quitar destacado" : "Destacar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => saveProduct({ ...product, isActive: !product.isActive })}
                        disabled={isSaving}
                        className="min-h-[44px] rounded-2xl border border-[var(--brand-primary)]/40 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
                      >
                        {product.isActive ? "Pausar" : "Activar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deactivateProduct(product.id)}
                        disabled={deletingProductId === product.id}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-red-100 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-red-700 disabled:opacity-50"
                      >
                        {deletingProductId === product.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Desactivar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  full = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: "text" | "decimal" | "numeric"
  full?: boolean
}) {
  return (
    <div className={full ? "lg:col-span-2" : ""}>
      <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
      />
    </div>
  )
}

// Editor de listas tipo "chips": el dueño escribe una opción, presiona Enter
// (o el botón Agregar) y la ve como etiqueta con su X para quitarla. Por
// debajo el valor se sigue guardando como texto multilínea, así el guardado
// existente (splitNamesFromText) no cambia.
function TagListEditor({
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
  const [draft, setDraft] = useState("")
  const items = splitNamesFromText(value)

  function commitDraft() {
    if (!draft.trim()) return
    const nextItems = splitNamesFromText(`${value}\n${draft}`)
    setDraft("")
    onChange(nextItems.join("\n"))
  }

  function removeItem(target: string) {
    onChange(items.filter((item) => item !== target).join("\n"))
  }

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <div className="mt-2 rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-2.5 transition focus-within:border-[var(--brand-primary)]">
        {items.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/30 bg-white px-3 py-1 text-xs font-bold text-[var(--brand-ink)]"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  aria-label={`Quitar ${item}`}
                  className="text-[var(--brand-primary)] transition hover:scale-110"
                >
                  <XCircle size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]/40"
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={!draft.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:brightness-105 disabled:opacity-40"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>
      {helper ? (
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

// Igual que TagListEditor pero cada entrada lleva nombre + precio opcional:
// para adicionales tipo "Tocineta extra +$1.50" que suman al precio final.
function AddonPriceListEditor({
  label,
  rows,
  onChange,
  helper,
}: {
  label: string
  rows: { name: string; price: string }[]
  onChange: (rows: { name: string; price: string }[]) => void
  helper?: string
}) {
  const [draftName, setDraftName] = useState("")
  const [draftPrice, setDraftPrice] = useState("")

  function commitDraft() {
    const name = draftName.trim()
    if (!name) return

    const exists = rows.some(
      (row) => row.name.trim().toLowerCase() === name.toLowerCase(),
    )
    setDraftName("")
    setDraftPrice("")

    if (exists) return

    const price = Number(draftPrice)
    onChange([
      ...rows,
      { name, price: Number.isFinite(price) && price > 0 ? draftPrice.trim() : "" },
    ])
  }

  function removeRow(target: string) {
    onChange(rows.filter((row) => row.name !== target))
  }

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
        {label}
      </label>
      <div className="mt-2 rounded-2xl border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-2.5 transition focus-within:border-[var(--brand-primary)]">
        {rows.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {rows.map((row) => (
              <span
                key={row.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/30 bg-white px-3 py-1 text-xs font-bold text-[var(--brand-ink)]"
              >
                {row.name}
                {Number(row.price) > 0 ? (
                  <span className="text-[var(--brand-primary)]">
                    +{formatUSD(Number(row.price))}
                  </span>
                ) : (
                  <span className="text-[var(--brand-ink-2)]/55">$0</span>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(row.name)}
                  aria-label={`Quitar ${row.name}`}
                  className="text-[var(--brand-primary)] transition hover:scale-110"
                >
                  <XCircle size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder="Escribe un adicional"
            className="min-w-0 flex-1 basis-40 rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]/40"
          />
          <input
            value={draftPrice}
            onChange={(event) => setDraftPrice(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder="Precio $"
            inputMode="decimal"
            aria-label={`Precio del adicional de ${label}`}
            className="w-24 shrink-0 rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/40 focus:border-[var(--brand-primary)]/40"
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={!draftName.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:brightness-105 disabled:opacity-40"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>
      {helper ? (
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/58">
          {helper}
        </p>
      ) : null}
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
  icon,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  activeLabel: string
  inactiveLabel: string
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
        checked
          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-sm"
          : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:border-[var(--brand-primary)] hover:bg-yellow-50"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
            checked
              ? "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]"
              : "border-[var(--brand-primary)]/35 bg-[var(--brand-cream)] text-[var(--brand-primary)]/70"
          }`}
        >
          {icon}
        </span>

        <span className="min-w-0">
          <span className="block text-[0.64rem] font-bold uppercase leading-tight tracking-[0.13em]">
            {title}
          </span>
          <span className="mt-0.5 hidden text-[0.66rem] font-bold leading-4 text-[var(--brand-ink-2)]/58 sm:line-clamp-1 sm:block">
            {description}
          </span>
        </span>
      </span>

      <span
        className={`inline-flex h-7 shrink-0 items-center rounded-lg border px-2 text-[0.54rem] font-bold uppercase tracking-[0.09em] ${
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

function MetricCard({
  label,
  value,
  tone = "soft",
}: {
  label: string
  value: string | number
  tone?: "soft" | "warning" | "danger"
}) {
  const style =
    tone === "danger"
      ? "border-red-500/45 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-yellow-400 bg-[var(--brand-accent-100)] text-[var(--brand-amber)]"
        : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"

  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.2rem] border p-3 ${style}`}>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-1 break-words text-xl font-bold leading-tight sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-2 break-words text-sm font-bold text-[var(--brand-ink-3)]">
        {icon}
        {value || "—"}
      </p>
    </div>
  )
}
