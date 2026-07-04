"use client"

import { useEffect, useMemo, useState } from "react"
import { BRAND } from "@/lib/brand"
import { Clock, MapPin, MessageCircle, Star } from "lucide-react"

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

  return (
    <section
      id="contacto"
      className="bg-[var(--brand-cream)] px-4 py-12 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.14)]">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b-4 border-[var(--brand-primary)] p-6 sm:p-8 lg:border-b-0 lg:border-r-4">
            <div className="inline-flex rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-ink)]">
              {businessConfig.publicSectionTitle || "Contacto"}
            </div>

            <h2 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.8)] sm:text-5xl">
              {businessConfig.publicWelcomeTitle}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-[var(--brand-ink-2)]/85 sm:text-base">
              {businessConfig.publicWelcomeText}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:scale-[1.02] hover:bg-[var(--brand-accent-200)]"
              >
                <MessageCircle size={17} />
                {businessConfig.whatsappButtonText}
              </a>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.10)] transition hover:scale-[1.02] hover:bg-[var(--brand-accent-100)]"
              >
                <MapPin size={17} />
                {businessConfig.locationButtonText}
              </a>

              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.10)] transition hover:scale-[1.02] hover:bg-[var(--brand-accent-100)]"
                >
                  <Star size={17} />
                  {businessConfig.instagramButtonText}
                </a>
              ) : null}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <article className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-5 shadow-[0_7px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
                  <Clock size={23} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                    {businessConfig.scheduleTitle}
                  </p>

                  <div className="mt-3 space-y-2 text-sm font-black leading-6 text-[var(--brand-ink-3)] sm:text-base">
                    <p>{businessConfig.scheduleLine1}</p>
                    {businessConfig.scheduleLine2 ? <p>{businessConfig.scheduleLine2}</p> : null}
                  </div>
                </div>
              </div>
            </article>

            <p className="mt-5 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
              Esta sección final se mantiene simple: contacto, ubicación, redes y horario. No incluye bloques viejos de reseñas, guías ni pedido rápido.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
