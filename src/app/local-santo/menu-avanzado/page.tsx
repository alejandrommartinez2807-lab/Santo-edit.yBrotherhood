"use client"

import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { useEffect, useEffectEvent, useMemo, useState } from "react"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { type ProductSalesChannel } from "@/data/products"
import CurrentBranchBanner from "@/components/local/CurrentBranchBanner"
import { formatUSD } from "@/utils/formatCurrency"
import {
  ADMIN_STORAGE_KEY,
  EMPTY_FORM,
  PRODUCT_TYPE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  buildConfigWarnings,
  buildFormFromProduct,
  buildPremiumSummary,
  cleanComboRowsForSave,
  cleanRowsForSave,
  cleanVariationGroupsForSave,
  formatDate,
  isFormDirty,
  normalizeMenuProduct,
  normalizeMenuProducts,
  normalizePositiveInteger,
  normalizeProductType,
  normalizeSalesChannels,
  normalizeSelectionRules,
  normalizeUnknownArray,
  randomRowId,
  readApiResponse,
  type AdvancedForm,
  type ComboItemRow,
  type InventoryOption,
  type MenuProduct,
  type OptionValue,
  type SelectionRules,
  type VariationGroup,
} from "./domain"
import {
  AddonsBuilder,
  AdvancedTextArea,
  ComboBuilder,
  IngredientsBuilder,
  InputField,
  MetricCard,
  ToggleCard,
  VariationsBuilder,
} from "./components"

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
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([])

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

  // Cambios sin guardar respecto al producto seleccionado. Protege contra
  // perder ediciones al cambiar de producto o al refrescar desde el servidor.
  const hasUnsavedChanges = useMemo(
    () => isFormDirty(form, selectedProduct),
    [form, selectedProduct],
  )

  const preparationMinutes = normalizePositiveInteger(form.preparationMinutes)
  const maxAddons = normalizePositiveInteger(form.maxAddons)
  const premiumSummary = buildPremiumSummary({
    productType: form.productType,
    salesChannels: form.salesChannels,
    variations: form.variations,
    addons: form.addons,
    comboItems: form.comboItems,
    removableIngredients: form.removableIngredients,
    preparationMinutes,
    requiresWaiterConfirmation: form.requiresWaiterConfirmation,
    inventoryDiscountEnabled: form.inventoryDiscountEnabled,
  })

  const warnings = useMemo(
    () => (selectedProduct ? buildConfigWarnings(form) : []),
    [form, selectedProduct],
  )

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

  // --- Variaciones (grupos + valores) ---
  function addVariationGroup() {
    updateForm("variations", [
      ...form.variations,
      {
        id: randomRowId("grupo"),
        name: "",
        type: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: [],
        sortOrder: form.variations.length + 1,
      },
    ])
  }

  function updateVariationGroup(index: number, patch: Partial<VariationGroup>) {
    updateForm(
      "variations",
      form.variations.map((group, groupIndex) => {
        if (groupIndex !== index) return group
        const next = { ...group, ...patch }
        if (next.type === "single") next.maxSelections = 1
        return next
      }),
    )
  }

  function removeVariationGroup(index: number) {
    updateForm("variations", form.variations.filter((_, groupIndex) => groupIndex !== index))
  }

  function moveVariationGroup(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= form.variations.length) return
    const next = [...form.variations]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateForm("variations", next)
  }

  function addVariationValue(groupIndex: number) {
    updateForm(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              values: [
                ...group.values,
                { id: randomRowId("opcion"), name: "", priceDelta: 0, isActive: true },
              ],
            }
          : group,
      ),
    )
  }

  function updateVariationValue(groupIndex: number, valueIndex: number, patch: Partial<OptionValue>) {
    updateForm(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              values: group.values.map((value, vIndex) =>
                vIndex === valueIndex ? { ...value, ...patch } : value,
              ),
            }
          : group,
      ),
    )
  }

  function removeVariationValue(groupIndex: number, valueIndex: number) {
    updateForm(
      "variations",
      form.variations.map((group, index) =>
        index === groupIndex
          ? { ...group, values: group.values.filter((_, vIndex) => vIndex !== valueIndex) }
          : group,
      ),
    )
  }

  // --- Adicionales ---
  function addAddon() {
    updateForm("addons", [
      ...form.addons,
      { id: randomRowId("adicional"), name: "", price: 0, category: "", maxQuantity: 1, isActive: true },
    ])
  }

  function updateAddon(index: number, patch: Partial<OptionValue>) {
    updateForm(
      "addons",
      form.addons.map((addon, addonIndex) => (addonIndex === index ? { ...addon, ...patch } : addon)),
    )
  }

  function removeAddon(index: number) {
    updateForm("addons", form.addons.filter((_, addonIndex) => addonIndex !== index))
  }

  // --- Artículos del combo ---
  function addComboItem() {
    updateForm("comboItems", [
      ...form.comboItems,
      { id: randomRowId("combo"), name: "", productId: undefined, quantity: 1 },
    ])
  }

  function updateComboItem(index: number, patch: Partial<ComboItemRow>) {
    updateForm(
      "comboItems",
      form.comboItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function removeComboItem(index: number) {
    updateForm("comboItems", form.comboItems.filter((_, itemIndex) => itemIndex !== index))
  }

  // --- Ingredientes (incluidos / removibles) ---
  function addIngredient(field: "includedIngredients" | "removableIngredients") {
    const mode = field === "includedIngredients" ? "included" : "removable"
    updateForm(field, [
      ...form[field],
      {
        id: randomRowId(mode),
        name: "",
        included: mode === "included",
        removable: mode === "removable",
        extraPrice: 0,
        inventoryItemId: null,
        inventoryUnit: "",
        inventoryQuantity: 0,
        isActive: true,
      },
    ])
  }

  function updateIngredient(
    field: "includedIngredients" | "removableIngredients",
    index: number,
    patch: Partial<OptionValue>,
  ) {
    updateForm(
      field,
      form[field].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function removeIngredient(field: "includedIngredients" | "removableIngredients", index: number) {
    updateForm(field, form[field].filter((_, itemIndex) => itemIndex !== index))
  }

  function selectProduct(product: MenuProduct) {
    if (product.id === selectedProductId) return

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        `Tienes cambios sin guardar en ${selectedProduct?.name || "el producto actual"}. Si cambias de producto se perderán. ¿Continuar?`,
      )

      if (!confirmed) return
    }

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

  async function loadProducts(password = adminPassword, keepDirtyForm = false) {
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

        // No pisa el formulario si hay ediciones en curso: el refresco de
        // productos no debe descartar trabajo sin confirmación.
        if (updatedSelectedProduct && !(keepDirtyForm && hasUnsavedChanges)) {
          setForm(buildFormFromProduct(updatedSelectedProduct))
        }
      }

      await loadInventoryOptions(password)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el menú editable"
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Insumos para vincular ingredientes al inventario. Es opcional: si el módulo
  // de inventario está apagado o falla, el editor sigue funcionando sin vínculo.
  async function loadInventoryOptions(password = adminPassword) {
    if (!password) return

    try {
      const response = await fetch("/api/inventory", {
        headers: { "x-admin-password": password },
        cache: "no-store",
      })

      if (!response.ok) {
        setInventoryOptions([])
        return
      }

      const data = (await response.json().catch(() => ({}))) as {
        inventory?: Array<{ id?: unknown; name?: unknown; unit?: unknown }>
      }

      setInventoryOptions(
        (data.inventory || [])
          .map((item) => ({
            id: String(item.id || "").trim(),
            name: String(item.name || "").trim(),
            unit: String(item.unit || "").trim(),
          }))
          .filter((item) => item.id && item.name),
      )
    } catch {
      setInventoryOptions([])
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

  const restoreSavedSession = useEffectEvent(() => {
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
  })

  useEffect(() => {
    restoreSavedSession()
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
          variations: cleanVariationGroupsForSave(form.variations),
          addons: cleanRowsForSave(form.addons),
          comboItems: cleanComboRowsForSave(form.comboItems),
          includedIngredients: cleanRowsForSave(form.includedIngredients),
          removableIngredients: cleanRowsForSave(form.removableIngredients),
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

            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={BRAND.name}
              width={112}
              height={112}
              unoptimized
              className="mx-auto mt-6 h-28 w-28 object-contain"
            />

            <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.28em] text-[var(--brand-primary)]">
              Menú avanzado
            </p>

            <h1 className="font-serif mt-2 text-center text-4xl leading-tight text-[var(--brand-ink-3)] font-semibold">
              Productos configurables
            </h1>

            <p className="mt-3 text-center text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Ingresa la clave autorizada. Este módulo permite preparar variaciones, adicionales, ingredientes y reglas internas del menú premium.
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
        <header className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <ArrowLeft size={16} />
                    Volver al panel
                  </a>

                  <a
                    href="/local-santo/menu"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    <PackageCheck size={16} />
                    Menú editable
                  </a>

                  <button
                    type="button"
                    onClick={() => loadProducts(adminPassword, true)}
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

        {/* Sede en edición, bien visible: el menú avanzado guarda por sede
            (header x-branch-id); sin esto era fácil editar la sede equivocada. */}
        <CurrentBranchBanner />

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

        <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-[1.5rem] border border-[var(--brand-primary)]/40 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
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
                className="w-full rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-11 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
              />
            </div>

            <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-4 text-center">
                  <p className="text-sm font-bold text-[var(--brand-primary)]">
                    No hay productos para mostrar.
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                    Si esta sede no tiene menú propio, el público ve el menú de
                    la sede principal. Crea productos desde Menú editable con
                    esta sede seleccionada para darle menú propio.
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
                      className={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                        isSelected
                          ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-sm"
                          : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] text-[var(--brand-ink-2)] hover:border-[var(--brand-primary)] hover:bg-yellow-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--brand-primary)]/20 bg-white">
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.name}
                              width={64}
                              height={64}
                              unoptimized
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <PackageCheck size={20} className="text-[var(--brand-primary)]/50" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-bold uppercase leading-tight">
                            {product.name}
                          </p>
                          <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]/75">
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

          <section className="rounded-[1.5rem] border border-[var(--brand-primary)]/40 bg-white p-4 shadow-sm">
            {!selectedProduct ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-6 py-14 text-center">
                <SlidersHorizontal size={54} className="text-[var(--brand-primary)]" />
                <h2 className="font-serif mt-5 text-3xl text-[var(--brand-ink-3)] font-semibold">
                  Selecciona un producto
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Primero crea el producto básico desde Menú editable. Luego entra aquí para preparar variaciones, adicionales y reglas premium.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 border-b border-[var(--brand-primary)]/15 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Configurando
                    </p>
                    <h2 className="font-serif mt-1 text-3xl leading-tight text-[var(--brand-ink-3)] font-semibold">
                      {selectedProduct.name}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                      {selectedProduct.category} · {formatUSD(selectedProduct.price)} · Actualizado: {formatDate(selectedProduct.updatedAt)}
                    </p>
                    {hasUnsavedChanges && (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-yellow-500 bg-[var(--brand-accent-100)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                        Cambios sin guardar
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 lg:w-[320px]">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Resumen
                    </p>
                    <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]">
                      {premiumSummary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Tipo de producto
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {PRODUCT_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateForm("productType", option.value)}
                          className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                            form.productType === option.value
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)] hover:border-[var(--brand-primary)]"
                          }`}
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.12em]">
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
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
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
                            className={`rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] ${
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

                  {form.productType === "combo" && (
                    <div className="xl:col-span-2">
                      <ComboBuilder
                        rows={form.comboItems}
                        productOptions={products
                          .filter((product) => product.id !== selectedProduct.id)
                          .map((product) => ({ id: product.id, name: product.name, price: product.price }))}
                        onAdd={addComboItem}
                        onUpdate={updateComboItem}
                        onRemove={removeComboItem}
                      />
                    </div>
                  )}

                  <div className="xl:col-span-2">
                    <VariationsBuilder
                      groups={form.variations}
                      onAddGroup={addVariationGroup}
                      onUpdateGroup={updateVariationGroup}
                      onRemoveGroup={removeVariationGroup}
                      onMoveGroup={moveVariationGroup}
                      onAddValue={addVariationValue}
                      onUpdateValue={updateVariationValue}
                      onRemoveValue={removeVariationValue}
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <AddonsBuilder
                      addons={form.addons}
                      onAdd={addAddon}
                      onUpdate={updateAddon}
                      onRemove={removeAddon}
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <IngredientsBuilder
                      title="Ingredientes incluidos"
                      helper="Ingredientes base del producto. Vincúlalos a un insumo para descontar stock."
                      rows={form.includedIngredients}
                      inventoryOptions={inventoryOptions}
                      showExtraPrice={false}
                      onAdd={() => addIngredient("includedIngredients")}
                      onUpdate={(index, patch) => updateIngredient("includedIngredients", index, patch)}
                      onRemove={(index) => removeIngredient("includedIngredients", index)}
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <IngredientsBuilder
                      title="Ingredientes removibles / extras"
                      helper="Lo que el cliente puede quitar o agregar. Usa precio extra si cobrar el añadido."
                      rows={form.removableIngredients}
                      inventoryOptions={inventoryOptions}
                      showExtraPrice
                      onAdd={() => addIngredient("removableIngredients")}
                      onUpdate={(index, patch) => updateIngredient("removableIngredients", index, patch)}
                      onRemove={(index) => removeIngredient("removableIngredients", index)}
                    />
                  </div>

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
                  <div className="mt-4 rounded-2xl border border-yellow-400 bg-[var(--brand-accent-100)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-amber)]">
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
                    className="inline-flex min-h-[50px] w-full max-w-[310px] items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar configuración
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPreview((value) => !value)}
                    className="inline-flex min-h-[50px] w-full max-w-[310px] items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                  >
                    {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showPreview ? "Ocultar vista técnica" : "Ver vista técnica"}
                  </button>
                </div>

                {showPreview && (
                  <div className="mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-[var(--brand-ink-3)] p-4 text-[var(--brand-cream)]">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">
                      Vista técnica guardada
                    </p>
                    <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-xs font-bold leading-5">
{JSON.stringify(
  {
    productType: form.productType,
    salesChannels: form.salesChannels,
    variations: form.variations,
    addons: form.addons,
    comboItems: form.comboItems,
    includedIngredients: form.includedIngredients,
    removableIngredients: form.removableIngredients,
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
