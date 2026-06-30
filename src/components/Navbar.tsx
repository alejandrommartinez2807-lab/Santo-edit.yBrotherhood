"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, MessageCircle, ShoppingCart } from "lucide-react"
import { BRAND } from "@/lib/brand"
import {
  DEFAULT_PUBLIC_NAV_BUTTONS,
  normalizePublicNavButtons,
  type PublicNavButton,
} from "@/lib/publicPageConfig"

type NavbarProps = {
  totalItems: number
  onOpenCart: () => void
}

type PublicBusinessConfig = {
  businessName: string
  businessShortDescription: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  instagramUrl: string
  googleMapsUrl: string
  locationButtonText: string
  publicNavButtons: PublicNavButton[]
  updatedAt: string
}

type NavItem = {
  label: string
  href: string
  external?: boolean
}

const PUBLIC_CONFIG_ENDPOINT = "/api/public/business-config"
const PUBLIC_CONFIG_CACHE_KEY = "santo_perrito_public_business_config_v2"

const DEFAULT_PUBLIC_CONFIG: PublicBusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  mainWhatsapp: BRAND.whatsapp,
  deliveryWhatsapp: "",
  instagramUrl: BRAND.instagram ? `https://www.instagram.com/${BRAND.instagram}/` : "",
  googleMapsUrl: "",
  locationButtonText: "Ubicación",
  publicNavButtons: DEFAULT_PUBLIC_NAV_BUTTONS,
  updatedAt: "",
}

function safeText(value: unknown, fallback = "") {
  const text = String(value || "").trim()
  return text || fallback
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function buildWhatsAppUrl(phone: string) {
  const normalizedPhone = normalizePhone(phone)

  if (!normalizedPhone) {
    return ""
  }

  return `https://wa.me/${normalizedPhone}`
}

function normalizeExternalUrl(value: unknown) {
  const text = String(value || "").trim()

  if (!text) {
    return ""
  }

  try {
    const url = new URL(text)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return ""
    }

    return url.toString()
  } catch {
    return ""
  }
}

function normalizeInstagramUrl(value: unknown) {
  const text = String(value || "").trim()

  if (!text) {
    return ""
  }

  const directUrl = normalizeExternalUrl(text)

  if (directUrl) {
    return directUrl
  }

  const username = text.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "")

  return username ? `https://www.instagram.com/${username}/` : ""
}

function normalizePublicConfig(value: unknown): PublicBusinessConfig {
  const data =
    value && typeof value === "object" && "businessConfig" in value
      ? (value as { businessConfig?: unknown }).businessConfig
      : value

  const config = data && typeof data === "object" ? (data as Record<string, unknown>) : {}

  return {
    businessName: safeText(config.businessName, DEFAULT_PUBLIC_CONFIG.businessName),
    businessShortDescription: safeText(
      config.businessShortDescription,
      DEFAULT_PUBLIC_CONFIG.businessShortDescription
    ),
    mainWhatsapp: normalizePhone(config.mainWhatsapp) || DEFAULT_PUBLIC_CONFIG.mainWhatsapp,
    deliveryWhatsapp: normalizePhone(config.deliveryWhatsapp),
    instagramUrl: normalizeInstagramUrl(config.instagramUrl || DEFAULT_PUBLIC_CONFIG.instagramUrl),
    googleMapsUrl: normalizeExternalUrl(config.googleMapsUrl),
    locationButtonText: safeText(
      config.locationButtonText,
      DEFAULT_PUBLIC_CONFIG.locationButtonText
    ),
    publicNavButtons: normalizePublicNavButtons(config.publicNavButtons),
    updatedAt: safeText(config.updatedAt),
  }
}

function readCachedPublicConfig() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(PUBLIC_CONFIG_CACHE_KEY)

    if (!rawValue) {
      return null
    }

    return normalizePublicConfig(JSON.parse(rawValue))
  } catch {
    return null
  }
}

function saveCachedPublicConfig(config: PublicBusinessConfig) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(config))
  } catch {
    // No bloquea la navegación si el navegador no permite guardar cache local.
  }
}

export default function Navbar({ totalItems, onOpenCart }: NavbarProps) {
  const [businessConfig, setBusinessConfig] = useState<PublicBusinessConfig>(
    DEFAULT_PUBLIC_CONFIG
  )

  useEffect(() => {
    let isMounted = true

    const cachedConfig = readCachedPublicConfig()

    if (cachedConfig && isMounted) {
      setBusinessConfig(cachedConfig)
    }

    async function loadPublicConfig() {
      try {
        const response = await fetch(PUBLIC_CONFIG_ENDPOINT, {
          cache: "no-store",
        })

        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.ok) {
          return
        }

        const nextConfig = normalizePublicConfig(data)

        if (!isMounted) {
          return
        }

        setBusinessConfig(nextConfig)
        saveCachedPublicConfig(nextConfig)
      } catch {
        // Si la configuración no carga, el menú queda visible con valores base.
      }
    }

    loadPublicConfig()

    return () => {
      isMounted = false
    }
  }, [])

  const businessName = safeText(
    businessConfig.businessName,
    DEFAULT_PUBLIC_CONFIG.businessName
  )
  const businessShortDescription = safeText(
    businessConfig.businessShortDescription,
    DEFAULT_PUBLIC_CONFIG.businessShortDescription
  )

  const whatsappUrl = useMemo(
    () =>
      buildWhatsAppUrl(
        businessConfig.deliveryWhatsapp ||
          businessConfig.mainWhatsapp ||
          DEFAULT_PUBLIC_CONFIG.mainWhatsapp
      ),
    [businessConfig.deliveryWhatsapp, businessConfig.mainWhatsapp]
  )

  const instagramUrl = useMemo(
    () =>
      normalizeInstagramUrl(
        businessConfig.instagramUrl || DEFAULT_PUBLIC_CONFIG.instagramUrl
      ),
    [businessConfig.instagramUrl]
  )

  const navItems = useMemo<NavItem[]>(() => {
    const configuredButtons = normalizePublicNavButtons(
      businessConfig.publicNavButtons
    )
      .filter((item) => item.isVisible !== false)
      .map((item) => {
        if (item.kind === "whatsapp") {
          return {
            label: item.label,
            href: whatsappUrl || "#menu",
            external: Boolean(whatsappUrl),
          }
        }

        if (item.kind === "instagram") {
          return {
            label: item.label,
            href: instagramUrl || "#inicio",
            external: Boolean(instagramUrl),
          }
        }

        if (item.kind === "url") {
          const isExternal =
            item.target.startsWith("http://") || item.target.startsWith("https://")

          return {
            label: item.label,
            href: item.target || "#menu",
            external: isExternal,
          }
        }

        return {
          label: item.label,
          href: item.target || "#menu",
        }
      })

    return configuredButtons.length > 0
      ? configuredButtons
      : DEFAULT_PUBLIC_NAV_BUTTONS.map((item) => ({
          label: item.label,
          href: item.target || "#menu",
        }))
  }, [businessConfig.publicNavButtons, instagramUrl, whatsappUrl])

  return (
    <header className="sticky top-0 z-50 w-full border-b-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] shadow-[0_10px_28px_rgba(80,0,0,0.14)]">
      <div className="h-4 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0] bg-[var(--brand-cream)]" />

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <a href="#inicio" className="flex min-w-0 items-center gap-3">
          <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] shadow-[0_10px_24px_rgba(var(--brand-primary-rgb),0.22)] ring-4 ring-[var(--brand-accent)] sm:h-[70px] sm:w-[70px]">
            <img
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={businessName}
              className="h-[47px] w-[47px] object-contain sm:h-[58px] sm:w-[58px]"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[1.45rem] font-black uppercase leading-none tracking-[-0.04em] text-[var(--brand-primary)] sm:text-4xl">
              {businessName}
            </p>

            <p className="mt-1 line-clamp-1 text-[0.74rem] font-black leading-tight tracking-[0.04em] text-[var(--brand-ink-3)] sm:text-base sm:tracking-[0.08em]">
              {businessShortDescription}
            </p>
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-2">
          {businessConfig.googleMapsUrl ? (
            <a
              href={businessConfig.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={businessConfig.locationButtonText || "Abrir ubicación"}
              className="hidden h-[52px] w-[52px] items-center justify-center rounded-[1.1rem] border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] shadow-[0_10px_24px_rgba(80,0,0,0.12)] transition hover:scale-105 sm:flex"
            >
              <MapPin size={25} strokeWidth={2.4} />
            </a>
          ) : null}

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir WhatsApp"
              className="hidden h-[52px] w-[52px] items-center justify-center rounded-[1.1rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_10px_24px_rgba(80,0,0,0.12)] transition hover:scale-105 sm:flex"
            >
              <MessageCircle size={25} strokeWidth={2.4} />
            </a>
          ) : null}

          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Abrir carrito"
            className="relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[1.1rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)] shadow-[0_10px_24px_rgba(80,0,0,0.18)] transition hover:scale-105 sm:h-16 sm:w-16"
          >
            <ShoppingCart size={28} strokeWidth={2.4} />

            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] px-2 text-xs font-black text-white shadow-md">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 pb-3 sm:px-6 lg:px-8">
        <nav
          className="mx-auto flex max-w-5xl overflow-hidden rounded-[1rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.12)]"
        >
          {navItems.map((item, index) => {
            const linkClass = [
              "flex h-[42px] min-w-0 flex-1 items-center justify-center text-center",
              "border-[var(--brand-primary)]/15 px-1.5 text-[0.56rem] font-black uppercase tracking-[0.07em]",
              "text-[var(--brand-primary)] transition duration-200 hover:bg-[var(--brand-accent)] hover:text-[var(--brand-ink)]",
              "sm:h-[48px] sm:px-2 sm:text-xs sm:tracking-[0.12em] lg:text-sm lg:tracking-[0.16em]",
              index !== navItems.length - 1 ? "border-r" : "",
            ].join(" ")

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {item.label}
                </a>
              )
            }

            return (
              <a key={item.label} href={item.href} className={linkClass}>
                {item.label}
              </a>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
