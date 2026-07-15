import Link from "next/link"
import type { ReactNode } from "react"
import { BRAND } from "@/lib/brand"
import { HOTEL_PUBLIC_THEME_STYLE } from "@/components/hotelPublicTheme"
import HotelHeader from "./HotelHeader"

// Layout premium compartido por las páginas públicas del hotel (landing,
// reservar, mi-reserva): header fijo (transparente sobre el hero, marfil al
// hacer scroll) + footer. Da un marco de 5★ consistente, con paleta champán
// fija (la personalización de colores del dueño aplica al menú, no aquí).
export default function HotelLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear()
  return (
    <div
      style={HOTEL_PUBLIC_THEME_STYLE}
      className="flex min-h-screen flex-col bg-[var(--brand-cream)] text-[var(--brand-ink)]"
    >
      <HotelHeader />

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
            <Link href="/hotel/reservar" className="font-semibold text-[var(--brand-primary-dark)] transition-colors hover:underline">
              Reservar en línea
            </Link>
            <p className="mt-1">
              <Link href="/hotel/mi-reserva" className="transition-colors hover:text-[var(--brand-primary)]">
                Consultar mi reserva
              </Link>
            </p>
          </div>
        </div>
        <div className="border-t border-black/5 py-5 text-center text-xs text-[var(--brand-ink-2)]">
          © {year} {BRAND.name}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
