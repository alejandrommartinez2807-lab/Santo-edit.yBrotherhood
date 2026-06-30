"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BadgeDollarSign,
  CheckCircle2,
  HelpCircle,
  MapPin,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicLocalTable = {
  name?: string
  isActive?: boolean
}

type PublicFaqConfig = {
  businessName: string
  businessShortDescription: string
  mainWhatsapp: string
  deliveryWhatsapp: string
  googleMapsUrl: string
  locationButtonText: string
  scheduleLine1: string
  deliveryEnabled: boolean
  deliveryModuleEnabled: boolean
  paymentProofsEnabled: boolean
  openAccountsEnabled: boolean
  localTables: PublicLocalTable[]
  locationLabel: string
  publicCustomizeButtonText: string
  pricesIncludeIva: boolean
  igtfEnabled: boolean
}

type PublicBusinessConfigResponse = {
  ok?: boolean
  businessConfig?: Record<string, unknown>
  config?: Record<string, unknown>
}

const DEFAULT_FAQ_CONFIG: PublicFaqConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  mainWhatsapp: "",
  deliveryWhatsapp: "",
  googleMapsUrl: "",
  locationButtonText: "Ubicación",
  scheduleLine1: "Horario visible en la página",
  deliveryEnabled: true,
  deliveryModuleEnabled: true,
  paymentProofsEnabled: false,
  openAccountsEnabled: false,
  localTables: [],
  locationLabel: "Mesa",
  publicCustomizeButtonText: "Elige tus ingredientes",
  pricesIncludeIva: true,
  igtfEnabled: true,
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").trim()
  return text || fallback
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0

  const normalized = cleanText(value)
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

function normalizeExternalUrl(value: unknown) {
  const text = cleanText(value)
  if (!text) return ""

  try {
    const url = new URL(text)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : ""
  } catch {
    return ""
  }
}

function buildWhatsappUrl(value: unknown) {
  const phone = normalizePhone(value)
  return phone ? `https://wa.me/${phone}` : ""
}

function normalizeLocalTables(value: unknown): PublicLocalTable[] {
  return Array.isArray(value)
    ? value
        .map((item) => (item && typeof item === "object" ? item : { name: String(item || "") }))
        .map((item) => item as PublicLocalTable)
        .filter((table) => cleanText(table.name) && table.isActive !== false)
    : []
}

function getConfigPayload(value: PublicBusinessConfigResponse | null) {
  return value?.businessConfig || value?.config || {}
}

function normalizeConfig(value: unknown): PublicFaqConfig {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    businessName: cleanText(source.businessName, DEFAULT_FAQ_CONFIG.businessName),
    businessShortDescription: cleanText(
      source.businessShortDescription,
      DEFAULT_FAQ_CONFIG.businessShortDescription,
    ),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    locationButtonText: cleanText(source.locationButtonText, DEFAULT_FAQ_CONFIG.locationButtonText),
    scheduleLine1: cleanText(source.scheduleLine1, DEFAULT_FAQ_CONFIG.scheduleLine1),
    deliveryEnabled: normalizeBoolean(source.deliveryEnabled, DEFAULT_FAQ_CONFIG.deliveryEnabled),
    deliveryModuleEnabled: normalizeBoolean(
      source.deliveryModuleEnabled,
      DEFAULT_FAQ_CONFIG.deliveryModuleEnabled,
    ),
    paymentProofsEnabled: normalizeBoolean(
      source.paymentProofsEnabled || source.paymentProofsModuleEnabled,
      DEFAULT_FAQ_CONFIG.paymentProofsEnabled,
    ),
    openAccountsEnabled: normalizeBoolean(source.openAccountsEnabled, DEFAULT_FAQ_CONFIG.openAccountsEnabled),
    localTables: normalizeLocalTables(source.localTables),
    locationLabel: cleanText(source.locationLabel, DEFAULT_FAQ_CONFIG.locationLabel),
    publicCustomizeButtonText: cleanText(
      source.publicCustomizeButtonText,
      DEFAULT_FAQ_CONFIG.publicCustomizeButtonText,
    ),
    pricesIncludeIva: normalizeBoolean(source.pricesIncludeIva, DEFAULT_FAQ_CONFIG.pricesIncludeIva),
    igtfEnabled: normalizeBoolean(source.igtfEnabled, DEFAULT_FAQ_CONFIG.igtfEnabled),
  }
}

export default function PublicOrderFaq() {
  const [config, setConfig] = useState<PublicFaqConfig>(DEFAULT_FAQ_CONFIG)

  useEffect(() => {
    let isMounted = true

    async function loadConfig() {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as PublicBusinessConfigResponse | null

        if (!response.ok || !data?.ok || !isMounted) return

        setConfig(normalizeConfig(getConfigPayload(data)))
      } catch {
        if (isMounted) setConfig(DEFAULT_FAQ_CONFIG)
      }
    }

    loadConfig()

    return () => {
      isMounted = false
    }
  }, [])

  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(config.deliveryWhatsapp || config.mainWhatsapp),
    [config.deliveryWhatsapp, config.mainWhatsapp],
  )

  const hasDelivery = config.deliveryEnabled && config.deliveryModuleEnabled
  const hasOpenTables = config.openAccountsEnabled && config.localTables.length > 0

  const faqItems = [
    {
      icon: ShoppingCart,
      question: "¿Cómo hago mi pedido?",
      answer: `Elige tus productos, usa ${config.publicCustomizeButtonText} cuando el producto tenga opciones y revisa el carrito antes de confirmar.`,
    },
    {
      icon: Truck,
      question: hasDelivery ? "¿Tienen delivery?" : "¿Cómo retiro mi pedido?",
      answer: hasDelivery
        ? "Puedes pedir delivery si tu zona está activa. Revisa la sección de zonas para ver el costo antes de cerrar el pedido."
        : "El pedido se puede organizar para retirar o consumir en el local, según las opciones activas del negocio.",
    },
    {
      icon: BadgeDollarSign,
      question: "¿Cómo sé cuánto pagar?",
      answer: `${config.pricesIncludeIva ? "Los precios se muestran como referencia final al público." : "El negocio puede mostrar referencias y calcular impuestos según configuración."} La referencia en Bs usa la tasa activa del sistema.`,
    },
    {
      icon: ShieldCheck,
      question: "¿Qué pasa con productos que requieren confirmación?",
      answer: "Algunos productos pueden pedir confirmación del personal por disponibilidad, ingredientes o preparación especial. El aviso aparece antes de agregarlos.",
    },
    ...(config.paymentProofsEnabled
      ? [
          {
            icon: ReceiptText,
            question: "¿Puedo enviar comprobante?",
            answer: "Sí. Si el módulo está activo, puedes adjuntar referencia o captura para que caja la revise sin marcar el pago automáticamente.",
          },
        ]
      : []),
    ...(hasOpenTables
      ? [
          {
            icon: CheckCircle2,
            question: `¿Puedo abrir cuenta por ${config.locationLabel.toLowerCase()}?`,
            answer: `Sí. Si escaneas el QR de una ${config.locationLabel.toLowerCase()}, puedes consultar la cuenta abierta y ver qué está entregado o pendiente.`,
          },
        ]
      : []),
  ]

  return (
    <section id="preguntas" className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="rounded-[1.8rem] border-2 border-[var(--brand-primary)] bg-white p-5 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.10)]">
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              <HelpCircle size={16} />
              Ayuda rápida
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-4xl">
              Preguntas antes de pedir
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              Resuelve lo básico antes de escribir o llenar el carrito: horario, delivery, comprobantes, cuenta por mesa y opciones del producto.
            </p>
            <div className="mt-4 grid gap-2">
              <p className="rounded-2xl bg-[var(--brand-cream)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                {config.scheduleLine1}
              </p>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
                >
                  <MessageCircle size={17} />
                  Preguntar por WhatsApp
                </a>
              ) : null}
              {config.googleMapsUrl ? (
                <a
                  href={config.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                >
                  <MapPin size={17} />
                  {config.locationButtonText}
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {faqItems.map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={item.question}
                  className="rounded-[1.45rem] border-2 border-[var(--brand-primary)]/15 bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.06)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]">
                      <Icon size={19} />
                    </span>
                    <div>
                      <h3 className="text-sm font-black uppercase leading-5 text-[var(--brand-primary)]">
                        {item.question}
                      </h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
