"use client"

import { useEffect, useEffectEvent, useMemo, useState, type CSSProperties } from "react"
import {
  BadgePercent,
  Beef,
  Bike,
  Candy,
  Cookie,
  CupSoda,
  Droplets,
  Drumstick,
  Flame,
  Heart,
  IceCreamCone,
  LayoutGrid,
  Sandwich,
  Search,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react"
import ProductCard from "@/components/ProductCard"
import { BRAND } from "@/lib/brand"
import {
  categories as fallbackCategories,
  products as fallbackProducts,
  type Product,
} from "@/data/products"
import { buildPublicProductCategories } from "@/lib/publicProductCategories"
import { normalizePublicProducts } from "@/lib/publicProductNormalization"
import { BRANCH_CHANGE_EVENT } from "@/lib/branchClient"
import type { ProductToAdd } from "@/hooks/useCart"
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  normalizePublicCategoryList,
  normalizePublicHiddenCategoryList,
} from "@/lib/publicPageConfig"

type ProductsProps = {
  exchangeRate: number
  onAddToCart: (product: ProductToAdd) => void
  // Notifica el catálogo vivo (para sincronizar carritos viejos en storage).
  onProductsLoaded?: (products: Product[]) => void
}

type QuickMenuFilter = "all" | "favorites" | "combo" | "customizable" | "delivery"

type PublicProductsResponse = {
  products?: Product[]
  categories?: string[]
  fallback?: boolean
  warning?: string
}

type PublicMenuConfig = {
  publicMenuEyebrow?: string
  publicMenuTitle?: string
  publicMenuText?: string
  publicMenuSearchPlaceholder?: string
  publicComboTitle?: string
  publicComboText?: string
  publicComboButtonText?: string
  publicCustomizeButtonText?: string
  publicCustomizerTitle?: string
  productCardBackgroundColor?: string
  productCardTextColor?: string
  productCardBorderColor?: string
  productCardButtonColor?: string
  publicCategoryOrder?: string[]
  publicHiddenCategories?: string[]
  // Tamaño de las tarjetas (grande | media | compacta): define cuántos
  // productos caben por fila, sobre todo en el teléfono.
  publicProductCardSize?: string
}

type PublicBusinessConfigResponse = {
  businessConfig?: PublicMenuConfig
  config?: PublicMenuConfig
}

const PUBLIC_MENU_FAVORITES_STORAGE_KEY = "santo-public-menu-favorites"

// Banner "Ver combos" apagado por ahora (pedido del dueño 2026-07-12): llenaba
// mucho la pantalla y los combos ya se llegan por las categorías. Poner en
// true para volver a mostrarlo; los textos siguen editables en Configuración.
const SHOW_COMBO_BANNER: boolean = false

const DEFAULT_PUBLIC_MENU_CONFIG: Required<PublicMenuConfig> = {
  publicMenuEyebrow: `Menú ${BRAND.name}`,
  publicMenuTitle: "Elige tu pedido",
  publicMenuText:
    "Combos en divisas y productos normales con referencia en bolívares según la tasa activa del negocio.",
  publicMenuSearchPlaceholder: "Buscar productos, combos o adicionales",
  publicComboTitle: "Combos disponibles",
  publicComboText:
    "Los combos se manejan en divisas para mantener precios claros.",
  publicComboButtonText: "Ver combos",
  publicCustomizeButtonText: "Elige tus ingredientes",
  publicCustomizerTitle: "Elige tus ingredientes",
  // Defaults alineados al tema oscuro Brotherhood; la config del admin
  // (business_config) sigue mandando si trae valores propios.
  productCardBackgroundColor: "#141414",
  productCardTextColor: "#fafaf9",
  productCardBorderColor: "#2a2a2a",
  productCardButtonColor: "#f5a623",
  publicCategoryOrder: DEFAULT_PUBLIC_CATEGORY_ORDER,
  publicHiddenCategories: [],
  publicProductCardSize: "grande",
}

function cleanPublicText(value: unknown, fallback: string) {
  const text = String(value || "").trim()
  return text || fallback
}

function normalizePublicMenuConfig(value: unknown): Required<PublicMenuConfig> {
  const source =
    value && typeof value === "object" ? (value as PublicMenuConfig) : {}

  const publicCustomizeButtonText = cleanPublicText(
    source.publicCustomizeButtonText,
    DEFAULT_PUBLIC_MENU_CONFIG.publicCustomizeButtonText,
  )

  return {
    publicMenuEyebrow: cleanPublicText(
      source.publicMenuEyebrow,
      DEFAULT_PUBLIC_MENU_CONFIG.publicMenuEyebrow,
    ),
    publicMenuTitle: cleanPublicText(
      source.publicMenuTitle,
      DEFAULT_PUBLIC_MENU_CONFIG.publicMenuTitle,
    ),
    publicMenuText: cleanPublicText(
      source.publicMenuText,
      DEFAULT_PUBLIC_MENU_CONFIG.publicMenuText,
    ),
    publicMenuSearchPlaceholder: cleanPublicText(
      source.publicMenuSearchPlaceholder,
      DEFAULT_PUBLIC_MENU_CONFIG.publicMenuSearchPlaceholder,
    ),
    publicComboTitle: cleanPublicText(
      source.publicComboTitle,
      DEFAULT_PUBLIC_MENU_CONFIG.publicComboTitle,
    ),
    publicComboText: cleanPublicText(
      source.publicComboText,
      DEFAULT_PUBLIC_MENU_CONFIG.publicComboText,
    ),
    publicComboButtonText: cleanPublicText(
      source.publicComboButtonText,
      DEFAULT_PUBLIC_MENU_CONFIG.publicComboButtonText,
    ),
    publicCustomizeButtonText,
    publicCustomizerTitle: cleanPublicText(
      source.publicCustomizerTitle,
      publicCustomizeButtonText,
    ),
    productCardBackgroundColor: cleanPublicText(
      source.productCardBackgroundColor,
      DEFAULT_PUBLIC_MENU_CONFIG.productCardBackgroundColor,
    ),
    productCardTextColor: cleanPublicText(
      source.productCardTextColor,
      DEFAULT_PUBLIC_MENU_CONFIG.productCardTextColor,
    ),
    productCardBorderColor: cleanPublicText(
      source.productCardBorderColor,
      DEFAULT_PUBLIC_MENU_CONFIG.productCardBorderColor,
    ),
    productCardButtonColor: cleanPublicText(
      source.productCardButtonColor,
      DEFAULT_PUBLIC_MENU_CONFIG.productCardButtonColor,
    ),
    publicCategoryOrder: normalizePublicCategoryList(source.publicCategoryOrder).length
      ? normalizePublicCategoryList(source.publicCategoryOrder)
      : DEFAULT_PUBLIC_MENU_CONFIG.publicCategoryOrder,
    publicHiddenCategories: normalizePublicHiddenCategoryList(
      source.publicHiddenCategories,
    ),
    publicProductCardSize: ["grande", "media", "compacta"].includes(
      String(source.publicProductCardSize || "").trim().toLowerCase(),
    )
      ? String(source.publicProductCardSize).trim().toLowerCase()
      : DEFAULT_PUBLIC_MENU_CONFIG.publicProductCardSize,
  }
}

// Columnas del grid según el tamaño elegido en Configuración: "grande" es el
// diseño original; "media" y "compacta" meten más productos por fila.
const PRODUCT_GRID_BY_CARD_SIZE: Record<string, string> = {
  grande: "mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3",
  media: "mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4",
  compacta:
    "mt-8 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5",
}

function getBusinessConfigPayload(
  value: PublicBusinessConfigResponse,
): PublicMenuConfig {
  return value.businessConfig || value.config || {}
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

// Icono por categor\u00eda (mockup del redise\u00f1o: chips con dibujito). Se resuelve
// por palabras clave para aguantar los nombres reales que ponga el due\u00f1o.
function getCategoryIcon(category: string): LucideIcon {
  const key = normalizeSearchText(category)

  if (key === "todos") return LayoutGrid
  if (key === "favoritos") return Heart
  if (/promo|favorita|epa bro|oferta/.test(key)) return BadgePercent
  if (/combo/.test(key)) return UtensilsCrossed
  if (/pollo|chicken|nugget/.test(key)) return Drumstick
  if (/hamburgues|burger|smash|biggie|veggie|basic/.test(key)) return Sandwich
  if (/kid/.test(key)) return Candy
  if (/refresco|bebida|jugo|te frio|malta|agua/.test(key)) return CupSoda
  if (/postre|dulce|brownie|helado/.test(key)) return IceCreamCone
  if (/antojo/.test(key)) return Cookie
  if (/papa|frita|side|extra|acompan/.test(key)) return Utensils

  return Utensils
}

// Franja de features del final del men\u00fa (mockup del redise\u00f1o): argumentos
// fijos de la marca, mismos textos de la cinta del hero + operaci\u00f3n.
const MENU_FEATURE_STRIP: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Beef, title: "Carne 100% res", detail: "Smash al momento" },
  { icon: Flame, title: "Queso fundido", detail: "En cada mordida" },
  { icon: Sandwich, title: "Pan brioche", detail: "Suave y dorado" },
  { icon: Utensils, title: "Papas frescas", detail: "Corte grueso" },
  { icon: Droplets, title: "Salsas caseras", detail: "Hechas por nosotros" },
  { icon: Bike, title: "Pedido r\u00e1pido", detail: "Delivery y Pick Up" },
]

function hasSelectablePublicOptions(product: Product) {
  return Boolean(
    (product.variations || []).length > 0 ||
      (product.addons || []).length > 0 ||
      (product.includedIngredients || []).length > 0 ||
      (product.removableIngredients || []).length > 0,
  )
}

function isComboPublicProduct(product: Product) {
  return product.category === "Combos" || product.productType === "combo"
}

function productMatchesQuickFilter(
  product: Product,
  filter: QuickMenuFilter,
  favoriteProductIds: number[],
) {
  if (filter === "favorites") return favoriteProductIds.includes(product.id)
  if (filter === "combo") return isComboPublicProduct(product)
  if (filter === "customizable") return hasSelectablePublicOptions(product)
  if (filter === "delivery") {
    return (product.salesChannels || []).includes("delivery")
  }

  return true
}

function productMatchesSearch(product: Product, normalizedSearch: string) {
  if (normalizedSearch.length === 0) return true

  const searchableText = normalizeSearchText(
    [
      product.name,
      product.description,
      product.category,
      product.premiumSummary,
      ...(product.variations || []).map((item) => JSON.stringify(item)),
      ...(product.addons || []).map((item) => JSON.stringify(item)),
      ...(product.includedIngredients || []).map((item) => JSON.stringify(item)),
      ...(product.removableIngredients || []).map((item) => JSON.stringify(item)),
    ]
      .filter(Boolean)
      .join(" "),
  )

  return searchableText.includes(normalizedSearch)
}

function getProductSortOrder(product: Product) {
  const sortOrder = Number(product.sortOrder || 9999)

  return Number.isFinite(sortOrder) ? sortOrder : 9999
}

function sortPublicProducts(first: Product, second: Product) {
  return (
    Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured)) ||
    getProductSortOrder(first) - getProductSortOrder(second) ||
    first.category.localeCompare(second.category) ||
    first.name.localeCompare(second.name)
  )
}

export default function Products({ exchangeRate, onAddToCart, onProductsLoaded }: ProductsProps) {
  const [selectedCategory, setSelectedCategory] = useState("Todos")
  // Grupo de categorías (botones fijos de la barra compacta del Navbar:
  // Promos / Hamburguesas / Bebidas...): filtra por VARIAS categorías a la
  // vez. Se limpia al tocar cualquier categoría del menú.
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<string[]>([])
  const [selectedQuickFilter, setSelectedQuickFilter] =
    useState<QuickMenuFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [menuProducts, setMenuProducts] = useState<Product[]>(fallbackProducts)
  const [menuCategories, setMenuCategories] = useState<string[]>(fallbackCategories)
  const [menuWarning, setMenuWarning] = useState<string | null>(null)
  const [favoriteProductIds, setFavoriteProductIds] = useState<number[]>([])
  const [publicMenuConfig, setPublicMenuConfig] = useState<
    Required<PublicMenuConfig>
  >(DEFAULT_PUBLIC_MENU_CONFIG)

  useEffect(() => {
    function applyFavoriteIds(nextIds: number[]) {
      setFavoriteProductIds(
        nextIds.filter((item) => Number.isFinite(item) && item > 0),
      )
    }

    function handleFavoritesChanged(event: Event) {
      const detail = (
        event as CustomEvent<{ favoriteProductIds?: number[] }>
      ).detail

      if (Array.isArray(detail?.favoriteProductIds)) {
        applyFavoriteIds(detail.favoriteProductIds.map((item) => Number(item)))
      }
    }

    // Difiere la lectura de favoritos un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const favoritesTimer = setTimeout(() => {
      try {
        const rawFavorites = window.localStorage.getItem(
          PUBLIC_MENU_FAVORITES_STORAGE_KEY,
        )
        const parsedFavorites = rawFavorites ? JSON.parse(rawFavorites) : []

        if (Array.isArray(parsedFavorites)) {
          applyFavoriteIds(parsedFavorites.map((item) => Number(item)))
        }
      } catch {
        setFavoriteProductIds([])
      }
    }, 0)

    window.addEventListener("santo:favorites-changed", handleFavoritesChanged)

    return () => {
      clearTimeout(favoritesTimer)
      window.removeEventListener(
        "santo:favorites-changed",
        handleFavoritesChanged,
      )
    }
  }, [])

  // Estable para el efecto: el callback del padre cambia en cada render.
  const notifyProductsLoaded = useEffectEvent((loadedProducts: Product[]) => {
    onProductsLoaded?.(loadedProducts)
  })

  useEffect(() => {
    let isMounted = true

    async function loadPublicProducts() {
      try {
        const [productsResponse, configResponse] = await Promise.all([
          fetch("/api/public/products", { cache: "no-store" }),
          fetch("/api/public/business-config", { cache: "no-store" }),
        ])
        const data = (await productsResponse.json()) as PublicProductsResponse

        if (!productsResponse.ok) {
          throw new Error(data.warning || "No se pudo cargar el menú editable")
        }

        let nextPublicMenuConfig = DEFAULT_PUBLIC_MENU_CONFIG

        if (configResponse.ok) {
          const configData =
            (await configResponse.json()) as PublicBusinessConfigResponse
          nextPublicMenuConfig = normalizePublicMenuConfig(
            getBusinessConfigPayload(configData),
          )
        }

        const cleanProducts = normalizePublicProducts(data.products)
        const cleanCategories = buildPublicProductCategories(
          cleanProducts,
          data.categories,
        )

        if (!isMounted) return

        setMenuProducts(cleanProducts)
        setMenuCategories(cleanCategories)
        notifyProductsLoaded(cleanProducts)
        setMenuWarning(data.warning || null)
        setPublicMenuConfig(nextPublicMenuConfig)
      } catch {
        if (!isMounted) return

        setMenuProducts(fallbackProducts)
        setMenuCategories(fallbackCategories)
        setMenuWarning(null)
        setPublicMenuConfig(DEFAULT_PUBLIC_MENU_CONFIG)
      }
    }

    loadPublicProducts()

    // Al cambiar la sede elegida (picker público o saneo de una sede vieja),
    // el menú se recarga: AuthBridge adjunta la nueva x-branch-id al fetch.
    function handleBranchChange() {
      loadPublicProducts()
    }
    window.addEventListener(BRANCH_CHANGE_EVENT, handleBranchChange)

    return () => {
      isMounted = false
      window.removeEventListener(BRANCH_CHANGE_EVENT, handleBranchChange)
    }
  }, [])

  useEffect(() => {
    function handleExternalFilter(event: Event) {
      const detail = (
        event as CustomEvent<{
          quickFilter?: QuickMenuFilter
          category?: string
          categories?: string[]
          search?: string
        }>
      ).detail

      if (!detail) return

      if (detail.category) {
        setSelectedCategory(detail.category)
        setSelectedCategoryGroup([])
      }
      if (Array.isArray(detail.categories)) {
        // Grupo (botones fijos del Navbar): varias categorías a la vez.
        setSelectedCategoryGroup(detail.categories.filter(Boolean))
        setSelectedCategory("Todos")
      }
      if (detail.quickFilter) setSelectedQuickFilter(detail.quickFilter)
      if (typeof detail.search === "string") setSearchTerm(detail.search)
    }

    window.addEventListener("santo:menu-filter", handleExternalFilter)

    return () => {
      window.removeEventListener("santo:menu-filter", handleExternalFilter)
    }
  }, [])

  const comboProducts = menuProducts.filter(isComboPublicProduct)

  const visibleMenuCategories = useMemo(() => {
    const hiddenCategoryKeys = new Set(
      publicMenuConfig.publicHiddenCategories.map(normalizeSearchText),
    )
    const cleanCategories = menuCategories.filter((category) => {
      const normalizedCategory = normalizeSearchText(category)

      return (
        category !== "Todos" &&
        category !== "Favoritos" &&
        !hiddenCategoryKeys.has(normalizedCategory)
      )
    })
    const categoryByKey = new Map(
      cleanCategories.map((category) => [normalizeSearchText(category), category]),
    )
    const orderedCategories = publicMenuConfig.publicCategoryOrder
      .map((category) => categoryByKey.get(normalizeSearchText(category)))
      .filter((category): category is string => Boolean(category))
    const remainingCategories = cleanCategories.filter(
      (category) => !orderedCategories.includes(category),
    )

    return ["Todos", "Favoritos", ...orderedCategories, ...remainingCategories]
  }, [menuCategories, publicMenuConfig.publicCategoryOrder, publicMenuConfig.publicHiddenCategories])

  useEffect(() => {
    // La barra compacta del Navbar muestra estas categorías como accesos
    // directos; se publican cada vez que cambian (sede, config del dueño).
    window.dispatchEvent(
      new CustomEvent("santo:menu-categories", {
        detail: { categories: visibleMenuCategories },
      })
    )
  }, [visibleMenuCategories])

  useEffect(() => {
    if (!visibleMenuCategories.includes(selectedCategory)) {
      const timer = setTimeout(() => setSelectedCategory("Todos"), 0)
      return () => clearTimeout(timer)
    }
  }, [selectedCategory, visibleMenuCategories])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)

    return menuProducts
      .filter((product) => {
        const matchesCategory =
          selectedCategory === "Todos" ||
          (selectedCategory === "Favoritos" && favoriteProductIds.includes(product.id)) ||
          product.category === selectedCategory
        const matchesCategoryGroup =
          selectedCategoryGroup.length === 0 ||
          selectedCategoryGroup.includes(product.category)
        const matchesQuickFilter = productMatchesQuickFilter(
          product,
          selectedQuickFilter,
          favoriteProductIds,
        )
        const matchesSearch = productMatchesSearch(product, normalizedSearch)

        return matchesCategory && matchesCategoryGroup && matchesQuickFilter && matchesSearch
      })
      .sort(sortPublicProducts)
  }, [
    menuProducts,
    searchTerm,
    selectedCategory,
    selectedCategoryGroup,
    selectedQuickFilter,
    favoriteProductIds,
  ])

  function clearFilters() {
    setSelectedCategory("Todos")
    setSelectedCategoryGroup([])
    setSelectedQuickFilter("all")
    setSearchTerm("")
  }

  function toggleFavoriteProduct(productId: number) {
    setFavoriteProductIds((currentIds) => {
      const nextIds = currentIds.includes(productId)
        ? currentIds.filter((item) => item !== productId)
        : [...currentIds, productId]

      try {
        window.localStorage.setItem(
          PUBLIC_MENU_FAVORITES_STORAGE_KEY,
          JSON.stringify(nextIds),
        )
      } catch {
        // Favoritos públicos: si el navegador bloquea localStorage, la página sigue funcionando.
      }

      window.dispatchEvent(
        new CustomEvent("santo:favorites-changed", {
          detail: { favoriteProductIds: nextIds },
        }),
      )

      return nextIds
    })
  }

  const productCardStyle = {
    "--product-card-bg": publicMenuConfig.productCardBackgroundColor,
    "--product-card-text": publicMenuConfig.productCardTextColor,
    "--product-card-border": publicMenuConfig.productCardBorderColor,
    "--product-card-button": publicMenuConfig.productCardButtonColor,
  } as CSSProperties

  return (
    <section
      id="menu"
      className="relative overflow-hidden bg-[var(--brand-cream)] px-4 py-12 sm:px-6 lg:px-8"
      style={productCardStyle}
    >
      {/* Brillos ambientales de la marca: dan profundidad sin tocar el contenido. */}
      <div className="pointer-events-none absolute -left-36 top-24 h-80 w-80 rounded-full bg-[rgba(var(--brand-primary-rgb),0.09)] blur-3xl" />
      <div className="pointer-events-none absolute -right-36 bottom-44 h-96 w-96 rounded-full bg-[rgba(var(--brand-primary-rgb),0.06)] blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
              <Sparkles size={16} />
              {publicMenuConfig.publicMenuEyebrow}
            </p>
            <h2 className="font-display mt-4 text-[3.4rem] uppercase leading-[0.88] text-[var(--brand-ink-3)] [text-shadow:0_8px_40px_rgba(var(--brand-primary-rgb),0.25)] sm:text-7xl">
              {publicMenuConfig.publicMenuTitle}
            </h2>
            <div className="mt-4 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--brand-primary),rgba(var(--brand-primary-rgb),0.05))]" />
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--brand-ink-2)] sm:text-base">
              {publicMenuConfig.publicMenuText}
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <div className="relative">
              <Search
                size={20}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
              />
              <input
                id="public-menu-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={publicMenuConfig.publicMenuSearchPlaceholder}
                className="h-14 w-full rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] pl-12 pr-12 text-sm font-bold text-[var(--brand-ink-3)] outline-none transition placeholder:text-[var(--brand-ink-2)]/70 focus:border-[var(--brand-primary)] focus:bg-black sm:text-base"
              />
              {searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--brand-surface-2)] text-[var(--brand-primary)] transition hover:bg-black"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {menuWarning && (
          <div className="mt-5 rounded-2xl border border-[rgba(var(--brand-primary-rgb),0.4)] bg-[var(--brand-surface)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--brand-accent)]">
            {menuWarning}
          </div>
        )}

        {SHOW_COMBO_BANNER && comboProducts.length > 0 && (
          <div className="relative mt-10 overflow-hidden rounded-[1.4rem] border border-[rgba(var(--brand-primary-rgb),0.45)] bg-[linear-gradient(100deg,rgba(var(--brand-primary-rgb),0.16),rgba(var(--brand-primary-rgb),0.03)_55%,transparent)]">
            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[rgba(var(--brand-primary-rgb),0.18)] blur-3xl" />
            <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-black">
                  <Sparkles size={22} />
                </span>
                <div>
                  <p className="font-display text-xl uppercase leading-none text-[var(--brand-primary)] sm:text-2xl">
                    {publicMenuConfig.publicComboTitle}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-5 text-[var(--brand-ink-2)]">
                    {publicMenuConfig.publicComboText}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("Combos")
                  setSelectedCategoryGroup([])
                  setSelectedQuickFilter("all")
                }}
                className="shrink-0 rounded-full bg-[var(--brand-primary)] px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_12px_30px_-12px_rgba(var(--brand-primary-rgb),0.8)] transition hover:bg-[var(--brand-accent)] active:scale-95"
              >
                {publicMenuConfig.publicComboButtonText}
              </button>
            </div>
          </div>
        )}

        <div className="sticky top-[8.4rem] z-30 -mx-4 mt-8 bg-[var(--brand-cream)]/95 px-4 py-3 backdrop-blur-sm sm:static sm:z-auto sm:m-0 sm:bg-transparent sm:p-0 sm:pt-8 sm:backdrop-blur-none">
          {/* Sin barra de scroll visible: en el teléfono se pintaba como una
              franja naranja gruesa bajo las categorías y desentonaba. */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:pb-0">
            {visibleMenuCategories.map((category) => {
              const isActive = selectedCategory === category
              const CategoryIcon = getCategoryIcon(category)

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category)
                    setSelectedCategoryGroup([])
                    setSelectedQuickFilter("all")
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition active:scale-95 sm:gap-2 sm:px-5 sm:py-3 ${
                    isActive
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black shadow-[0_10px_26px_-12px_rgba(var(--brand-primary-rgb),0.8)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  }`}
                >
                  <CategoryIcon
                    size={15}
                    className={isActive ? "text-black" : "text-[var(--brand-primary)]"}
                  />
                  {category}
                </button>
              )
            })}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-8 rounded-[1.5rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] px-5 py-10 text-center">
            <p className="font-display text-2xl text-[var(--brand-primary)]">
              No encontramos productos con ese filtro
            </p>
            <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/65">
              {selectedQuickFilter === "favorites"
                ? "Guarda productos tocando el botón de favorito en una tarjeta y vuelve a este filtro cuando quieras."
                : "Limpia la búsqueda o cambia de categoría para ver el menú."}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-full bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black"
            >
              Ver todo el menú
            </button>
          </div>
        ) : (
          <div
            className={
              PRODUCT_GRID_BY_CARD_SIZE[
                publicMenuConfig.publicProductCardSize
              ] || PRODUCT_GRID_BY_CARD_SIZE.grande
            }
          >
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                {...product}
                cardSize={publicMenuConfig.publicProductCardSize}
                exchangeRate={exchangeRate}
                index={index}
                onAddToCart={onAddToCart}
                publicLabels={{
                  customizeAction: publicMenuConfig.publicCustomizeButtonText,
                  customizerTitle: publicMenuConfig.publicCustomizerTitle,
                }}
                isFavorite={favoriteProductIds.includes(product.id)}
                onToggleFavorite={toggleFavoriteProduct}
              />
            ))}
          </div>
        )}

        {/* Franja de features (mockup del rediseño): cierra el menú con los
            argumentos de la marca. Solo decorativa, no depende de la config. */}
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-6 rounded-[1.6rem] border border-[var(--brand-border)] bg-black/40 px-5 py-7 sm:grid-cols-3 lg:grid-cols-6">
          {MENU_FEATURE_STRIP.map(({ icon: FeatureIcon, title, detail }) => (
            <div
              key={title}
              className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center lg:flex-row lg:gap-3 lg:text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(var(--brand-primary-rgb),0.35)] bg-[var(--brand-surface)] text-[var(--brand-primary)]">
                <FeatureIcon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.7rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-3)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-[0.62rem] font-bold uppercase tracking-[0.06em] text-[var(--brand-ink-2)]">
                  {detail}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
