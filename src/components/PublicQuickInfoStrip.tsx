"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, MapPin, ShoppingCart, Sparkles } from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicQuickInfoConfig = {
  businessName: string
  publicTagline: string
  publicInfoTitle: string
  publicInfoText: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  quickOrderTitle: string
  quickOrderText: string
  locationButtonText: string
  googleMapsUrl: string
  mainWhatsapp: string
  deliveryWhatsapp: string
}

const DEFAULT_CONFIG: PublicQuickInfoConfig = {
  businessName: BRAND.name,
  publicTagline: "Página pública",
  publicInfoTitle: `Visita ${BRAND.name}`,
  publicInfoText:
    "Revisa el menú, elige tus productos y coordina tu pedido desde la página pública.",
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible en el local",
  scheduleLine2: "",
  quickOrderTitle: "Pedido rápido",
  quickOrderText: "Agrega productos al carrito y confirma tu pedido al finalizar.",
  locationButtonText: "Abrir ubicación",
  googleMapsUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
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

function normalizeExternalUrl(value: string) {
  const cleanValue = String(value || "").trim()

  if (!cleanValue) return ""
  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue
  }

  return ""
}

function buildWhatsappUrl(value: string) {
  const cleanValue = String(value || "").trim()

  if (!cleanValue) return ""
  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue
  }

  const digits = cleanValue.replace(/\D/g, "")

  return digits ? `https://wa.me/${digits}` : ""
}

function normalizeConfig(value: unknown): PublicQuickInfoConfig {
  const source = (value || {}) as Record<string, unknown>

  return {
    businessName: readText(source, ["businessName", "name"], DEFAULT_CONFIG.businessName),
    publicTagline: readText(
      source,
      ["publicTagline", "heroBadgeText", "businessTagline"],
      DEFAULT_CONFIG.publicTagline
    ),
    publicInfoTitle: readText(
      source,
      ["publicInfoTitle", "publicWelcomeTitle", "welcomeTitle"],
      DEFAULT_CONFIG.publicInfoTitle
    ),
    publicInfoText: readText(
      source,
      ["publicInfoText", "publicWelcomeText", "welcomeText"],
      DEFAULT_CONFIG.publicInfoText
    ),
    scheduleTitle: readText(
      source,
      ["scheduleTitle", "publicScheduleTitle"],
      DEFAULT_CONFIG.scheduleTitle
    ),
    scheduleLine1: readText(
      source,
      ["scheduleLine1", "publicScheduleLine1"],
      DEFAULT_CONFIG.scheduleLine1
    ),
    scheduleLine2: readText(
      source,
      ["scheduleLine2", "publicScheduleLine2"],
      DEFAULT_CONFIG.scheduleLine2
    ),
    quickOrderTitle: readText(
      source,
      ["quickOrderTitle", "publicQuickOrderTitle"],
      DEFAULT_CONFIG.quickOrderTitle
    ),
    quickOrderText: readText(
      source,
      ["quickOrderText", "publicQuickOrderText"],
      DEFAULT_CONFIG.quickOrderText
    ),
    locationButtonText: readText(
      source,
      ["locationButtonText", "publicLocationButtonText", "mapsButtonText"],
      DEFAULT_CONFIG.locationButtonText
    ),
    googleMapsUrl: readText(
      source,
      ["googleMapsUrl", "googleMapsLink", "mapsUrl"],
      ""
    ),
    mainWhatsapp: readText(source, ["mainWhatsapp", "whatsapp"], ""),
    deliveryWhatsapp: readText(source, ["deliveryWhatsapp", "whatsappDelivery"], ""),
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public/business-config", {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo cargar la información pública")
  }

  const data = await response.json()

  return normalizeConfig(data.businessConfig || data.config || data.publicConfig || data)
}

export default function PublicQuickInfoStrip() {
  const [config, setConfig] = useState<PublicQuickInfoConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let isMounted = true

    getPublicConfig()
      .then((nextConfig) => {
        if (isMounted) setConfig(nextConfig)
      })
      .catch(() => {
        if (isMounted) setConfig(DEFAULT_CONFIG)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(config.deliveryWhatsapp || config.mainWhatsapp),
    [config.deliveryWhatsapp, config.mainWhatsapp]
  )
  const mapsUrl = useMemo(
    () => normalizeExternalUrl(config.googleMapsUrl),
    [config.googleMapsUrl]
  )

  const cards = [
    {
      icon: <Sparkles size={22} />,
      title: config.publicTagline || config.businessName,
      text: config.publicInfoTitle || config.publicInfoText,
      href: "#menu",
      label: "Ver menú",
      primary: true,
    },
    {
      icon: <Clock size={22} />,
      title: config.scheduleTitle,
      text: [config.scheduleLine1, config.scheduleLine2].filter(Boolean).join(" · "),
      href: "#ubicacion",
      label: "Ver horario",
      primary: false,
    },
    {
      icon: <MapPin size={22} />,
      title: config.locationButtonText || "Ubicación",
      text: mapsUrl ? "Abre la ubicación del negocio en Google Maps." : "Configura el enlace de ubicación desde el panel.",
      href: mapsUrl || "#ubicacion",
      label: config.locationButtonText || "Ubicación",
      external: Boolean(mapsUrl),
      primary: false,
    },
    {
      icon: <ShoppingCart size={22} />,
      title: config.quickOrderTitle,
      text: config.quickOrderText,
      href: whatsappUrl || "#menu",
      label: whatsappUrl ? "Pedir por WhatsApp" : "Armar pedido",
      external: Boolean(whatsappUrl),
      primary: false,
      whatsapp: Boolean(whatsappUrl),
    },
  ]

  return (
    <section className="relative z-10 bg-[var(--brand-cream)] px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto -mt-8 grid max-w-7xl gap-3 rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-white p-3 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)] sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <>
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border-2 border-[var(--brand-primary)] ${
                  card.primary || card.whatsapp
                    ? "bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                    : "bg-[var(--brand-cream)] text-[var(--brand-primary)]"
                }`}
              >
                {card.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                  {card.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                  {card.text}
                </p>
                <span className="mt-3 inline-flex text-[0.68rem] font-black uppercase tracking-[0.13em] text-[var(--brand-primary)]">
                  {card.label}
                </span>
              </div>
            </>
          )

          const className =
            "group flex min-h-[128px] items-start gap-3 rounded-[1.35rem] border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"

          if (card.external) {
            return (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {content}
              </a>
            )
          }

          return (
            <a key={card.title} href={card.href} className={className}>
              {content}
            </a>
          )
        })}
      </div>
    </section>
  )
}
