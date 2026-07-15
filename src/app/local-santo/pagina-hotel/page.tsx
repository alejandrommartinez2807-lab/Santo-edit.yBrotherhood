"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  DEFAULT_HOTEL_BOOKING_FIELDS,
  HOTEL_BOOKING_FIELD_DEFINITIONS,
  normalizeHotelBookingFields,
  type HotelBookingFieldId,
  type HotelBookingFieldMode,
  type HotelBookingFieldsConfig,
} from "@/lib/hotelBooking"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

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

const EMPTY: Profile = {
  headline: "",
  about: "",
  amenities: "",
  address: "",
  phone: "",
  email: "",
  checkinTime: "15:00",
  checkoutTime: "12:00",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function PaginaHotelPage() {
  return (
    <ModuleAccessGuard moduleKey="hotelLanding" moduleName="Página del hotel">
      <PaginaHotelContent />
    </ModuleAccessGuard>
  )
}

function PaginaHotelContent() {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [bookingFields, setBookingFields] = useState<HotelBookingFieldsConfig>(
    DEFAULT_HOTEL_BOOKING_FIELDS,
  )
  const [termsText, setTermsText] = useState("")
  const [termsDefault, setTermsDefault] = useState("")
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/hotel-profile", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setProfile({ ...EMPTY, ...(data.profile || {}) })
      setBookingFields(normalizeHotelBookingFields(data.bookingFields))
      setTermsText(String(data.termsText || ""))
      setTermsDefault(String(data.termsDefault || ""))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  function setFieldMode(id: HotelBookingFieldId, mode: HotelBookingFieldMode) {
    setBookingFields((f) => ({ ...f, [id]: mode }))
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/hotel-profile", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...profile, bookingFields, termsText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      setProfile({ ...EMPTY, ...(data.profile || {}) })
      setBookingFields(normalizeHotelBookingFields(data.bookingFields))
      setTermsText(String(data.termsText || ""))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/local-santo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Página del hotel</h1>
          <a href="/hotel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)] bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]">
            <ExternalLink size={14} /> Ver /hotel
          </a>
        </div>
        <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Contenido de tu landing pública.</p>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para editar la página, o el módulo está desactivado.
          </p>
        ) : loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
        ) : (
          <div className="mt-6 grid gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
            <input value={profile.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Titular (Bienvenido a…)" className={inputClass} />
            <textarea value={profile.about} onChange={(e) => set("about", e.target.value)} placeholder="Descripción del hotel" rows={4} className={inputClass} />
            <textarea value={profile.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Amenidades (piscina, wifi, desayuno…)" rows={2} className={inputClass} />
            <input value={profile.address} onChange={(e) => set("address", e.target.value)} placeholder="Dirección" className={inputClass} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={profile.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Teléfono" className={inputClass} />
              <input value={profile.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className={inputClass} />
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Check-in</span>
                <input type="time" value={profile.checkinTime} onChange={(e) => set("checkinTime", e.target.value)} className="w-full bg-transparent font-bold outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Check-out</span>
                <input type="time" value={profile.checkoutTime} onChange={(e) => set("checkoutTime", e.target.value)} className="w-full bg-transparent font-bold outline-none" />
              </label>
            </div>
            {/* Qué datos pide el formulario de reserva pública */}
            <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                Formulario de reserva
              </p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Elige qué datos se piden al huésped al reservar en línea. Nombre y teléfono
                siempre son obligatorios.
              </p>
              <div className="mt-3 grid gap-2">
                {HOTEL_BOOKING_FIELD_DEFINITIONS.map((def) => (
                  <label
                    key={def.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2"
                  >
                    <span className="text-sm font-bold text-[var(--brand-ink-3)]">{def.label}</span>
                    <select
                      value={bookingFields[def.id]}
                      onChange={(e) => setFieldMode(def.id, e.target.value as HotelBookingFieldMode)}
                      className="rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-2 py-1.5 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                    >
                      <option value="off">No pedir</option>
                      <option value="optional">Opcional</option>
                      <option value="required">Obligatorio</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
            {/* Términos y condiciones de la reserva pública */}
            <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black uppercase text-[var(--brand-ink-3)]">
                  Términos y condiciones
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTermsText(termsDefault)
                    setSaved(false)
                  }}
                  className="rounded-lg border-2 border-[var(--brand-primary)]/25 bg-white px-2.5 py-1 text-xs font-black uppercase text-[var(--brand-primary)]"
                >
                  Usar texto estándar
                </button>
              </div>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/70">
                El huésped debe aceptarlos para reservar (se leen en /hotel/terminos). Si lo dejas
                vacío, se usa el texto estándar de la industria.
              </p>
              <textarea
                value={termsText}
                onChange={(e) => {
                  setTermsText(e.target.value)
                  setSaved(false)
                }}
                placeholder={termsDefault}
                rows={8}
                className={`${inputClass} mt-2 text-sm`}
              />
            </div>
            {error && <p className="font-bold text-red-600">{error}</p>}
            <button onClick={save} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {saved ? "Guardado ✓" : "Guardar página"}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
