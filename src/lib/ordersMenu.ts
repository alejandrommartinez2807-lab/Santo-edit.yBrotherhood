import type { ProductPaymentMode } from "@/types/localOrders"

import { decodeDataUrlImage, sanitizeUploadedImageFileName } from "@/lib/dataUrlImages"
import { decodeDataUrlModel, sanitizeUploadedModelFileName } from "@/lib/dataUrlModels"
import { getSupabaseAdmin } from "./supabaseServer"

function cleanId(value: unknown): string {
  return String(value ?? "").trim()
}

export type MenuProductType =
  | "normal"
  | "variations"
  | "addons"
  | "buildable"
  | "combo"

export type MenuProductSalesChannel = "local" | "takeaway" | "delivery"

export type MenuProductOptionValue = {
  id?: string
  name: string
  priceDelta?: number
  isActive?: boolean
  sortOrder?: number
}

export type MenuProductOptionGroup = {
  id?: string
  name: string
  type?: "single" | "multiple"
  required?: boolean
  minSelections?: number
  maxSelections?: number
  values?: MenuProductOptionValue[]
}

export type MenuProductAddon = {
  id?: string
  name: string
  price?: number
  category?: string
  isActive?: boolean
  maxQuantity?: number
  sortOrder?: number
}

export type MenuProductIngredient = {
  id?: string
  name: string
  included?: boolean
  removable?: boolean
  extraPrice?: number
  sortOrder?: number
  // Vínculo opcional con un insumo del inventario para descuento de stock real.
  inventoryItemId?: string | null
  inventoryQuantity?: number
  inventoryUnit?: string
}

// Artículo que compone un combo. Guarda el nombre denormalizado para que
// cocina/caja vean la composición aunque el producto original cambie.
export type MenuProductComboItem = {
  id?: string
  productId?: number
  name: string
  quantity?: number
  sortOrder?: number
}

export type MenuProductSelectionRules = Record<string, unknown>

export type MenuProduct = {
  id: number
  name: string
  category: string
  description: string
  price: number
  basePrice?: number
  unitOptionsPrice?: number
  image: string
  paymentMode: ProductPaymentMode
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  productType?: MenuProductType
  salesChannels?: MenuProductSalesChannel[]
  variations?: MenuProductOptionGroup[]
  addons?: MenuProductAddon[]
  includedIngredients?: MenuProductIngredient[]
  removableIngredients?: MenuProductIngredient[]
  comboItems?: MenuProductComboItem[]
  selectionRules?: MenuProductSelectionRules
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
  inventoryDiscountEnabled?: boolean
  premiumSummary?: string
  /** Tasa de IVA del producto (16 / 8 / 0 = exento). Si es null/undefined, usa la default del negocio. */
  ivaRate?: number | null
  /** Modelo 3D `.glb` del plato. "" = el producto se ve como siempre (sin 3D). */
  model3dUrl?: string
  /** Modelo `.usdz`: es el único que habilita el botón AR en iPhone. */
  model3dIosUrl?: string
}

export type SaveMenuProductInput = {
  id?: number
  name: string
  category: string
  description?: string
  price: number
  image?: string
  paymentMode?: ProductPaymentMode
  isActive?: boolean
  isFeatured?: boolean
  sortOrder?: number
  productType?: MenuProductType
  salesChannels?: MenuProductSalesChannel[]
  variations?: MenuProductOptionGroup[]
  addons?: MenuProductAddon[]
  includedIngredients?: MenuProductIngredient[]
  removableIngredients?: MenuProductIngredient[]
  comboItems?: MenuProductComboItem[]
  selectionRules?: MenuProductSelectionRules
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
  inventoryDiscountEnabled?: boolean
  ivaRate?: number | null
  model3dUrl?: string
  model3dIosUrl?: string
}

export type UploadMenuProductImageInput = {
  dataUrl: string
  fileName: string
  mimeType: string
  productName?: string
}

export type UploadedMenuProductImage = {
  imageUrl: string
  thumbnailUrl: string
  viewUrl: string
  fileId: string
  fileName: string
  uploadedAt: string
}

export type UploadMenuProductModelInput = {
  dataUrl: string
  fileName: string
  mimeType: string
  productName?: string
}

export type UploadedMenuProductModel = {
  modelUrl: string
  fileId: string
  fileName: string
  mimeType: string
  uploadedAt: string
}

function normalizeMenuProductPaymentMode(value: unknown): ProductPaymentMode {
  return value === "divisa" ? "divisa" : "mixto"
}

function normalizeMenuProductType(value: unknown): MenuProductType {
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

function normalizeMenuProductSalesChannels(value: unknown): MenuProductSalesChannel[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const cleanValue = value.trim()

          if (!cleanValue) return []

          try {
            const parsedValue = JSON.parse(cleanValue)

            return Array.isArray(parsedValue) ? parsedValue : cleanValue.split(/[;,|]/g)
          } catch {
            return cleanValue.split(/[;,|]/g)
          }
        })()
      : []
  const allowedChannels: MenuProductSalesChannel[] = ["local", "takeaway", "delivery"]
  const selectedChannels = rawList
    .map((item) => String(item || "").trim())
    .filter((item): item is MenuProductSalesChannel =>
      allowedChannels.includes(item as MenuProductSalesChannel)
    )

  return selectedChannels.length ? Array.from(new Set(selectedChannels)) : allowedChannels
}

function normalizeMenuProductArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]

  const rawValue = String(value || "").trim()

  if (!rawValue) return []

  try {
    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? (parsedValue as T[]) : []
  } catch {
    return []
  }
}

function normalizeMenuProductRecord(value: unknown): MenuProductSelectionRules {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as MenuProductSelectionRules
  }

  const rawValue = String(value || "").trim()

  if (!rawValue) return {}

  try {
    const parsedValue = JSON.parse(rawValue)

    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? (parsedValue as MenuProductSelectionRules)
      : {}
  } catch {
    return {}
  }
}

// El valor termina en el atributo `src`/`ios-src` de <model-viewer> en la carta
// pública, así que solo se aceptan rutas del propio sitio o URLs http(s).
// Cualquier otra cosa (javascript:, data:…) se guarda como "" = sin modelo.
function normalizeMenuProductModelUrl(value: unknown) {
  const rawValue = String(value || "").trim()

  if (!rawValue) return ""

  const isSafeUrl =
    rawValue.startsWith("/") ||
    /^https?:\/\//i.test(rawValue)

  return isSafeUrl ? rawValue : ""
}

function normalizeMenuProductPositiveInteger(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0

  return Math.round(numberValue)
}

function buildMenuProductPremiumSummary(product: {
  productType?: MenuProductType
  salesChannels?: MenuProductSalesChannel[]
  variations?: unknown[]
  addons?: unknown[]
  removableIngredients?: unknown[]
  preparationMinutes?: number
  requiresWaiterConfirmation?: boolean
}) {
  const details: string[] = []

  if (product.productType && product.productType !== "normal") {
    details.push(`Tipo: ${product.productType}`)
  }

  if (product.salesChannels?.length) {
    details.push(`Canales: ${product.salesChannels.join(", ")}`)
  }

  if (product.variations?.length) {
    details.push(`Variaciones: ${product.variations.length}`)
  }

  if (product.addons?.length) {
    details.push(`Adicionales: ${product.addons.length}`)
  }

  if (product.removableIngredients?.length) {
    details.push(`Removibles: ${product.removableIngredients.length}`)
  }

  if (product.preparationMinutes) {
    details.push(`Preparación: ${product.preparationMinutes} min`)
  }

  if (product.requiresWaiterConfirmation) {
    details.push("Requiere confirmación del mesonero")
  }

  return details.join(" · ")
}

function normalizeMenuProduct(value: unknown): MenuProduct {
  const source = (value || {}) as Partial<MenuProduct>
  const id = Number(source.id || 0)
  const price = Number(source.price || 0)
  const sortOrder = Number(source.sortOrder || 0)

  const normalizedProduct = {
    id: Number.isFinite(id) && id > 0 ? Math.round(id) : 0,
    name: String(source.name || "").trim(),
    category: String(source.category || "Otros").trim() || "Otros",
    description: String(source.description || "").trim(),
    price: Number.isFinite(price) && price > 0 ? Math.round((price + Number.EPSILON) * 100) / 100 : 0,
    image: String(source.image || "").trim(),
    paymentMode: normalizeMenuProductPaymentMode(source.paymentMode),
    isActive: source.isActive !== false,
    isFeatured: source.isFeatured === true,
    sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? Math.round(sortOrder) : 9999,
    createdAt: String(source.createdAt || "").trim(),
    updatedAt: String(source.updatedAt || "").trim(),
    productType: normalizeMenuProductType(source.productType),
    salesChannels: normalizeMenuProductSalesChannels(source.salesChannels),
    variations: normalizeMenuProductArray<MenuProductOptionGroup>(source.variations),
    addons: normalizeMenuProductArray<MenuProductAddon>(source.addons),
    includedIngredients: normalizeMenuProductArray<MenuProductIngredient>(source.includedIngredients),
    removableIngredients: normalizeMenuProductArray<MenuProductIngredient>(source.removableIngredients),
    comboItems: normalizeMenuProductArray<MenuProductComboItem>(source.comboItems),
    selectionRules: normalizeMenuProductRecord(source.selectionRules),
    preparationMinutes: normalizeMenuProductPositiveInteger(source.preparationMinutes),
    requiresWaiterConfirmation: source.requiresWaiterConfirmation === true,
    inventoryDiscountEnabled: source.inventoryDiscountEnabled !== false,
    premiumSummary: String(source.premiumSummary || "").trim(),
    ivaRate: (() => {
      const raw = source.ivaRate as unknown
      if (raw == null || raw === "") return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
    })(),
    model3dUrl: normalizeMenuProductModelUrl(source.model3dUrl),
    model3dIosUrl: normalizeMenuProductModelUrl(source.model3dIosUrl),
  }

  return {
    ...normalizedProduct,
    premiumSummary:
      normalizedProduct.premiumSummary || buildMenuProductPremiumSummary(normalizedProduct),
  }
}

function normalizeMenuProducts(value: unknown): MenuProduct[] {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeMenuProduct)
    .filter((product: MenuProduct) => product.id > 0 && product.name)
    .sort((a: MenuProduct, b: MenuProduct) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })
}


function normalizeUploadedMenuProductImage(value: unknown): UploadedMenuProductImage {
  const source = (value || {}) as Partial<UploadedMenuProductImage>

  return {
    imageUrl: String(source.imageUrl || source.thumbnailUrl || "").trim(),
    thumbnailUrl: String(source.thumbnailUrl || source.imageUrl || "").trim(),
    viewUrl: String(source.viewUrl || "").trim(),
    fileId: String(source.fileId || "").trim(),
    fileName: String(source.fileName || "").trim(),
    uploadedAt: String(source.uploadedAt || "").trim(),
  }
}

// El menú vive en la tabla `menu_products` de Supabase: campos planos en columnas
// y las partes complejas (variaciones, adicionales, ingredientes, reglas, flags)
// en la columna JSONB `config`. Las imágenes se guardan en el bucket público
// `menu-images` de Supabase Storage.
const MENU_IMAGES_BUCKET = "menu-images"

function menuRowToProduct(row: Record<string, unknown>): MenuProduct {
  const config =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {}

  return normalizeMenuProduct({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    image: row.image,
    paymentMode: row.payment_mode,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    productType: row.product_type,
    salesChannels: row.sales_channels,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...config,
  })
}

export async function getMenuProducts(
  options: { includeInactive?: boolean } = {},
  branchId?: string | null,
): Promise<MenuProduct[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("menu_products").select("*")

  if (!options.includeInactive) {
    query = query.eq("is_active", true)
  }

  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || "No se pudieron cargar los productos del menú")
  }

  return normalizeMenuProducts((data ?? []).map(menuRowToProduct))
}

export async function saveMenuProduct(
  input: SaveMenuProductInput,
  branchId?: string | null,
): Promise<{ menuProduct: MenuProduct }> {
  const supabase = getSupabaseAdmin()
  const isUpdate = Number(input.id) > 0
  const productId = isUpdate ? Math.round(Number(input.id)) : Date.now()
  const normalized = normalizeMenuProduct({ ...input, id: productId })

  // Al ACTUALIZAR: (1) guardia de sede — el upsert no filtraba por branch_id y
  // un manager de la sede B podía sobrescribir/robarse un producto de la sede A
  // enviando su id (auditoría 2026-07-24); (2) se conserva la config existente
  // para toda clave estructurada que el cliente NO envió (el editor simple no
  // manda combos/variaciones avanzadas y antes el guardado las vaciaba).
  let existingConfig: Record<string, unknown> | null = null

  if (isUpdate) {
    const { data: existingRow, error: existingError } = await supabase
      .from("menu_products")
      .select("id, branch_id, config")
      .eq("id", productId)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message || "No se pudo verificar el producto del menú")
    }

    if (existingRow) {
      const existingBranch = cleanId((existingRow as Record<string, unknown>).branch_id)
      const targetBranch = cleanId(branchId)

      if (existingBranch && targetBranch && existingBranch !== targetBranch) {
        throw new Error("Ese producto pertenece a otra sucursal")
      }

      const rawConfig = (existingRow as Record<string, unknown>).config
      existingConfig =
        rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
          ? (rawConfig as Record<string, unknown>)
          : null
    }
  }

  // Clave enviada por el cliente ⇒ manda lo normalizado; clave AUSENTE en un
  // update ⇒ se conserva lo guardado (nada de vaciar config por omisión).
  const configValue = (key: string, normalizedValue: unknown, fallback: unknown) => {
    const provided = (input as Record<string, unknown>)[key] !== undefined
    if (!provided && existingConfig) return existingConfig[key] ?? fallback
    return normalizedValue ?? fallback
  }

  const row = {
    id: productId,
    branch_id: branchId ?? null,
    name: normalized.name,
    category: normalized.category,
    description: normalized.description,
    price: normalized.price,
    image: normalized.image,
    product_type: normalized.productType ?? "normal",
    payment_mode: normalized.paymentMode,
    sales_channels: normalized.salesChannels ?? ["local", "takeaway", "delivery"],
    is_active: normalized.isActive,
    sort_order: normalized.sortOrder,
    config: {
      variations: configValue("variations", normalized.variations, []),
      addons: configValue("addons", normalized.addons, []),
      includedIngredients: configValue(
        "includedIngredients",
        normalized.includedIngredients,
        [],
      ),
      removableIngredients: configValue(
        "removableIngredients",
        normalized.removableIngredients,
        [],
      ),
      comboItems: configValue("comboItems", normalized.comboItems, []),
      selectionRules: configValue("selectionRules", normalized.selectionRules, {}),
      preparationMinutes: configValue(
        "preparationMinutes",
        normalized.preparationMinutes,
        0,
      ),
      requiresWaiterConfirmation: normalized.requiresWaiterConfirmation === true,
      inventoryDiscountEnabled: normalized.inventoryDiscountEnabled !== false,
      isFeatured: normalized.isFeatured === true,
      premiumSummary: configValue("premiumSummary", normalized.premiumSummary, ""),
      ivaRate: configValue("ivaRate", normalized.ivaRate ?? null, null),
      model3dUrl: configValue("model3dUrl", normalized.model3dUrl, ""),
      model3dIosUrl: configValue("model3dIosUrl", normalized.model3dIosUrl, ""),
    },
  }

  // branch-exempt: `row` incluye branch_id (asignado arriba).
  const { data, error } = await supabase
    .from("menu_products")
    .upsert(row)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message || "No se pudo guardar el producto del menú")
  }

  return { menuProduct: menuRowToProduct(data as Record<string, unknown>) }
}

export async function uploadMenuProductImage(
  input: UploadMenuProductImageInput,
): Promise<UploadedMenuProductImage> {
  const supabase = getSupabaseAdmin()

  const image = decodeDataUrlImage(input.dataUrl, {
    label: "La imagen del producto",
    maxBytes: 6_000_000,
    fallbackMimeType: input.mimeType || "image/jpeg",
  })
  const safeName = sanitizeUploadedImageFileName(
    input.fileName,
    input.productName || "imagen",
    image.mimeType,
  )
  const path = `products/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(path, image.buffer, { contentType: image.mimeType, upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message || "No se pudo subir la imagen del producto")
  }

  const { data: publicData } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(path)
  const imageUrl = publicData?.publicUrl || ""

  if (!imageUrl) {
    throw new Error("La imagen se subió, pero no se recibió un enlace válido")
  }

  return normalizeUploadedMenuProductImage({
    imageUrl,
    thumbnailUrl: imageUrl,
    viewUrl: imageUrl,
    fileId: path,
    fileName: safeName,
    uploadedAt: new Date().toISOString(),
  })
}

// Los modelos 3D van al MISMO bucket público `menu-images`, en la carpeta
// `models/`: así no hay que crear ni configurar nada a mano en Supabase.
export async function uploadMenuProductModel(
  input: UploadMenuProductModelInput,
): Promise<UploadedMenuProductModel> {
  const supabase = getSupabaseAdmin()

  const model = decodeDataUrlModel(input.dataUrl, {
    label: "El modelo 3D del producto",
    maxBytes: 12_000_000,
    fallbackMimeType: input.mimeType || "model/gltf-binary",
    fileName: input.fileName,
  })
  const safeName = sanitizeUploadedModelFileName(
    input.fileName,
    input.productName || "modelo",
    model.mimeType,
  )
  const path = `models/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(path, model.buffer, { contentType: model.mimeType, upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message || "No se pudo subir el modelo 3D del producto")
  }

  const { data: publicData } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(path)
  const modelUrl = publicData?.publicUrl || ""

  if (!modelUrl) {
    throw new Error("El modelo 3D se subió, pero no se recibió un enlace válido")
  }

  return {
    modelUrl,
    fileId: path,
    fileName: safeName,
    mimeType: model.mimeType,
    uploadedAt: new Date().toISOString(),
  }
}

export async function deleteMenuProduct(
  productId: number,
  branchId?: string | null,
): Promise<{ ok: true; message: string }> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("menu_products")
    .update({ is_active: false })
    .eq("id", Math.round(Number(productId) || 0))

  if (branchId) {
    query = query.eq("branch_id", branchId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message || "No se pudo desactivar el producto del menú")
  }

  return {
    ok: true,
    message: "Producto desactivado correctamente.",
  }
}
