"use client"

// Header público del hotel: transparente sobre el hero de la landing (texto
// blanco) y se vuelve barra marfil translúcida al hacer scroll o en las demás
// páginas. Patrón clásico de sitios de hotel 5★.

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { BRAND } from "@/lib/brand"

export default function HotelHeader() {
  const pathname = usePathname()
  const overHero = pathname === "/hotel"
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const transparent = overHero && !scrolled

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          transparent
            ? "border-b border-transparent bg-transparent"
            : "border-b border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/90 shadow-[0_1px_12px_rgba(0,0,0,0.04)] backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/hotel" className="flex items-center gap-3" aria-label={BRAND.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-11 w-11 rounded-lg bg-white object-contain p-1 shadow-sm"
            />
            <span
              className={`hidden font-serif text-lg font-semibold tracking-wide transition-colors sm:inline ${
                transparent ? "text-white drop-shadow-sm" : "text-[var(--brand-ink-3)]"
              }`}
            >
              {BRAND.name}
            </span>
          </Link>
          <nav
            className={`flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
              transparent ? "text-white/85" : "text-[var(--brand-ink-2)]"
            }`}
          >
            <Link
              href="/hotel"
              className={`hidden transition-colors sm:inline ${
                transparent ? "hover:text-[#e6cf9a]" : "hover:text-[var(--brand-primary-dark)]"
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/hotel/mi-reserva"
              className={`hidden transition-colors sm:inline ${
                transparent ? "hover:text-[#e6cf9a]" : "hover:text-[var(--brand-primary-dark)]"
              }`}
            >
              Mi reserva
            </Link>
            <Link
              href="/hotel/reservar"
              className="rounded-full bg-[var(--brand-primary)] px-5 py-2.5 font-serif text-[11px] font-semibold uppercase tracking-[0.18em] text-[#171410] shadow-sm transition-transform hover:scale-[1.04]"
            >
              Reservar
            </Link>
          </nav>
        </div>
      </header>
      {/* Fuera de la landing el header es fijo: este separador evita que el
          contenido quede escondido debajo. En la landing el hero pasa por
          detrás del header transparente, que es el efecto buscado. */}
      {!overHero && <div className="h-[72px]" aria-hidden="true" />}
    </>
  )
}
