"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { MapPin, MessageCircle, Search, ShoppingCart } from "lucide-react"
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
  // Al bajar, la barra completa (logo + redes) se recoge y queda una barra
  // compacta con las categorías del menú + sede + carrito; al subir vuelve
  // la completa (pedido del dueño 2026-07-21).
  const [compact, setCompact] = useState(false)
  const [menuCategories, setMenuCategories] = useState<string[]>([])

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    function handleScroll() {
      if (ticking) return
      ticking = true

      window.requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY

        if (y < 120) {
          setCompact(false)
        } else if (delta > 6) {
          setCompact(true)
        } else if (delta < -6) {
          setCompact(false)
        }

        lastY = y
        ticking = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    // Products publica sus categorías visibles (cambian por sede y por config
    // del dueño); la barra compacta las usa como accesos directos.
    function handleCategories(event: Event) {
      const detail = (event as CustomEvent<{ categories?: unknown }>).detail
      const categories = Array.isArray(detail?.categories)
        ? detail.categories.filter(
            (category): category is string =>
              typeof category === "string" && category.trim() !== ""
          )
        : []

      setMenuCategories(categories)
    }

    window.addEventListener("santo:menu-categories", handleCategories)
    return () =>
      window.removeEventListener("santo:menu-categories", handleCategories)
  }, [])

  // Botones FIJOS de la barra compacta (pedido del cliente 2026-07-21):
  // Promos / Antojos / Hamburguesas / Menú Kids / Bebidas. Cada botón agrupa
  // las categorías reales del menú que le corresponden; solo se muestra si
  // la sede tiene al menos una de esas categorías.
  const categoryGroups = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()

    const groupDefs: { label: string; keywords: string[] }[] = [
      { label: "Promos", keywords: ["promo", "favorita", "epa bro"] },
      { label: "Antojos", keywords: ["antojo"] },
      {
        label: "Hamburguesas",
        keywords: ["hamburgues", "burger", "smash", "biggie", "veggie", "basic"],
      },
      { label: "Menú Kids", keywords: ["kid"] },
      { label: "Bebidas", keywords: ["refresco", "bebida", "te frio", "jugo"] },
    ]

    return groupDefs
      .map((group) => ({
        label: group.label,
        categories: menuCategories.filter((category) =>
          group.keywords.some((keyword) => normalize(category).includes(keyword))
        ),
      }))
      .filter((group) => group.categories.length > 0)
  }, [menuCategories])

  function goToCategoryGroup(categories: string[]) {
    window.dispatchEvent(
      new CustomEvent("santo:menu-filter", { detail: { categories } })
    )
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })
  }

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
      {/* Barra completa (logo + redes): se recoge al bajar y vuelve al subir. */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          compact ? "max-h-0 opacity-0" : "max-h-52 opacity-100"
        }`}
      >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Logotipo vectorizado: el guion ya dice el nombre, sin texto duplicado. */}
        <a href="#inicio" className="group flex min-w-0 items-center">
          <Image
            src={BRAND.wordmarkDarkBgUrl}
            alt={businessName}
            width={320}
            height={103}
            unoptimized
            priority
            className="h-9 w-auto max-w-[44vw] object-contain transition group-hover:opacity-90 sm:h-11"
          />
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

          {/* Lupa junto al carrito: baja al buscador del menú y lo enfoca
              para encontrar un producto sin recorrer toda la página. */}
          <button
            type="button"
            onClick={() => {
              const searchInput = document.getElementById("public-menu-search")
              if (!(searchInput instanceof HTMLInputElement)) return

              const targetTop = Math.max(
                0,
                window.scrollY +
                  searchInput.getBoundingClientRect().top -
                  window.innerHeight / 2,
              )
              window.scrollTo({ top: targetTop, behavior: "smooth" })

              // Algunos navegadores dentro de apps ignoran el scroll suave:
              // si no se movió, se salta directo y luego se enfoca.
              window.setTimeout(() => {
                if (Math.abs(window.scrollY - targetTop) > 200) {
                  window.scrollTo({
                    top: targetTop,
                    behavior: "instant" as ScrollBehavior,
                  })
                }
                searchInput.focus({ preventScroll: true })
              }, 500)
            }}
            aria-label="Buscar en el menú"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <Search size={20} strokeWidth={2.4} />
          </button>

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

      {/* Nav (móvil / tablet): los botones nunca se encogen por debajo de su
          texto (antes las palabras largas quedaban apretadas y las cortas
          estiradas). Si no caben todos, la fila se desliza a los lados. */}
      <div className="mx-auto max-w-7xl space-y-2 px-3 pb-3 sm:px-6 lg:hidden">
        <nav className="overflow-x-auto rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max min-w-full items-center justify-center gap-1">
          {navItems.map((item) => {
            const linkClass =
              "flex flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2 py-2 text-center text-[0.55rem] font-bold uppercase tracking-[0.06em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-primary)] hover:text-black sm:px-3 sm:text-xs"

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
          </div>
        </nav>
      </div>
      </div>

      {/* Barra compacta al bajar: categorías del menú + sede + carrito. */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          compact ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:px-6 lg:px-8">
          <nav
            aria-label="Categorías del menú"
            className="flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max items-center gap-1.5">
              {categoryGroups.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => goToCategoryGroup(group.categories)}
                  className="shrink-0 whitespace-nowrap rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3.5 py-2 text-[0.65rem] font-black uppercase tracking-[0.06em] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] sm:text-xs"
                >
                  {group.label}
                </button>
              ))}
            </div>
          </nav>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Abrir carrito"
            className="relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3.5 text-black transition hover:bg-[var(--brand-accent)] active:scale-95"
          >
            <ShoppingCart size={18} strokeWidth={2.4} />
            {totalItems > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[0.65rem] font-black text-[var(--brand-primary)]">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
