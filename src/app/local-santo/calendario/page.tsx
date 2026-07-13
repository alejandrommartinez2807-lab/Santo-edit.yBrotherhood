"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  buildTapeChart,
  type CalendarBlock,
  type CalendarReservation,
  type CalendarRoom,
} from "@/lib/hotelCalendar"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Room = {
  id: string
  name: string
  floor: string
  outOfService: boolean
  sortOrder?: number
}
type Reservation = {
  id: string
  roomId: string
  code: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  status: string
}

const STATE_STYLES: Record<string, string> = {
  free: "bg-white",
  occupied: "bg-[var(--brand-primary)]/85 text-white",
  out: "bg-[var(--brand-ink-2)]/15 text-[var(--brand-ink-2)]/50",
  blocked:
    "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.12)_4px,rgba(0,0,0,0.12)_8px)] bg-amber-100",
}

const STATUS_DOT: Record<string, string> = {
  pendiente: "bg-amber-300",
  confirmada: "bg-blue-300",
  checkin: "bg-green-400",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
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
function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  const wd = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"][d.getDay()]
  return { wd, day: String(d.getDate()), weekend: d.getDay() === 0 || d.getDay() === 6 }
}

export default function CalendarioPage() {
  return (
    <ModuleAccessGuard moduleKey="tapeChart" moduleName="Calendario">
      <CalendarioContent />
    </ModuleAccessGuard>
  )
}

function CalendarioContent() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")

  const [start, setStart] = useState(todayISO())
  const [windowDays, setWindowDays] = useState(14)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const to = addDaysISO(start, windowDays)
      const res = await fetch(`/api/hotel-reservations?from=${start}&to=${to}`, {
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
      setRooms(data.rooms || [])
      setReservations(data.reservations || [])

      // Bloqueos: best-effort (si el módulo está apagado, se ignora sin romper).
      try {
        const bres = await fetch(`/api/room-blocks?from=${start}&to=${to}`, {
          headers: authHeaders(),
          cache: "no-store",
        })
        const bdata = await bres.json().catch(() => ({}))
        setBlocks(bres.ok ? bdata.blocks || [] : [])
      } catch {
        setBlocks([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [start, windowDays])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const chart = useMemo(
    () =>
      buildTapeChart({
        rooms: rooms as CalendarRoom[],
        reservations: reservations as CalendarReservation[],
        blocks,
        startDate: start,
        days: windowDays,
      }),
    [rooms, reservations, blocks, start, windowDays],
  )

  const totalRooms = useMemo(() => rooms.filter((r) => !r.outOfService).length, [rooms])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <CalendarRange size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Calendario</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Ocupación por habitación y día. Quién entra, quién sale y qué queda libre.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para ver el calendario, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Controles */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStart(addDaysISO(start, -windowDays))}
                className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                onClick={() => setStart(todayISO())}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]"
              >
                Hoy
              </button>
              <button
                onClick={() => setStart(addDaysISO(start, windowDays))}
                className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]"
              >
                Siguiente <ChevronRight size={14} />
              </button>
              <label className="ml-auto flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Desde</span>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value || todayISO())}
                  className="bg-transparent font-bold outline-none"
                />
              </label>
              <select
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value) || 14)}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 font-bold text-[var(--brand-ink-3)] outline-none"
              >
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
              </select>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : rooms.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay habitaciones. Créalas en el módulo Habitaciones.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[120px] border-b-2 border-r-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-2 text-left text-xs font-black uppercase text-[var(--brand-primary)]">
                        Habitación
                      </th>
                      {chart.days.map((d, i) => {
                        const { wd, day, weekend } = dayLabel(d)
                        return (
                          <th
                            key={d}
                            className={`min-w-[38px] border-b-2 border-[var(--brand-primary)]/15 px-1 py-2 text-center text-[11px] font-black ${
                              weekend ? "bg-[var(--brand-accent)]/40" : "bg-[var(--brand-cream)]"
                            }`}
                          >
                            <div className="text-[var(--brand-ink-2)]/55">{wd}</div>
                            <div className="text-[var(--brand-ink-3)]">{day}</div>
                            <div className="mt-0.5 text-[9px] font-bold text-[var(--brand-ink-2)]/45">
                              {chart.occupancyByDay[i]}/{totalRooms}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.rows.map((row) => (
                      <tr key={row.room.id}>
                        <td className="sticky left-0 z-10 border-r-2 border-b border-[var(--brand-primary)]/15 bg-white px-3 py-1.5 font-black text-[var(--brand-ink-3)]">
                          {row.room.name}
                          {row.room.floor ? (
                            <span className="ml-1 text-[11px] font-bold text-[var(--brand-ink-2)]/45">
                              P{row.room.floor}
                            </span>
                          ) : null}
                        </td>
                        {row.cells.map((cell) => (
                          <td
                            key={cell.date}
                            title={
                              cell.state === "occupied"
                                ? `${cell.guestName || ""} (#${cell.code || ""})`
                                : cell.state === "out"
                                  ? "Fuera de servicio"
                                  : cell.state === "blocked"
                                    ? `Bloqueo${cell.reason ? `: ${cell.reason}` : ""}`
                                    : "Libre"
                            }
                            className={`relative border-b border-l border-[var(--brand-primary)]/10 px-0.5 py-2 text-center align-middle ${STATE_STYLES[cell.state]}`}
                          >
                            {cell.state === "occupied" && cell.isStart ? (
                              <span className="pointer-events-none absolute left-0.5 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded px-1 text-[10px] font-black text-white">
                                <span
                                  className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[cell.status || ""] || "bg-white"}`}
                                />
                                {(cell.guestName || "").split(" ")[0]}
                              </span>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Leyenda */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-[var(--brand-ink-2)]/70">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border border-[var(--brand-primary)]/20 bg-white" /> Libre
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-[var(--brand-primary)]/85" /> Ocupada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-[var(--brand-ink-2)]/15" /> Fuera de servicio
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-amber-100" /> Bloqueada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-300" /> Pendiente
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-300" /> Confirmada
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-400" /> Check-in
              </span>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
