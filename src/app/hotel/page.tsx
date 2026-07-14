"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BedDouble,
  CalendarCheck,
  Check,
  Clock,
  Compass,
  ConciergeBell,
  KeyRound,
  Mail,
  MapPin,
  PartyPopper,
  Phone,
  Quote,
  Sparkles,
  Star,
  UtensilsCrossed,
  Users,
  Waves,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { BRAND } from "@/lib/brand"

const EXPERIENCE = [
  { icon: MapPin, title: "Ubicación privilegiada", text: "En el corazón de Valencia, a minutos de todo." },
  { icon: UtensilsCrossed, title: "Gastronomía de autor", text: "Restaurante y desayuno buffet incluido." },
  { icon: Sparkles, title: "Confort 5 estrellas", text: "Habitaciones y suites impecables, atención al detalle." },
  { icon: ConciergeBell, title: "Atención personalizada", text: "Un equipo dedicado a que tu estadía sea perfecta." },
]

const SERVICE_ICONS: Record<string, LucideIcon> = {
  spa: Waves,
  tour: Compass,
  restaurante: UtensilsCrossed,
  otro: PartyPopper,
}

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
type RoomQuote = { total: number; averageRate: number }
type RoomType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  quote: RoomQuote
}
type Review = { guestName: string; rating: number; comment: string }
type ResortService = { id: string; name: string; kind: string; description: string; price: number }

function isoInDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const FACHADA = "/demo/lidotel/lidotel-fachada.jpg"

export default function HotelLandingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [types, setTypes] = useState<RoomType[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [ratingAvg, setRatingAvg] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [services, setServices] = useState<ResortService[]>([])
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

  useEffect(() => {
    fetch("/api/public/hotel/review", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setReviews(Array.isArray(d.reviews) ? d.reviews : [])
        setRatingAvg(d.summary?.average || 0)
        setRatingCount(d.summary?.count || 0)
      })
      .catch(() => setReviews([]))
  }, [])

  useEffect(() => {
    fetch("/api/public/hotel/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d.services) ? d.services : []))
      .catch(() => setServices([]))
  }, [])

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

      {/* ============ Experiencia ============ */}
      <section className="mx-auto max-w-6xl px-6 pt-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EXPERIENCE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="text-center sm:text-left">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <h3 className="mt-4 font-serif text-lg font-semibold text-[var(--brand-ink-3)]">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--brand-ink-2)]">{text}</p>
            </div>
          ))}
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

      {/* ============ Servicios y experiencias ============ */}
      {services.length > 0 && (
        <section className="border-y border-[var(--brand-primary)]/10 bg-[#0a0a0b]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="text-center">
              <p className="kicker">Experiencias</p>
              <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">Servicios del resort</h2>
              <p className="mx-auto mt-3 max-w-xl text-[var(--brand-ink-2)]">
                Spa, gastronomía, tours y eventos para completar tu estadía.
              </p>
              <hr className="hairline-gold mx-auto mt-6 w-24" />
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => {
                const Icon = SERVICE_ICONS[s.kind] || Sparkles
                return (
                  <article
                    key={s.id}
                    className="flex flex-col rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-7 transition-colors hover:border-[var(--brand-primary)]/45"
                  >
                    <Icon className="text-[var(--brand-primary)]" size={26} strokeWidth={1.5} />
                    <h3 className="mt-4 font-serif text-xl font-semibold text-[var(--brand-ink-3)]">{s.name}</h3>
                    {s.description && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--brand-ink-2)]">{s.description}</p>
                    )}
                    {s.price > 0 && (
                      <p className="mt-5 border-t border-white/5 pt-4 text-sm text-[var(--brand-ink-2)]">
                        Desde <span className="font-serif text-lg text-gold">{money(s.price)}</span>
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}

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

      {/* ============ Testimonios ============ */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <p className="kicker">Opiniones</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">Lo que dicen nuestros huéspedes</h2>
            {ratingCount > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-[var(--brand-primary)]">
                <span className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} fill={i < Math.round(ratingAvg) ? "currentColor" : "none"} strokeWidth={1.5} />
                  ))}
                </span>
                <span className="font-serif text-lg text-[var(--brand-ink-3)]">{ratingAvg.toFixed(1)}</span>
                <span className="text-sm text-[var(--brand-ink-2)]">· {ratingCount} opiniones</span>
              </div>
            )}
            <hr className="hairline-gold mx-auto mt-6 w-24" />
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-surface)] p-7"
              >
                <Quote className="text-[var(--brand-primary)]/50" size={26} />
                <blockquote className="mt-3 flex-1 text-[var(--brand-ink)]">“{r.comment}”</blockquote>
                <figcaption className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="font-serif text-lg text-[var(--brand-ink-3)]">{r.guestName}</span>
                  <span className="flex items-center gap-0.5 text-[var(--brand-primary)]">
                    {Array.from({ length: r.rating }).map((_, s) => (
                      <Star key={s} size={13} fill="currentColor" strokeWidth={0} />
                    ))}
                  </span>
                </figcaption>
              </figure>
            ))}
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
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15">
          <iframe
            title="Ubicación de Lidotel Valencia"
            src="https://maps.google.com/maps?q=Lidotel%20Valencia%20Avenida%204%20Valencia%20Carabobo%20Venezuela&z=15&output=embed"
            className="h-72 w-full grayscale-[0.3] contrast-110"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </main>
  )
}
