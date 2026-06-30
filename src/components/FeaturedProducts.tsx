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
              businessConfig.productCardBackgroundColor || "#ffffff"
            ).trim(),
            productCardTextColor: String(
              businessConfig.productCardTextColor || "#4a0000"
            ).trim(),
            productCardBorderColor: String(
              businessConfig.productCardBorderColor || "#a00000"
            ).trim(),
            productCardButtonColor: String(
              businessConfig.productCardButtonColor || "#ffd23c"
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
    "--product-card-bg": config.productCardBackgroundColor || "#ffffff",
    "--product-card-text": config.productCardTextColor || "#4a0000",
    "--product-card-border": config.productCardBorderColor || "#a00000",
    "--product-card-button": config.productCardButtonColor || "#ffd23c",
  } as CSSProperties

  return (
    <section
      className="bg-[var(--brand-cream)] px-4 pt-20 pb-8 text-[var(--brand-ink-3)] sm:px-6 sm:pt-24 lg:px-8"
      style={productCardStyle}
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_14px_0_rgba(var(--brand-primary-rgb),0.12)]">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(var(--brand-accent-rgb),0.28),transparent_34%),linear-gradient(180deg,#fffdf5_0%,var(--brand-cream)_100%)] p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[var(--brand-accent)]/40 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]">
                <Sparkles size={16} />
                Recomendados
              </div>

              <h2 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl lg:text-6xl">
                {title}
              </h2>

              <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75 sm:text-base">
                {text}
              </p>
            </div>

            <a
              href="#menu"
              className="inline-flex w-fit items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:bg-[var(--brand-accent)] hover:text-[var(--brand-ink)]"
            >
              Ver menú completo
            </a>
          </div>

          <div className="relative mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>
    </section>
  )
}
