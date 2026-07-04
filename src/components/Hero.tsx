"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
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

  const marqueeItems = [
    ...businessConfig.heroBadgeText
      .split("·")
      .map((item) => item.trim())
      .filter(Boolean),
    ...guarantees.map(({ top, bottom }) => `${top} ${bottom}`),
  ]

  const marqueeTrack = Array.from(
    { length: 3 },
    () => marqueeItems
  ).flat()

  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden bg-[var(--brand-cream)]"
    >
      <style>{`
        @keyframes bh-hero-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes bh-hero-glow {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Fondo: resplandor naranja + logo marca de agua */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_50%_-10%,rgba(var(--brand-primary-rgb),0.22),transparent_60%)]"
          style={{ animation: "bh-hero-glow 6s ease-in-out infinite" }}
        />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[rgba(var(--brand-primary-rgb),0.07)] blur-3xl" />
        <Image
          src="/brotherhood-logo-transparente.png"
          alt=""
          width={720}
          height={720}
          unoptimized
          className="absolute -right-24 top-16 w-[22rem] rotate-12 opacity-[0.05] sm:-right-16 sm:w-[34rem]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,var(--brand-cream)_100%)]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-12 pt-10 text-center sm:px-6 sm:pt-16">
        {/* Logo */}
        <div className="relative mb-6">
          <div className="absolute inset-2 -z-10 rounded-full bg-[rgba(var(--brand-primary-rgb),0.25)] blur-2xl" />
          <Image
            src={BRAND.logoUrl || "/logoremovebg.png"}
            alt={businessConfig.businessName}
            width={320}
            height={320}
            unoptimized
            priority
            className="h-32 w-32 rounded-full border border-[var(--brand-border)] object-cover shadow-[0_0_60px_-10px_rgba(var(--brand-primary-rgb),0.55)] sm:h-44 sm:w-44"
          />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)] backdrop-blur sm:text-xs">
          <Flame size={14} />
          {businessConfig.heroBadgeText}
        </div>

        {/* Título */}
        <h1 className="max-w-full font-display text-[clamp(2.6rem,14.5vw,4.5rem)] uppercase leading-[0.85] tracking-tight text-[var(--brand-ink-3)] [text-shadow:0_10px_50px_rgba(var(--brand-primary-rgb),0.35)] sm:text-8xl md:text-[7.5rem]">
          {businessConfig.businessName}
        </h1>

        {/* Subtítulo */}
        <p className="mt-4 font-display text-xl uppercase tracking-[0.06em] text-[var(--brand-primary)] sm:text-3xl">
          {businessConfig.heroSubtitle}
        </p>

        {/* Descripción */}
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--brand-ink-2)] sm:text-base">
          {businessConfig.heroDescription}
        </p>

        {/* CTAs primarias */}
        <div className="mt-9 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="#menu"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-black shadow-[0_14px_38px_-10px_rgba(var(--brand-primary-rgb),0.65)] transition hover:bg-[var(--brand-accent)] active:scale-95"
          >
            <UtensilsCrossed size={18} />
            {businessConfig.publicMenuTitle || "Ver menú"}
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(var(--brand-primary-rgb),0.35)] bg-[var(--brand-surface)] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-[var(--brand-ink-3)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-black/30 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
          >
            <MapPin size={16} />
            {businessConfig.locationButtonText}
          </a>

          <a
            href="#resena"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-black/30 px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
          >
            <Star size={16} />
            {businessConfig.reviewsTitle || "Reseñas"}
          </a>
        </div>

        {/* Garantías */}
        <div className="mt-10 grid w-full max-w-md grid-cols-3 gap-3">
          {guarantees.map(({ icon: Icon, top, bottom }) => (
            <div
              key={top}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2 py-4 transition hover:border-[rgba(var(--brand-primary-rgb),0.5)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary)]">
                <Icon size={20} />
              </span>
              <span className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--brand-ink-3)]">
                {top}
              </span>
              <span className="-mt-1.5 text-[0.6rem] uppercase tracking-wide text-[var(--brand-ink-2)]">
                {bottom}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cinta en movimiento con lo esencial de la marca */}
      <div className="relative overflow-hidden border-y border-[var(--brand-border)] bg-black/60 py-3">
        <div
          className="flex w-max whitespace-nowrap"
          style={{ animation: "bh-hero-marquee 28s linear infinite" }}
        >
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="flex items-center">
              {marqueeTrack.map((item, index) => (
                <span
                  key={`${copy}-${index}`}
                  className="flex items-center gap-6 pr-6 font-display text-sm uppercase tracking-[0.24em] text-[var(--brand-ink-2)]"
                >
                  {item}
                  <Flame size={13} className="text-[var(--brand-primary)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
