"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BedDouble,
  CalendarCheck,
  Check,
  Clock,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Star,
  Users,
} from "lucide-react"
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
type Quote = { total: number; averageRate: number }
type RoomType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  quote: Quote
}

function isoInDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const FACHADA = "/demo/lidotel/lidotel-fachada.jpg"

export default function HotelLandingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [types, setTypes] = useState<RoomType[]>([])
  const [loaded, setLoaded] = useState(false)

  // Rango de muestra (dentro de una semana, 2 noches) para cotizar "desde".
  const sample = useMemo(() => ({ checkIn: isoInDays(7), checkOut: isoInDays(9) }), [])

  useEffect(() => {
    fetch("/api/public/hotel/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProfile(d.enabled ? d.profile : null))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    fetch(`/api/public/hotel?checkIn=${sample.checkIn}&checkOut=${sample.checkOut}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTypes(Array.isArray(d.types) ? d.types : []))
      .catch(() => setTypes([]))
  }, [sample])

  const amenities = (profile?.amenities || "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)

  const money = (n: number) =>
    new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  return (
    <main>
      {/* ============ HERO a sangre ============ */}
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FACHADA}
          alt={BRAND.name}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/60 to-[var(--brand-cream)]" />
        <div className="mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
          <p className="kicker">Hotel 5 estrellas · Valencia</p>
          <div className="mt-4 flex items-center gap-1 text-[var(--brand-primary)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={18} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <h1 className="mt-6 font-serif text-5xl font-semibold leading-[1.05] text-white sm:text-6xl md:text-7xl">
            {profile?.headline || BRAND.name}
          </h1>
          {profile?.about && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{profile.about}</p>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/hotel/reservar"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-[#0b0b0c] shadow-lg shadow-black/40 transition-transform hover:scale-[1.03]"
            >
              <CalendarCheck size={18} /> Reservar ahora
            </Link>
            <Link
              href="/hotel/mi-reserva"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur-sm transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              <KeyRound size={18} /> Mi reserva
            </Link>
          </div>
        </div>
      </section>

      {/* ============ Habitaciones ============ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <p className="kicker">Alojamiento</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">
            Habitaciones y suites
          </h2>
          <hr className="hairline-gold mx-auto mt-6 w-24" />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <article
              key={t.roomTypeId}
              className="group flex flex-col rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-7 transition-colors hover:border-[var(--brand-primary)]/45"
            >
              <BedDouble className="text-[var(--brand-primary)]" size={26} strokeWidth={1.5} />
              <h3 className="mt-4 font-serif text-2xl font-semibold text-[var(--brand-ink-3)]">{t.name}</h3>
              {t.description && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--brand-ink-2)]">{t.description}</p>
              )}
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--brand-ink-2)]">
                <Users size={15} /> Hasta {t.capacity} {t.capacity === 1 ? "huésped" : "huéspedes"}
              </p>
              <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--brand-ink-2)]/70">Desde</p>
                  <p className="font-serif text-2xl font-semibold text-gold">
                    {money(t.quote.averageRate)}
                    <span className="ml-1 text-sm font-normal text-[var(--brand-ink-2)]">/ noche</span>
                  </p>
                </div>
                <Link
                  href="/hotel/reservar"
                  className="rounded-full border border-[var(--brand-primary)]/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-[#0b0b0c]"
                >
                  Reservar
                </Link>
              </div>
            </article>
          ))}
          {types.length === 0 && loaded && (
            <p className="col-span-full text-center text-[var(--brand-ink-2)]/70">
              Escríbenos para conocer nuestra disponibilidad.
            </p>
          )}
        </div>
      </section>

      {/* ============ Amenidades ============ */}
      {amenities.length > 0 && (
        <section className="border-y border-[var(--brand-primary)]/10 bg-[#0a0a0b]">
          <div className="mx-auto max-w-5xl px-6 py-16 text-center">
            <p className="kicker">Servicios</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">Todo incluido para tu estadía</h2>
            <ul className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
              {amenities.map((a) => (
                <li key={a} className="flex items-center gap-3 text-[var(--brand-ink)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]">
                    <Check size={15} strokeWidth={2.5} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============ Contacto / horarios ============ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-8">
            <p className="kicker inline-flex items-center gap-2">
              <Clock size={14} /> Horarios
            </p>
            <div className="mt-4 space-y-2 text-[var(--brand-ink)]">
              <p className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[var(--brand-ink-2)]">Check-in</span>
                <span className="font-serif text-xl">{profile?.checkinTime || "15:00"}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-[var(--brand-ink-2)]">Check-out</span>
                <span className="font-serif text-xl">{profile?.checkoutTime || "12:00"}</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-8">
            <p className="kicker">Contacto</p>
            <div className="mt-4 space-y-3 text-[var(--brand-ink)]">
              {profile?.address && (
                <p className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--brand-primary)]" /> {profile.address}
                </p>
              )}
              {profile?.phone && (
                <p className="flex items-center gap-3">
                  <Phone size={16} className="shrink-0 text-[var(--brand-primary)]" /> {profile.phone}
                </p>
              )}
              {profile?.email && (
                <p className="flex items-center gap-3">
                  <Mail size={16} className="shrink-0 text-[var(--brand-primary)]" /> {profile.email}
                </p>
              )}
              {!profile?.address && !profile?.phone && !profile?.email && loaded && (
                <p className="text-[var(--brand-ink-2)]/70">Escríbenos para reservar.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
