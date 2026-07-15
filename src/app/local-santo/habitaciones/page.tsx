"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
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

type RoomTypePhoto = { url: string; caption: string }

type RoomType = {
  id: string
  name: string
  description: string
  baseCapacity: number
  maxCapacity: number
  baseRate: number
  photos: RoomTypePhoto[]
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

// Estadías para la ficha de la habitación (actual, próxima e historial).
type RoomStay = {
  id: string
  roomId: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  status: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function isoDaysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

  // Galería de fotos por tipo
  const [photoTypeId, setPhotoTypeId] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [photoCaption, setPhotoCaption] = useState("")

  // Alta de habitación
  const [roomName, setRoomName] = useState("")
  const [roomFloor, setRoomFloor] = useState("")
  const [roomTypeId, setRoomTypeId] = useState("")
  const [roomCapacity, setRoomCapacity] = useState("2")
  const [roomRate, setRoomRate] = useState("")
  const [roomAmenities, setRoomAmenities] = useState("")

  // Alta en serie (pisos completos)
  const [bulkTypeId, setBulkTypeId] = useState("")
  const [bulkFrom, setBulkFrom] = useState("")
  const [bulkTo, setBulkTo] = useState("")
  const [bulkFloor, setBulkFloor] = useState("")
  const [bulkCapacity, setBulkCapacity] = useState("2")
  const [bulkMessage, setBulkMessage] = useState("")

  // Ficha de la habitación: estadías (actual/próxima/historial) y saldos de folio.
  const [stays, setStays] = useState<RoomStay[]>([])
  const [folioBalances, setFolioBalances] = useState<Record<string, number>>({})
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const loadStays = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/hotel-reservations?from=${isoDaysFromNow(-90)}&to=${isoDaysFromNow(60)}`,
        { headers: authHeaders(), cache: "no-store" },
      )
      if (!res.ok) return
      const data = await res.json()
      const list: RoomStay[] = Array.isArray(data.reservations) ? data.reservations : []
      setStays(list)

      // Saldo del folio solo para los huéspedes en casa (pocas consultas).
      const inHouse = list.filter((stay) => stay.status === "checkin")
      const balances = await Promise.all(
        inHouse.map(async (stay) => {
          try {
            const folioRes = await fetch(`/api/folios?reservationId=${stay.id}`, {
              headers: authHeaders(),
              cache: "no-store",
            })
            if (!folioRes.ok) return null
            const folioData = await folioRes.json()
            return [stay.id, Number(folioData.balance) || 0] as const
          } catch {
            return null
          }
        }),
      )
      setFolioBalances(Object.fromEntries(balances.filter(Boolean) as [string, number][]))
    } catch {
      // La ficha muestra "Libre" si esto falla; el CRUD de habitaciones no depende.
    }
  }, [])

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
    const timer = setTimeout(() => {
      void load()
      void loadStays()
    }, 0)
    return () => clearTimeout(timer)
  }, [load, loadStays])

  const today = isoDaysFromNow(0)

  // Estadía actual, próxima llegada e historial por habitación.
  const staysByRoom = useMemo(() => {
    const map = new Map<string, { current?: RoomStay; next?: RoomStay; pastCount: number }>()
    for (const stay of stays) {
      const entry = map.get(stay.roomId) || { pastCount: 0 }
      if (stay.status === "checkin") {
        entry.current = stay
      } else if (
        (stay.status === "pendiente" || stay.status === "confirmada") &&
        stay.checkOutDate > today
      ) {
        if (!entry.next || stay.checkInDate < entry.next.checkInDate) entry.next = stay
      } else if (stay.status === "checkout") {
        entry.pastCount += 1
      }
      map.set(stay.roomId, entry)
    }
    return map
  }, [stays, today])

  // Guarda cambios puntuales de una habitación (notas, fuera de servicio…)
  // reenviando la ficha completa, que es lo que espera el endpoint.
  async function saveRoomPatch(room: Room, patch: Partial<Room>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          id: room.id,
          roomTypeId: room.roomTypeId,
          name: room.name,
          floor: room.floor,
          capacity: room.capacity,
          baseRate: room.baseRate,
          housekeepingStatus: room.housekeepingStatus,
          outOfService: room.outOfService,
          amenities: room.amenities,
          notes: room.notes,
          active: room.active,
          ...patch,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la habitación")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

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

  // Crea un rango de habitaciones numeradas de una vez (p. ej. 301 a 320).
  async function createRoomsBulk() {
    if (!bulkTypeId || !bulkFrom.trim() || !bulkTo.trim()) return
    setBusy(true)
    setError("")
    setBulkMessage("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          kind: "roomsBulk",
          roomTypeId: bulkTypeId,
          fromNumber: Number(bulkFrom),
          toNumber: Number(bulkTo),
          floor: bulkFloor.trim(),
          capacity: Number(bulkCapacity) || 2,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la serie")
      const created = Array.isArray(data.created) ? data.created.length : 0
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0
      setBulkMessage(
        `${created} habitación(es) creada(s)${skipped ? ` · ${skipped} ya existían (${data.skipped.join(", ")})` : ""}.`,
      )
      setBulkFrom("")
      setBulkTo("")
      await load()
      await loadStays()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  // Guarda la galería completa del tipo (el orden del arreglo es el orden público).
  async function saveTypePhotos(type: RoomType, photos: RoomTypePhoto[]) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          kind: "roomType",
          id: type.id,
          name: type.name,
          baseRate: type.baseRate,
          baseCapacity: type.baseCapacity,
          maxCapacity: type.maxCapacity,
          photos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la galería")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function addPhoto(type: RoomType) {
    const url = photoUrl.trim()
    if (!/^https?:\/\//i.test(url)) {
      setError("La foto debe ser un enlace directo que empiece por http(s)://")
      return
    }
    setPhotoUrl("")
    setPhotoCaption("")
    void saveTypePhotos(type, [...type.photos, { url, caption: photoCaption.trim() }])
  }

  // Sube un archivo local (foto del teléfono/PC) y lo agrega a la galería.
  async function uploadPhotoFile(type: RoomType, file: File) {
    setBusy(true)
    setError("")
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
        reader.readAsDataURL(file)
      })
      const res = await fetch("/api/rooms/upload-photo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          dataUrl,
          fileName: file.name,
          mimeType: file.type,
          typeName: type.name,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo subir la foto")
      const caption = photoCaption.trim()
      setPhotoCaption("")
      await saveTypePhotos(type, [...type.photos, { url: data.url, caption }])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function movePhoto(type: RoomType, index: number, delta: number) {
    const next = [...type.photos]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void saveTypePhotos(type, next)
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
    "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

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
            <BedDouble size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Habitaciones</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Catálogo de habitaciones y tipos con tarifa base, capacidad y estado de limpieza.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar habitaciones, o el módulo está desactivado en la
            configuración del negocio.
          </p>
        ) : (
          <>
            {/* Tipos de habitación */}
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Tag size={16} /> Tipos de habitación
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
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
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-4"
                >
                  <Plus size={16} /> Agregar tipo
                </button>
              </div>

              {roomTypes.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {roomTypes.map((type) => (
                    <li
                      key={type.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-sm font-bold"
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

            {/* Galería de fotos por tipo (se muestra en la página pública) */}
            {roomTypes.length > 0 && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  <ImageIcon size={16} /> Fotos por tipo
                </h2>
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]">
                  Estas fotos salen en la página pública: en la tarjeta del tipo y en la galería del
                  hotel. Pega el enlace directo de la imagen (http…jpg/png/webp).
                </p>
                <div className="mt-3 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    {roomTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setPhotoTypeId(type.id === photoTypeId ? "" : type.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${
                          type.id === photoTypeId
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[#171410]"
                            : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]"
                        }`}
                      >
                        {type.name}
                        <span className={type.id === photoTypeId ? "" : "text-[var(--brand-primary-dark)]"}>
                          {type.photos.length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {roomTypes
                    .filter((type) => type.id === photoTypeId)
                    .map((type) => (
                      <div key={type.id} className="mt-4">
                        {type.photos.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[var(--brand-primary)]/25 p-4 text-sm font-bold text-[var(--brand-ink-2)]">
                            {type.name} aún no tiene fotos. Agrega la primera abajo: será la portada
                            de la tarjeta en la página pública.
                          </p>
                        ) : (
                          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {type.photos.map((photo, index) => (
                              <li
                                key={`${photo.url}-${index}`}
                                className="overflow-hidden rounded-xl border border-[var(--brand-primary)]/20"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photo.url}
                                  alt={photo.caption || type.name}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                />
                                <div className="flex items-center justify-between gap-1 p-2">
                                  <p className="min-w-0 truncate text-xs font-bold text-[var(--brand-ink-2)]">
                                    {index === 0 ? "★ Portada" : photo.caption || `Foto ${index + 1}`}
                                  </p>
                                  <span className="flex shrink-0 items-center gap-1">
                                    <button
                                      onClick={() => movePhoto(type, index, -1)}
                                      disabled={busy || index === 0}
                                      title="Mover antes"
                                      className="text-[var(--brand-primary-dark)] disabled:opacity-30"
                                    >
                                      <ChevronLeft size={16} />
                                    </button>
                                    <button
                                      onClick={() => movePhoto(type, index, 1)}
                                      disabled={busy || index === type.photos.length - 1}
                                      title="Mover después"
                                      className="text-[var(--brand-primary-dark)] disabled:opacity-30"
                                    >
                                      <ChevronRight size={16} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        saveTypePhotos(
                                          type,
                                          type.photos.filter((_, i) => i !== index),
                                        )
                                      }
                                      disabled={busy}
                                      title="Quitar foto"
                                      className="text-red-500 disabled:opacity-50"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-3 grid gap-2 sm:grid-cols-6">
                          <input
                            value={photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            placeholder="https://… enlace directo de la imagen"
                            className={`${inputClass} sm:col-span-2`}
                          />
                          <input
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            placeholder="Descripción (opcional)"
                            className={`${inputClass} sm:col-span-2`}
                          />
                          <button
                            onClick={() => addPhoto(type)}
                            disabled={busy || !photoUrl.trim()}
                            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-[#171410] disabled:opacity-50"
                          >
                            <Plus size={16} /> Agregar
                          </button>
                          <label
                            className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold uppercase text-[var(--brand-primary-dark)] ${
                              busy ? "pointer-events-none opacity-50" : ""
                            }`}
                          >
                            <ImageIcon size={16} /> Subir foto
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={busy}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ""
                                if (file) void uploadPhotoFile(type, file)
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Alta de habitación */}
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Plus size={16} /> Nueva habitación
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
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
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  <Plus size={16} /> Agregar habitación
                </button>
              </div>

              {/* Alta en serie: pisos completos sin cargar una por una */}
              <h3 className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <BedDouble size={16} /> Crear en serie (piso completo)
              </h3>
              <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]">
                Crea habitaciones numeradas de una sola vez: elige el tipo y el rango
                (por ejemplo 501 a 520). Las que ya existan se saltan.
              </p>
              <div className="mt-3 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-6">
                <select
                  value={bulkTypeId}
                  onChange={(e) => setBulkTypeId(e.target.value)}
                  className={`${inputClass} sm:col-span-2`}
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
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  placeholder="Desde (501)"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  placeholder="Hasta (520)"
                  className={inputClass}
                />
                <input
                  value={bulkFloor}
                  onChange={(e) => setBulkFloor(e.target.value)}
                  placeholder="Piso (opcional)"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  value={bulkCapacity}
                  onChange={(e) => setBulkCapacity(e.target.value)}
                  placeholder="Capacidad"
                  className={inputClass}
                />
                <button
                  onClick={createRoomsBulk}
                  disabled={busy || !bulkTypeId || !bulkFrom.trim() || !bulkTo.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-[#171410] disabled:opacity-50 sm:col-span-6"
                >
                  <Plus size={16} /> Crear serie
                </button>
                {bulkMessage && (
                  <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700 sm:col-span-6">
                    {bulkMessage}
                  </p>
                )}
              </div>
            </section>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de habitaciones */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : rooms.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay habitaciones. Crea un tipo y luego agrega habitaciones.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[var(--brand-ink-3)]">
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
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${
                          HOUSEKEEPING_STYLES[room.housekeepingStatus] || HOUSEKEEPING_STYLES.limpia
                        }`}
                      >
                        {HOUSEKEEPING_LABELS[room.housekeepingStatus] || room.housekeepingStatus}
                      </span>
                    </div>

                    {/* Estadía actual / próxima llegada / historial + saldo del folio */}
                    {(() => {
                      const info = staysByRoom.get(room.id)
                      const balance = info?.current ? folioBalances[info.current.id] : undefined
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[var(--brand-cream)] px-3 py-2 text-sm font-bold text-[var(--brand-ink-2)]">
                          {info?.current ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 text-green-700">
                                <BedDouble size={14} /> {info.current.guestName} · sale{" "}
                                {info.current.checkOutDate}
                              </span>
                              {balance !== undefined && (
                                <span className={balance > 0 ? "text-amber-700" : "text-green-700"}>
                                  Saldo del folio: ${balance}
                                </span>
                              )}
                              <Link
                                href="/local-santo/folio"
                                className="text-[var(--brand-primary-dark)] underline-offset-2 hover:underline"
                              >
                                Abrir folio
                              </Link>
                            </>
                          ) : info?.next ? (
                            <span>
                              Próxima llegada: {info.next.guestName} · {info.next.checkInDate}
                            </span>
                          ) : (
                            <span>Libre — sin llegadas próximas</span>
                          )}
                          {info && info.pastCount > 0 && (
                            <span className="text-[var(--brand-ink-2)]">
                              {info.pastCount} estadía(s) previa(s) en 90 días
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {Object.keys(HOUSEKEEPING_LABELS).map((status) => (
                        <button
                          key={status}
                          onClick={() => setHousekeeping(room, status)}
                          disabled={busy || room.housekeepingStatus === status}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40 ${
                            room.housekeepingStatus === status
                              ? HOUSEKEEPING_STYLES[status]
                              : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
                          }`}
                        >
                          {HOUSEKEEPING_LABELS[status]}
                        </button>
                      ))}
                      <button
                        onClick={() => saveRoomPatch(room, { outOfService: !room.outOfService })}
                        disabled={busy}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40 ${
                          room.outOfService
                            ? "border-red-300 bg-red-50 text-red-600"
                            : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/70"
                        }`}
                      >
                        {room.outOfService ? "Volver a servicio" : "Fuera de servicio"}
                      </button>
                      <button
                        onClick={() => removeRoom(room)}
                        disabled={busy}
                        title="Eliminar habitación"
                        className="ml-auto inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Notas internas de la habitación */}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={notesDraft[room.id] ?? room.notes}
                        onChange={(e) =>
                          setNotesDraft((draft) => ({ ...draft, [room.id]: e.target.value }))
                        }
                        placeholder="Notas internas (vista al jardín, ruido del ascensor…)"
                        className="w-full rounded-xl border border-[var(--brand-primary)]/15 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                      />
                      {(notesDraft[room.id] ?? room.notes) !== room.notes && (
                        <button
                          onClick={() =>
                            saveRoomPatch(room, { notes: notesDraft[room.id] ?? "" }).then(() =>
                              setNotesDraft((draft) => {
                                const next = { ...draft }
                                delete next[room.id]
                                return next
                              }),
                            )
                          }
                          disabled={busy}
                          className="shrink-0 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold uppercase text-[#171410] disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      )}
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
