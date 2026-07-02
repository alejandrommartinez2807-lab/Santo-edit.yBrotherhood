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

const DEFAULT_PROMOTION_COLORS = {
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
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
      className="bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
      style={colorStyle}
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-[var(--promo-card-border)] bg-[var(--promo-card-bg)] text-[var(--promo-card-text)] shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:p-10">
          <div className="flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] border-4 border-[var(--promo-card-border)] bg-[var(--promo-card-button)] text-[var(--promo-card-text)] shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.14)]">
                <Sparkles size={38} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--promo-card-border)]">
                  Promoción activa
                </p>
                <h2 className="mt-2 text-4xl font-black uppercase leading-none tracking-[-0.05em] text-[var(--promo-card-border)] drop-shadow-[0_4px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  {title}
                </h2>
                {productName && productName !== title && (
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.14em] opacity-75">
                    Producto: {productName}
                  </p>
                )}
              </div>
            </div>

            {imageUrl && !imageFailed && (
              <div className="overflow-hidden rounded-[1.6rem] border-2 border-[var(--promo-card-border)] bg-[var(--brand-cream)]">
                <Image
                  src={imageUrl}
                  alt={title}
                  width={640}
                  height={360}
                  unoptimized
                  onError={() => setImageFailed(true)}
                  className="h-[240px] w-full object-cover object-center sm:h-[320px] lg:h-[360px]"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-[1.5rem] border-2 border-[var(--promo-card-border)]/30 bg-[var(--brand-cream)] p-5">
            <div>
              <div className="inline-flex rounded-full border-2 border-[var(--promo-card-border)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--promo-card-border)]">
                Oferta destacada
              </div>

              <p className="mt-5 text-2xl font-black leading-8 text-[var(--promo-card-text)]">
                {highlight}
              </p>
              <p className="mt-3 text-sm font-bold leading-7 text-[var(--promo-card-text)]/75">
                {text}
              </p>

              {promotionPriceUSD > 0 && (
                <div className="mt-5 rounded-[1.3rem] border-2 border-[var(--promo-card-border)]/30 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--promo-card-border)]">
                    Precio promocional
                  </p>
                  <p className="mt-1 text-4xl font-black text-[var(--promo-card-border)]">
                    {formatPromoPrice(promotionPriceUSD)}
                  </p>
                </div>
              )}
            </div>

            <a
              href={buttonHref}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full border-2 border-[var(--promo-card-border)] bg-[var(--promo-card-button)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--promo-card-text)] transition hover:brightness-105"
            >
              {buttonText}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
