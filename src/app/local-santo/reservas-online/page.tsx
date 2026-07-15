"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, ExternalLink, Globe, Loader2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type HotelReservation = {
  id: string
  code: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  nights: number
  ratePerNight: number
  totalAmount: number
  status: string
  source: string
  note: string
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  checkin: "Check-in",
  checkout: "Check-out",
  cancelada: "Cancelada",
  no_show: "No llegó",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ReservasOnlinePage() {
  return (
    <ModuleAccessGuard moduleKey="bookingEngine" moduleName="Reservas online">
      <ReservasOnlineContent />
    </ModuleAccessGuard>
  )
}

function ReservasOnlineContent() {
  const [reservations, setReservations] = useState<HotelReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [publicUrl, setPublicUrl] = useState("/hotel/reservar")

  useEffect(() => {
    if (typeof window !== "undefined") setPublicUrl(`${window.location.origin}/hotel/reservar`)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const from = toISO(new Date())
      const to = toISO(new Date(new Date().getFullYear() + 1, 0, 1))
      const res = await fetch(`/api/hotel-reservations?from=${from}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setReservations(data.reservations || [])
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

  const webReservations = useMemo(
    () => reservations.filter((r) => r.source === "web"),
    [reservations],
  )
  const pendingCount = useMemo(
    () => webReservations.filter((r) => r.status === "pendiente").length,
    [webReservations],
  )

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Globe size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Reservas online</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              El huésped reserva desde la web; la reserva entra <b>pendiente</b> para que la confirmes.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para ver las reservas online, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Enlace público */}
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Enlace público de reservas</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--brand-cream)] px-3 py-2 font-bold text-[var(--brand-ink-3)]">
                  {publicUrl}
                </code>
                <a
                  href="/hotel/reservar"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]"
                >
                  <ExternalLink size={14} /> Abrir
                </a>
              </div>
              <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/60">
                Compártelo en tu web, Instagram o WhatsApp. Para apagarlo, desactiva “Reservas online”
                en Configuración.
              </p>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Reservas web */}
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Reservas recibidas por la web
              </h2>
              {pendingCount > 0 && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-700">
                  {pendingCount} por confirmar
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-4 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : webReservations.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay reservas hechas desde la web. Comparte el enlace de arriba.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {webReservations.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[var(--brand-ink-3)]">
                          {r.guestName}
                          <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/45">#{r.code}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange size={14} /> {r.checkInDate} → {r.checkOutDate} ({r.nights}n)
                          </span>
                          <span>${r.totalAmount}</span>
                          {r.guestPhone && <span>{r.guestPhone}</span>}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-ink-2)]/70">
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-sm font-bold text-[var(--brand-ink-2)]/55">
              Para confirmar, hacer check-in o cancelar, usa el módulo <b>Reservas del hotel</b>.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
