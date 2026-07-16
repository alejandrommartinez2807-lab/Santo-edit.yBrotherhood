"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  Check,
  CheckCircle2,
  Gift,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"
import { BRAND } from "@/lib/brand"
import {
  DEFAULT_HOTEL_BOOKING_FIELDS,
  HOTEL_BOOKING_FIELD_DEFINITIONS,
  normalizeHotelBookingFields,
  type HotelBookingFieldId,
  type HotelBookingFieldsConfig,
} from "@/lib/hotelBooking"
import PhotoLightbox, { type LightboxPhoto } from "../PhotoLightbox"
import ReservationQr from "../ReservationQr"
import ReservationPaymentSection from "../ReservationPaymentSection"

type Quote = {
  nights: number
  total: number
  averageRate: number
  seasonApplied: boolean
  seasonNames: string[]
}
type AvailableType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  photos?: { url: string; caption: string }[]
  details?: {
    beds: string
    sizeM2: string
    view: string
    amenities: string
    includes?: string
  } | null
  quote: Quote
}
type UpsellService = {
  id: string
  name: string
  kind: string
  description: string
  price: number
  durationMin: number
  imageUrl: string
}
type UpsellPackage = {
  id: string
  name: string
  description: string
  includes: string
  price: number
  imageUrl: string
}
type Upsell = { style: "fotos" | "texto"; services: UpsellService[]; packages: UpsellPackage[] }
type Created = {
  code: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  ratePerNight: number
  totalAmount: number
  roomTypeName: string
  services?: { name: string; price: number; people: number; date: string }[]
  packageName?: string
  packagePrice?: number
  extrasTotal?: number
  membership?: { name: string; discountPct: number; viaPass: boolean; referredBy: string } | null
}

/** "desayuno, wifi, spa" → lista limpia para chips. */
function csvList(value: string | undefined, max = 8): string[] {
  return (value || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
}

// Memoria del navegador para "Mi reserva": autocompleta código+teléfono al
// volver. Se borra sola cuando la estadía termina (checkout/cancelada/no_show).
const GUEST_RESERVATION_MEMORY_KEY = "hotel_guest_reservation_v1"

function rememberReservation(code: string, phone: string) {
  try {
    window.localStorage.setItem(GUEST_RESERVATION_MEMORY_KEY, JSON.stringify({ code, phone }))
  } catch {
    // Sin almacenamiento el flujo sigue igual, solo sin autocompletar.
  }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function todayISO() {
  return toISO(new Date())
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export default function HotelReservarPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [checkIn, setCheckIn] = useState(todayISO())
  const [checkOut, setCheckOut] = useState(addDaysISO(todayISO(), 1))
  const [types, setTypes] = useState<AvailableType[]>([])
  const [nights, setNights] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [adults, setAdults] = useState("2")
  const [children, setChildren] = useState("0")
  const [note, setNote] = useState("")
  // Campos extra que el dueño activó (cédula, dirección, hora de llegada…).
  const [bookingFields, setBookingFields] = useState<HotelBookingFieldsConfig>(
    DEFAULT_HOTEL_BOOKING_FIELDS,
  )
  const [document, setDocument] = useState("")
  const [address, setAddress] = useState("")
  const [arrivalTime, setArrivalTime] = useState("")
  const [membershipCode, setMembershipCode] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  // Extras del hotel al reservar: servicios elegidos (id → personas) y paquete.
  const [upsell, setUpsell] = useState<Upsell>({ style: "fotos", services: [], packages: [] })
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({})
  const [selectedPackageId, setSelectedPackageId] = useState("")

  // Galería de fotos del tipo (lightbox); null = cerrado.
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null)

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    setError("")
    setSelectedTypeId("")
    try {
      const res = await fetch(`/api/public/hotel?checkIn=${checkIn}&checkOut=${checkOut}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo consultar")
      setEnabled(data.enabled)
      setTypes(data.types || [])
      setNights(data.nights || 0)
      if (data.bookingFields) setBookingFields(normalizeHotelBookingFields(data.bookingFields))
      if (data.upsell) {
        setUpsell({
          style: data.upsell.style === "texto" ? "texto" : "fotos",
          services: Array.isArray(data.upsell.services) ? data.upsell.services : [],
          packages: Array.isArray(data.upsell.packages) ? data.upsell.packages : [],
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [checkIn, checkOut])

  useEffect(() => {
    const timer = setTimeout(loadAvailability, 0)
    return () => clearTimeout(timer)
  }, [loadAvailability])

  const selectedType = useMemo(
    () => types.find((t) => t.roomTypeId === selectedTypeId) || null,
    [types, selectedTypeId],
  )

  // Totales de extras: los servicios se cobran por persona; el paquete es fijo.
  // Se pagan en el hotel (van al folio), por eso se muestran aparte del total
  // de la habitación.
  const selectedPackage = useMemo(
    () => upsell.packages.find((p) => p.id === selectedPackageId) || null,
    [upsell.packages, selectedPackageId],
  )
  const extrasTotal = useMemo(() => {
    const servicesTotal = Object.entries(selectedServices).reduce((sum, [id, people]) => {
      const service = upsell.services.find((s) => s.id === id)
      return service ? sum + service.price * Math.max(1, people) : sum
    }, 0)
    return servicesTotal + (selectedPackage ? selectedPackage.price : 0)
  }, [selectedServices, upsell.services, selectedPackage])

  function toggleService(id: string) {
    setSelectedServices((current) => {
      const next = { ...current }
      if (next[id]) delete next[id]
      else next[id] = 1
      return next
    })
  }

  function setServicePeople(id: string, delta: number) {
    setSelectedServices((current) => {
      if (!current[id]) return current
      const next = Math.min(20, Math.max(1, current[id] + delta))
      return { ...current, [id]: next }
    })
  }

  // Valor actual de cada campo extra configurable.
  const extraFieldValue = useCallback(
    (id: HotelBookingFieldId) =>
      ({ document, email: guestEmail, address, arrivalTime, requests: note })[id] || "",
    [document, guestEmail, address, arrivalTime, note],
  )

  const missingRequired = useMemo(
    () =>
      HOTEL_BOOKING_FIELD_DEFINITIONS.filter(
        (f) => bookingFields[f.id] === "required" && !extraFieldValue(f.id).trim(),
      ),
    [bookingFields, extraFieldValue],
  )

  async function submit() {
    if (!selectedType || guestName.trim().length < 3 || missingRequired.length > 0 || !termsAccepted)
      return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/public/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomTypeId: selectedType.roomTypeId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestEmail: guestEmail.trim(),
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          note: note.trim(),
          document: document.trim(),
          address: address.trim(),
          arrivalTime: arrivalTime.trim(),
          membershipCode: membershipCode.trim(),
          termsAccepted,
          checkIn,
          checkOut,
          services: Object.entries(selectedServices).map(([id, people]) => ({ id, people })),
          packageId: selectedPackageId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo reservar")
      setCreated(data.reservation)
      if (data.reservation?.code) rememberReservation(data.reservation.code, guestPhone.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  // Confirmación
  if (created) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--brand-cream)] px-6 py-16 text-center text-[var(--brand-ink-2)]">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 size={28} />
        </span>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-[var(--brand-ink-3)]">¡Reserva recibida!</h1>
        <p className="mt-2 font-bold text-[var(--brand-ink-2)]">
          Tu código de reserva es
        </p>
        <p className="my-2 text-4xl font-black tracking-[0.2em] text-[var(--brand-primary-dark)]">
          {created.code}
        </p>
        <div className="mt-2 w-full max-w-sm">
          <ReservationQr code={created.code} />
        </div>
        {created.membership && (
          <div className="mt-2 w-full max-w-sm rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/5 p-4 text-left">
            <p className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-primary-dark)]">
              <Sparkles size={15} /> Beneficio de membresía
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]">
              {created.membership.name} · -{created.membership.discountPct}% sugerido sobre la tarifa (recepción lo confirma al llegar).
              {created.membership.viaPass && created.membership.referredBy ? ` Pase de ${created.membership.referredBy}.` : ""}
            </p>
          </div>
        )}
        <div className="mt-2 w-full max-w-sm rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 text-left font-bold">
          <p className="flex items-center gap-2"><BedDouble size={16} /> {created.roomTypeName}</p>
          <p className="mt-1 flex items-center gap-2">
            <CalendarRange size={16} /> {created.checkInDate} → {created.checkOutDate} ({created.nights}n)
          </p>
          <p className="mt-2 text-lg font-black text-[var(--brand-ink-3)]">
            Habitación ${created.totalAmount}
            <span className="ml-1 text-sm font-bold text-[var(--brand-ink-2)]">
              ({created.nights}n × ${created.ratePerNight})
            </span>
          </p>
          {((created.services && created.services.length > 0) || created.packageName) && (
            <div className="mt-3 border-t border-[var(--brand-primary)]/15 pt-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]">
                Extras de tu estadía
              </p>
              {created.packageName && (
                <p className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Gift size={14} /> Paquete {created.packageName}
                  </span>
                  <span>${created.packagePrice}</span>
                </p>
              )}
              {(created.services || []).map((s) => (
                <p key={s.name} className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={14} /> {s.name}
                    {s.people > 1 ? ` × ${s.people}` : ""}
                  </span>
                  <span>${s.price * s.people}</span>
                </p>
              ))}
              <p className="mt-2 text-sm text-[var(--brand-ink-2)]">
                Los extras quedaron asociados a tu reserva: se cargan a tu cuenta
                (folio) y los pagas en el hotel.
              </p>
            </div>
          )}
        </div>
        <div className="mt-2 w-full max-w-sm">
          <ReservationPaymentSection
            code={created.code}
            phone={guestPhone}
            totalAmount={created.totalAmount}
          />
        </div>
        <p className="mt-4 max-w-sm text-sm font-bold text-[var(--brand-ink-2)]">
          Guardamos tu reserva como <b>pendiente</b>. Te contactaremos por teléfono para confirmarla.
        </p>
        <Link
          href="/hotel"
          className="mt-8 inline-flex items-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]"
        >
          Volver al hotel
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/hotel"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary-dark)]"
        >
          <ArrowLeft size={16} /> {BRAND.name}
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">Reservar en línea</h1>
        <p className="text-sm font-bold text-[var(--brand-ink-2)]">
          Elige tus fechas y mira las habitaciones disponibles con su precio.
        </p>

        {/* Fechas */}
        <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
            <span className="text-xs font-black uppercase text-[var(--brand-primary-dark)]">Entrada</span>
            <input
              type="date"
              value={checkIn}
              min={todayISO()}
              onChange={(e) => {
                const v = e.target.value || todayISO()
                setCheckIn(v)
                if (checkOut <= v) setCheckOut(addDaysISO(v, 1))
              }}
              className="w-full bg-transparent font-bold outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
            <span className="text-xs font-black uppercase text-[var(--brand-primary-dark)]">Salida</span>
            <input
              type="date"
              value={checkOut}
              min={addDaysISO(checkIn, 1)}
              onChange={(e) => setCheckOut(e.target.value || addDaysISO(checkIn, 1))}
              className="w-full bg-transparent font-bold outline-none"
            />
          </label>
        </div>

        {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

        {enabled === false ? (
          <p className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary-dark)]">
            Las reservas en línea no están disponibles por ahora. Escríbenos para reservar.
          </p>
        ) : loading ? (
          <p className="mt-6 inline-flex items-center gap-2 font-bold">
            <Loader2 className="animate-spin" size={18} /> Buscando disponibilidad…
          </p>
        ) : (
          <>
            {/* Tipos disponibles */}
            {types.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]">
                No hay habitaciones libres para esas fechas. Prueba con otras.
              </p>
            ) : (
              <ul className="mt-6 space-y-4">
                {types.map((type) => {
                  const isSel = type.roomTypeId === selectedTypeId
                  const fewLeft = type.freeCount <= 3
                  return (
                    <li
                      key={type.roomTypeId}
                      className={`overflow-hidden rounded-2xl border-2 bg-white ${
                        isSel ? "border-[var(--brand-primary)]" : "border-[var(--brand-primary)]/20"
                      }`}
                    >
                      {/* Foto grande clicable: abre la galería del tipo */}
                      {type.photos && type.photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLightbox({ photos: type.photos!, index: 0 })}
                          aria-label={`Ver fotos de ${type.name}`}
                          className="relative block h-44 w-full cursor-zoom-in overflow-hidden sm:h-52"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={type.photos[0].url}
                            alt={type.photos[0].caption || type.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                          />
                          {type.photos.length > 1 && (
                            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                              {type.photos.length} fotos · ver galería
                            </span>
                          )}
                        </button>
                      )}

                      <div className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <h3 className="min-w-0 font-serif text-2xl font-semibold leading-tight text-[var(--brand-ink-3)]">
                            {type.name}
                          </h3>
                          <div className="text-right">
                            <p className="text-xl font-black text-[var(--brand-ink-3)]">${type.quote.total}</p>
                            <p className="text-xs font-bold text-[var(--brand-ink-2)]">
                              {nights}n × ${type.quote.averageRate}
                            </p>
                          </div>
                        </div>
                        {type.description && (
                          <p className="mt-1 text-sm leading-relaxed text-[var(--brand-ink-2)]">{type.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {/* Cupo real, visible: ámbar cuando quedan pocas */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${
                              fewLeft
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : "border-green-400 bg-green-100 text-green-900"
                            }`}
                          >
                            {type.freeCount === 1 ? "¡Queda 1!" : `Quedan ${type.freeCount}`}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/25 px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]">
                            <Users size={13} /> Hasta {type.capacity}
                          </span>
                          {type.details?.beds && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/25 px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]">
                              <BedDouble size={13} /> {type.details.beds}
                            </span>
                          )}
                          {type.details?.sizeM2 && (
                            <span className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/25 px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]">
                              {type.details.sizeM2} m²
                            </span>
                          )}
                          {type.details?.view && (
                            <span className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/25 px-3 py-1 text-xs font-bold text-[var(--brand-ink-2)]">
                              {type.details.view}
                            </span>
                          )}
                          {type.quote.seasonApplied && (
                            <span className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/25 px-3 py-1 text-xs font-bold text-[var(--brand-primary-dark)]">
                              Temporada {type.quote.seasonNames.join(", ")}
                            </span>
                          )}
                        </div>
                        {/* Servicios que YA vienen con la tarifa (los define el
                            dueño por tipo): el huésped sabe qué está pagando. */}
                        {csvList(type.details?.includes).length > 0 && (
                          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-800">
                              Incluido con tu habitación
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {csvList(type.details?.includes).map((item) => (
                                <span
                                  key={item}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-green-900"
                                >
                                  <Check size={12} /> {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => setSelectedTypeId(isSel ? "" : type.roomTypeId)}
                          className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-black uppercase ${
                            isSel
                              ? "border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary-dark)]"
                              : "bg-[var(--brand-primary)] text-[#171410]"
                          }`}
                        >
                          {isSel ? "Elegida" : "Elegir esta habitación"}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Extras: servicios y paquetes del hotel para completar la
                estadía. Quedan asociados a la reserva (y luego al folio). */}
            {selectedType && (upsell.services.length > 0 || upsell.packages.length > 0) && (
              <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="text-sm font-black uppercase text-[var(--brand-primary-dark)]">
                  Completa tu estadía <span className="font-bold text-[var(--brand-ink-2)]/55">(opcional)</span>
                </p>
                <p className="mt-0.5 text-xs font-bold text-[var(--brand-ink-2)]/65">
                  Se asocian a tu reserva y se pagan en el hotel.
                </p>

                {upsell.services.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {upsell.services.map((service) => {
                      const picked = selectedServices[service.id] || 0
                      const showPhoto = upsell.style === "fotos" && service.imageUrl
                      return (
                        <li
                          key={service.id}
                          className={`overflow-hidden rounded-xl border-2 ${
                            picked
                              ? "border-[var(--brand-primary)] bg-[var(--brand-cream)]/60"
                              : "border-[var(--brand-primary)]/20 bg-white"
                          }`}
                        >
                          <div className="flex items-stretch gap-3">
                            {showPhoto && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={service.imageUrl}
                                alt={service.name}
                                loading="lazy"
                                className="h-auto w-24 shrink-0 object-cover sm:w-32"
                              />
                            )}
                            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 py-2.5 pr-3 pl-1 sm:pl-2">
                              <div className="min-w-0">
                                <p className="font-bold text-[var(--brand-ink-3)]">
                                  {service.name}
                                  {service.price > 0 && (
                                    <span className="ml-2 text-sm text-[var(--brand-ink-2)]/60">
                                      ${service.price}/persona
                                    </span>
                                  )}
                                </p>
                                {service.description && (
                                  <p className="text-xs font-bold leading-relaxed text-[var(--brand-ink-2)]/65">
                                    {service.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {picked > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/30 bg-white px-1.5 py-1">
                                    <button
                                      type="button"
                                      onClick={() => setServicePeople(service.id, -1)}
                                      aria-label="Menos personas"
                                      className="rounded-full p-1 text-[var(--brand-primary-dark)]"
                                    >
                                      <Minus size={13} />
                                    </button>
                                    <span className="min-w-5 text-center text-sm font-black text-[var(--brand-ink-3)]">
                                      {picked}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setServicePeople(service.id, 1)}
                                      aria-label="Más personas"
                                      className="rounded-full p-1 text-[var(--brand-primary-dark)]"
                                    >
                                      <Plus size={13} />
                                    </button>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleService(service.id)}
                                  className={`rounded-full px-3.5 py-1.5 text-xs font-black uppercase ${
                                    picked
                                      ? "border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary-dark)]"
                                      : "bg-[var(--brand-primary)] text-[#171410]"
                                  }`}
                                >
                                  {picked ? "Quitar" : "Agregar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {upsell.packages.length > 0 && (
                  <>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]">
                      <Gift size={14} /> Paquetes del hotel
                    </p>
                    <ul className="mt-2 space-y-2">
                      {upsell.packages.map((pkg) => {
                        const picked = selectedPackageId === pkg.id
                        const showPhoto = upsell.style === "fotos" && pkg.imageUrl
                        return (
                          <li
                            key={pkg.id}
                            className={`overflow-hidden rounded-xl border-2 ${
                              picked
                                ? "border-[var(--brand-primary)] bg-[var(--brand-cream)]/60"
                                : "border-[var(--brand-primary)]/20 bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPackageId(picked ? "" : pkg.id)}
                              className="flex w-full items-stretch gap-3 text-left"
                            >
                              {showPhoto && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={pkg.imageUrl}
                                  alt={pkg.name}
                                  loading="lazy"
                                  className="h-auto w-24 shrink-0 object-cover sm:w-32"
                                />
                              )}
                              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 py-2.5 pr-3 pl-1 sm:pl-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-[var(--brand-ink-3)]">
                                    {pkg.name}
                                    {pkg.price > 0 && (
                                      <span className="ml-2 text-sm text-[var(--brand-ink-2)]/60">
                                        ${pkg.price}
                                      </span>
                                    )}
                                  </p>
                                  {(pkg.includes || pkg.description) && (
                                    <p className="text-xs font-bold leading-relaxed text-[var(--brand-ink-2)]/65">
                                      {pkg.includes ? `Incluye: ${pkg.includes}` : pkg.description}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-black uppercase ${
                                    picked
                                      ? "border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary-dark)]"
                                      : "bg-[var(--brand-primary)] text-[#171410]"
                                  }`}
                                >
                                  {picked ? <Check size={13} /> : null}
                                  {picked ? "Elegido" : "Elegir"}
                                </span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Datos del huésped */}
            {selectedType && (
              <div className="mt-4 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                <p className="text-sm font-black uppercase text-[var(--brand-primary-dark)] sm:col-span-2">
                  Tus datos
                </p>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nombre completo *" className={`${inputClass} sm:col-span-2`} />
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Teléfono *" className={inputClass} />
                {bookingFields.email !== "off" && (
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={bookingFields.email === "required" ? "Email *" : "Email (opcional)"}
                    className={inputClass}
                  />
                )}
                {bookingFields.document !== "off" && (
                  <input
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder={
                      bookingFields.document === "required"
                        ? "Cédula o pasaporte *"
                        : "Cédula o pasaporte (opcional)"
                    }
                    className={inputClass}
                  />
                )}
                {bookingFields.address !== "off" && (
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={bookingFields.address === "required" ? "Dirección *" : "Dirección (opcional)"}
                    className={`${inputClass} sm:col-span-2`}
                  />
                )}
                {bookingFields.arrivalTime !== "off" && (
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 sm:col-span-2">
                    <span className="text-xs font-black uppercase text-[var(--brand-primary-dark)]">
                      Hora de llegada{bookingFields.arrivalTime === "required" ? " *" : ""}
                    </span>
                    <input
                      type="time"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      className="w-full bg-transparent font-bold outline-none"
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                  <Users size={16} className="shrink-0 text-[var(--brand-primary)]" />
                  <input type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} placeholder="Adultos" className="w-full bg-transparent font-bold outline-none" />
                </label>
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                  <span className="text-xs font-black uppercase text-[var(--brand-primary-dark)]">Niños</span>
                  <input type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} placeholder="Niños" className="w-full bg-transparent font-bold outline-none" />
                </label>
                {bookingFields.requests !== "off" && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      bookingFields.requests === "required"
                        ? "Solicitudes especiales *"
                        : "Solicitudes especiales (opcional): llegada tarde, cuna…"
                    }
                    className={`${inputClass} sm:col-span-2`}
                  />
                )}
                <div className="rounded-xl bg-[var(--brand-cream)] px-4 py-3 font-black text-[var(--brand-ink-3)] sm:col-span-2">
                  <p className="flex items-center justify-between">
                    <span>Habitación · {selectedType.name}</span>
                    <span>
                      ${selectedType.quote.total}{" "}
                      <span className="text-sm font-bold text-[var(--brand-ink-2)]">({nights}n)</span>
                    </span>
                  </p>
                  {extrasTotal > 0 && (
                    <>
                      <p className="mt-1 flex items-center justify-between text-sm font-bold text-[var(--brand-ink-2)]">
                        <span>Extras (se pagan en el hotel)</span>
                        <span>${extrasTotal}</span>
                      </p>
                      <p className="mt-1 flex items-center justify-between border-t border-[var(--brand-primary)]/15 pt-1.5">
                        <span>Total estimado</span>
                        <span>${selectedType.quote.total + extrasTotal}</span>
                      </p>
                    </>
                  )}
                </div>
                <input
                  value={membershipCode}
                  onChange={(e) => setMembershipCode(e.target.value.toUpperCase())}
                  placeholder="Código de membresía o pase de invitado (opcional)"
                  className={`${inputClass} sm:col-span-2`}
                />
                {/* Aceptación de términos: sin marcarla no se envía (y el servidor lo exige) */}
                <label className="flex items-start gap-2.5 rounded-xl bg-[var(--brand-cream)]/70 px-4 py-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
                  />
                  <span className="text-sm font-bold text-[var(--brand-ink-2)]">
                    He leído y acepto los{" "}
                    <Link
                      href="/hotel/terminos"
                      target="_blank"
                      className="text-[var(--brand-primary-dark)] underline underline-offset-2"
                    >
                      términos y condiciones
                    </Link>
                  </span>
                </label>
                {missingRequired.length > 0 && (
                  <p className="text-xs font-bold text-amber-800 sm:col-span-2">
                    Falta completar: {missingRequired.map((f) => f.label.toLowerCase()).join(", ")}
                  </p>
                )}
                <button
                  onClick={submit}
                  disabled={
                    submitting ||
                    guestName.trim().length < 3 ||
                    missingRequired.length > 0 ||
                    !termsAccepted
                  }
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
                  Confirmar reserva
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
