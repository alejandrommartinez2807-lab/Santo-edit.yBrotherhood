"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Compass,
  ConciergeBell,
  Dumbbell,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
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

// Portada optimizada: webp liviano para escritorio y un recorte VERTICAL para
// teléfonos (el png original pesaba 3 MB y en móvil se estiraba borroso).
const HERO = "/demo/lidotel/lidotel-hero.webp"
const HERO_MOBILE = "/demo/lidotel/lidotel-hero-movil.webp"

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
type SiteExtras = {
  heroUrl: string
  tagline: string
  stars: number
  hallmarks: string
  quote: string
  mapsQuery: string
  whatsapp: string
  instagram: string
  facebook: string
  tiktok: string
  googleReviewsCount?: number
  googleReviewsRating?: number
  googleReviewsUrl?: string
}
type RoomQuote = { total: number; averageRate: number }
type RoomTypePhoto = { url: string; caption: string }
type RoomTypeDetails = { beds: string; sizeM2: string; view: string; amenities: string }
type RoomType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  photos?: RoomTypePhoto[]
  details?: RoomTypeDetails | null
  quote: RoomQuote
}
type Review = { guestName: string; rating: number; comment: string }
type ResortService = {
  id: string
  name: string
  kind: string
  description: string
  price: number
  imageUrl?: string
}

// Formulario de reserva de servicio (se abre bajo la tarjeta elegida).
type ServiceBookingForm = {
  serviceId: string
  date: string
  time: string
  people: string
  hasCode: boolean
  code: string
  guestName: string
  guestPhone: string
}

type ServiceBookingDone = {
  serviceId: string
  message: string
}

function isoInDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function HotelLandingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [extras, setExtras] = useState<SiteExtras | null>(null)
  const [types, setTypes] = useState<RoomType[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [ratingAvg, setRatingAvg] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [services, setServices] = useState<ResortService[]>([])
  const [loaded, setLoaded] = useState(false)

  // Reserva de servicio desde la landing (spa, tour…): un formulario a la vez.
  const [svcForm, setSvcForm] = useState<ServiceBookingForm | null>(null)
  const [svcBusy, setSvcBusy] = useState(false)
  const [svcError, setSvcError] = useState("")
  const [svcDone, setSvcDone] = useState<ServiceBookingDone | null>(null)

  // El botón flotante de WhatsApp aparece solo cuando el visitante ya bajó un
  // poco (no encima de la portada) y se esconde al volver arriba.
  const [showWhatsappFloat, setShowWhatsappFloat] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowWhatsappFloat(window.scrollY > 320)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Lightbox: lista de fotos activa + índice inicial (null = cerrado).
  const [lightbox, setLightbox] = useState<{ photos: RoomTypePhoto[]; index: number } | null>(null)

  // Rango de muestra (dentro de una semana, 2 noches) para cotizar "desde".
  const sample = useMemo(() => ({ checkIn: isoInDays(7), checkOut: isoInDays(9) }), [])

  useEffect(() => {
    fetch("/api/public/hotel/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.enabled ? d.profile : null)
        setExtras(d.enabled && d.extras ? d.extras : null)
      })
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

  function openServiceForm(serviceId: string) {
    setSvcError("")
    setSvcDone(null)
    setSvcForm((current) =>
      current?.serviceId === serviceId
        ? null
        : {
            serviceId,
            date: isoInDays(1),
            time: "",
            people: "2",
            hasCode: false,
            code: "",
            guestName: "",
            guestPhone: "",
          },
    )
  }

  function setSvc<K extends keyof ServiceBookingForm>(key: K, value: ServiceBookingForm[K]) {
    setSvcForm((current) => (current ? { ...current, [key]: value } : current))
    setSvcError("")
  }

  const svcFormValid = Boolean(
    svcForm &&
      svcForm.date &&
      (svcForm.hasCode
        ? svcForm.code.trim().length >= 3 && svcForm.guestPhone.trim().length >= 4
        : svcForm.guestName.trim().length >= 3 && svcForm.guestPhone.trim().length >= 7),
  )

  async function submitServiceBooking() {
    if (!svcForm || !svcFormValid) return
    setSvcBusy(true)
    setSvcError("")
    try {
      const res = await fetch("/api/public/hotel/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: svcForm.serviceId,
          date: svcForm.date,
          time: svcForm.time,
          people: Number(svcForm.people) || 1,
          code: svcForm.hasCode ? svcForm.code.trim() : "",
          guestName: svcForm.guestName.trim(),
          guestPhone: svcForm.guestPhone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo reservar")
      const booking = data.booking || {}
      setSvcDone({
        serviceId: svcForm.serviceId,
        message: booking.linkedToReservation
          ? `¡Listo! ${booking.serviceName} quedó reservado para el ${booking.date} y asociado a tu reserva #${booking.reservationCode}. Se carga a tu cuenta al llegar.`
          : `¡Listo! ${booking.serviceName} quedó reservado para el ${booking.date}. Te contactaremos para confirmarte.`,
      })
      setSvcForm(null)
    } catch (e) {
      setSvcError(e instanceof Error ? e.message : "Error")
    } finally {
      setSvcBusy(false)
    }
  }

  const amenities = (profile?.amenities || "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean)

  // Contenido editable de la landing con defaults del template: el dueño lo
  // cambia desde Panel → Página del hotel sin tocar código.
  const heroUrl = extras?.heroUrl || HERO
  const tagline = extras?.tagline || BRAND.tagline
  const starCount = extras ? extras.stars : 5
  const hallmarks = (extras?.hallmarks || "")
    .split(/[,\n]/)
    .map((h) => h.trim())
    .filter(Boolean)
  const hallmarkList = hallmarks.length > 0 ? hallmarks.slice(0, 6) : HALLMARKS
  const bandQuote = extras?.quote || "Una experiencia inolvidable en el corazón de Valencia."
  const mapsQuery =
    extras?.mapsQuery ||
    profile?.address ||
    "Lidotel Valencia Avenida 4 Valencia Carabobo Venezuela"
  const whatsappDigits = (extras?.whatsapp || "").replace(/\D+/g, "")
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Hola, quiero información para reservar")}`
    : ""
  const socialLinks = [
    extras?.instagram
      ? { label: "Instagram", url: `https://instagram.com/${extras.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}` }
      : null,
    extras?.facebook
      ? { label: "Facebook", url: /^https?:\/\//.test(extras.facebook) ? extras.facebook : `https://facebook.com/${extras.facebook}` }
      : null,
    extras?.tiktok
      ? { label: "TikTok", url: `https://tiktok.com/@${extras.tiktok.replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, "")}` }
      : null,
  ].filter((s): s is { label: string; url: string } => Boolean(s))

  // Reseñas mostradas: el rating/total de la ficha de Google manda si el dueño
  // lo configuró; si no, se usan los datos internos del sistema.
  const displayRating = extras?.googleReviewsRating || ratingAvg
  const displayReviewCount = extras?.googleReviewsCount || ratingCount

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
      {/* En el teléfono la portada cubre la PANTALLA COMPLETA al entrar
          (100svh): la franja de sellos queda debajo del pliegue, sin asomarse. */}
      <section className="relative isolate min-h-[100svh] overflow-hidden sm:min-h-[92vh]">
        {extras?.heroUrl ? (
          // Portada personalizada por el dueño: una sola imagen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={extras.heroUrl}
            alt={BRAND.name}
            fetchPriority="high"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : (
          // Portada de fábrica por pantalla: el teléfono recibe el render
          // VERTICAL con el letrero LIDOTEL; object-[center_30%] lo mantiene
          // encuadrado cuando el recorte es vertical.
          <picture>
            <source media="(max-width: 640px)" srcSet={HERO_MOBILE} />
            { }
            <img
              src={HERO}
              alt={BRAND.name}
              fetchPriority="high"
              className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_30%] sm:object-center"
            />
          </picture>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/55 sm:via-black/50 sm:to-black/45" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-[var(--brand-cream)] to-transparent" />

        <div className="mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center sm:min-h-[92vh] sm:py-28">
          {starCount > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--brand-primary)] drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
              {Array.from({ length: starCount }).map((_, i) => (
                <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
          )}
          <p className="mt-5 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-[#e6cf9a] drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
            {tagline}
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
          {hallmarkList.map((h, i) => (
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
                  {t.details?.beds && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--brand-ink-2)]">
                      <BedDouble size={13} /> {t.details.beds}
                    </span>
                  )}
                  {t.details?.sizeM2 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--brand-ink-2)]">
                      {t.details.sizeM2} m²
                    </span>
                  )}
                  {t.details?.view && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--brand-ink-2)]">
                      <Compass size={13} /> {t.details.view}
                    </span>
                  )}
                  {t.freeCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/40 px-3 py-1 text-xs font-medium text-[var(--brand-primary-dark)]">
                      Disponible
                    </span>
                  )}
                </div>
                {(t.details?.amenities || "").trim() && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {(t.details?.amenities || "")
                      .split(/[,\n]/)
                      .map((a) => a.trim())
                      .filter(Boolean)
                      .slice(0, 6)
                      .map((a) => {
                        const Icon = amenityIcon(a)
                        return (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--brand-ink-2)]"
                          >
                            <Icon size={13} className="text-[var(--brand-primary)]" /> {a}
                          </span>
                        )
                      })}
                  </div>
                )}
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
        <img src={heroUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto max-w-3xl px-6 py-28 text-center">
          <Sparkles className="mx-auto text-[var(--brand-primary)]" size={28} />
          <p className="mt-6 font-serif text-3xl font-medium italic leading-snug text-white sm:text-4xl">
            “{bandQuote}”
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
              const isFormOpen = svcForm?.serviceId === s.id
              const isDone = svcDone?.serviceId === s.id
              return (
                <article
                  key={s.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-primary)]/40"
                >
                  {s.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      loading="lazy"
                      className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-8">
                    {!s.imageUrl && (
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                        <Icon size={24} strokeWidth={1.5} />
                      </span>
                    )}
                    <h3 className={`font-serif text-xl font-semibold text-[var(--brand-ink-3)] ${s.imageUrl ? "" : "mt-5"}`}>
                      {s.name}
                    </h3>
                    {s.description && (
                      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--brand-ink-2)]">{s.description}</p>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
                      {s.price > 0 ? (
                        <span>
                          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-ink-2)]">Desde</span>
                          <span className="font-serif text-2xl font-semibold leading-none text-gold">
                            <span className="mr-0.5 align-top text-sm">$</span>
                            {Math.round(s.price)}
                          </span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => openServiceForm(s.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/50 px-5 py-2.5 font-serif text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-dark)] transition-colors hover:bg-[var(--brand-primary)] hover:text-[#0b0b0c]"
                      >
                        {isFormOpen ? "Cerrar" : "Reservar"}
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {isDone && (
                      <p className="mt-4 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-green-900">
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {svcDone.message}
                      </p>
                    )}

                    {/* Reserva del servicio sin salir de la página: con el
                        código de la estadía queda asociada a la cuenta del
                        huésped; sin código, a su nombre y teléfono. */}
                    {isFormOpen && svcForm && (
                      <div className="mt-4 grid gap-2 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-surface-2)] p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink-2)]">Fecha</span>
                            <input
                              type="date"
                              value={svcForm.date}
                              min={isoInDays(0)}
                              onChange={(e) => setSvc("date", e.target.value)}
                              className="w-full bg-transparent text-sm font-medium text-[var(--brand-ink-3)] outline-none"
                            />
                          </label>
                          <label className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink-2)]">Hora (opcional)</span>
                            <input
                              type="time"
                              value={svcForm.time}
                              onChange={(e) => setSvc("time", e.target.value)}
                              className="w-full bg-transparent text-sm font-medium text-[var(--brand-ink-3)] outline-none"
                            />
                          </label>
                        </div>
                        <label className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink-2)]">Personas</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={svcForm.people}
                            onChange={(e) => setSvc("people", e.target.value)}
                            className="w-full bg-transparent text-sm font-medium text-[var(--brand-ink-3)] outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-2 px-1 text-sm text-[var(--brand-ink-2)]">
                          <input
                            type="checkbox"
                            checked={svcForm.hasCode}
                            onChange={(e) => setSvc("hasCode", e.target.checked)}
                            className="h-4 w-4 accent-[var(--brand-primary)]"
                          />
                          Ya tengo reserva de habitación (asociar a mi cuenta)
                        </label>
                        {svcForm.hasCode ? (
                          <input
                            value={svcForm.code}
                            onChange={(e) => setSvc("code", e.target.value.toUpperCase())}
                            placeholder="Código de tu reserva (ej. WBZNT)"
                            className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2.5 text-sm font-medium text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        ) : (
                          <input
                            value={svcForm.guestName}
                            onChange={(e) => setSvc("guestName", e.target.value)}
                            placeholder="Tu nombre completo"
                            className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2.5 text-sm font-medium text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                          />
                        )}
                        <input
                          value={svcForm.guestPhone}
                          onChange={(e) => setSvc("guestPhone", e.target.value)}
                          placeholder={svcForm.hasCode ? "Teléfono de tu reserva" : "Tu teléfono"}
                          className="rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2.5 text-sm font-medium text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                        />
                        {svcError && <p className="text-sm font-medium text-red-700">{svcError}</p>}
                        <button
                          type="button"
                          onClick={submitServiceBooking}
                          disabled={svcBusy || !svcFormValid}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-3 font-serif text-[12px] font-semibold uppercase tracking-[0.18em] text-[#171410] disabled:opacity-50"
                        >
                          {svcBusy ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck size={15} />}
                          Confirmar reserva del servicio
                        </button>
                      </div>
                    )}
                  </div>
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
            {/* Resumen tipo ficha de Google: el dueño publica el total real de
                su ficha (googleReviews*) aunque aquí solo se lean 5 reseñas. */}
            {(displayReviewCount > 0 || displayRating > 0) && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[var(--brand-primary)]">
                <span className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} fill={i < Math.round(displayRating) ? "currentColor" : "none"} strokeWidth={1.5} />
                  ))}
                </span>
                <span className="font-serif text-lg text-[var(--brand-ink-3)]">{displayRating.toFixed(1)}</span>
                <span className="text-sm text-[var(--brand-ink-2)]">
                  · {displayReviewCount.toLocaleString("es-VE")} opiniones
                </span>
                {extras?.googleReviewsUrl && (
                  <a
                    href={extras.googleReviewsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/40 px-3 py-1 text-xs font-semibold text-[var(--brand-primary-dark)] transition-colors hover:bg-[var(--brand-primary)]/10"
                  >
                    Ver en Google <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
            <hr className="hairline-gold mx-auto mt-6 w-24" />
          </div>
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 5).map((r, i) => (
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
                {whatsappUrl && (
                  <p>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-primary-dark)] transition-colors hover:bg-[var(--brand-primary)] hover:text-white"
                    >
                      <MessageCircle size={16} /> Escríbenos por WhatsApp
                    </a>
                  </p>
                )}
                {socialLinks.length > 0 && (
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
                    {socialLinks.map((s) => (
                      <a
                        key={s.label}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[var(--brand-primary-dark)] transition-colors hover:underline"
                      >
                        {s.label}
                      </a>
                    ))}
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
              title={`Ubicación de ${BRAND.name}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}&z=15&output=embed`}
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

      {/* ==================== WhatsApp flotante ====================
          Aparece solo después de bajar un poco (no tapa la portada). */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Escríbenos por WhatsApp"
          aria-hidden={!showWhatsappFloat}
          tabIndex={showWhatsappFloat ? 0 : -1}
          className={`fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-black/25 transition-all duration-300 hover:scale-105 ${
            showWhatsappFloat
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
        >
          <MessageCircle size={26} />
        </a>
      )}

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
