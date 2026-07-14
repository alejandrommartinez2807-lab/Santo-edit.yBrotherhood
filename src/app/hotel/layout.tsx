import Link from "next/link"
import type { ReactNode } from "react"
import { BRAND } from "@/lib/brand"

// Layout premium compartido por las páginas públicas del hotel (landing,
// reservar, mi-reserva): header translúcido con hairline dorado + footer.
// Da un marco de 5★ consistente y distinto al resto del template.
export default function HotelLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear()
  return (
    <div className="flex min-h-screen flex-col bg-[var(--brand-cream)] text-[var(--brand-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/hotel" className="flex items-center gap-3" aria-label={BRAND.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-11 w-11 rounded-lg bg-white object-contain p-1 shadow-sm"
            />
            <span className="hidden font-serif text-lg font-semibold tracking-wide text-[var(--brand-ink-3)] sm:inline">
              {BRAND.name}
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-[var(--brand-ink-2)]">
            <Link href="/hotel" className="hidden transition-colors hover:text-[var(--brand-primary)] sm:inline">
              Inicio
            </Link>
            <Link
              href="/hotel/mi-reserva"
              className="hidden transition-colors hover:text-[var(--brand-primary)] sm:inline"
            >
              Mi reserva
            </Link>
            <Link
              href="/hotel/reservar"
              className="rounded-full border border-[var(--brand-primary)]/60 px-4 py-1.5 text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-[#0b0b0c]"
            >
              Reservar
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[var(--brand-primary)]/20 bg-[var(--brand-surface-2)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          <div>
            <p className="font-serif text-lg font-semibold text-[var(--brand-ink-3)]">{BRAND.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--brand-ink-2)]">{BRAND.tagline}</p>
          </div>
          <div className="text-sm text-[var(--brand-ink-2)]">
            <p className="kicker mb-3">Contacto</p>
            <p className="leading-relaxed">{BRAND.location}</p>
            <p className="mt-1">@{BRAND.instagram}</p>
          </div>
          <div className="text-sm text-[var(--brand-ink-2)]">
            <p className="kicker mb-3">Reservas</p>
            <Link href="/hotel/reservar" className="text-[var(--brand-primary)] transition-colors hover:underline">
              Reservar en línea
            </Link>
            <p className="mt-1">
              <Link href="/hotel/mi-reserva" className="transition-colors hover:text-[var(--brand-primary)]">
                Consultar mi reserva
              </Link>
            </p>
          </div>
        </div>
        <div className="border-t border-black/5 py-5 text-center text-xs text-[var(--brand-ink-2)]/70">
          © {year} {BRAND.name}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
