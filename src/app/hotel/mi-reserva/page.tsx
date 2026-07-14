"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, CheckCircle2, Loader2, Star } from "lucide-react"
import { BRAND } from "@/lib/brand"

type Reservation = {
  code: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  adults: number
  children: number
  totalAmount: number
  statusLabel: string
}

export default function MiReservaPage() {
  const [code, setCode] = useState("")
  const [phone, setPhone] = useState("")
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Reseña
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [reviewSent, setReviewSent] = useState(false)
  const [reviewError, setReviewError] = useState("")
  const [sending, setSending] = useState(false)

  async function lookup() {
    if (!code.trim() || phone.trim().length < 4) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/public/hotel/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No encontramos tu reserva")
      setReservation(data.reservation)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      setReservation(null)
    } finally {
      setLoading(false)
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
