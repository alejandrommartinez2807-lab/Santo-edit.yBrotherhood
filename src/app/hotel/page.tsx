"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BedDouble, CalendarCheck, KeyRound, MapPin, Phone } from "lucide-react"
import { BRAND } from "@/lib/brand"

type Profile = {
  headline: string
  about: string
  amenities: string
  address: string
  phone: string
  email: string
  checkinTime: string
  checkoutTime: string
}

// Landing pública del hotel (Fase 11). Renderiza el contenido editable + CTAs.
export default function HotelLandingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/public/hotel/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProfile(d.enabled ? d.profile : null))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true))
  }, [])

  const amenities = (profile?.amenities || "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] text-[var(--brand-ink-2)]">
      {/* Hero */}
      <section className="px-6 py-16 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">{BRAND.name}</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-black uppercase text-[var(--brand-ink-3)]">
          {profile?.headline || "Bienvenido"}
        </h1>
        {profile?.about && (
          <p className="mx-auto mt-4 max-w-xl font-bold text-[var(--brand-ink-2)]/70">{profile.about}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/hotel/reservar" className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-3 text-sm font-black uppercase text-white">
            <CalendarCheck size={18} /> Reservar
          </Link>
          <Link href="/hotel/mi-reserva" className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-6 py-3 text-sm font-black uppercase text-[var(--brand-primary)]">
            <KeyRound size={18} /> Mi reserva
          </Link>
        </div>
      </section>

      {/* Amenidades */}
      {amenities.length > 0 && (
        <section className="px-6 pb-10">
          <div className="mx-auto max-w-2xl">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
              <BedDouble size={16} /> Amenidades
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {amenities.map((a) => (
                <li key={a} className="rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-sm font-bold text-[var(--brand-ink-3)]">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Info */}
      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 font-bold">
            <p className="text-xs font-black uppercase text-[var(--brand-primary)]">Horarios</p>
            <p className="mt-1">Check-in: {profile?.checkinTime || "15:00"}</p>
            <p>Check-out: {profile?.checkoutTime || "12:00"}</p>
          </div>
          <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 font-bold">
            <p className="text-xs font-black uppercase text-[var(--brand-primary)]">Contacto</p>
            {profile?.address && <p className="mt-1 inline-flex items-center gap-1"><MapPin size={14} /> {profile.address}</p>}
            {profile?.phone && <p className="inline-flex items-center gap-1"><Phone size={14} /> {profile.phone}</p>}
            {profile?.email && <p className="text-[var(--brand-ink-2)]/70">{profile.email}</p>}
            {!profile?.address && !profile?.phone && !profile?.email && loaded && (
              <p className="mt-1 text-[var(--brand-ink-2)]/55">Escríbenos para reservar.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
