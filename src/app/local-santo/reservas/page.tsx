"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Loader2,
  Phone,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { RESERVATION_STATUS_LABELS } from "@/lib/reservationConflicts"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Reservation = {
  id: string
  tableId: string
  tableName: string
  customerName: string
  customerPhone: string
  partySize: number
  reservationDate: string
  startTime: string
  endTime: string
  status: keyof typeof RESERVATION_STATUS_LABELS
  note: string
}

type LocalTable = { id: string; name: string; area: string }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export default function ReservasPage() {
  return (
    <ModuleAccessGuard moduleKey="reservations" moduleName="Reservas">
      <ReservasPageContent />
    </ModuleAccessGuard>
  )
}

function ReservasPageContent() {
  const [date, setDate] = useState(todayISO())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<LocalTable[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [tableId, setTableId] = useState("")
  const [partySize, setPartySize] = useState("2")
  const [startTime, setStartTime] = useState("19:00")
  const [endTime, setEndTime] = useState("21:00")
  const [note, setNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/reservations?date=${encodeURIComponent(date)}`, {
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
      setTables(data.tables || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const activeCount = useMemo(
    () => reservations.filter((r) => r.status === "activa").length,
    [reservations]
  )

  async function create() {
    if (!customerName.trim() || !tableId) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          tableId,
          partySize: Number(partySize) || 2,
          reservationDate: date,
          startTime,
          endTime,
          note: note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la reserva")
      setCustomerName("")
      setCustomerPhone("")
      setNote("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(reservation: Reservation, status: Reservation["status"]) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(reservation: Reservation) {
    if (!window.confirm(`¿Eliminar la reserva de "${reservation.customerName}"?`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const statusStyles: Record<Reservation["status"], string> = {
    activa: "border-green-600/30 bg-green-50 text-green-700",
    completada: "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)]",
    cancelada: "border-red-200 bg-red-50 text-red-600",
    no_show: "border-amber-300 bg-amber-50 text-amber-700",
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <CalendarClock size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Reservas</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Reservas por mesa y franja horaria. La mesa reservada se bloquea en el pedido del
              cliente durante su franja.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar reservas, o el módulo está desactivado en la
            configuración del negocio.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 font-bold">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Día
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayISO())}
                  className="bg-transparent font-bold outline-none"
                />
              </label>
              <span className="text-sm font-bold text-[var(--brand-ink-2)]/60">
                {activeCount} activa{activeCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="">Elige la mesa…</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                    {table.area ? ` · ${table.area}` : ""}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                <Users size={16} className="shrink-0 text-[var(--brand-primary)]" />
                <input
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                  placeholder="Personas"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">De</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">A</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional): cumpleaños, silla de bebé…"
                className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)] sm:col-span-2"
              />
              <button
                onClick={create}
                disabled={busy || !customerName.trim() || !tableId}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-2"
              >
                <Plus size={16} /> Reservar
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : reservations.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay reservas para este día.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {reservations.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[var(--brand-ink-3)]">
                          {reservation.startTime}–{reservation.endTime} · {reservation.tableName || reservation.tableId}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span>{reservation.customerName}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users size={14} /> {reservation.partySize}
                          </span>
                          {reservation.customerPhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={14} /> {reservation.customerPhone}
                            </span>
                          )}
                        </p>
                        {reservation.note && (
                          <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/55">
                            {reservation.note}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${statusStyles[reservation.status]}`}
                      >
                        {RESERVATION_STATUS_LABELS[reservation.status]}
                      </span>
                    </div>

                    {reservation.status === "activa" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setStatus(reservation, "completada")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border border-green-600/30 bg-green-50 px-3 py-1.5 text-xs font-bold uppercase text-green-700 disabled:opacity-50"
                        >
                          <Check size={14} /> Llegó
                        </button>
                        <button
                          onClick={() => setStatus(reservation, "no_show")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase text-amber-700 disabled:opacity-50"
                        >
                          No llegó
                        </button>
                        <button
                          onClick={() => setStatus(reservation, "cancelada")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold uppercase text-red-600 disabled:opacity-50"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button
                          onClick={() => remove(reservation)}
                          disabled={busy}
                          title="Eliminar reserva"
                          className="ml-auto inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
