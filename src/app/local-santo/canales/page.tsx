"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Radio } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

export default function CanalesPage() {
  return (
    <ModuleAccessGuard moduleKey="channelManager" moduleName="Canales / OTAs">
      <CanalesContent />
    </ModuleAccessGuard>
  )
}

function CanalesContent() {
  const [url, setUrl] = useState("/api/public/hotel/ical")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setUrl(`${window.location.origin}/api/public/hotel/ical`)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Radio size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Canales / OTAs</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Comparte tu disponibilidad con Booking, Airbnb y otras por iCal.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
          <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Enlace iCal de disponibilidad</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--brand-cream)] px-3 py-2 font-bold text-[var(--brand-ink-3)]">{url}</code>
            <button onClick={copy} className="rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]">
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
            <a href="/api/public/hotel/ical" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]">
              <ExternalLink size={14} /> Ver
            </a>
          </div>
          <div className="mt-4 text-sm font-bold text-[var(--brand-ink-2)]/70">
            <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Cómo usarlo</p>
            <p className="mt-1">· En Booking/Airbnb, en “Calendarios → Importar calendario / iCal”, pega este enlace.</p>
            <p>· El canal verá como <b>ocupadas</b> las fechas ya reservadas aquí y evitará el overbooking.</p>
            <p className="mt-1 text-[var(--brand-ink-2)]/55">El enlace se actualiza solo; no expone datos privados, solo fechas ocupadas.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
