"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Sparkles, X } from "lucide-react"
import { formatPublicUSD as formatUSD } from "@/utils/formatCurrency"
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol"

// Promoción del dueño como VENTANA EMERGENTE al entrar al menú público
// (pedido del dueño 2026-07-21). Usa la misma promoción de Configuración
// (producto elegido, textos, imagen); el dueño la activa con
// promotionPopupEnabled. El cierre se recuerda POR CONTENIDO: al cambiar la
// promoción, la ventana vuelve a salir una vez para todos.

const DISMISS_KEY = "bh_promo_popup_dismissed"

type PromotionPopupData = {
  title: string
  text: string
  highlight: string
  buttonText: string
  buttonHref: string
  productName: string
  priceUSD: number
  image: string
}

function popupSignature(promotion: PromotionPopupData) {
  return [
    promotion.title,
    promotion.productName,
    promotion.priceUSD,
    promotion.image,
    promotion.highlight,
  ].join("|")
}

export default function PublicPromotionPopup() {
  usePublicCurrencySymbol()
  const [promotion, setPromotion] = useState<PromotionPopupData | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        const config = data?.businessConfig || data?.config || {}

        if (config.promotionPopupEnabled !== true || config.promotionActive !== true) {
          return
        }

        const nextPromotion: PromotionPopupData = {
          title: String(config.promotionTitle || "").trim(),
          text: String(config.promotionText || "").trim(),
          highlight: String(config.promotionHighlight || "").trim(),
          buttonText: String(config.promotionButtonText || "").trim() || "Lo quiero",
          buttonHref: String(config.promotionButtonHref || "").trim() || "#menu",
          productName: String(config.promotionProductName || "").trim(),
          priceUSD: Number(config.promotionPriceUSD || 0),
          image: String(config.promotionImage || "").trim(),
        }

        if (!nextPromotion.title && !nextPromotion.productName) return

        try {
          if (window.localStorage.getItem(DISMISS_KEY) === popupSignature(nextPromotion)) {
            return
          }
        } catch {
          // Sin localStorage se muestra una vez por visita.
        }

        setPromotion(nextPromotion)
        // Pequeña pausa para que primero cargue la página (no asaltar).
        window.setTimeout(() => {
          if (!cancelled) setIsOpen(true)
        }, 1200)
      })
      .catch(() => {
        // Sin config no hay promoción emergente.
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isOpen || !promotion) return null

  function dismiss() {
    setIsOpen(false)
    try {
      if (promotion) {
        window.localStorage.setItem(DISMISS_KEY, popupSignature(promotion))
      }
    } catch {
      // Sin localStorage solo se repetiría en la próxima visita.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end justify-center bg-black/75 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[1.8rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface)] shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          {promotion.image ? (
            <Image
              src={promotion.image}
              alt={promotion.productName || promotion.title}
              width={640}
              height={400}
              unoptimized
              className="h-48 w-full object-cover"
            />
          ) : (
            <div className="flex h-28 items-center justify-center bg-[rgba(var(--brand-primary-rgb),0.12)]">
              <Sparkles size={40} className="text-[var(--brand-primary)]" />
            </div>
          )}

          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar promoción"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <X size={20} />
          </button>

          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
            <Sparkles size={13} />
            Promoción
          </span>
        </div>

        <div className="p-5 text-center">
          <h3 className="font-display text-3xl uppercase leading-[0.95] text-[var(--brand-primary)]">
            {promotion.title || promotion.productName}
          </h3>

          {promotion.highlight ? (
            <p className="mt-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
              {promotion.highlight}
            </p>
          ) : null}

          {promotion.text ? (
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--brand-ink-2)]">
              {promotion.text}
            </p>
          ) : null}

          {promotion.priceUSD > 0 ? (
            <p className="mt-3 text-3xl font-black leading-none text-[var(--brand-ink-3)]">
              {formatUSD(promotion.priceUSD)}
            </p>
          ) : null}

          <a
            href={promotion.buttonHref}
            onClick={dismiss}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[var(--brand-accent)] active:scale-[0.98]"
          >
            {promotion.buttonText}
          </a>

          <button
            type="button"
            onClick={dismiss}
            className="mt-2 w-full rounded-full px-5 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 transition hover:text-[var(--brand-ink-2)]"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
