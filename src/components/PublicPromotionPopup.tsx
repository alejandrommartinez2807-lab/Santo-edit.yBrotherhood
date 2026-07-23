"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Flame, Sparkles, X } from "lucide-react"
import { formatPublicUSD as formatUSD } from "@/utils/formatCurrency"
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol"

// Promoción del dueño como VENTANA EMERGENTE al entrar al menú público.
// Lote v6.1 (pedidos del dueño 2026-07-23):
// - Sale RÁPIDO (300ms tras cargar la config, sin esperar a "no asaltar").
// - Se ve DISTINTA al resto: franja "PROMOCIÓN" arriba, borde llamativo y
//   animación de entrada.
// - El texto es PROPIO del pop-up (promotionPopupText, editable en
//   Configuración; distinto del texto del producto).
// - "Ver promoción" abre la FICHA del producto en promoción
//   (#producto-<id>, mismo deep-link que compartir por WhatsApp).
// El cierre se recuerda POR CONTENIDO: al cambiar la promoción vuelve a salir.

const DISMISS_KEY = "bh_promo_popup_dismissed"

type PromotionPopupData = {
  title: string
  text: string
  highlight: string
  buttonText: string
  buttonHref: string
  productId: number
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
    promotion.text,
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

        const productId = Math.round(Number(config.promotionProductId || 0))
        const nextPromotion: PromotionPopupData = {
          title: String(config.promotionTitle || "").trim(),
          // Texto propio del pop-up; si el dueño no lo escribió, cae al
          // texto corto de la promoción.
          text:
            String(config.promotionPopupText || "").trim() ||
            String(config.promotionText || "").trim(),
          highlight: String(config.promotionHighlight || "").trim(),
          buttonText: String(config.promotionButtonText || "").trim() || "Ver promoción",
          // Con producto vinculado, el botón abre SU ficha (deep-link
          // #producto-<id>); sin producto, el destino configurado o el menú.
          buttonHref:
            productId > 0
              ? `#producto-${productId}`
              : String(config.promotionButtonHref || "").trim() || "#menu",
          productId,
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
        // Apenas carga la config (el dueño la quiere DE UNA al entrar).
        window.setTimeout(() => {
          if (!cancelled) setIsOpen(true)
        }, 300)
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
      className="fixed inset-0 z-[105] flex items-end justify-center bg-black/80 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      {/* Animación de entrada + doble borde: que se note que ES una promo. */}
      <style>{`@keyframes promoPopIn{0%{opacity:0;transform:translateY(24px) scale(0.92)}60%{transform:translateY(-4px) scale(1.02)}100%{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div
        className="w-full max-w-sm overflow-hidden rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface)] shadow-2xl shadow-black/70 ring-4 ring-[var(--brand-primary)]/30"
        style={{ animation: "promoPopIn 0.4s ease-out both" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Franja superior inconfundible: esto es una PROMOCIÓN. */}
        <div className="flex items-center justify-center gap-2 bg-[var(--brand-primary)] px-4 py-2.5">
          <Flame size={17} className="text-black" />
          <p className="text-[0.78rem] font-black uppercase tracking-[0.3em] text-black">
            Promoción
          </p>
          <Flame size={17} className="text-black" />
        </div>

        <div className="relative">
          {promotion.image ? (
            <Image
              src={promotion.image}
              alt={promotion.productName || promotion.title}
              width={640}
              height={400}
              unoptimized
              className="h-44 w-full object-cover"
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

          {promotion.priceUSD > 0 ? (
            <span className="absolute bottom-3 right-3 rounded-2xl border-2 border-black/20 bg-[var(--brand-primary)] px-3.5 py-1.5 text-xl font-black leading-none text-black shadow-lg">
              {formatUSD(promotion.priceUSD)}
            </span>
          ) : null}
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

          <a
            href={promotion.buttonHref}
            onClick={dismiss}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[var(--brand-accent)] active:scale-[0.98]"
          >
            <Sparkles size={16} />
            {promotion.productId > 0 ? "Ver promoción" : promotion.buttonText}
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
