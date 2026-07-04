"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Search, Sparkles, X } from "lucide-react"
import ProductCard from "@/components/ProductCard"
import { BRAND } from "@/lib/brand"
import {
  categories as fallbackCategories,
  products as fallbackProducts,
  type Product,
} from "@/data/products"
import { buildPublicProductCategories } from "@/lib/publicProductCategories"
import { normalizePublicProducts } from "@/lib/publicProductNormalization"
import type { ProductToAdd } from "@/hooks/useCart"
import {
  DEFAULT_PUBLIC_CATEGORY_ORDER,
  normalizePublicCategoryList,
  normalizePublicHiddenCategoryList,
} from "@/lib/publicPageConfig"

type ProductsProps = {
  exchangeRate: number
  onAddToCart: (product: ProductToAdd) => void
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
}

type PublicBusinessConfigResponse = {
  businessConfig?: PublicMenuConfig
  config?: PublicMenuConfig
}

const PUBLIC_MENU_FAVORITES_STORAGE_KEY = "santo-public-menu-favorites"

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
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
  publicCategoryOrder: DEFAULT_PUBLIC_CATEGORY_ORDER,
  publicHiddenCategories: [],
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
  }
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

export default function Products({ exchangeRate, onAddToCart }: ProductsProps) {
  const [selectedCategory, setSelectedCategory] = useState("Todos")
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

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    function handleExternalFilter(event: Event) {
      const detail = (
        event as CustomEvent<{
          quickFilter?: QuickMenuFilter
          category?: string
          search?: string
        }>
      ).detail

      if (!detail) return

      if (detail.category) setSelectedCategory(detail.category)
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
        const matchesQuickFilter = productMatchesQuickFilter(
          product,
          selectedQuickFilter,
          favoriteProductIds,
        )
        const matchesSearch = productMatchesSearch(product, normalizedSearch)

        return matchesCategory && matchesQuickFilter && matchesSearch
      })
      .sort(sortPublicProducts)
  }, [menuProducts, searchTerm, selectedCategory, selectedQuickFilter, favoriteProductIds])

  function clearFilters() {
    setSelectedCategory("Todos")
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
      className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 lg:px-8"
      style={productCardStyle}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.4)] bg-[var(--brand-surface)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              <Sparkles size={16} />
              {publicMenuConfig.publicMenuEyebrow}
            </p>
            <h2 className="font-display mt-4 text-5xl leading-none text-[var(--brand-ink-3)] sm:text-6xl">
              {publicMenuConfig.publicMenuTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--brand-ink-2)] sm:text-base">
              {publicMenuConfig.publicMenuText}
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-2 sm:max-w-3xl">
            <div className="relative">
              <Search
                size={21}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={publicMenuConfig.publicMenuSearchPlaceholder}
                className="h-[3.25rem] w-full rounded-[1rem] bg-[var(--brand-surface-2)] px-12 py-4 text-base font-bold text-[var(--brand-ink-3)] outline-none placeholder:text-[var(--brand-ink-2)] focus:bg-black"
              />
              {searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--brand-surface-2)] text-[var(--brand-primary)] transition hover:bg-black"
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

        {comboProducts.length > 0 && (
          <div className="mt-8 rounded-[1.6rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  {publicMenuConfig.publicComboTitle}
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                  {publicMenuConfig.publicComboText}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("Combos")
                  setSelectedQuickFilter("all")
                }}
                className="rounded-full bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black"
              >
                {publicMenuConfig.publicComboButtonText}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-[1.6rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
          <div>
            <p className="mb-2 px-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--brand-ink-2)]">
              Categorías
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {visibleMenuCategories.map((category) => {
                const isActive = selectedCategory === category
                const count =
                  category === "Todos"
                    ? menuProducts.length
                    : category === "Favoritos"
                      ? menuProducts.filter((product) =>
                          favoriteProductIds.includes(product.id),
                        ).length
                      : menuProducts.filter(
                          (product) => product.category === category,
                        ).length

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category)
                      setSelectedQuickFilter("all")
                    }}
                    className={`shrink-0 rounded-full border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
                      isActive
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    }`}
                  >
                    {category}
                    <span className="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-[0.62rem]">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
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
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                {...product}
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
      </div>
    </section>
  )
}
