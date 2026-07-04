"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Flame,
  MapPin,
  MessageCircle,
  Star,
  UtensilsCrossed,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicBusinessConfig = {
  businessName: string
  businessShortDescription: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  googleMapsUrl: string
  instagramUrl: string
  heroBadgeText: string
  heroSubtitle: string
  heroDescription: string
  locationButtonText: string
  publicMenuTitle: string
  scheduleTitle: string
  scheduleLine1: string
  reviewsTitle: string
}

const DEFAULT_PUBLIC_CONFIG: PublicBusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  mainWhatsapp: BRAND.whatsapp,
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  instagramUrl: `https://www.instagram.com/${BRAND.instagram}/`,
  heroBadgeText: "Smash burgers · Delivery y Pick Up",
  heroSubtitle: BRAND.tagline,
  heroDescription: BRAND.description,
  locationButtonText: "Ubicación",
  publicMenuTitle: "Ver menú",
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible",
  reviewsTitle: "Reseñas",
}

function readText(source: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return fallback
}

function normalizePublicBusinessConfig(value: unknown): PublicBusinessConfig {
  const source = (value || {}) as Record<string, unknown>

  return {
    businessName: readText(
      source,
      ["businessName", "name", "publicBusinessName"],
      DEFAULT_PUBLIC_CONFIG.businessName
    ),
    businessShortDescription: readText(
      source,
      [
        "businessShortDescription",
        "shortDescription",
        "publicShortDescription",
        "logoSubtitle",
        "brandSubtitle",
      ],
      DEFAULT_PUBLIC_CONFIG.businessShortDescription
    ),
    mainWhatsapp: readText(
      source,
      ["mainWhatsapp", "whatsapp", "whatsappPrincipal", "publicWhatsapp"],
      DEFAULT_PUBLIC_CONFIG.mainWhatsapp
    ),
    deliveryWhatsapp: readText(
      source,
      ["deliveryWhatsapp", "whatsappDelivery"],
      ""
    ),
    googleMapsUrl: readText(
      source,
      ["googleMapsUrl", "googleMapsLink", "mapsUrl", "publicGoogleMapsUrl"],
      DEFAULT_PUBLIC_CONFIG.googleMapsUrl
    ),
    instagramUrl: readText(
      source,
      ["instagramUrl", "instagram", "instagramLink", "publicInstagramUrl"],
      DEFAULT_PUBLIC_CONFIG.instagramUrl
    ),
    heroBadgeText: readText(
      source,
      [
        "heroBadgeText",
        "publicHeroBadgeText",
        "publicTagline",
        "businessTagline",
        "brandTagline",
      ],
      DEFAULT_PUBLIC_CONFIG.heroBadgeText
    ),
    heroSubtitle: readText(
      source,
      [
        "heroSubtitle",
        "publicHeroSubtitle",
        "businessHeroSubtitle",
        "publicMainSubtitle",
      ],
      DEFAULT_PUBLIC_CONFIG.heroSubtitle
    ),
    heroDescription: readText(
      source,
      [
        "heroDescription",
        "publicHeroDescription",
        "businessDescription",
        "publicInfoText",
        "publicWelcomeText",
      ],
      DEFAULT_PUBLIC_CONFIG.heroDescription
    ),
    locationButtonText: readText(
      source,
      ["locationButtonText", "publicLocationButtonText", "mapsButtonText"],
      DEFAULT_PUBLIC_CONFIG.locationButtonText
    ),
    publicMenuTitle: readText(
      source,
      ["publicMenuTitle", "menuTitle"],
      DEFAULT_PUBLIC_CONFIG.publicMenuTitle
    ),
    scheduleTitle: readText(
      source,
      ["scheduleTitle", "publicScheduleTitle", "hoursTitle"],
      DEFAULT_PUBLIC_CONFIG.scheduleTitle
    ),
    scheduleLine1: readText(
      source,
      ["scheduleLine1", "publicScheduleLine1", "hoursLine1"],
      DEFAULT_PUBLIC_CONFIG.scheduleLine1
    ),
    reviewsTitle: readText(
      source,
      ["reviewsTitle", "publicReviewsTitle", "reviewTitle"],
      DEFAULT_PUBLIC_CONFIG.reviewsTitle
    ),
  }
}

function normalizeExternalUrl(value: string, fallback = "#") {
  const cleanValue = String(value || "").trim()

  if (!cleanValue) return fallback
  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue
  }

  return fallback
}

function buildWhatsappUrl(value: string) {
  const cleanValue = String(value || "").trim()

  if (!cleanValue) return "#"

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue
  }

  const digits = cleanValue.replace(/\D/g, "")

  if (!digits) return "#"

  return `https://wa.me/${digits}`
}

async function getPublicBusinessConfig() {
  const response = await fetch("/api/public/business-config", {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo cargar la información pública del negocio")
  }

  const data = await response.json()

  return normalizePublicBusinessConfig(
    data.businessConfig || data.config || data.publicConfig || data
  )
}

export default function Hero() {
  const [businessConfig, setBusinessConfig] = useState<PublicBusinessConfig>(
    DEFAULT_PUBLIC_CONFIG
  )

  useEffect(() => {
    let isMounted = true

    getPublicBusinessConfig()
      .then((config) => {
        if (isMounted) {
          setBusinessConfig(config)
        }
      })
      .catch(() => {
        if (isMounted) {
          setBusinessConfig(DEFAULT_PUBLIC_CONFIG)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const whatsappUrl = useMemo(() => {
    return buildWhatsappUrl(
      businessConfig.mainWhatsapp || businessConfig.deliveryWhatsapp
    )
  }, [businessConfig.mainWhatsapp, businessConfig.deliveryWhatsapp])

  const googleMapsUrl = useMemo(() => {
    return normalizeExternalUrl(
      businessConfig.googleMapsUrl,
      DEFAULT_PUBLIC_CONFIG.googleMapsUrl
    )
  }, [businessConfig.googleMapsUrl])

  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[var(--brand-cream)] px-4 pb-16 pt-10 sm:pt-16 md:py-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(180,0,0,0.08),transparent_34%),radial-gradient(circle_at_15%_75%,rgba(var(--brand-primary-rgb),0.06),transparent_34%)]" />

      <div className="absolute left-0 top-0 h-full w-4 bg-[var(--brand-primary)]" />
      <div className="absolute right-0 top-0 h-full w-4 bg-[var(--brand-primary)]" />

      <div className="absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-[1fr_0.9fr]">
        <div className="text-center md:text-left">
          <Image
            src={BRAND.logoUrl || "/logoremovebg.png"}
            alt={businessConfig.businessName}
            width={384}
            height={384}
            unoptimized
            className="mx-auto mb-7 h-72 w-72 object-contain drop-shadow-[0_14px_24px_rgba(var(--brand-primary-rgb),0.18)] sm:h-96 sm:w-96 md:hidden"
          />

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--brand-primary)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.12)] sm:text-sm">
            <Flame size={16} />
            {businessConfig.heroBadgeText}
          </div>

          <h1 className="mx-auto max-w-4xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-[var(--brand-primary)] drop-shadow-[0_5px_0_rgba(var(--brand-accent-rgb),0.8)] sm:text-7xl md:mx-0 md:text-8xl lg:text-9xl">
            {businessConfig.businessName}
          </h1>

          <p className="mt-5 text-2xl font-black uppercase tracking-[0.22em] text-[var(--brand-ink-3)] sm:text-3xl">
            {businessConfig.heroSubtitle}
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base font-bold leading-relaxed text-[var(--brand-ink-2)] sm:text-lg md:mx-0 md:text-xl">
            {businessConfig.heroDescription}
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 md:max-w-2xl">
            <a
              href="#menu"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_8px_0_rgba(90,0,0,0.22)] transition hover:scale-105"
            >
              <UtensilsCrossed size={19} />
              {businessConfig.publicMenuTitle || "Ver menú"}
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[var(--brand-ink)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:scale-105"
            >
              <MessageCircle size={19} />
              Pedir ahora
            </a>
          </div>


          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:max-w-2xl">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[var(--brand-primary)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] transition hover:scale-105 hover:bg-[var(--brand-accent-100)]"
            >
              <MapPin size={19} />
              {businessConfig.locationButtonText}
            </a>

            <a
              href="#resena"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[var(--brand-primary)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] transition hover:scale-105 hover:bg-[var(--brand-accent-100)]"
            >
              <Star size={19} />
              {businessConfig.reviewsTitle || "Reseñas"}
            </a>
          </div>
        </div>

        <div className="relative mx-auto hidden max-w-md items-center justify-center md:flex">
          <div className="absolute h-[28rem] w-[28rem] rounded-full bg-white/85 blur-3xl" />
          <div className="absolute h-[24rem] w-[24rem] rounded-full border-[18px] border-[var(--brand-primary)]/10" />

          <div className="relative rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-8 shadow-[0_18px_0_rgba(var(--brand-primary-rgb),0.14)]">
            <Image
              src={BRAND.logoUrl || "/logoremovebg.png"}
              alt={businessConfig.businessName}
              width={512}
              height={512}
              unoptimized
              className="relative w-full max-w-md object-contain drop-shadow-[0_16px_18px_rgba(var(--brand-primary-rgb),0.16)] lg:max-w-lg"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
