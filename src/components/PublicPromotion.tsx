"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import Image from "next/image"
import { Sparkles } from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicPromotionConfig = {
  promotionActive?: boolean
  promotionTitle?: string
  promotionText?: string
  promotionHighlight?: string
  promotionButtonText?: string
  promotionButtonHref?: string
  promotionProductId?: number
  promotionProductName?: string
  promotionPriceUSD?: number
  promotionImage?: string
  productCardBackgroundColor?: string
  productCardTextColor?: string
  productCardBorderColor?: string
  productCardButtonColor?: string
}

// Defaults alineados a la paleta champán del hotel; los valores que el admin
// guarde en business_config siguen teniendo prioridad.
const DEFAULT_PROMOTION_COLORS = {
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#171410",
  productCardBorderColor: "#ddd0b6",
  productCardButtonColor: "#b08d4c",
}

function normalizeText(value: unknown) {
  return String(value || "").trim()
}

function normalizeColor(value: unknown, fallback: string) {
  const color = normalizeText(value)

  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function normalizeHref(value: unknown) {
  const cleanValue = normalizeText(value)

  if (!cleanValue) return "#menu"

  if (
    cleanValue.startsWith("#") ||
    cleanValue.startsWith("/") ||
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
    return cleanValue
  }

  return "#menu"
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100
}

function formatPromoPrice(value: number) {
  return `$${value.toFixed(2)}`
}

async function getPublicPromotionConfig() {
  const response = await fetch("/api/public/business-config", {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo cargar la promoción pública")
  }

  const data = await response.json()
  const source = (data.businessConfig ||
    data.config ||
    data.publicConfig ||
    data ||
    {}) as Record<string, unknown>

  return {
    promotionActive: Boolean(source.promotionActive),
    promotionTitle: normalizeText(source.promotionTitle),
    promotionText: normalizeText(source.promotionText),
    promotionHighlight: normalizeText(source.promotionHighlight),
    promotionButtonText: normalizeText(source.promotionButtonText),
    promotionButtonHref: normalizeHref(source.promotionButtonHref),
    promotionProductId: Math.round(normalizeNumber(source.promotionProductId)),
    promotionProductName: normalizeText(source.promotionProductName),
    promotionPriceUSD: normalizeNumber(source.promotionPriceUSD),
    promotionImage: normalizeText(source.promotionImage),
    productCardBackgroundColor: normalizeColor(
      source.productCardBackgroundColor,
      DEFAULT_PROMOTION_COLORS.productCardBackgroundColor
    ),
    productCardTextColor: normalizeColor(
      source.productCardTextColor,
      DEFAULT_PROMOTION_COLORS.productCardTextColor
    ),
    productCardBorderColor: normalizeColor(
      source.productCardBorderColor,
      DEFAULT_PROMOTION_COLORS.productCardBorderColor
    ),
    productCardButtonColor: normalizeColor(
      source.productCardButtonColor,
      DEFAULT_PROMOTION_COLORS.productCardButtonColor
    ),
  } satisfies PublicPromotionConfig
}

export default function PublicPromotion() {
  const [promotionConfig, setPromotionConfig] =
    useState<PublicPromotionConfig | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    getPublicPromotionConfig()
      .then((config) => {
        if (isMounted) setPromotionConfig(config)
      })
      .catch(() => {
        if (isMounted) setPromotionConfig(null)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    // Difiere el reset un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(() => setImageFailed(false), 0)
    return () => clearTimeout(timer)
  }, [promotionConfig?.promotionImage])

  const canShowPromotion = useMemo(() => {
    if (!promotionConfig?.promotionActive) return false

    return Boolean(
      promotionConfig.promotionTitle ||
        promotionConfig.promotionText ||
        promotionConfig.promotionHighlight ||
        promotionConfig.promotionProductName ||
        promotionConfig.promotionImage ||
        (promotionConfig.promotionPriceUSD || 0) > 0
    )
  }, [promotionConfig])

  if (!canShowPromotion || !promotionConfig) {
    return null
  }

  const title =
    promotionConfig.promotionTitle ||
    promotionConfig.promotionProductName ||
    "Promoción especial"
  const productName = promotionConfig.promotionProductName || ""
  const text =
    promotionConfig.promotionText ||
    `Aprovecha una oferta preparada para disfrutar en ${BRAND.name}.`
  const highlight =
    promotionConfig.promotionHighlight || "Disponible por tiempo limitado."
  const buttonText = promotionConfig.promotionButtonText || "Ver menú"
  const buttonHref = promotionConfig.promotionButtonHref || "#menu"
  const imageUrl = promotionConfig.promotionImage || ""
  const promotionPriceUSD = promotionConfig.promotionPriceUSD || 0
  const colorStyle = {
    "--promo-card-bg":
      promotionConfig.productCardBackgroundColor ||
      DEFAULT_PROMOTION_COLORS.productCardBackgroundColor,
    "--promo-card-text":
      promotionConfig.productCardTextColor ||
      DEFAULT_PROMOTION_COLORS.productCardTextColor,
    "--promo-card-border":
      promotionConfig.productCardBorderColor ||
      DEFAULT_PROMOTION_COLORS.productCardBorderColor,
    "--promo-card-button":
      promotionConfig.productCardButtonColor ||
      DEFAULT_PROMOTION_COLORS.productCardButtonColor,
  } as CSSProperties

  return (
    <section
      className="bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
      style={colorStyle}
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[1.8rem] border border-[rgba(var(--brand-primary-rgb),0.45)] bg-[var(--promo-card-bg)] text-[var(--promo-card-text)]">
        {/* Resplandor y marca de agua */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(var(--brand-primary-rgb),0.18),transparent_55%)]"
        />
        <Image
          src="/brotherhood-logo-transparente.png"
          alt=""
          width={480}
          height={480}
          unoptimized
          className="pointer-events-none absolute -bottom-16 -left-16 w-64 -rotate-12 opacity-[0.05]"
        />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--promo-card-button)] px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-black">
              <Sparkles size={15} />
              Promoción activa
            </div>

            <h2 className="font-display mt-5 text-[2.8rem] uppercase leading-[0.9] text-[var(--brand-primary)] [text-shadow:0_8px_40px_rgba(var(--brand-primary-rgb),0.35)] sm:text-6xl">
              {title}
            </h2>

            {productName && productName !== title && (
              <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] opacity-70">
                Producto: {productName}
              </p>
            )}

            <p className="mt-5 max-w-xl text-xl font-black leading-7 sm:text-2xl">
              {highlight}
            </p>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 opacity-70">
              {text}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              {promotionPriceUSD > 0 && (
                <div className="rounded-2xl border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/40 px-5 py-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] opacity-70">
                    Precio promo
                  </p>
                  <p className="text-3xl font-black leading-none text-[var(--promo-card-button)]">
                    {formatPromoPrice(promotionPriceUSD)}
                  </p>
                </div>
              )}

              <a
                href={buttonHref}
                className="inline-flex items-center justify-center rounded-full bg-[var(--promo-card-button)] px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_14px_36px_-12px_rgba(var(--brand-primary-rgb),0.8)] transition hover:brightness-110 active:scale-95"
              >
                {buttonText}
              </a>
            </div>
          </div>

          {imageUrl && !imageFailed && (
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[2rem] bg-[rgba(var(--brand-primary-rgb),0.16)] blur-2xl"
              />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black">
                <Image
                  src={imageUrl}
                  alt={title}
                  width={640}
                  height={360}
                  unoptimized
                  onError={() => setImageFailed(true)}
                  className="h-[240px] w-full object-cover object-center sm:h-[320px] lg:h-[380px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
