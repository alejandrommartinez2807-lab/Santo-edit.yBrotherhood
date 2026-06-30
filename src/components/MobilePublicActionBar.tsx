"use client"

import { useEffect, useMemo, useState } from "react"
import { Home, MapPin, Menu, MessageCircle, ShoppingCart } from "lucide-react"

type MobilePublicActionBarProps = {
  totalItems: number
  onOpenCart: () => void
}

type PublicMobileConfig = {
  mainWhatsapp: string
  deliveryWhatsapp: string
  googleMapsUrl: string
  locationButtonText: string
}

const DEFAULT_PUBLIC_MOBILE_CONFIG: PublicMobileConfig = {
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  locationButtonText: "Ubicación",
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function normalizeExternalUrl(value: unknown) {
  const text = String(value || "").trim()

  if (!text) return ""

  try {
    const url = new URL(text)

    if (url.protocol !== "http:" && url.protocol !== "https:") return ""

    return url.toString()
  } catch {
    return ""
  }
}

function buildWhatsAppUrl(value: unknown) {
  const phone = normalizePhone(value)

  return phone ? `https://wa.me/${phone}` : ""
}

function getPublicMobileConfigPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>
  const businessConfig = source.businessConfig

  if (businessConfig && typeof businessConfig === "object") {
    return businessConfig as Record<string, unknown>
  }

  return source
}

function normalizePublicMobileConfig(value: unknown): PublicMobileConfig {
  const source = getPublicMobileConfigPayload(value)

  return {
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    locationButtonText: String(source.locationButtonText || "Ubicación").trim() || "Ubicación",
  }
}

export default function MobilePublicActionBar({
  totalItems,
  onOpenCart,
}: MobilePublicActionBarProps) {
  const [config, setConfig] = useState<PublicMobileConfig>(
    DEFAULT_PUBLIC_MOBILE_CONFIG
  )

  useEffect(() => {
    let isMounted = true

    async function loadPublicConfig() {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        })

        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.ok || !isMounted) return

        setConfig(normalizePublicMobileConfig(data))
      } catch {
        if (isMounted) setConfig(DEFAULT_PUBLIC_MOBILE_CONFIG)
      }
    }

    loadPublicConfig()

    return () => {
      isMounted = false
    }
  }, [])

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(config.deliveryWhatsapp || config.mainWhatsapp),
    [config.deliveryWhatsapp, config.mainWhatsapp]
  )

  const actionClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.58rem] font-black uppercase tracking-[0.06em] text-[var(--brand-primary)] transition active:scale-[0.98]"
  const primaryActionClass =
    "border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.14)]"

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2 shadow-[0_-12px_30px_rgba(var(--brand-primary-rgb),0.16)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-[1.35rem] border-2 border-[var(--brand-primary)]/15 bg-white/90 p-1.5">
        <a href="#inicio" className={actionClass}>
          <Home size={18} />
          Inicio
        </a>

        <a href="#menu" className={`${actionClass} ${primaryActionClass}`}>
          <Menu size={18} />
          Menú
        </a>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className={actionClass}
          >
            <MessageCircle size={18} />
            Pedir
          </a>
        ) : config.googleMapsUrl ? (
          <a
            href={config.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className={actionClass}
          >
            <MapPin size={18} />
            {config.locationButtonText.slice(0, 10)}
          </a>
        ) : (
          <a href="#como-pedir" className={actionClass}>
            <MessageCircle size={18} />
            Cómo pedir
          </a>
        )}

        <button
          type="button"
          onClick={onOpenCart}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-2 py-2 text-[0.58rem] font-black uppercase tracking-[0.06em] text-white shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.16)] transition active:scale-[0.98]"
        >
          <ShoppingCart size={18} />
          {totalItems > 0 ? `${totalItems} item${totalItems === 1 ? "" : "s"}` : "Carrito"}
          {totalItems > 0 ? (
            <span className="absolute -right-1 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--brand-accent)] px-1 text-[0.65rem] font-black text-[var(--brand-ink)]">
              {totalItems}
            </span>
          ) : null}
        </button>
      </div>
    </nav>
  )
}
