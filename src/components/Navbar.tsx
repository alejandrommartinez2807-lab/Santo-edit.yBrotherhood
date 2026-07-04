"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
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

    // Difiere el setState un tick para no hacerlo síncrono dentro del
    // efecto (react-hooks/set-state-in-effect).
    const cacheTimer = setTimeout(() => {
      const cachedConfig = readCachedPublicConfig()

      if (cachedConfig && isMounted) {
        setBusinessConfig(cachedConfig)
      }
    }, 0)

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
      clearTimeout(cacheTimer)
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
    <header className="sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-[rgba(9,9,9,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#inicio" className="group flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-[rgba(var(--brand-primary-rgb),0.35)] opacity-0 blur-md transition group-hover:opacity-100" />
            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={businessName}
              width={58}
              height={58}
              unoptimized
              className="relative h-11 w-11 rounded-full border border-[var(--brand-border)] object-cover sm:h-[52px] sm:w-[52px]"
            />
          </div>

          <div className="min-w-0">
            <p className="font-display truncate text-[1.35rem] uppercase leading-none tracking-wide text-[var(--brand-ink-3)] sm:text-2xl">
              {businessName}
            </p>

            <p className="mt-1 line-clamp-1 text-[0.6rem] font-bold uppercase leading-tight tracking-[0.22em] text-[var(--brand-primary)] sm:text-[0.68rem]">
              {businessShortDescription}
            </p>
          </div>
        </a>

        {/* Nav central (escritorio) */}
        <nav className="hidden items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] p-1.5 lg:flex">
          {navItems.map((item) => {
            const linkClass =
              "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-primary)] hover:text-black"

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

        <div className="flex shrink-0 items-center gap-2">
          {businessConfig.googleMapsUrl ? (
            <a
              href={businessConfig.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={businessConfig.locationButtonText || "Abrir ubicación"}
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:flex"
            >
              <MapPin size={20} strokeWidth={2.2} />
            </a>
          ) : null}

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir WhatsApp"
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:flex"
            >
              <MessageCircle size={20} strokeWidth={2.2} />
            </a>
          ) : null}

          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Abrir carrito"
            className="relative flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 text-black shadow-[0_10px_30px_-10px_rgba(var(--brand-primary-rgb),0.8)] transition hover:bg-[var(--brand-accent)] hover:shadow-[0_10px_34px_-8px_rgba(var(--brand-primary-rgb),0.9)] active:scale-95 sm:px-5"
          >
            <ShoppingCart size={22} strokeWidth={2.4} />
            <span className="hidden text-xs font-black uppercase tracking-[0.12em] sm:inline">
              Carrito
            </span>

            {totalItems > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1.5 text-xs font-black text-[var(--brand-primary)]">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Nav (móvil / tablet) */}
      <div className="mx-auto max-w-7xl px-3 pb-3 sm:px-6 lg:hidden">
        <nav className="flex gap-1.5 overflow-x-auto rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] p-1.5">
          {navItems.map((item) => {
            const linkClass =
              "flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 py-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-primary)] hover:text-black sm:text-xs"

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
