"use client"

import Link from "next/link"
import { Clock } from "lucide-react"
import { BRAND } from "@/lib/brand"

// Placeholder PÚBLICO (cara al huésped) para las páginas del hotel que aún no
// están construidas: landing, reservas online y portal del huésped. Reserva la
// URL pública con la marca. Ver docs/ROADMAP-HOTEL-COMPLETO.md. Se reemplaza por
// la pantalla real al construir la fase.

export default function PublicComingSoon({
  title,
  description,
  backHref = "/hotel",
  backLabel = "Volver",
}: {
  title: string
  description: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--brand-cream)] px-6 py-16 text-center text-[var(--brand-ink-2)]">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
        <Clock size={26} />
      </span>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
        {BRAND.name}
      </p>
      <h1 className="mt-2 text-3xl font-black uppercase text-[var(--brand-ink-3)] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
        Próximamente
      </p>
      <p className="mt-4 max-w-md font-bold text-[var(--brand-ink-2)]/70">{description}</p>
      <Link
        href={backHref}
        className="mt-8 inline-flex items-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
      >
        {backLabel}
      </Link>
    </main>
  )
}
