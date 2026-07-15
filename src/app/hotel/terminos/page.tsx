"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ScrollText } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { DEFAULT_HOTEL_TERMS } from "@/lib/hotelBooking"

// Términos y condiciones de la reserva, editables por el dueño desde
// "Página del hotel". Si el dueño no escribió nada, se muestra el estándar.
export default function HotelTerminosPage() {
  const [terms, setTerms] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/public/hotel", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTerms(String(d.termsText || "") || DEFAULT_HOTEL_TERMS))
      .catch(() => setTerms(DEFAULT_HOTEL_TERMS))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/hotel/reservar"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary-dark)]"
        >
          <ArrowLeft size={16} /> Volver a reservar
        </Link>
        <h1 className="mt-3 flex items-center gap-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">
          <ScrollText size={30} className="text-[var(--brand-primary)]" /> Términos y condiciones
        </h1>
        <p className="text-sm font-bold text-[var(--brand-ink-2)]">
          Condiciones de la reserva en {BRAND.name}.
        </p>

        {loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold">
            <Loader2 className="animate-spin" size={18} /> Cargando…
          </p>
        ) : (
          <div className="mt-6 whitespace-pre-line rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-6 leading-relaxed text-[var(--brand-ink)]">
            {terms}
          </div>
        )}
      </div>
    </main>
  )
}
