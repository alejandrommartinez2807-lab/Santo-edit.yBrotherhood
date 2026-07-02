"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Camera, Clock, MapPin, MessageCircle, ShoppingCart } from "lucide-react"
import { BRAND } from "@/lib/brand"

type PublicFooterConfig = {
  businessName: string
  businessShortDescription: string
  scheduleTitle: string
  scheduleLine1: string
  scheduleLine2: string
  locationButtonText: string
  googleMapsUrl: string
  instagramUrl: string
  mainWhatsapp: string
  deliveryWhatsapp: string
}

const DEFAULT_CONFIG: PublicFooterConfig = {
  businessName: BRAND.name,
  businessShortDescription: BRAND.tagline,
  scheduleTitle: "Horario",
  scheduleLine1: "Horario disponible en el local",
  scheduleLine2: "",
  locationButtonText: "Ubicación",
  googleMapsUrl: "",
  instagramUrl: "",
  mainWhatsapp: "",
  deliveryWhatsapp: "",
}

function readText(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return fallback
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

function getConfigPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>
  const businessConfig = source.businessConfig

  return businessConfig && typeof businessConfig === "object"
    ? businessConfig as Record<string, unknown>
    : source
}

function normalizeConfig(value: unknown): PublicFooterConfig {
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
    locationButtonText: readText(source, ["locationButtonText", "mapsButtonText"], DEFAULT_CONFIG.locationButtonText),
    googleMapsUrl: normalizeExternalUrl(source.googleMapsUrl),
    instagramUrl: normalizeExternalUrl(source.instagramUrl),
    mainWhatsapp: normalizePhone(source.mainWhatsapp),
    deliveryWhatsapp: normalizePhone(source.deliveryWhatsapp),
  }
}

async function getPublicConfig() {
  const response = await fetch("/api/public/business-config", {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) throw new Error("No se pudo cargar la información pública")

  const data = await response.json()

  return normalizeConfig(data)
}

export default function PublicFooter() {
  const [config, setConfig] = useState<PublicFooterConfig>(DEFAULT_CONFIG)

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
  const scheduleText = [config.scheduleLine1, config.scheduleLine2].filter(Boolean).join(" · ")

  return (
    <footer id="contacto" className="bg-[var(--brand-primary)] px-4 pb-32 pt-10 text-white md:pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-[var(--brand-accent)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-[0_12px_0_rgba(0,0,0,0.18)]">
        <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,-16px_0] bg-[var(--brand-cream)]" />

        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] ring-4 ring-[var(--brand-accent)]">
              <Image
                src={BRAND.logoUrl || "/logoremovebg.png"}
                alt={config.businessName || BRAND.name}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 object-contain"
              />
            </div>
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                Gracias por visitar
              </p>
              <h2 className="mt-2 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] sm:text-4xl">
                {config.businessName || BRAND.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/72">
                {config.businessShortDescription || BRAND.tagline}
              </p>

              {scheduleText ? (
                <div className="mt-4 flex items-start gap-3 rounded-[1.1rem] border-2 border-[var(--brand-primary)]/15 bg-white px-4 py-3">
                  <Clock size={19} className="mt-0.5 shrink-0 text-[var(--brand-primary)]" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                      {config.scheduleTitle || "Horario"}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      {scheduleText}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <a
              href="#menu"
              className="flex items-center justify-between rounded-[1.15rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.20)]"
            >
              <span className="inline-flex items-center gap-2"><ShoppingCart size={19} /> Ver menú</span>
              <span>→</span>
            </a>

            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[1.15rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.14)]"
              >
                <span className="inline-flex items-center gap-2"><MessageCircle size={19} /> WhatsApp</span>
                <span>→</span>
              </a>
            ) : null}

            {config.googleMapsUrl ? (
              <a
                href={config.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[1.15rem] border-2 border-[var(--brand-primary)] bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.08)]"
              >
                <span className="inline-flex items-center gap-2"><MapPin size={19} /> {config.locationButtonText || "Ubicación"}</span>
                <span>→</span>
              </a>
            ) : null}

            {config.instagramUrl ? (
              <a
                href={config.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[1.15rem] border-2 border-[var(--brand-primary)]/20 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.08)]"
              >
                <span className="inline-flex items-center gap-2"><Camera size={19} /> Instagram</span>
                <span>→</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
