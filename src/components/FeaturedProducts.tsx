"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Sparkles } from "lucide-react"
import ProductCard from "@/components/ProductCard"
import { BRAND } from "@/lib/brand"
import { normalizeProductIds } from "@/lib/productIdList"
import {
  products as fallbackProducts,
  type Product,
} from "@/data/products"
import { normalizePublicProducts } from "@/lib/publicProductNormalization"
import type { ProductToAdd } from "@/hooks/useCart"

type FeaturedProductsProps = {
  exchangeRate: number
  onAddToCart: (product: ProductToAdd) => void
}

type PublicBusinessConfig = {
  featuredProductsActive?: boolean
  featuredProductsTitle?: string
  featuredProductsText?: string
  featuredProductIds?: number[]
  publicCustomizeButtonText?: string
  publicCustomizerTitle?: string
  productCardBackgroundColor?: string
  productCardTextColor?: string
  productCardBorderColor?: string
  productCardButtonColor?: string
}

type PublicProductsResponse = {
  products?: Product[]
  fallback?: boolean
  warning?: string
}

export default function FeaturedProducts({
  exchangeRate,
  onAddToCart,
}: FeaturedProductsProps) {
  const [config, setConfig] = useState<PublicBusinessConfig | null>(null)
  const [publicProducts, setPublicProducts] = useState<Product[]>(fallbackProducts)

  useEffect(() => {
    let isMounted = true

    async function loadPublicData() {
      try {
        const [configResponse, productsResponse] = await Promise.all([
          fetch("/api/public/business-config", { cache: "no-store" }),
          fetch("/api/public/products", { cache: "no-store" }),
        ])

        let nextConfig: PublicBusinessConfig = {}
        let nextProducts = fallbackProducts

        if (configResponse.ok) {
          const data = await configResponse.json()
          const businessConfig = data.businessConfig || data.config || {}

          nextConfig = {
            featuredProductsActive: Boolean(
              businessConfig.featuredProductsActive
            ),
            featuredProductsTitle: String(
              businessConfig.featuredProductsTitle || ""
            ).trim(),
            featuredProductsText: String(
              businessConfig.featuredProductsText || ""
            ).trim(),
            featuredProductIds: normalizeProductIds(
              businessConfig.featuredProductIds
            ),
            publicCustomizeButtonText: String(
              businessConfig.publicCustomizeButtonText || ""
            ).trim(),
            publicCustomizerTitle: String(
              businessConfig.publicCustomizerTitle || ""
            ).trim(),
            productCardBackgroundColor: String(
              businessConfig.productCardBackgroundColor || "#141414"
            ).trim(),
            productCardTextColor: String(
              businessConfig.productCardTextColor || "#fafaf9"
            ).trim(),
            productCardBorderColor: String(
              businessConfig.productCardBorderColor || "#2a2a2a"
            ).trim(),
            productCardButtonColor: String(
              businessConfig.productCardButtonColor || "#f5a623"
            ).trim(),
          }
        }

        if (productsResponse.ok) {
          const data = (await productsResponse.json()) as PublicProductsResponse
          nextProducts = normalizePublicProducts(data.products, {
            imageFallback: BRAND.logoUrl || "/logoremovebg.png",
          })
        }

        if (!isMounted) return

        setConfig(nextConfig)
        setPublicProducts(nextProducts)
      } catch {
        if (!isMounted) return

        setConfig(null)
        setPublicProducts(fallbackProducts)
      }
    }

    loadPublicData()

    return () => {
      isMounted = false
    }
  }, [])

  const featuredProducts = useMemo(() => {
    const ids = normalizeProductIds(config?.featuredProductIds)
    const byId = ids
      .map((id) => publicProducts.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product))

    const byFlag = publicProducts.filter((product) => product.isFeatured === true)
    const merged = [...byId, ...byFlag]
    const seen = new Set<number>()

    return merged
      .filter((product) => product.isActive !== false)
      .filter((product) => {
        if (seen.has(product.id)) return false
        seen.add(product.id)
        return true
      })
      .slice(0, 6)
  }, [config?.featuredProductIds, publicProducts])

  if (!config?.featuredProductsActive || featuredProducts.length === 0) {
    return null
  }

  const title = config.featuredProductsTitle || "Favoritos de la casa"
  const text =
    config.featuredProductsText ||
    "Una selección rápida para pedir lo más recomendado del menú."
  const productCardStyle = {
    "--product-card-bg": config.productCardBackgroundColor || "#141414",
    "--product-card-text": config.productCardTextColor || "#fafaf9",
    "--product-card-border": config.productCardBorderColor || "#2a2a2a",
    "--product-card-button": config.productCardButtonColor || "#f5a623",
  } as CSSProperties

  return (
    <section
      className="relative overflow-hidden bg-[var(--brand-cream)] px-4 pb-10 pt-16 text-[var(--brand-ink-3)] sm:px-6 sm:pt-20 lg:px-8"
      style={productCardStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_20%_0%,rgba(var(--brand-primary-rgb),0.12),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
              <Sparkles size={16} />
              Recomendados
            </div>

            <h2 className="font-display mt-4 max-w-4xl text-[2.8rem] uppercase leading-[0.9] text-[var(--brand-ink-3)] sm:text-6xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--brand-ink-2)] sm:text-base">
              {text}
            </p>
          </div>

          <a
            href="#menu"
            className="inline-flex w-fit shrink-0 items-center justify-center rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-transparent px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-black active:scale-95"
          >
            Ver menú completo
          </a>
        </div>

        <div className="relative mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {featuredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              {...product}
              exchangeRate={exchangeRate}
              index={index}
              onAddToCart={onAddToCart}
              publicLabels={{
                customizeAction: config.publicCustomizeButtonText || "Elige tus ingredientes",
                customizerTitle:
                  config.publicCustomizerTitle ||
                  config.publicCustomizeButtonText ||
                  "Elige tus ingredientes",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
