"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, KeyRound } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

export default function PortalHuespedPage() {
  return (
    <ModuleAccessGuard moduleKey="guestPortal" moduleName="Portal del huésped">
      <PortalHuespedContent />
    </ModuleAccessGuard>
  )
}

function PortalHuespedContent() {
  const [url, setUrl] = useState("/hotel/mi-reserva")
  useEffect(() => {
    if (typeof window !== "undefined") setUrl(`${window.location.origin}/hotel/mi-reserva`)
  }, [])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <KeyRound size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Portal del huésped</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">El huésped consulta su reserva en línea con su código y teléfono.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
          <p className="text-xs font-black uppercase text-[var(--brand-primary)]">Enlace del portal</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--brand-cream)] px-3 py-2 font-bold text-[var(--brand-ink-3)]">{url}</code>
            <a href="/hotel/mi-reserva" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)] bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]">
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
          <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/65">
            El huésped entra con el <b>código</b> de su reserva y su <b>teléfono</b>. Ve el estado y los datos de su
            estadía (solo lectura) y puede dejar una reseña tras el check-out. Para apagarlo, desactiva
            “Portal del huésped” en Configuración.
          </p>
        </div>
      </div>
    </main>
  )
}
