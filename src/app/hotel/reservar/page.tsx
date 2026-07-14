"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Users,
} from "lucide-react"
import { BRAND } from "@/lib/brand"

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
  quote: Quote
}
type Created = {
  code: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  ratePerNight: number
  totalAmount: number
  roomTypeName: string
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
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

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

  async function submit() {
    if (!selectedType || guestName.trim().length < 3) return
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
          checkIn,
          checkOut,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo reservar")
      setCreated(data.reservation)
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
        <div className="mt-2 w-full max-w-sm rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 text-left font-bold">
          <p className="flex items-center gap-2"><BedDouble size={16} /> {created.roomTypeName}</p>
          <p className="mt-1 flex items-center gap-2">
            <CalendarRange size={16} /> {created.checkInDate} → {created.checkOutDate} ({created.nights}n)
          </p>
          <p className="mt-2 text-lg font-black text-[var(--brand-ink-3)]">
            Total ${created.totalAmount}
            <span className="ml-1 text-sm font-bold text-[var(--brand-ink-2)]">
              ({created.nights}n × ${created.ratePerNight})
            </span>
          </p>
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
              <ul className="mt-6 space-y-3">
                {types.map((type) => {
                  const isSel = type.roomTypeId === selectedTypeId
                  return (
                    <li
                      key={type.roomTypeId}
                      className={`rounded-2xl border-2 bg-white p-4 ${
                        isSel ? "border-[var(--brand-primary)]" : "border-[var(--brand-primary)]/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {type.photos && type.photos.length > 0 && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={type.photos[0].url}
                            alt={type.photos[0].caption || type.name}
                            loading="lazy"
                            className="h-16 w-24 shrink-0 rounded-lg border border-[var(--brand-primary)]/20 object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-black text-[var(--brand-ink-3)]">{type.name}</p>
                          <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]">
                            <span className="inline-flex items-center gap-1"><Users size={14} /> {type.capacity}p</span>
                            <span>{type.freeCount} disponible{type.freeCount === 1 ? "" : "s"}</span>
                            {type.quote.seasonApplied && (
                              <span className="text-[var(--brand-primary-dark)]">Temporada {type.quote.seasonNames.join(", ")}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-[var(--brand-ink-3)]">${type.quote.total}</p>
                          <p className="text-xs font-bold text-[var(--brand-ink-2)]">
                            {nights}n × ${type.quote.averageRate}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTypeId(isSel ? "" : type.roomTypeId)}
                        className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-black uppercase ${
                          isSel
                            ? "border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary-dark)]"
                            : "bg-[var(--brand-primary)] text-[#171410]"
                        }`}
                      >
                        {isSel ? "Elegida" : "Elegir esta habitación"}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Datos del huésped */}
            {selectedType && (
              <div className="mt-4 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                <p className="text-sm font-black uppercase text-[var(--brand-primary-dark)] sm:col-span-2">
                  Tus datos
                </p>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nombre completo" className={`${inputClass} sm:col-span-2`} />
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Teléfono" className={inputClass} />
                <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email (opcional)" className={inputClass} />
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                  <Users size={16} className="shrink-0 text-[var(--brand-primary)]" />
                  <input type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} placeholder="Adultos" className="w-full bg-transparent font-bold outline-none" />
                </label>
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                  <span className="text-xs font-black uppercase text-[var(--brand-primary-dark)]">Niños</span>
                  <input type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} placeholder="Niños" className="w-full bg-transparent font-bold outline-none" />
                </label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): llegada tarde, cuna…" className={`${inputClass} sm:col-span-2`} />
                <div className="flex items-center justify-between rounded-xl bg-[var(--brand-cream)] px-4 py-3 font-black text-[var(--brand-ink-3)] sm:col-span-2">
                  <span>Total {selectedType.name}</span>
                  <span>${selectedType.quote.total} <span className="text-sm font-bold text-[var(--brand-ink-2)]">({nights}n)</span></span>
                </div>
                <button
                  onClick={submit}
                  disabled={submitting || guestName.trim().length < 3}
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
    </main>
  )
}
