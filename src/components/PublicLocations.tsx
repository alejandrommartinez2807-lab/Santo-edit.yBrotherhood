"use client"

import { useEffect, useState } from "react"
import { MapPin, MessageCircle, Navigation } from "lucide-react"
import { BRAND } from "@/lib/brand"

// "Nuestros locales": ubicación interactiva de cada sede (pedido del dueño
// 2026-07-21). Mapa embebido de Google + botón "Cómo llegar" + WhatsApp por
// sede. La dirección/zona/link se editan en Sucursales → Configuración por
// sede; sin dirección, el mapa busca el negocio por nombre y zona.

type PublicBranchLocation = {
  id: string
  name: string
  address: string
  zone: string
  googleMapsUrl: string
  whatsapp: string
}

function cleanText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeBranch(value: unknown): PublicBranchLocation | null {
  if (!value || typeof value !== "object") return null

  const source = value as Record<string, unknown>
  const config =
    source.config && typeof source.config === "object"
      ? (source.config as Record<string, unknown>)
      : {}
  const id = cleanText(source.id)
  const name = cleanText(source.publicName) || cleanText(source.name)

  if (!id || !name) return null

  return {
    id,
    name,
    address: cleanText(source.address) || cleanText(config.address),
    zone: cleanText(source.zone) || cleanText(config.zone),
    googleMapsUrl:
      cleanText(source.googleMapsUrl) || cleanText(config.googleMapsUrl),
    whatsapp: (cleanText(source.mainWhatsapp) || cleanText(config.mainWhatsapp))
      .replace(/[^0-9]/g, ""),
  }
}

// Consulta con la que Google encuentra el local: dirección exacta si existe;
// si no, el nombre del negocio + la zona/sede (suficiente para negocios con
// ficha en Google Maps).
function buildMapsQuery(branch: PublicBranchLocation) {
  if (branch.address) return `${branch.address}, Venezuela`

  const zoneOrName = branch.zone || branch.name
  return `${BRAND.name} ${zoneOrName === "Principal" ? "" : zoneOrName} Venezuela`
    .replace(/\s+/g, " ")
    .trim()
}

function buildDirectionsUrl(branch: PublicBranchLocation) {
  if (branch.googleMapsUrl) return branch.googleMapsUrl

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildMapsQuery(branch))}`
}

export default function PublicLocations() {
  const [branches, setBranches] = useState<PublicBranchLocation[]>([])

  useEffect(() => {
    let isMounted = true

    fetch("/api/public/branches", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted || !data?.ok) return

        const list = (Array.isArray(data.branches) ? (data.branches as unknown[]) : [])
          .map(normalizeBranch)
          .filter((branch): branch is PublicBranchLocation => Boolean(branch))

        setBranches(list)
      })
      .catch(() => {
        // Sin sedes cargadas la sección simplemente no se muestra.
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (branches.length === 0) return null

  return (
    <section
      id="ubicaciones"
      className="bg-[var(--brand-cream)] px-4 py-12 text-[var(--brand-ink-3)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.45)] bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
            <MapPin size={14} />
            Nuestros locales
          </p>
          <h2 className="font-display mt-4 text-4xl uppercase leading-[0.9] text-[var(--brand-ink-3)] sm:text-5xl">
            ¿Dónde estamos?
          </h2>
        </div>

        <div
          className={`mt-8 grid gap-5 ${branches.length > 1 ? "lg:grid-cols-2" : "lg:mx-auto lg:max-w-2xl"}`}
        >
          {branches.map((branch) => {
            const directionsUrl = buildDirectionsUrl(branch)
            const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(buildMapsQuery(branch))}&output=embed`

            return (
              <article
                key={branch.id}
                className="overflow-hidden rounded-[1.6rem] border border-[var(--brand-border)] bg-[var(--brand-surface)] transition hover:border-[rgba(var(--brand-primary-rgb),0.5)]"
              >
                {/* Mapa interactivo (se puede mover y hacer zoom) */}
                <iframe
                  src={embedUrl}
                  title={`Mapa de ${branch.name}`}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-52 w-full border-0 sm:h-60"
                />

                <div className="p-5">
                  <h3 className="font-display text-2xl uppercase leading-none text-[var(--brand-ink-3)]">
                    {branch.name}
                  </h3>

                  {branch.zone && branch.zone !== branch.name ? (
                    <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      {branch.zone}
                    </p>
                  ) : null}

                  {branch.address ? (
                    <p className="mt-2 text-sm font-medium leading-6 text-[var(--brand-ink-2)]">
                      {branch.address}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:bg-[var(--brand-accent)] active:scale-95"
                    >
                      <Navigation size={15} />
                      Cómo llegar
                    </a>

                    {branch.whatsapp ? (
                      <a
                        href={`https://wa.me/${branch.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-black/30 px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-95"
                      >
                        <MessageCircle size={15} />
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
