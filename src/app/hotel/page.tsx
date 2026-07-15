"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Car,
  ChevronDown,
  Clock,
  Coffee,
  Compass,
  ConciergeBell,
  Dumbbell,
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
  Wifi,
  Wind,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { BRAND } from "@/lib/brand"
import PhotoLightbox from "./PhotoLightbox"

const HERO = "/demo/lidotel/lidotel-hero.png"

const EXPERIENCE = [
  { icon: MapPin, title: "Ubicación privilegiada", text: "En el corazón de Valencia, a minutos de todo." },
  { icon: UtensilsCrossed, title: "Gastronomía de autor", text: "Restaurante y desayuno buffet incluido." },
  { icon: Sparkles, title: "Confort 5 estrellas", text: "Habitaciones y suites impecables, atención al detalle." },
  { icon: ConciergeBell, title: "Atención personalizada", text: "Un equipo dedicado a que tu estadía sea perfecta." },
]

const HALLMARKS = ["5 Estrellas", "Habitaciones & Suites", "Restaurante Gourmet", "Spa & Bienestar"]

const SERVICE_ICONS: Record<string, LucideIcon> = {
  spa: Waves,
  tour: Compass,
  restaurante: UtensilsCrossed,
  otro: PartyPopper,
}

// Icono elegante por amenidad (por palabra clave).
function amenityIcon(a: string): LucideIcon {
  const s = a.toLowerCase()
  if (s.includes("wifi") || s.includes("wi-fi")) return Wifi
  if (s.includes("desayuno")) return Coffee
  if (s.includes("estacion") || s.includes("parking")) return Car
  if (s.includes("piscina")) return Waves
  if (s.includes("gim")) return Dumbbell
  if (s.includes("restaur")) return UtensilsCrossed
  if (s.includes("evento") || s.includes("salón") || s.includes("salon")) return PartyPopper
  if (s.includes("aire") || s.includes("a/c") || s.includes("clima")) return Wind
  return Sparkles
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
type RoomTypePhoto = { url: string; caption: string }
type RoomType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  photos?: RoomTypePhoto[]
  quote: RoomQuote
}
type Review = { guestName: string; rating: number; comment: string }
type ResortService = { id: string; name: string; kind: string; description: string; price: number }

function isoInDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function HotelLandingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [types, setTypes] = useState<RoomType[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [ratingAvg, setRatingAvg] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [services, setServices] = useState<ResortService[]>([])
  const [loaded, setLoaded] = useState(false)

  // Lightbox: lista de fotos activa + índice inicial (null = cerrado).
  const [lightbox, setLightbox] = useState<{ photos: RoomTypePhoto[]; index: number } | null>(null)

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

  // Galería: mezcla las fotos de todos los tipos (sin repetir la portada dos
  // veces seguidas del mismo tipo) y muestra hasta 8.
  const galleryPhotos = useMemo(() => {
    const photos: { url: string; caption: string }[] = []
    const seen = new Set<string>()
    for (const t of types) {
      for (const photo of t.photos || []) {
        if (seen.has(photo.url)) continue
        seen.add(photo.url)
        photos.push({ url: photo.url, caption: photo.caption || t.name })
      }
    }
    return photos.slice(0, 8)
  }, [types])

  return (
    <main>
      {/* ==================== HERO cinematográfico ==================== */}
      <section className="relative isolate min-h-[92vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt={BRAND.name} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/50 to-black/45" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-[var(--brand-cream)] to-transparent" />

        <div className="mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-6 py-28 text-center">
          <div className="flex items-center gap-1.5 text-[var(--brand-primary)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <p className="mt-5 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-[#e6cf9a]">
            Hotel 5 estrellas · Valencia
          </p>
          <h1 className="mt-5 font-serif text-6xl font-semibold leading-[1] text-white drop-shadow-lg sm:text-7xl md:text-8xl">
            {profile?.headline || BRAND.name}
          </h1>
          <div className="mx-auto mt-7 h-px w-28 bg-gradient-to-r from-transparent via-[var(--brand-primary)] to-transparent" />
          {profile?.about && (
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white drop-shadow-[0_1px_12px_rgba(0,0,0,0.55)]">{profile.about}</p>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/hotel/reservar"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--brand-primary)] px-10 py-4 font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-[#171410] shadow-xl shadow-black/40 transition-transform hover:scale-[1.03]"
            >
              <CalendarCheck size={17} /> Reservar ahora
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/hotel/mi-reserva"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-black/30 px-10 py-4 font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md transition-colors hover:border-[#e6cf9a] hover:text-[#e6cf9a]"
            >
              <KeyRound size={18} /> Mi reserva
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center text-[var(--brand-primary-dark)]">
          <ChevronDown size={26} className="animate-bounce" />
        </div>
      </section>

      {/* ==================== Franja de sellos ==================== */}
      <div className="border-y border-[var(--brand-primary)]/15 bg-[var(--brand-surface-2)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6">
          {HALLMARKS.map((h, i) => (
            <span key={h} className="flex items-center gap-10">
              {i > 0 && <span className="hidden h-1 w-1 rounded-full bg-[var(--brand-primary)]/60 sm:block" />}
              <span className="font-serif text-[1.05rem] italic text-[var(--brand-ink)]">{h}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ==================== Experiencia ==================== */}
      <section className="mx-auto max-w-6xl px-6 pt-20">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {EXPERIENCE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="text-center sm:text-left">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Icon size={24} strokeWidth={1.5} />
              </span>
              <h3 className="mt-5 font-serif text-xl font-semibold text-[var(--brand-ink-3)]">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--brand-ink-2)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== Habitaciones ==================== */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <p className="kicker">Alojamiento</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">
            Habitaciones y suites
          </h2>
          <hr className="hairline-gold mx-auto mt-6 w-24" />
        </div>

        <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t, i) => (
            <article
              key={t.roomTypeId}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-primary)]/40 hover:shadow-2xl hover:shadow-black/10"
            >
              {/* Filete dorado superior, discreto */}
              <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/60 to-transparent" />

              {t.photos && t.photos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLightbox({ photos: t.photos!, index: 0 })}
                  aria-label={`Ver fotos de ${t.name}`}
                  className="relative block h-52 w-full cursor-zoom-in overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.photos[0].url}
                    alt={t.photos[0].caption || t.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {t.photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                      {t.photos.length} fotos
                    </span>
                  )}
                </button>
              )}

              <div className="flex flex-1 flex-col p-9">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.35em] text-[var(--brand-primary-dark)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <BedDouble className="text-[var(--brand-primary)]/70" size={22} strokeWidth={1.25} />
                </div>
                <h3 className="mt-6 font-serif text-[1.75rem] font-medium leading-tight text-[var(--brand-ink-3)]">{t.name}</h3>
                {t.description && (
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--brand-ink-2)]">{t.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--brand-ink-2)]">
                    <Users size={13} /> Hasta {t.capacity}
                  </span>
                  {t.freeCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/40 px-3 py-1 text-xs font-medium text-[var(--brand-primary-dark)]">
                      Disponible
                    </span>
                  )}
                </div>
                <div className="mt-6 flex items-end justify-between border-t border-black/5 pt-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-ink-2)]">Desde</p>
                    <p className="mt-1 font-serif text-4xl font-semibold leading-none text-gold">
                      <span className="mr-0.5 align-top text-lg">$</span>
                      {Math.round(t.quote.averageRate)}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-ink-2)]">
                      USD · por noche
                    </p>
                  </div>
                  <Link
                    href="/hotel/reservar"
                    className="group/btn inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/50 px-5 py-2.5 font-serif text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-dark)] transition-colors hover:bg-[var(--brand-primary)] hover:text-[#0b0b0c]"
                  >
                    Reservar
                    <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
          {types.length === 0 && loaded && (
            <p className="col-span-full text-center text-[var(--brand-ink-2)]">
              Escríbenos para conocer nuestra disponibilidad.
            </p>
          )}
        </div>
      </section>

      {/* ==================== Galería ==================== */}
      {galleryPhotos.length >= 3 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="text-center">
            <p className="kicker">Galería</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">
              Un vistazo al hotel
            </h2>
            <hr className="hairline-gold mx-auto mt-6 w-24" />
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {galleryPhotos.map((photo, i) => (
              <figure
                key={photo.url}
                onClick={() => setLightbox({ photos: galleryPhotos, index: i })}
                className={`group relative cursor-zoom-in overflow-hidden rounded-xl border border-[var(--brand-border)] ${
                  i % 4 === 0 ? "row-span-2 h-full min-h-64" : "h-40 sm:h-48"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {photo.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {photo.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ==================== Banda de invitación (parallax) ==================== */}
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto max-w-3xl px-6 py-28 text-center">
          <Sparkles className="mx-auto text-[var(--brand-primary)]" size={28} />
          <p className="mt-6 font-serif text-3xl font-medium italic leading-snug text-white sm:text-4xl">
            “Una experiencia inolvidable en el corazón de Valencia.”
          </p>
          <Link
            href="/hotel/reservar"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-9 py-4 font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-[#171410] transition-transform hover:scale-[1.03]"
          >
            <CalendarCheck size={18} /> Reservar mi estadía
          </Link>
        </div>
      </section>

      {/* ==================== Servicios del resort ==================== */}
      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="kicker">Experiencias</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">Servicios del resort</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--brand-ink-2)]">
              Spa, gastronomía, tours y eventos para completar tu estadía.
            </p>
            <hr className="hairline-gold mx-auto mt-6 w-24" />
          </div>
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = SERVICE_ICONS[s.kind] || Sparkles
              return (
                <article
                  key={s.id}
                  className="group flex flex-col rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-primary)]/40"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <Icon size={24} strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-5 font-serif text-xl font-semibold text-[var(--brand-ink-3)]">{s.name}</h3>
                  {s.description && (
                    <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--brand-ink-2)]">{s.description}</p>
                  )}
                  {s.price > 0 && (
                    <div className="mt-5 flex items-baseline justify-between border-t border-black/5 pt-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-ink-2)]">Desde</span>
                      <span className="font-serif text-2xl font-semibold leading-none text-gold">
                        <span className="mr-0.5 align-top text-sm">$</span>
                        {Math.round(s.price)}
                      </span>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* ==================== Amenidades (grid de iconos) ==================== */}
      {amenities.length > 0 && (
        <section className="border-y border-[var(--brand-primary)]/10 bg-[var(--brand-surface-2)]">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center">
            <p className="kicker">Servicios incluidos</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">Todo para tu confort</h2>
            <hr className="hairline-gold mx-auto mt-6 w-24" />
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {amenities.map((a) => {
                const Icon = amenityIcon(a)
                return (
                  <div
                    key={a}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 transition-colors hover:border-[var(--brand-primary)]/40"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]">
                      <Icon size={22} strokeWidth={1.5} />
                    </span>
                    <span className="text-sm font-medium text-[var(--brand-ink)]">{a}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================== Testimonios ==================== */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="kicker">Opiniones</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">Lo que dicen nuestros huéspedes</h2>
            {ratingCount > 0 && (
              <div className="mt-5 flex items-center justify-center gap-2 text-[var(--brand-primary)]">
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
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8"
              >
                <Quote className="text-[var(--brand-primary)]/50" size={30} />
                <blockquote className="mt-4 flex-1 leading-relaxed text-[var(--brand-ink)]">“{r.comment}”</blockquote>
                <figcaption className="mt-6 flex items-center justify-between border-t border-black/5 pt-5">
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

      {/* ==================== Contacto / horarios / mapa ==================== */}
      <section className="border-t border-[var(--brand-primary)]/10 bg-[var(--brand-surface-2)]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="text-center">
            <p className="kicker">Visítanos</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">Ubicación y contacto</h2>
            <hr className="hairline-gold mx-auto mt-6 w-24" />
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8">
              <p className="kicker inline-flex items-center gap-2">
                <Clock size={14} /> Horarios
              </p>
              <div className="mt-4 space-y-2 text-[var(--brand-ink)]">
                <p className="flex items-center justify-between border-b border-black/10 pb-2">
                  <span className="text-[var(--brand-ink-2)]">Check-in</span>
                  <span className="font-serif text-xl">{profile?.checkinTime || "15:00"}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-[var(--brand-ink-2)]">Check-out</span>
                  <span className="font-serif text-xl">{profile?.checkoutTime || "12:00"}</span>
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8">
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
                  <p className="text-[var(--brand-ink-2)]">Escríbenos para reservar.</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15">
            <iframe
              title="Ubicación de Lidotel Valencia"
              src="https://maps.google.com/maps?q=Lidotel%20Valencia%20Avenida%204%20Valencia%20Carabobo%20Venezuela&z=15&output=embed"
              className="h-80 w-full grayscale-[0.3] contrast-110"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* ==================== CTA final ==================== */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="kicker">Tu próxima estadía</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)] sm:text-5xl">
          Reserva en <span className="text-gold">{BRAND.name}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--brand-ink-2)]">
          Confirma tu habitación en segundos. Mejor tarifa garantizada al reservar directo.
        </p>
        <Link
          href="/hotel/reservar"
          className="group mt-9 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-10 py-4 font-serif text-[13px] font-semibold uppercase tracking-[0.22em] text-[#171410] shadow-lg shadow-black/10 transition-transform hover:scale-[1.03]"
        >
          <CalendarCheck size={18} /> Reservar ahora
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* ==================== Lightbox de fotos ==================== */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </main>
  )
}
