"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarRange,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

const KINDS = ["spa", "tour", "restaurante", "alquiler", "clase", "otro"] as const
const KIND_LABELS: Record<string, string> = {
  spa: "Spa",
  tour: "Tour",
  restaurante: "Restaurante",
  alquiler: "Alquiler",
  clase: "Clase",
  otro: "Otro",
}
const STATUS_LABELS: Record<string, string> = {
  reservada: "Reservada",
  cumplida: "Cumplida",
  cancelada: "Cancelada",
}

type Service = {
  id: string
  name: string
  kind: string
  description: string
  price: number
  capacity: number
  durationMin: number
  active: boolean
}
type Booking = {
  id: string
  serviceId: string
  guestName: string
  guestPhone: string
  date: string
  time: string
  people: number
  status: string
  note: string
}
type ActiveReservation = { id: string; guestName: string; roomId: string; status: string }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ServiciosPage() {
  return (
    <ModuleAccessGuard moduleKey="resortServices" moduleName="Servicios y actividades">
      <ServiciosContent />
    </ModuleAccessGuard>
  )
}

function ServiciosContent() {
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Alta de servicio
  const [name, setName] = useState("")
  const [kind, setKind] = useState<string>("spa")
  const [price, setPrice] = useState("")
  const [capacity, setCapacity] = useState("1")

  // Nueva reserva de servicio
  const [bServiceId, setBServiceId] = useState("")
  const [bDate, setBDate] = useState(toISO(new Date()))
  const [bTime, setBTime] = useState("")
  const [bPeople, setBPeople] = useState("1")
  const [bGuest, setBGuest] = useState("")
  const [bReservationId, setBReservationId] = useState("")
  const [reservations, setReservations] = useState<ActiveReservation[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/resort-services", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setServices(data.services || [])
      setBookings(data.bookings || [])

      // Reservas activas (best-effort): para vincular el servicio a una estadía
      // y poder cargarlo luego al folio. Si el módulo está apagado, se ignora.
      try {
        const today = toISO(new Date())
        const to = toISO(new Date(new Date().getFullYear() + 1, 0, 1))
        const rres = await fetch(`/api/hotel-reservations?from=${today}&to=${to}`, {
          headers: authHeaders(),
          cache: "no-store",
        })
        const rdata = await rres.json().catch(() => ({}))
        const list: ActiveReservation[] = rres.ok ? rdata.reservations || [] : []
        setReservations(list.filter((r) => r.status === "checkin" || r.status === "confirmada"))
      } catch {
        setReservations([])
      }
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

  const serviceById = useMemo(() => {
    const map = new Map<string, Service>()
    services.forEach((s) => map.set(s.id, s))
    return map
  }, [services])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/resort-services", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createService() {
    if (!name.trim()) return
    const ok = await post({
      action: "saveService",
      name: name.trim(),
      kind,
      price: Number(price) || 0,
      capacity: Number(capacity) || 1,
    })
    if (ok) {
      setName("")
      setPrice("")
      setCapacity("1")
    }
  }

  async function createBooking() {
    if (!bServiceId || !bDate) return
    const ok = await post({
      action: "createBooking",
      serviceId: bServiceId,
      date: bDate,
      time: bTime.trim(),
      people: Number(bPeople) || 1,
      guestName: bGuest.trim(),
      reservationId: bReservationId,
    })
    if (ok) {
      setBGuest("")
      setBPeople("1")
      setBReservationId("")
    }
  }

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  const upcoming = useMemo(
    () => bookings.filter((b) => b.status !== "cancelada"),
    [bookings],
  )

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Sparkles size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Servicios y actividades</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Spa, tours, clases y más. Cada servicio tiene cupo por franja; las reservas lo respetan.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para servicios del resort, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Alta de servicio */}
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Plus size={16} /> Nuevo servicio
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre (Masaje, Tour cascada…)"
                  className={`${inputClass} sm:col-span-2`}
                />
                <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Precio"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Cupo por franja"
                  className={`${inputClass} sm:col-span-2`}
                />
                <button
                  onClick={createService}
                  disabled={busy || !name.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  <Plus size={16} /> Agregar servicio
                </button>
              </div>

              {services.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <li
                      key={s.id}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-sm font-bold"
                    >
                      <span className="text-[var(--brand-ink-3)]">{s.name}</span>
                      <span className="text-[var(--brand-ink-2)]/55">
                        {KIND_LABELS[s.kind]} · ${s.price} · cupo {s.capacity}
                      </span>
                      <button
                        onClick={() => post({ action: "deleteService", id: s.id })}
                        disabled={busy}
                        title="Eliminar servicio"
                        className="text-red-500 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Nueva reserva de servicio */}
            {services.length > 0 && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  <CalendarRange size={16} /> Reservar un servicio
                </h2>
                <div className="mt-3 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                  <select value={bServiceId} onChange={(e) => setBServiceId(e.target.value)} className={inputClass}>
                    <option value="">Servicio…</option>
                    {services.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (cupo {s.capacity})
                      </option>
                    ))}
                  </select>
                  {reservations.length > 0 ? (
                    <select
                      value={bReservationId}
                      onChange={(e) => {
                        const id = e.target.value
                        setBReservationId(id)
                        const r = reservations.find((x) => x.id === id)
                        if (r) setBGuest(r.guestName)
                      }}
                      className={inputClass}
                    >
                      <option value="">Sin vincular a estadía</option>
                      {reservations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.guestName} (en casa)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={bGuest} onChange={(e) => setBGuest(e.target.value)} placeholder="Huésped (opcional)" className={inputClass} />
                  )}
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                    <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Fecha</span>
                    <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value || toISO(new Date()))} className="w-full bg-transparent font-bold outline-none" />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                    <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Hora</span>
                    <input type="time" value={bTime} onChange={(e) => setBTime(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                    <Users size={16} className="shrink-0 text-[var(--brand-primary)]" />
                    <input type="number" min={1} value={bPeople} onChange={(e) => setBPeople(e.target.value)} placeholder="Personas" className="w-full bg-transparent font-bold outline-none" />
                  </label>
                  <button
                    onClick={createBooking}
                    disabled={busy || !bServiceId}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                  >
                    <Plus size={16} /> Reservar
                  </button>
                </div>
              </section>
            )}

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Reservas próximas */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : upcoming.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay reservas de servicio próximas.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {upcoming.map((b) => {
                  const service = serviceById.get(b.serviceId)
                  return (
                    <li key={b.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-black text-[var(--brand-ink-3)]">
                            {service?.name || "Servicio"}
                            {b.guestName ? (
                              <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">· {b.guestName}</span>
                            ) : null}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                            <span className="inline-flex items-center gap-1">
                              <CalendarRange size={14} /> {b.date}{b.time ? ` · ${b.time}` : ""}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users size={14} /> {b.people}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink-2)]/70">
                            {STATUS_LABELS[b.status] || b.status}
                          </span>
                          {b.status === "reservada" && (
                            <button
                              onClick={() => post({ action: "bookingStatus", id: b.id, status: "cumplida" })}
                              disabled={busy}
                              title="Marcar cumplida"
                              className="inline-flex items-center justify-center rounded-full border-2 border-green-600/30 bg-green-50 p-1.5 text-green-700 disabled:opacity-50"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => post({ action: "bookingStatus", id: b.id, status: "cancelada" })}
                            disabled={busy}
                            title="Cancelar"
                            className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
