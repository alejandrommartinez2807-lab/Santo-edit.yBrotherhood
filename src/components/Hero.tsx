"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Beef,
  Flame,
  MapPin,
  MessageCircle,
  Sandwich,
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

  const guarantees = [
    { icon: Beef, top: "Carne", bottom: "100% res" },
    { icon: Flame, top: "Queso", bottom: "fundido" },
    { icon: Sandwich, top: "Pan", bottom: "brioche" },
  ]

  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[var(--brand-cream)] px-5 pb-14 pt-10 sm:px-6 sm:pt-16"
    >
      {/* Resplandor de marca */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--brand-primary-rgb),0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[rgba(var(--brand-primary-rgb),0.12)] blur-3xl" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        {/* Logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -z-10 rounded-full bg-[rgba(var(--brand-primary-rgb),0.18)] blur-2xl" />
          <Image
            src={BRAND.logoUrl || "/logoremovebg.png"}
            alt={businessConfig.businessName}
            width={320}
            height={320}
            unoptimized
            priority
            className="h-36 w-36 rounded-3xl object-contain sm:h-52 sm:w-52"
          />
        </div>

        {/* Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.4)] bg-[var(--brand-surface)] px-4 py-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)] sm:text-xs">
          <Flame size={14} />
          {businessConfig.heroBadgeText}
        </div>

        {/* Título */}
        <h1 className="font-display text-[3.25rem] leading-[0.86] text-[var(--brand-ink-3)] sm:text-7xl md:text-8xl">
          {businessConfig.businessName}
        </h1>

        {/* Subtítulo */}
        <p className="mt-4 font-display text-lg tracking-wide text-[var(--brand-primary)] sm:text-2xl">
          {businessConfig.heroSubtitle}
        </p>

        {/* Descripción */}
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--brand-ink-2)] sm:text-base">
          {businessConfig.heroDescription}
        </p>

        {/* CTAs primarias */}
        <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="#menu"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-black shadow-[0_10px_30px_-8px_rgba(var(--brand-primary-rgb),0.6)] transition active:scale-95"
          >
            <UtensilsCrossed size={18} />
            {businessConfig.publicMenuTitle || "Ver menú"}
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-[var(--brand-ink-3)] transition active:scale-95"
          >
            <MessageCircle size={18} />
            Pedir ahora
          </a>
        </div>

        {/* CTAs secundarias */}
        <div className="mt-3 grid w-full max-w-md grid-cols-2 gap-3">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink)] transition active:scale-95"
          >
            <MapPin size={16} />
            {businessConfig.locationButtonText}
          </a>

          <a
            href="#resena"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink)] transition active:scale-95"
          >
            <Star size={16} />
            {businessConfig.reviewsTitle || "Reseñas"}
          </a>
        </div>

        {/* Garantías */}
        <div className="mt-9 grid w-full max-w-md grid-cols-3 gap-2 border-t border-[var(--brand-border)] pt-6">
          {guarantees.map(({ icon: Icon, top, bottom }) => (
            <div key={top} className="flex flex-col items-center gap-1">
              <Icon size={20} className="text-[var(--brand-primary)]" />
              <span className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--brand-ink-3)]">
                {top}
              </span>
              <span className="text-[0.6rem] uppercase tracking-wide text-[var(--brand-ink-2)]">
                {bottom}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
