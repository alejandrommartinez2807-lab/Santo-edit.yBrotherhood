"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Star,
} from "lucide-react"
import { BRAND } from "@/lib/brand"
import ReservationQr from "../ReservationQr"
import ReservationPaymentSection from "../ReservationPaymentSection"

type Reservation = {
  code: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  adults: number
  children: number
  totalAmount: number
  status?: string
  statusLabel: string
}

type StayService = {
  serviceName: string
  date: string
  time: string
  people: number
  status: string
  total: number
}

type CatalogService = { id: string; name: string; price: number }

// Misma clave que escribe /hotel/reservar al confirmar: autocompleta y consulta
// sin teclear. Cuando la estadía ya terminó, se borra y vuelve el formulario.
const GUEST_RESERVATION_MEMORY_KEY = "hotel_guest_reservation_v1"
const FINISHED_STATUSES = new Set(["checkout", "cancelada", "no_show"])

function readMemory(): { code: string; phone: string } | null {
  try {
    const raw = window.localStorage.getItem(GUEST_RESERVATION_MEMORY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: unknown; phone?: unknown }
    const code = String(parsed.code || "").trim()
    const phone = String(parsed.phone || "").trim()
    return code && phone ? { code, phone } : null
  } catch {
    return null
  }
}

function clearMemory() {
  try {
    window.localStorage.removeItem(GUEST_RESERVATION_MEMORY_KEY)
  } catch {
    // Nada que limpiar.
  }
}

export default function MiReservaPage() {
  const [code, setCode] = useState("")
  const [phone, setPhone] = useState("")
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Servicios de la estadía (asociados a la cuenta) + agregar uno nuevo.
  const [stayServices, setStayServices] = useState<StayService[]>([])
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [addServiceId, setAddServiceId] = useState("")
  const [addDate, setAddDate] = useState("")
  const [addPeople, setAddPeople] = useState("2")
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState("")
  const [addDone, setAddDone] = useState("")

  // Reseña
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [reviewSent, setReviewSent] = useState(false)
  const [reviewError, setReviewError] = useState("")
  const [sending, setSending] = useState(false)

  const doLookup = useCallback(async (codeValue: string, phoneValue: string, auto = false) => {
    if (!codeValue.trim() || phoneValue.trim().length < 4) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/public/hotel/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeValue.trim(), phone: phoneValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No encontramos tu reserva")
      const found = data.reservation as Reservation
      const finished = FINISHED_STATUSES.has(String(found.status || ""))
      if (finished) {
        // Estadía terminada: se olvida en este navegador. En consulta manual
        // igual se muestra el resultado; en la automática vuelve el formulario.
        clearMemory()
        if (auto) {
          setCode("")
          setPhone("")
          setReservation(null)
          return
        }
      }
      setReservation(found)
      setStayServices(Array.isArray(data.services) ? data.services : [])
    } catch (e) {
      if (auto) {
        // La memoria ya no sirve (reserva borrada o datos cambiados): límpiala
        // en silencio y deja el formulario listo para teclear.
        clearMemory()
        setCode("")
        setPhone("")
      } else {
        setError(e instanceof Error ? e.message : "Error")
      }
      setReservation(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Al abrir: si este navegador recuerda una reserva, autocompleta y consulta solo.
  useEffect(() => {
    const memory = readMemory()
    if (!memory) return
    const timer = setTimeout(() => {
      setCode(memory.code)
      setPhone(memory.phone)
      void doLookup(memory.code, memory.phone, true)
    }, 0)
    return () => clearTimeout(timer)
  }, [doLookup])

  function lookup() {
    void doLookup(code, phone)
  }

  // Catálogo de servicios reservables (para agregarlos a la estadía).
  useEffect(() => {
    if (!reservation) return
    fetch("/api/public/hotel/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setCatalog(
          Array.isArray(d.services)
            ? d.services.map((s: { id: unknown; name: unknown; price: unknown }) => ({
                id: String(s.id || ""),
                name: String(s.name || ""),
                price: Number(s.price) || 0,
              }))
            : [],
        ),
      )
      .catch(() => setCatalog([]))
  }, [reservation])

  async function addService() {
    if (!reservation || !addServiceId || !addDate) return
    setAddBusy(true)
    setAddError("")
    setAddDone("")
    try {
      const res = await fetch("/api/public/hotel/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: addServiceId,
          date: addDate,
          people: Number(addPeople) || 1,
          code: reservation.code,
          guestPhone: phone,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo reservar")
      setAddDone(`${data.booking?.serviceName || "Servicio"} agregado a tu estadía.`)
      setAddServiceId("")
      // Refresca la lista sin perder la sesión del formulario.
      void doLookup(reservation.code, phone)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Error")
    } finally {
      setAddBusy(false)
    }
  }

  async function sendReview() {
    setSending(true)
    setReviewError("")
    try {
      const res = await fetch("/api/public/hotel/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: reservation?.code, guestName: reservation?.guestName, rating, comment: comment.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo enviar")
      setReviewSent(true)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Error")
    } finally {
      setSending(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-md">
        <Link href="/hotel" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary-dark)]">
          <ArrowLeft size={16} /> {BRAND.name}
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-ink-3)]">Mi reserva</h1>
        <p className="text-sm font-bold text-[var(--brand-ink-2)]">Consulta tu reserva con tu código y teléfono.</p>

        {!reservation ? (
          <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código de reserva (ej. WBZNT)" className={inputClass} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono de la reserva" className={inputClass} />
            {error && <p className="font-bold text-red-600">{error}</p>}
            <button onClick={lookup} disabled={loading || !code.trim() || phone.trim().length < 4} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : null} Ver mi reserva
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
              <p className="text-lg font-black text-[var(--brand-ink-3)]">Hola, {reservation.guestName}</p>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--brand-primary-dark)]">{reservation.statusLabel} · #{reservation.code}</p>
              <p className="mt-3 flex items-center gap-2 font-bold">
                <CalendarRange size={16} /> {reservation.checkInDate} → {reservation.checkOutDate} ({reservation.nights}n)
              </p>
              <p className="mt-1 font-bold text-[var(--brand-ink-2)]">{reservation.adults} adulto(s){reservation.children ? ` · ${reservation.children} niño(s)` : ""}</p>
              <p className="mt-2 text-2xl font-black text-[var(--brand-ink-3)]">${reservation.totalAmount}</p>
            </div>

            {/* QR de la reserva (mientras la estadía siga viva) */}
            {!FINISHED_STATUSES.has(String(reservation.status || "")) && (
              <div className="mt-4">
                <ReservationQr code={reservation.code} />
              </div>
            )}

            {/* Abona tu reserva: paga con los datos del hotel y reporta el abono */}
            <ReservationPaymentSection
              code={reservation.code}
              phone={phone}
              totalAmount={reservation.totalAmount}
            />

            {/* Servicios asociados a la estadía: todo en una sola cuenta */}
            {(stayServices.length > 0 || catalog.length > 0) && (
              <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="inline-flex items-center gap-1.5 text-sm font-black uppercase text-[var(--brand-primary-dark)]">
                  <Sparkles size={15} /> Servicios de tu estadía
                </p>
                {stayServices.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {stayServices.map((s, i) => (
                      <li
                        key={`${s.serviceName}-${s.date}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--brand-cream)]/70 px-3 py-2 text-sm font-bold text-[var(--brand-ink-2)]"
                      >
                        <span>
                          {s.serviceName}
                          {s.people > 1 ? ` × ${s.people}` : ""}
                          <span className="ml-2 text-xs text-[var(--brand-ink-2)]/60">
                            {s.date}
                            {s.time ? ` · ${s.time}` : ""}
                          </span>
                        </span>
                        <span className="text-[var(--brand-ink-3)]">{s.total > 0 ? `$${s.total}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
                    Aún no tienes servicios reservados. Se cargan a tu cuenta y los pagas en el hotel.
                  </p>
                )}

                {/* Agregar un servicio: queda asociado a ESTA reserva */}
                {catalog.length > 0 && !FINISHED_STATUSES.has(String(reservation.status || "")) && (
                  <div className="mt-3 grid gap-2 border-t border-[var(--brand-primary)]/15 pt-3">
                    <select
                      value={addServiceId}
                      onChange={(e) => {
                        setAddServiceId(e.target.value)
                        setAddError("")
                        setAddDone("")
                        if (!addDate) setAddDate(reservation.checkInDate)
                      }}
                      className={inputClass}
                    >
                      <option value="">Agregar un servicio…</option>
                      {catalog.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.price > 0 ? ` — $${s.price}/persona` : ""}
                        </option>
                      ))}
                    </select>
                    {addServiceId && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2">
                          <span className="block text-[10px] font-black uppercase text-[var(--brand-primary-dark)]">Fecha</span>
                          <input
                            type="date"
                            value={addDate}
                            onChange={(e) => setAddDate(e.target.value)}
                            className="w-full bg-transparent font-bold outline-none"
                          />
                        </label>
                        <label className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2">
                          <span className="block text-[10px] font-black uppercase text-[var(--brand-primary-dark)]">Personas</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={addPeople}
                            onChange={(e) => setAddPeople(e.target.value)}
                            className="w-full bg-transparent font-bold outline-none"
                          />
                        </label>
                      </div>
                    )}
                    {addError && <p className="text-sm font-bold text-red-600">{addError}</p>}
                    {addDone && (
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700">
                        <CheckCircle2 size={15} /> {addDone}
                      </p>
                    )}
                    {addServiceId && (
                      <button
                        onClick={addService}
                        disabled={addBusy || !addDate}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-black uppercase text-white disabled:opacity-50"
                      >
                        {addBusy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
                        Reservar y asociar a mi cuenta
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reseña */}
            <div className="mt-4 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-4">
              {reviewSent ? (
                <p className="inline-flex items-center gap-2 font-bold text-green-700"><CheckCircle2 size={18} /> ¡Gracias por tu reseña!</p>
              ) : (
                <>
                  <p className="text-sm font-black uppercase text-[var(--brand-primary-dark)]">Deja tu reseña</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button key={i} onClick={() => setRating(i)} type="button" aria-label={`${i} estrellas`}>
                        <Star size={26} className={i <= rating ? "fill-amber-400 text-amber-400" : "text-[var(--brand-ink-2)]/25"} />
                      </button>
                    ))}
                  </div>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="¿Cómo estuvo tu estadía?" rows={3} className={`${inputClass} mt-2`} />
                  {reviewError && <p className="mt-1 font-bold text-red-600">{reviewError}</p>}
                  <button onClick={sendReview} disabled={sending} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                    {sending ? <Loader2 className="animate-spin" size={16} /> : null} Enviar reseña
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
