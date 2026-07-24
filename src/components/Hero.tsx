"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  Beef,
  Flame,
  MapPin,
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
  // Link directo a las reseñas de Google (Configuración → googleReviewUrl):
  // con él, el botón "Reseñas" abre Google Maps; sin él, baja a la sección.
  googleReviewUrl: string
}

const DEFAULT_PUBLIC_CONFIG: PublicBusinessConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  mainWhatsapp: BRAND.whatsapp,
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  instagramUrl: `https://www.instagram.com/${BRAND.instagram}/`,
  heroBadgeText: "Smash burgers · Delivery y Pick Up",
  heroSubtitle: "Porque nos gustan las buenas burgers",
  heroDescription: BRAND.description,
  locationButtonText: "Ubicación",
  publicMenuTitle: "Ver menú",
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible",
  reviewsTitle: "Reseñas",
  googleReviewUrl: "",
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
    googleReviewUrl: (() => {
      const url = readText(source, ["googleReviewUrl"], "")
      return url.startsWith("https://") || url.startsWith("http://") ? url : ""
    })(),
  }
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

type BranchReviewLink = { name: string; url: string }

export default function Hero() {
  const [businessConfig, setBusinessConfig] = useState<PublicBusinessConfig>(
    DEFAULT_PUBLIC_CONFIG
  )
  // Links de reseñas POR SEDE (Sucursales → "Link de reseñas de Google"):
  // con 2+ sedes con link, el botón "Reseñas" abre un selector.
  const [branchReviews, setBranchReviews] = useState<BranchReviewLink[]>([])
  const [isReviewChooserOpen, setIsReviewChooserOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    fetch("/api/public/branches", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted) return
        const list = Array.isArray(data?.branches) ? data.branches : []
        setBranchReviews(
          list
            .map((branch: Record<string, unknown>) => ({
              name: String(branch.name || "").trim(),
              // Preferencia: link de reseñas propio; sin él, la ficha de Maps
              // de la sede (ahí también viven las reseñas). Así el botón
              // NUNCA desaparece aunque falte configurar (dueño 2026-07-24).
              url:
                String(branch.googleReviewUrl || "").trim() ||
                String(branch.googleMapsUrl || "").trim(),
            }))
            .filter(
              (item: BranchReviewLink) =>
                item.name &&
                (item.url.startsWith("https://") || item.url.startsWith("http://")),
            ),
        )
      })
      .catch(() => {
        // Sin sedes cargadas, el botón usa el link general (o se oculta).
      })

    return () => {
      isMounted = false
    }
  }, [])

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

  const guarantees = [
    { icon: Beef, top: "Carne", bottom: "100% res" },
    { icon: Flame, top: "Queso", bottom: "americano" },
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
          src={BRAND.symbolDarkBgUrl}
          alt=""
          width={900}
          height={675}
          unoptimized
          className="absolute -right-24 top-16 w-[22rem] rotate-12 opacity-[0.05] sm:-right-16 sm:w-[34rem]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,var(--brand-cream)_100%)]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-12 pt-10 text-center sm:px-6 sm:pt-16">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)] backdrop-blur sm:text-xs">
          <Flame size={14} />
          {businessConfig.heroBadgeText}
        </div>

        {/* Título: el logotipo vectorizado ES el nombre; el h1 queda para
            lectores de pantalla y buscadores sin repetir el texto en la vista. */}
        <h1 className="sr-only">{businessConfig.businessName}</h1>
        <div className="relative w-full max-w-[34rem]">
          <div className="absolute inset-x-8 inset-y-4 -z-10 rounded-full bg-[rgba(var(--brand-primary-rgb),0.22)] blur-3xl" />
          <Image
            src={BRAND.wordmarkDarkBgUrl}
            alt={businessConfig.businessName}
            width={1600}
            height={513}
            unoptimized
            priority
            className="h-auto w-full object-contain drop-shadow-[0_18px_60px_rgba(var(--brand-primary-rgb),0.35)]"
          />
        </div>

        {/* Subtítulo */}
        <p className="mt-4 font-display text-xl uppercase tracking-[0.06em] text-[var(--brand-primary)] sm:text-3xl">
          {businessConfig.heroSubtitle}
        </p>

        {/* Descripción */}
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--brand-ink-2)] sm:text-base">
          {businessConfig.heroDescription}
        </p>

        {/* CTA primaria: un solo botón al menú. El "Pedir ahora" por WhatsApp
            se quitó (2026-07-12): el cliente casi siempre LLEGA desde
            WhatsApp, así que mandarlo de vuelta no tenía sentido. */}
        <div className="mt-9 w-full max-w-md">
          <a
            href="#menu"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-black shadow-[0_14px_38px_-10px_rgba(var(--brand-primary-rgb),0.65)] transition hover:bg-[var(--brand-accent)] active:scale-95"
          >
            <UtensilsCrossed size={18} />
            Descubre el menú
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </a>
        </div>

        {/* CTAs secundarias: más grandes desde que se retiraron las tarjetas
            de garantías (el espacio libre las hacía ver chiquitas). */}
        <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3">
          {/* Baja a "Nuestros locales" (mapas interactivos por sede) en vez
              de abrir un solo link externo que además podía venir vacío. */}
          <a
            href="#ubicaciones"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-black/30 px-4 py-4 text-sm font-extrabold uppercase tracking-wide text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
          >
            <MapPin size={19} />
            {businessConfig.locationButtonText}
          </a>

          {/* Reseñas REALES de Google: con 2+ sedes con link abre el selector
              de sede; con 1, va directo; sin sedes usa el link general; y sin
              nada configurado el botón no se muestra (el viejo ancla #resena
              no existía y el botón "no servía" — dueño 2026-07-23). */}
          {(() => {
            const hasChooser = branchReviews.length >= 2;
            // Cadena de respaldos para que el botón SIEMPRE exista: sede
            // única → su link; sin sedes → link general de reseñas → link
            // general de Maps → sección "Nuestros locales".
            const directUrl =
              branchReviews.length === 1
                ? branchReviews[0].url
                : businessConfig.googleReviewUrl ||
                  businessConfig.googleMapsUrl ||
                  "#ubicaciones";
            const isExternal = directUrl.startsWith("http");

            const buttonClass =
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-black/30 px-4 py-4 text-sm font-extrabold uppercase tracking-wide text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95";

            return hasChooser ? (
              <button
                type="button"
                onClick={() => setIsReviewChooserOpen(true)}
                className={buttonClass}
              >
                <Star size={19} />
                {businessConfig.reviewsTitle || "Reseñas"}
              </button>
            ) : (
              <a
                href={directUrl}
                {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
                className={buttonClass}
              >
                <Star size={19} />
                {businessConfig.reviewsTitle || "Reseñas"}
              </a>
            );
          })()}
        </div>

        {/* Selector de sede para dejar la reseña (cada local tiene su ficha
            de Google). */}
        {isReviewChooserOpen ? (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 px-4 py-6 backdrop-blur-sm sm:items-center"
            onClick={() => setIsReviewChooserOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface)] p-6 text-center shadow-2xl shadow-black/70"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)] text-black">
                <Star size={26} fill="currentColor" />
              </span>
              <p className="mt-4 text-xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                ¿A cuál sede le dejas tu reseña?
              </p>
              <div className="mt-4 space-y-2.5">
                {branchReviews.map((branch) => (
                  <a
                    key={branch.name}
                    href={branch.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsReviewChooserOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
                  >
                    <MapPin size={16} />
                    {branch.name}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsReviewChooserOpen(false)}
                className="mt-3 w-full rounded-full px-5 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 transition hover:text-[var(--brand-ink-2)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {/* Las tarjetas de garantías (Carne/Queso/Pan) se retiraron a pedido
            del dueño (2026-07-23): esos textos siguen SOLO en la cinta en
            movimiento de abajo (marqueeItems). */}
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
