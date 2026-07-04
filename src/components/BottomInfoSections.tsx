"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { AtSign, Bike, Clock, MapPin, MessageCircle } from "lucide-react"

type PublicBusinessConfig = {
  businessName: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  googleMapsUrl: string
  instagramUrl: string
  publicSectionTitle: string
  publicWelcomeTitle: string
  publicWelcomeText: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  locationButtonText: string
  whatsappButtonText: string
  instagramButtonText: string
}

const DEFAULT_PUBLIC_CONFIG: PublicBusinessConfig = {
  businessName: BRAND.name,
  mainWhatsapp: BRAND.whatsapp,
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  instagramUrl: `https://www.instagram.com/${BRAND.instagram}/`,
  publicSectionTitle: "Contacto",
  publicWelcomeTitle: `Visita ${BRAND.name}`,
  publicWelcomeText: BRAND.description,
  scheduleTitle: "Horario",
  scheduleLine1: "Martes a domingo: 5:00 p.m. a 11:30 p.m.",
  scheduleLine2: "Lunes: cerrado",
  locationButtonText: "Abrir ubicación",
  whatsappButtonText: "WhatsApp",
  instagramButtonText: "Instagram",
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
      DEFAULT_PUBLIC_CONFIG.businessName,
    ),
    mainWhatsapp: readText(
      source,
      ["mainWhatsapp", "whatsapp", "whatsappPrincipal", "publicWhatsapp"],
      DEFAULT_PUBLIC_CONFIG.mainWhatsapp,
    ),
    deliveryWhatsapp: readText(source, ["deliveryWhatsapp", "whatsappDelivery"], ""),
    googleMapsUrl: readText(
      source,
      ["googleMapsUrl", "googleMapsLink", "mapsUrl", "publicGoogleMapsUrl"],
      DEFAULT_PUBLIC_CONFIG.googleMapsUrl,
    ),
    instagramUrl: readText(
      source,
      ["instagramUrl", "instagram", "instagramLink", "publicInstagramUrl"],
      DEFAULT_PUBLIC_CONFIG.instagramUrl,
    ),
    publicSectionTitle: readText(
      source,
      ["publicSectionTitle", "bottomSectionTitle", "locationSectionTitle"],
      DEFAULT_PUBLIC_CONFIG.publicSectionTitle,
    ),
    publicWelcomeTitle: readText(
      source,
      ["publicWelcomeTitle", "publicInfoTitle", "welcomeTitle", "bottomWelcomeTitle"],
      DEFAULT_PUBLIC_CONFIG.publicWelcomeTitle,
    ),
    publicWelcomeText: readText(
      source,
      ["publicWelcomeText", "publicInfoText", "welcomeText", "bottomWelcomeText"],
      DEFAULT_PUBLIC_CONFIG.publicWelcomeText,
    ),
    scheduleTitle: readText(
      source,
      ["scheduleTitle", "publicScheduleTitle", "hoursTitle"],
      DEFAULT_PUBLIC_CONFIG.scheduleTitle,
    ),
    scheduleLine1: readText(
      source,
      ["scheduleLine1", "publicScheduleLine1", "hoursLine1"],
      DEFAULT_PUBLIC_CONFIG.scheduleLine1,
    ),
    scheduleLine2: readText(
      source,
      ["scheduleLine2", "publicScheduleLine2", "hoursLine2"],
      DEFAULT_PUBLIC_CONFIG.scheduleLine2,
    ),
    locationButtonText: readText(
      source,
      ["locationButtonText", "publicLocationButtonText", "mapsButtonText"],
      DEFAULT_PUBLIC_CONFIG.locationButtonText,
    ),
    whatsappButtonText: readText(
      source,
      ["whatsappButtonText", "publicWhatsappButtonText"],
      DEFAULT_PUBLIC_CONFIG.whatsappButtonText,
    ),
    instagramButtonText: readText(
      source,
      ["instagramButtonText", "publicInstagramButtonText"],
      DEFAULT_PUBLIC_CONFIG.instagramButtonText,
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

function formatWhatsappDisplay(value: string) {
  const digits = String(value || "").replace(/\D/g, "")

  if (!digits) return ""

  // Números venezolanos guardados con prefijo 58 se muestran como 0XXX-XXX-XXXX.
  const local = digits.startsWith("58") ? `0${digits.slice(2)}` : digits

  if (local.length === 11) {
    return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7)}`
  }

  return local
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
    data.businessConfig || data.config || data.publicConfig || data,
  )
}

export default function BottomInfoSections() {
  const [businessConfig, setBusinessConfig] = useState<PublicBusinessConfig>(
    DEFAULT_PUBLIC_CONFIG,
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
      businessConfig.deliveryWhatsapp || businessConfig.mainWhatsapp,
    )
  }, [businessConfig.deliveryWhatsapp, businessConfig.mainWhatsapp])

  const googleMapsUrl = useMemo(() => {
    return normalizeExternalUrl(
      businessConfig.googleMapsUrl,
      DEFAULT_PUBLIC_CONFIG.googleMapsUrl,
    )
  }, [businessConfig.googleMapsUrl])

  const instagramUrl = useMemo(() => {
    return normalizeExternalUrl(businessConfig.instagramUrl, "")
  }, [businessConfig.instagramUrl])

  const whatsappDisplay = formatWhatsappDisplay(
    businessConfig.deliveryWhatsapp || businessConfig.mainWhatsapp,
  )

  return (
    <section
      id="contacto"
      className="relative overflow-hidden bg-[var(--brand-cream)] px-4 pb-0 pt-14 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-96 bg-[radial-gradient(ellipse_at_50%_120%,rgba(var(--brand-primary-rgb),0.14),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Bloque de bienvenida */}
          <div>
            <div className="inline-flex rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
              {businessConfig.publicSectionTitle || "Contacto"}
            </div>

            <h2 className="font-display mt-5 max-w-3xl text-[2.8rem] uppercase leading-[0.9] text-[var(--brand-ink-3)] [text-shadow:0_8px_40px_rgba(var(--brand-primary-rgb),0.3)] sm:text-6xl">
              {businessConfig.publicWelcomeTitle}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-[var(--brand-ink-2)] sm:text-base">
              {businessConfig.publicWelcomeText}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_14px_36px_-12px_rgba(var(--brand-primary-rgb),0.8)] transition hover:bg-[var(--brand-accent)] active:scale-95"
              >
                <MessageCircle size={17} />
                {businessConfig.whatsappButtonText}
              </a>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
              >
                <MapPin size={17} />
                {businessConfig.locationButtonText}
              </a>

              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
                >
                  <AtSign size={17} />
                  {businessConfig.instagramButtonText}
                </a>
              ) : null}
            </div>
          </div>

          {/* Tiles de información */}
          <div className="grid gap-4">
            <article className="flex gap-4 rounded-[1.4rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 transition hover:border-[rgba(var(--brand-primary-rgb),0.5)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary)]">
                <Clock size={24} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                  {businessConfig.scheduleTitle}
                </p>

                <div className="mt-2 space-y-1 text-sm font-bold leading-6 text-[var(--brand-ink-3)] sm:text-base">
                  <p>{businessConfig.scheduleLine1}</p>
                  {businessConfig.scheduleLine2 ? <p>{businessConfig.scheduleLine2}</p> : null}
                </div>
              </div>
            </article>

            {whatsappDisplay ? (
              <article className="flex gap-4 rounded-[1.4rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 transition hover:border-[rgba(var(--brand-primary-rgb),0.5)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary)]">
                  <Bike size={24} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                    Pedido rápido
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]">
                    Haz tu pedido por WhatsApp
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xl font-black tracking-wide text-[var(--brand-primary)] transition hover:text-[var(--brand-accent)] sm:text-2xl"
                  >
                    {whatsappDisplay}
                  </a>
                </div>
              </article>
            ) : null}
          </div>
        </div>

        {/* Pie de página de marca */}
        <footer className="mt-14 border-t border-[var(--brand-border)] py-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <Image
                src={BRAND.logoUrl || "/logoremovebg.png"}
                alt={businessConfig.businessName}
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 rounded-full border border-[var(--brand-border)] object-cover"
              />
              <div>
                <p className="font-display text-xl uppercase leading-none text-[var(--brand-ink-3)]">
                  {businessConfig.businessName}
                </p>
                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                  {BRAND.tagline}
                </p>
              </div>
            </div>

            <p className="text-xs font-medium text-[var(--brand-ink-2)]">
              © {new Date().getFullYear()} {businessConfig.businessName} · Hecho
              con hambre en Venezuela
            </p>
          </div>
        </footer>
      </div>
    </section>
  )
}
