"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

// Datos compartidos por las vistas previas (Parte D). Solo LECTURA de las
// APIs públicas existentes: no tocan nada del sitio real.

export type PreviewProduct = {
  id: string
  name: string
  category: string
  description: string
  price: number
  image: string
  isFeatured?: boolean
}

export type PreviewData = {
  products: PreviewProduct[]
  categories: string[]
  tagline: string
  loading: boolean
}

const FALLBACK_TAGLINE = "Smash burgers, chicken y más"

export function usePreviewData(): PreviewData {
  const [products, setProducts] = useState<PreviewProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [tagline, setTagline] = useState(FALLBACK_TAGLINE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [productsRes, configRes] = await Promise.all([
          fetch("/api/public/products", { cache: "no-store" }),
          fetch("/api/public/business-config", { cache: "no-store" }),
        ])

        if (cancelled) return

        if (productsRes.ok) {
          const data = await productsRes.json()
          const items = Array.isArray(data?.products) ? data.products : []
          setProducts(
            items
              .filter((item: PreviewProduct) => item && item.name)
              .map((item: PreviewProduct) => ({
                id: String(item.id),
                name: item.name,
                category: item.category || "Menú",
                description: item.description || "",
                price: Number(item.price) || 0,
                image: item.image || "/brotherhood-logo-transparente.png",
                isFeatured: Boolean(item.isFeatured),
              }))
          )
          setCategories(Array.isArray(data?.categories) ? data.categories : [])
        }

        if (configRes.ok) {
          const config = await configRes.json()
          const text =
            typeof config?.publicTagline === "string" && config.publicTagline.trim()
              ? config.publicTagline.trim()
              : typeof config?.config?.publicTagline === "string" && config.config.publicTagline.trim()
                ? config.config.publicTagline.trim()
                : ""
          if (text) setTagline(text)
        }
      } catch {
        // Silencioso a propósito: la previa siempre debe renderizar algo.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return { products, categories, tagline, loading }
}

export function formatUsd(price: number) {
  return `$${price.toFixed(2).replace(/\.00$/, "")}`
}

/** Botón flotante para volver al comparador de previas. */
export function PreviewSwitcher({ current }: { current: string }) {
  return (
    <Link
      href="/previa"
      className="fixed left-3 top-1/2 z-[90] -translate-y-1/2 rounded-full border border-white/15 bg-black/70 px-2 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/70 backdrop-blur-md transition hover:bg-black/90 hover:text-white"
      style={{ writingMode: "vertical-rl" }}
    >
      {current} · Ver todas
    </Link>
  )
}
