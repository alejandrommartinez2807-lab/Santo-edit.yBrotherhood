"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ClipboardList,
  MapPin,
  MessageCircle,
  PackageCheck,
  QrCode,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicTable = {
  id?: string
  name?: string
  area?: string
  isActive?: boolean
}

type PublicOrderGuideConfig = {
  businessName: string
  businessShortDescription: string
  localOrdersEnabled: boolean
  deliveryEnabled: boolean
  deliveryModuleEnabled: boolean
  openAccountsEnabled: boolean
  paymentProofsEnabled: boolean
  localTables: PublicTable[]
  locationLabel: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  googleMapsUrl: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  quickOrderTitle: string
  quickOrderText: string
  locationButtonText: string
}

type GuideCard = {
  key: string
  title: string
  text: string
  label: string
  href: string
  icon: typeof ShoppingBag
  external?: boolean
  featured?: boolean
}

const DEFAULT_CONFIG: PublicOrderGuideConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  localOrdersEnabled: true,
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  openAccountsEnabled: false,
  paymentProofsEnabled: false,
  localTables: [],
  locationLabel: "Mesa",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible en el negocio",
  scheduleLine2: "",
  quickOrderTitle: "Cómo pedir",
  quickOrderText: "Elige tus productos, revisa el carrito y confirma tu pedido cuando estés listo.",
  locationButtonText: "Ubicación",
}

function readText(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return fallback
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0

  const text = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["true", "1", "si", "activo", "activa", "enabled", "on"].includes(text)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "disabled", "off"].includes(text)) {
    return false
  }

  return fallback
}

function normalizeTables(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (item && typeof item === "object" ? item as PublicTable : { name: String(item || "") }))
    .filter((item) => String(item.name || "").trim() && item.isActive !== false)
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "")
}

function buildWhatsappUrl(value: unknown) {
  const phone = normalizePhone(value)

  return phone ? `https://wa.me/${phone}` : ""
}

function normalizeExternalUrl(value: unknown) {
  const text = String(value || "").trim()

  if (!text) return ""

  try {
    const url = new URL(text)

    if (url.protocol !== "http:" && url.protocol !== "https:") return ""

    return url.toString()
  } catch {
    return ""
  }
}

function getConfigPayload(value: unknown) {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>

  if (source.businessConfig && typeof source.businessConfig === "object") {
    return source.businessConfig as Record<string, unknown>
  }

  return source
}

function normalizeConfig(value: unknown): PublicOrderGuideConfig {
  const source = getConfigPayload(value)

  return {
    businessName: readText(source, ["businessName", "name"], DEFAULT_CONFIG.businessName),
    businessShortDescription: readText(
      source,
      ["businessShortDescription", "shortDescription"],
      DEFAULT_CONFIG.businessShortDescription
    ),
    localOrdersEnabled: normalizeBoolean(source.localOrdersEnabled, DEFAULT_CONFIG.localOrdersEnabled),
    deliveryEnabled: normalizeBoolean(source.deliveryEnabled, DEFAULT_CONFIG.deliveryEnabled),
    deliveryModuleEnabled: normalizeBoolean(source.deliveryModuleEnabled, DEFAULT_CONFIG.deliveryModuleEnabled),
    openAccountsEnabled: normalizeBoolean(source.openAccountsEnabled, DEFAULT_CONFIG.openAccountsEnabled),
    paymentProofsEnabled: normalizeBoolean(source.paymentProofsEnabled, DEFAULT_CONFIG.paymentProofsEnabled),
    localTables: normalizeTables(source.localTables),
    locationLabel: readText(source, ["locationLabel"], DEFAULT_CONFIG.locationLabel),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    scheduleTitle: readText(source, ["scheduleTitle", "publicScheduleTitle"], DEFAULT_CONFIG.scheduleTitle),
    scheduleLine1: readText(source, ["scheduleLine1", "publicScheduleLine1"], DEFAULT_CONFIG.scheduleLine1),
    scheduleLine2: readText(source, ["scheduleLine2", "publicScheduleLine2"], DEFAULT_CONFIG.scheduleLine2),
    quickOrderTitle: readText(source, ["quickOrderTitle", "publicQuickOrderTitle"], DEFAULT_CONFIG.quickOrderTitle),
    quickOrderText: readText(source, ["quickOrderText", "publicQuickOrderText"], DEFAULT_CONFIG.quickOrderText),
    locationButtonText: readText(
      source,
      ["locationButtonText", "publicLocationButtonText", "mapsButtonText"],
      DEFAULT_CONFIG.locationButtonText
    ),
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public/business-config", {
    cache: "no-store",
  })
  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.ok) {
    throw new Error("No se pudo cargar la configuración pública")
  }

  return normalizeConfig(data)
}

export default function PublicOrderModeGuide() {
  const [config, setConfig] = useState<PublicOrderGuideConfig>(DEFAULT_CONFIG)

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

  const cards = useMemo<GuideCard[]>(() => {
    const nextCards: GuideCard[] = [
      {
        key: "menu",
        title: "Arma tu pedido",
        text: "Explora el menú, agrega productos al carrito y revisa el total antes de confirmar.",
        label: "Ver menú",
        href: "#menu",
        icon: ShoppingBag,
        featured: true,
      },
    ]

    if (config.localOrdersEnabled) {
      nextCards.push({
        key: "local",
        title: "Comer aquí",
        text: `Usa la opción del local y coloca tu ${config.locationLabel.toLowerCase()} para que el equipo ubique tu pedido.`,
        label: "Pedido en local",
        href: "#menu",
        icon: UtensilsCrossed,
      })
    }

    nextCards.push({
      key: "takeaway",
      title: "Para llevar",
      text: "Haz tu pedido para retirar y deja tus datos claros al finalizar el carrito.",
      label: "Pedir para llevar",
      href: "#menu",
      icon: PackageCheck,
    })

    if (config.deliveryEnabled && config.deliveryModuleEnabled) {
      nextCards.push({
        key: "delivery",
        title: "Delivery",
        text: "Elige delivery al confirmar y comparte tu ubicación de Google Maps: el costo se calcula por distancia.",
        label: whatsappUrl ? "Coordinar delivery" : "Ver menú",
        href: whatsappUrl || "#menu",
        icon: MessageCircle,
        external: Boolean(whatsappUrl),
      })
    }

    if (config.openAccountsEnabled && config.localTables.length > 0) {
      nextCards.push({
        key: "open-account",
        title: "Cuenta por mesa",
        text: "Escanea el QR de tu mesa, abre una cuenta y pide varias veces antes de pagar al final.",
        label: "Ver cómo funciona",
        href: "#abrir-cuenta",
        icon: QrCode,
      })
    }

    if (config.paymentProofsEnabled) {
      nextCards.push({
        key: "proofs",
        title: "Comprobante",
        text: "Cuando el negocio lo permita, podrás adjuntar referencia o captura sin que el pago se marque automático.",
        label: "Revisar carrito",
        href: "#menu",
        icon: ReceiptText,
      })
    }

    if (config.googleMapsUrl) {
      nextCards.push({
        key: "location",
        title: config.locationButtonText || "Ubicación",
        text: "Abre Google Maps para llegar al negocio o compartir la ubicación con otra persona.",
        label: config.locationButtonText || "Abrir ubicación",
        href: config.googleMapsUrl,
        icon: MapPin,
        external: true,
      })
    }

    return nextCards.slice(0, 6)
  }, [
    config.deliveryEnabled,
    config.deliveryModuleEnabled,
    config.googleMapsUrl,
    config.localOrdersEnabled,
    config.localTables.length,
    config.locationButtonText,
    config.locationLabel,
    config.openAccountsEnabled,
    config.paymentProofsEnabled,
    whatsappUrl,
  ])

  const scheduleText = [config.scheduleLine1, config.scheduleLine2]
    .filter(Boolean)
    .join(" · ")

  return (
    <section
      id="como-pedir"
      className="bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(var(--brand-accent-rgb),0.30),transparent_32%),linear-gradient(180deg,#fff_0%,var(--brand-cream)_100%)] p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[var(--brand-accent)]/35 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-ink)] shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.12)]">
                <ClipboardList size={16} />
                Pedido fácil
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl lg:text-6xl">
                {config.quickOrderTitle || "Cómo pedir"}
              </h2>
              <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75 sm:text-base">
                {config.quickOrderText || DEFAULT_CONFIG.quickOrderText}
              </p>
              {scheduleText ? (
                <p className="mt-4 inline-flex rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  {config.scheduleTitle}: {scheduleText}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <a
                href="#menu"
                className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:bg-[var(--brand-accent)] hover:text-[var(--brand-ink)]"
              >
                Ver menú
              </a>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div className="relative mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon
              const className = `group flex min-h-[178px] flex-col rounded-[1.45rem] border-2 p-5 transition hover:-translate-y-0.5 ${
                card.featured
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.18)]"
                  : "border-[var(--brand-primary)]/18 bg-white text-[#1a1a1a] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.08)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
              }`

              const content = (
                <>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-2 ${
                      card.featured
                        ? "border-white/50 bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                        : "border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-primary)]"
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-4 text-lg font-black uppercase leading-tight">
                    {card.title}
                  </h3>
                  <p className={`mt-2 flex-1 text-sm font-bold leading-6 ${card.featured ? "text-white/82" : "text-[var(--brand-ink-2)]/72"}`}>
                    {card.text}
                  </p>
                  <span className={`mt-4 text-xs font-black uppercase tracking-[0.13em] ${card.featured ? "text-[var(--brand-accent)]" : "text-[var(--brand-primary)]"}`}>
                    {card.label}
                  </span>
                </>
              )

              if (card.external) {
                return (
                  <a
                    key={card.key}
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
                <a key={card.key} href={card.href} className={className}>
                  {content}
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
