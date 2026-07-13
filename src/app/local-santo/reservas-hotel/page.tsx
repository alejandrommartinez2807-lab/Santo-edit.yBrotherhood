"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  Check,
  LogIn,
  LogOut,
  Loader2,
  Phone,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  HOTEL_RESERVATION_STATUS_LABELS,
  findRoomStayConflict,
  isValidStayRange,
  nightsBetween,
  type HotelReservationStatus,
} from "@/lib/hotelReservationConflicts"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type RoomType = { id: string; name: string; baseRate: number }
type Room = {
  id: string
  name: string
  roomTypeId: string
  baseRate: number | null
  outOfService: boolean
  active: boolean
}
type HotelReservation = {
  id: string
  code: string
  roomId: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
  nights: number
  adults: number
  children: number
  ratePerNight: number
  totalAmount: number
  status: HotelReservationStatus
  note: string
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

const STATUS_STYLES: Record<HotelReservationStatus, string> = {
  pendiente: "border-amber-300 bg-amber-50 text-amber-700",
  confirmada: "border-blue-300 bg-blue-50 text-blue-700",
  checkin: "border-green-600/30 bg-green-50 text-green-700",
  checkout: "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary)]",
  cancelada: "border-red-200 bg-red-50 text-red-600",
  no_show: "border-red-200 bg-red-50 text-red-600",
}

export default function ReservasHotelPage() {
  return (
    <ModuleAccessGuard moduleKey="hotelReservations" moduleName="Reservas del hotel">
      <ReservasHotelContent />
    </ModuleAccessGuard>
  )
}

function ReservasHotelContent() {
  const [reservations, setReservations] = useState<HotelReservation[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [checkIn, setCheckIn] = useState(todayISO())
  const [checkOut, setCheckOut] = useState(addDaysISO(todayISO(), 1))
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [roomId, setRoomId] = useState("")
  const [adults, setAdults] = useState("2")
  const [children, setChildren] = useState("0")
  const [rate, setRate] = useState("")
  const [note, setNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const from = todayISO()
      const to = addDaysISO(from, 120)
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
      setRooms(data.rooms || [])
      setRoomTypes(data.roomTypes || [])
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

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut])
  const validRange = useMemo(() => isValidStayRange({ checkIn, checkOut }), [checkIn, checkOut])

  const rateByRoom = useCallback(
    (room: Room) => {
      if (room.baseRate !== null && room.baseRate !== undefined) return room.baseRate
      const type = roomTypes.find((t) => t.id === room.roomTypeId)
      return type?.baseRate ?? 0
    },
    [roomTypes],
  )

  // Habitaciones libres para el rango elegido (excluye fuera de servicio y solapes).
  const availableRooms = useMemo(() => {
    if (!validRange) return []
    return rooms.filter((room) => {
      if (!room.active || room.outOfService) return false
      const conflict = findRoomStayConflict(
        reservations.map((r) => ({
          id: r.id,
          roomId: r.roomId,
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          status: r.status,
        })),
        { roomId: room.id, range: { checkIn, checkOut } },
      )
      return !conflict
    })
  }, [rooms, reservations, validRange, checkIn, checkOut])

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>()
    rooms.forEach((r) => map.set(r.id, r.name))
    return map
  }, [rooms])

  // Al elegir habitación, precarga su tarifa.
  function selectRoom(id: string) {
    setRoomId(id)
    const room = rooms.find((r) => r.id === id)
    if (room) setRate(String(rateByRoom(room)))
  }

  const effectiveRate = Number(rate) || 0
  const total = effectiveRate * nights

  async function create() {
    if (!guestName.trim() || !validRange) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/hotel-reservations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          roomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: Number(adults) || 1,
          children: Number(children) || 0,
          ratePerNight: effectiveRate,
          note: note.trim(),
          status: "confirmada",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la reserva")
      setGuestName("")
      setGuestPhone("")
      setNote("")
      setRoomId("")
      setRate("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(reservation: HotelReservation, status: HotelReservationStatus) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/hotel-reservations/${reservation.id}`, {
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

  async function remove(reservation: HotelReservation) {
    if (!window.confirm(`¿Eliminar la reserva de "${reservation.guestName}"?`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/hotel-reservations/${reservation.id}`, {
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

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  const upcoming = useMemo(
    () =>
      [...reservations].sort((a, b) =>
        a.checkInDate === b.checkInDate
          ? a.guestName.localeCompare(b.guestName)
          : a.checkInDate.localeCompare(b.checkInDate),
      ),
    [reservations],
  )

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
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
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Reservas del hotel</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Reservas por rango de noches con disponibilidad, tarifa y check-in / check-out.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar reservas del hotel, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Rango + disponibilidad */}
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Entrada</span>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => {
                    const value = e.target.value || todayISO()
                    setCheckIn(value)
                    if (checkOut <= value) setCheckOut(addDaysISO(value, 1))
                  }}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Salida</span>
                <input
                  type="date"
                  value={checkOut}
                  min={addDaysISO(checkIn, 1)}
                  onChange={(e) => setCheckOut(e.target.value || addDaysISO(checkIn, 1))}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <div className="flex items-center justify-center rounded-xl bg-[var(--brand-cream)] px-4 py-2.5 text-center text-sm font-black text-[var(--brand-ink-3)]">
                {validRange ? (
                  <span>
                    {nights} noche{nights === 1 ? "" : "s"} · {availableRooms.length} libre
                    {availableRooms.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-red-600">Revisa las fechas</span>
                )}
              </div>
            </div>

            {/* Alta de reserva */}
            <div className="mt-4 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nombre del huésped"
                className={inputClass}
              />
              <input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className={inputClass}
              />
              <select value={roomId} onChange={(e) => selectRoom(e.target.value)} className={inputClass}>
                <option value="">Habitación libre…</option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · ${rateByRoom(room)}/noche
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">$/noche</span>
                <input
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Tarifa"
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                <Users size={16} className="shrink-0 text-[var(--brand-primary)]" />
                <input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                  placeholder="Adultos"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Niños</span>
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                  placeholder="Niños"
                />
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional): llegada tarde, cuna…"
                className={`${inputClass} sm:col-span-2`}
              />
              <div className="flex items-center justify-between rounded-xl bg-[var(--brand-cream)] px-4 py-3 font-black text-[var(--brand-ink-3)] sm:col-span-2">
                <span>Total estadía</span>
                <span>
                  ${total} <span className="text-sm font-bold text-[var(--brand-ink-2)]/60">({nights}n × ${effectiveRate})</span>
                </span>
              </div>
              <button
                onClick={create}
                disabled={busy || !guestName.trim() || !validRange}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
              >
                <Plus size={16} /> Crear reserva
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de reservas */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : upcoming.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay reservas próximas. Crea la primera arriba.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {upcoming.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          {reservation.guestName}
                          <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/45">
                            #{reservation.code}
                          </span>
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange size={14} /> {reservation.checkInDate} → {reservation.checkOutDate}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BedDouble size={14} /> {roomNameById.get(reservation.roomId) || "Sin asignar"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users size={14} /> {reservation.adults}
                            {reservation.children ? `+${reservation.children}` : ""}
                          </span>
                          {reservation.guestPhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={14} /> {reservation.guestPhone}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm font-black text-[var(--brand-ink-3)]">
                          ${reservation.totalAmount}
                          <span className="ml-1 text-xs font-bold text-[var(--brand-ink-2)]/55">
                            ({reservation.nights}n × ${reservation.ratePerNight})
                          </span>
                        </p>
                        {reservation.note && (
                          <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/55">{reservation.note}</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${STATUS_STYLES[reservation.status]}`}
                      >
                        {HOTEL_RESERVATION_STATUS_LABELS[reservation.status]}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {reservation.status === "pendiente" && (
                        <button
                          onClick={() => setStatus(reservation, "confirmada")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border-2 border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-black uppercase text-blue-700 disabled:opacity-50"
                        >
                          <Check size={14} /> Confirmar
                        </button>
                      )}
                      {(reservation.status === "pendiente" || reservation.status === "confirmada") && (
                        <button
                          onClick={() => setStatus(reservation, "checkin")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border-2 border-green-600/30 bg-green-50 px-3 py-1.5 text-xs font-black uppercase text-green-700 disabled:opacity-50"
                        >
                          <LogIn size={14} /> Check-in
                        </button>
                      )}
                      {reservation.status === "checkin" && (
                        <button
                          onClick={() => setStatus(reservation, "checkout")}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          <LogOut size={14} /> Check-out
                        </button>
                      )}
                      {(reservation.status === "pendiente" || reservation.status === "confirmada") && (
                        <>
                          <button
                            onClick={() => setStatus(reservation, "no_show")}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase text-amber-700 disabled:opacity-50"
                          >
                            No llegó
                          </button>
                          <button
                            onClick={() => setStatus(reservation, "cancelada")}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-full border-2 border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black uppercase text-red-600 disabled:opacity-50"
                          >
                            <X size={14} /> Cancelar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => remove(reservation)}
                        disabled={busy}
                        title="Eliminar reserva"
                        className="ml-auto inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
