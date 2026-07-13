"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

const HOUSEKEEPING_LABELS: Record<string, string> = {
  limpia: "Limpia",
  sucia: "Sucia",
  inspeccion: "Inspección",
  mantenimiento: "Mantenimiento",
}

const HOUSEKEEPING_STYLES: Record<string, string> = {
  limpia: "border-green-600/30 bg-green-50 text-green-700",
  sucia: "border-amber-300 bg-amber-50 text-amber-700",
  inspeccion: "border-blue-300 bg-blue-50 text-blue-700",
  mantenimiento: "border-red-200 bg-red-50 text-red-600",
}

type RoomType = {
  id: string
  name: string
  description: string
  baseCapacity: number
  maxCapacity: number
  baseRate: number
  sortOrder: number
  active: boolean
}

type Room = {
  id: string
  roomTypeId: string
  name: string
  floor: string
  capacity: number
  baseRate: number | null
  housekeepingStatus: string
  outOfService: boolean
  amenities: string
  notes: string
  active: boolean
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function HabitacionesPage() {
  return (
    <ModuleAccessGuard moduleKey="rooms" moduleName="Habitaciones">
      <HabitacionesPageContent />
    </ModuleAccessGuard>
  )
}

function HabitacionesPageContent() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Alta de tipo
  const [typeName, setTypeName] = useState("")
  const [typeRate, setTypeRate] = useState("")
  const [typeCapacity, setTypeCapacity] = useState("2")

  // Alta de habitación
  const [roomName, setRoomName] = useState("")
  const [roomFloor, setRoomFloor] = useState("")
  const [roomTypeId, setRoomTypeId] = useState("")
  const [roomCapacity, setRoomCapacity] = useState("2")
  const [roomRate, setRoomRate] = useState("")
  const [roomAmenities, setRoomAmenities] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
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

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>()
    roomTypes.forEach((type) => map.set(type.id, type.name))
    return map
  }, [roomTypes])

  async function createType() {
    if (!typeName.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          kind: "roomType",
          name: typeName.trim(),
          baseRate: Number(typeRate) || 0,
          baseCapacity: Number(typeCapacity) || 2,
          maxCapacity: Number(typeCapacity) || 2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear el tipo")
      setTypeName("")
      setTypeRate("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function createRoom() {
    if (!roomName.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: roomName.trim(),
          floor: roomFloor.trim(),
          roomTypeId,
          capacity: Number(roomCapacity) || 2,
          baseRate: roomRate.trim() === "" ? null : Number(roomRate) || 0,
          amenities: roomAmenities.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la habitación")
      setRoomName("")
      setRoomFloor("")
      setRoomRate("")
      setRoomAmenities("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function setHousekeeping(room: Room, status: string) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ housekeepingStatus: status }),
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

  async function removeRoom(room: Room) {
    if (!window.confirm(`¿Eliminar la habitación "${room.name}"?`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
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

  async function removeType(type: RoomType) {
    if (!window.confirm(`¿Eliminar el tipo "${type.name}"? Las habitaciones de ese tipo quedarán sin tipo.`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/rooms/${type.id}?kind=roomType`, {
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
            <BedDouble size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Habitaciones</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Catálogo de habitaciones y tipos con tarifa base, capacidad y estado de limpieza.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar habitaciones, o el módulo está desactivado en la
            configuración del negocio.
          </p>
        ) : (
          <>
            {/* Tipos de habitación */}
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Tag size={16} /> Tipos de habitación
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
                <input
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="Nombre (Doble, Suite…)"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  type="number"
                  min={0}
                  value={typeRate}
                  onChange={(e) => setTypeRate(e.target.value)}
                  placeholder="Tarifa/noche"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  value={typeCapacity}
                  onChange={(e) => setTypeCapacity(e.target.value)}
                  placeholder="Capacidad"
                  className={inputClass}
                />
                <button
                  onClick={createType}
                  disabled={busy || !typeName.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-4"
                >
                  <Plus size={16} /> Agregar tipo
                </button>
              </div>

              {roomTypes.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {roomTypes.map((type) => (
                    <li
                      key={type.id}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-sm font-bold"
                    >
                      <span className="text-[var(--brand-ink-3)]">{type.name}</span>
                      <span className="text-[var(--brand-ink-2)]/60">
                        ${type.baseRate} · {type.baseCapacity}p
                      </span>
                      <button
                        onClick={() => removeType(type)}
                        disabled={busy}
                        title="Eliminar tipo"
                        className="text-red-500 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Alta de habitación */}
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Plus size={16} /> Nueva habitación
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Número o nombre (101, Suite Mar)"
                  className={inputClass}
                />
                <input
                  value={roomFloor}
                  onChange={(e) => setRoomFloor(e.target.value)}
                  placeholder="Piso (opcional)"
                  className={inputClass}
                />
                <select
                  value={roomTypeId}
                  onChange={(e) => setRoomTypeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Tipo de habitación…</option>
                  {roomTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(e.target.value)}
                  placeholder="Capacidad"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  value={roomRate}
                  onChange={(e) => setRoomRate(e.target.value)}
                  placeholder="Tarifa propia (vacío = usa la del tipo)"
                  className={inputClass}
                />
                <input
                  value={roomAmenities}
                  onChange={(e) => setRoomAmenities(e.target.value)}
                  placeholder="Amenidades (TV, A/C, Balcón…)"
                  className={inputClass}
                />
                <button
                  onClick={createRoom}
                  disabled={busy || !roomName.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  <Plus size={16} /> Agregar habitación
                </button>
              </div>
            </section>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de habitaciones */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : rooms.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay habitaciones. Crea un tipo y luego agrega habitaciones.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          {room.name}
                          {room.floor ? (
                            <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                              · Piso {room.floor}
                            </span>
                          ) : null}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span>{typeNameById.get(room.roomTypeId) || "Sin tipo"}</span>
                          <span>{room.capacity}p</span>
                          {room.baseRate !== null && <span>${room.baseRate}/noche</span>}
                          {room.outOfService && (
                            <span className="text-red-600">Fuera de servicio</span>
                          )}
                        </p>
                        {room.amenities && (
                          <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink-2)]/55">
                            <Sparkles size={13} /> {room.amenities}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                          HOUSEKEEPING_STYLES[room.housekeepingStatus] || HOUSEKEEPING_STYLES.limpia
                        }`}
                      >
                        {HOUSEKEEPING_LABELS[room.housekeepingStatus] || room.housekeepingStatus}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {Object.keys(HOUSEKEEPING_LABELS).map((status) => (
                        <button
                          key={status}
                          onClick={() => setHousekeeping(room, status)}
                          disabled={busy || room.housekeepingStatus === status}
                          className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase disabled:opacity-40 ${
                            room.housekeepingStatus === status
                              ? HOUSEKEEPING_STYLES[status]
                              : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
                          }`}
                        >
                          {HOUSEKEEPING_LABELS[status]}
                        </button>
                      ))}
                      <button
                        onClick={() => removeRoom(room)}
                        disabled={busy}
                        title="Eliminar habitación"
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
