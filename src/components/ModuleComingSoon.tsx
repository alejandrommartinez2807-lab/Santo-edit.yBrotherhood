import Link from "next/link"
import { ArrowLeft, Clock } from "lucide-react"

// Placeholder compartido para los módulos "Próximamente" (comingSoon) del
// roadmap del hotel/resort. Reserva la ruta y explica qué hará el módulo, sin
// lógica todavía. Ver docs/ROADMAP-HOTEL-COMPLETO.md. Al construir la fase, se
// reemplaza esta página por la pantalla real y se apaga comingSoon.

export default function ModuleComingSoon({
  title,
  phase,
  description,
  bullets = [],
}: {
  title: string
  phase: string
  description: string
  bullets?: string[]
}) {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Clock size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">{title}</h1>
            <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
              {phase} · Próximamente
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5">
          <p className="font-bold text-[var(--brand-ink-2)]/80">{description}</p>
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {bullets.map((item) => (
                <li key={item} className="flex gap-2 text-sm font-bold text-[var(--brand-ink-2)]/65">
                  <span className="text-[var(--brand-primary)]">·</span> {item}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs font-bold text-[var(--brand-ink-2)]/45">
            Módulo reservado en la estructura. Plan detallado en
            docs/ROADMAP-HOTEL-COMPLETO.md.
          </p>
        </div>
      </div>
    </main>
  )
}
