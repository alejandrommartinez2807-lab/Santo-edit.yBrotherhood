"use client"

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  Clock,
  MapPin,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Table2,
  Truck,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicConfidenceConfig = {
  businessName: string
  businessShortDescription: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  quickOrderTitle: string
  quickOrderText: string
  locationButtonText: string
  googleMapsUrl: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  deliveryEnabled: boolean
  deliveryModuleEnabled: boolean
  paymentProofsEnabled: boolean
  openAccountsEnabled: boolean
  localTables: Array<{ name?: string; isActive?: boolean }>
  productCardBackgroundColor: string
  productCardTextColor: string
  productCardBorderColor: string
  productCardButtonColor: string
}

type ConfidenceCard = {
  key: string
  icon: ReactNode
  title: string
  text: string
  href: string
  label: string
  external?: boolean
  highlighted?: boolean
}

const DEFAULT_CONFIG: PublicConfidenceConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible en el local",
  scheduleLine2: "",
  quickOrderTitle: "Pedido rápido",
  quickOrderText: "Agrega productos al carrito y confirma el pedido al finalizar.",
  locationButtonText: "Ubicación",
  googleMapsUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  paymentProofsEnabled: false,
  openAccountsEnabled: false,
  localTables: [],
  productCardBackgroundColor: "#ffffff",
  productCardTextColor: "#4a0000",
  productCardBorderColor: "#a00000",
  productCardButtonColor: "#ffd23c",
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

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0

  const normalized = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["true", "1", "si", "activo", "activa", "enabled", "on"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no", "inactivo", "inactiva", "disabled", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function normalizeColor(value: unknown, fallback: string) {
  const text = String(value || "").trim()

  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback
}

function normalizeExternalUrl(value: unknown) {
  const text = String(value || "").trim()

  if (!text) return ""

  try {
    const url = new URL(text)

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""
  } catch {
    return ""
  }
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "")
}

function buildWhatsappUrl(value: unknown) {
  const phone = normalizePhone(value)

  return phone ? `https://wa.me/${phone}` : ""
}

function normalizeLocalTables(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : {}))
    .map((item) => ({
      name: String(item.name || "").trim(),
      isActive: readBoolean(item.isActive, true),
    }))
    .filter((item) => item.name && item.isActive !== false)
}

function getConfigPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>
  const businessConfig = source.businessConfig

  if (businessConfig && typeof businessConfig === "object") {
    return businessConfig as Record<string, unknown>
  }

  return source
}

function normalizeConfig(value: unknown): PublicConfidenceConfig {
  const source = getConfigPayload(value)

  return {
    businessName: readText(source, ["businessName", "name"], DEFAULT_CONFIG.businessName),
    businessShortDescription: readText(
      source,
      ["businessShortDescription", "shortDescription"],
      DEFAULT_CONFIG.businessShortDescription
    ),
    scheduleTitle: readText(source, ["scheduleTitle", "publicScheduleTitle"], DEFAULT_CONFIG.scheduleTitle),
    scheduleLine1: readText(source, ["scheduleLine1", "publicScheduleLine1"], DEFAULT_CONFIG.scheduleLine1),
    scheduleLine2: readText(source, ["scheduleLine2", "publicScheduleLine2"], DEFAULT_CONFIG.scheduleLine2),
    quickOrderTitle: readText(source, ["quickOrderTitle", "publicQuickOrderTitle"], DEFAULT_CONFIG.quickOrderTitle),
    quickOrderText: readText(source, ["quickOrderText", "publicQuickOrderText"], DEFAULT_CONFIG.quickOrderText),
    locationButtonText: readText(source, ["locationButtonText", "mapsButtonText"], DEFAULT_CONFIG.locationButtonText),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    deliveryEnabled: readBoolean(source.deliveryEnabled, DEFAULT_CONFIG.deliveryEnabled),
    deliveryModuleEnabled: readBoolean(source.deliveryModuleEnabled, DEFAULT_CONFIG.deliveryModuleEnabled),
    paymentProofsEnabled: readBoolean(source.paymentProofsEnabled, false) || readBoolean(source.paymentProofsModuleEnabled, false),
    openAccountsEnabled: readBoolean(source.openAccountsEnabled, false) || readBoolean(source.openAccountsModuleEnabled, false),
    localTables: normalizeLocalTables(source.localTables),
    productCardBackgroundColor: normalizeColor(source.productCardBackgroundColor, DEFAULT_CONFIG.productCardBackgroundColor),
    productCardTextColor: normalizeColor(source.productCardTextColor, DEFAULT_CONFIG.productCardTextColor),
    productCardBorderColor: normalizeColor(source.productCardBorderColor, DEFAULT_CONFIG.productCardBorderColor),
    productCardButtonColor: normalizeColor(source.productCardButtonColor, DEFAULT_CONFIG.productCardButtonColor),
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

  return normalizeConfig(data)
}

export default function PublicCustomerConfidence() {
  const [config, setConfig] = useState<PublicConfidenceConfig>(DEFAULT_CONFIG)

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
  const hasDelivery = config.deliveryEnabled && config.deliveryModuleEnabled
  const hasTables = config.openAccountsEnabled && config.localTables.length > 0
  const scheduleText = [config.scheduleLine1, config.scheduleLine2].filter(Boolean).join(" · ")

  const cards: ConfidenceCard[] = [
    {
      key: "menu",
      icon: <ShoppingCart size={24} />,
      title: config.quickOrderTitle || "Pedido rápido",
      text: config.quickOrderText || "Arma tu pedido, revisa el carrito y confirma cuando todo esté listo.",
      href: "#menu",
      label: "Ver menú",
      highlighted: true,
    },
    {
      key: "schedule",
      icon: <Clock size={24} />,
      title: config.scheduleTitle || "Horario",
      text: scheduleText || "Revisa el horario de atención antes de coordinar tu pedido.",
      href: "#ubicacion",
      label: "Ver horario",
    },
    {
      key: "support",
      icon: <MessageCircle size={24} />,
      title: whatsappUrl ? "Atención por WhatsApp" : "Atención del local",
      text: whatsappUrl
        ? "Escribe al negocio para dudas, disponibilidad o coordinación del pedido."
        : "Configura WhatsApp desde el panel para mostrar acceso directo al cliente.",
      href: whatsappUrl || "#como-pedir",
      label: whatsappUrl ? "Escribir" : "Cómo pedir",
      external: Boolean(whatsappUrl),
    },
  ]

  if (hasDelivery) {
    cards.push({
      key: "delivery",
      icon: <Truck size={24} />,
      title: "Delivery disponible",
      text: "El cliente puede revisar el menú y coordinar la entrega según las zonas activas del negocio.",
      href: whatsappUrl || "#menu",
      label: whatsappUrl ? "Coordinar" : "Ver menú",
      external: Boolean(whatsappUrl),
    })
  } else if (hasTables) {
    cards.push({
      key: "tables",
      icon: <Table2 size={24} />,
      title: "Cuenta por mesa",
      text: "Las mesas activas pueden abrir cuenta por QR y agregar pedidos durante la visita.",
      href: "#abrir-cuenta",
      label: "Ver cuenta",
    })
  } else if (config.googleMapsUrl) {
    cards.push({
      key: "location",
      icon: <MapPin size={24} />,
      title: config.locationButtonText || "Ubicación",
      text: "Abre Google Maps para llegar al negocio o compartir la ubicación.",
      href: config.googleMapsUrl,
      label: config.locationButtonText || "Abrir ubicación",
      external: true,
    })
  }

  if (config.paymentProofsEnabled) {
    cards.push({
      key: "proof",
      icon: <ReceiptText size={24} />,
      title: "Comprobante revisable",
      text: "Si el negocio lo solicita, el cliente puede adjuntar referencia o captura para revisión del personal.",
      href: "#menu",
      label: "Armar pedido",
    })
  }

  const visibleCards = cards.slice(0, 5)

  return (
    <section
      id="info-pedido"
      className="bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
      style={{
        "--confidence-card-bg": config.productCardBackgroundColor,
        "--confidence-card-text": config.productCardTextColor,
        "--confidence-card-border": config.productCardBorderColor,
        "--confidence-card-button": config.productCardButtonColor,
      } as CSSProperties}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 rounded-[1.6rem] border-2 border-[var(--brand-primary)] bg-white p-5 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              <ShieldCheck size={16} />
              Antes de pedir
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-4xl">
              Compra con más claridad
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              {config.businessShortDescription || `Revisa las opciones de ${config.businessName || BRAND.name} antes de confirmar tu pedido.`}
            </p>
          </div>

          <a
            href="#menu"
            className="w-fit rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.18)]"
          >
            Ir al menú
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {visibleCards.map((card) => {
            const className = `group flex min-h-[168px] flex-col justify-between rounded-[1.45rem] border-2 p-4 text-left transition hover:-translate-y-0.5 ${
              card.highlighted
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.14)]"
                : "border-[var(--confidence-card-border)]/30 bg-[var(--confidence-card-bg)] text-[var(--confidence-card-text)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.07)]"
            }`
            const iconClass = `flex h-12 w-12 items-center justify-center rounded-[1rem] border-2 ${
              card.highlighted
                ? "border-white/30 bg-white/12 text-white"
                : "border-[var(--confidence-card-border)] bg-[var(--confidence-card-button)] text-[var(--confidence-card-text)]"
            }`
            const content = (
              <>
                <div>
                  <div className={iconClass}>{card.icon}</div>
                  <h3 className="mt-4 text-lg font-black uppercase leading-none">
                    {card.title}
                  </h3>
                  <p className={`mt-2 text-xs font-bold leading-5 ${card.highlighted ? "text-white/82" : "opacity-75"}`}>
                    {card.text}
                  </p>
                </div>
                <span className={`mt-4 inline-flex text-[0.68rem] font-black uppercase tracking-[0.14em] ${card.highlighted ? "text-[var(--brand-accent)]" : "text-[var(--confidence-card-border)]"}`}>
                  {card.label}
                </span>
              </>
            )

            if (card.external) {
              return (
                <a key={card.key} href={card.href} target="_blank" rel="noreferrer" className={className}>
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
    </section>
  )
}
