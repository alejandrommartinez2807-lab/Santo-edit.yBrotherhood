"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarRange,
  Loader2,
  Plus,
  Tag,
  Trash2,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { quoteStay, type RateSeasonLike } from "@/lib/rateSeasons"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type RoomType = { id: string; name: string; baseRate: number }

type Season = {
  id: string
  roomTypeId: string
  name: string
  startDate: string
  endDate: string
  mode: string
  rate: number
  multiplier: number
  priority: number
  active: boolean
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

export default function TarifasPage() {
  return (
    <ModuleAccessGuard moduleKey="rateSeasons" moduleName="Tarifas por temporada">
      <TarifasPageContent />
    </ModuleAccessGuard>
  )
}

function TarifasPageContent() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Alta de temporada
  const [name, setName] = useState("")
  const [roomTypeId, setRoomTypeId] = useState("")
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 7))
  const [mode, setMode] = useState("fija")
  const [rate, setRate] = useState("")
  const [multiplier, setMultiplier] = useState("1.2")
  const [priority, setPriority] = useState("0")

  // Previsualización de cotización
  const [previewTypeId, setPreviewTypeId] = useState("")
  const [previewIn, setPreviewIn] = useState(todayISO())
  const [previewOut, setPreviewOut] = useState(addDaysISO(todayISO(), 2))

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/rate-seasons", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setSeasons(data.seasons || [])
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

  async function createSeason() {
    if (!name.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate-seasons", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          roomTypeId,
          startDate,
          endDate,
          mode,
          rate: mode === "fija" ? Number(rate) || 0 : 0,
          multiplier: mode === "factor" ? Number(multiplier) || 1 : 1,
          priority: Number(priority) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear la temporada")
      setName("")
      setRate("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(season: Season) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate-seasons", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          id: season.id,
          name: season.name,
          roomTypeId: season.roomTypeId,
          startDate: season.startDate,
          endDate: season.endDate,
          mode: season.mode,
          rate: season.rate,
          multiplier: season.multiplier,
          priority: season.priority,
          active: !season.active,
        }),
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

  async function removeSeason(season: Season) {
    if (!window.confirm(`¿Eliminar la temporada "${season.name}"?`)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate-seasons", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "delete", id: season.id }),
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

  // Cotización de ejemplo con la lógica pura compartida.
  const preview = useMemo(() => {
    const type = roomTypes.find((t) => t.id === previewTypeId)
    const baseRate = type?.baseRate ?? 0
    return quoteStay({
      baseRate,
      roomTypeId: previewTypeId,
      checkIn: previewIn,
      checkOut: previewOut,
      seasons: seasons as RateSeasonLike[],
    })
  }, [roomTypes, previewTypeId, previewIn, previewOut, seasons])

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

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
            <Tag size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Tarifas por temporada</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Ajusta el precio por noche en rangos de fechas. Al crear una reserva se sugiere la
              tarifa automáticamente.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para usar tarifas, o el módulo está desactivado en la
            configuración del negocio.
          </p>
        ) : (
          <>
            {/* Alta de temporada */}
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                <Plus size={16} /> Nueva temporada
              </h2>
              <div className="mt-3 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre (Temporada alta, Carnaval…)"
                  className={`${inputClass} sm:col-span-2`}
                />
                <select
                  value={roomTypeId}
                  onChange={(e) => setRoomTypeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Todos los tipos</option>
                  {roomTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
                  <option value="fija">Precio fijo por noche</option>
                  <option value="factor">Factor sobre la tarifa base</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                  <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Desde</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const value = e.target.value || todayISO()
                      setStartDate(value)
                      if (endDate < value) setEndDate(value)
                    }}
                    className="w-full bg-transparent font-bold outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                  <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Hasta</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value || startDate)}
                    className="w-full bg-transparent font-bold outline-none"
                  />
                </label>
                {mode === "fija" ? (
                  <input
                    type="number"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="Precio/noche ($)"
                    className={inputClass}
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.05"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    placeholder="Factor (1.2 = +20%)"
                    className={inputClass}
                  />
                )}
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="Prioridad (mayor gana)"
                  className={inputClass}
                />
                <button
                  onClick={createSeason}
                  disabled={busy || !name.trim()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  <Plus size={16} /> Agregar temporada
                </button>
              </div>
            </section>

            {/* Previsualización */}
            {roomTypes.length > 0 && (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  <CalendarRange size={16} /> Probar una estadía
                </h2>
                <div className="mt-3 grid gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-4 sm:grid-cols-3">
                  <select
                    value={previewTypeId}
                    onChange={(e) => setPreviewTypeId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Tipo de habitación…</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} (${type.baseRate})
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-3 py-2.5 font-bold">
                    <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Entrada</span>
                    <input
                      type="date"
                      value={previewIn}
                      onChange={(e) => {
                        const value = e.target.value || todayISO()
                        setPreviewIn(value)
                        if (previewOut <= value) setPreviewOut(addDaysISO(value, 1))
                      }}
                      className="w-full bg-transparent font-bold outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-3 py-2.5 font-bold">
                    <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Salida</span>
                    <input
                      type="date"
                      value={previewOut}
                      min={addDaysISO(previewIn, 1)}
                      onChange={(e) => setPreviewOut(e.target.value || addDaysISO(previewIn, 1))}
                      className="w-full bg-transparent font-bold outline-none"
                    />
                  </label>
                  <div className="rounded-xl bg-[var(--brand-cream)] px-4 py-3 font-black text-[var(--brand-ink-3)] sm:col-span-3">
                    {preview.nights > 0 ? (
                      <span>
                        {preview.nights} noche(s) · Total ${preview.total}{" "}
                        <span className="text-sm font-bold text-[var(--brand-ink-2)]/60">
                          (~${preview.averageRate}/noche)
                        </span>
                        {preview.seasonApplied ? (
                          <span className="ml-2 text-sm font-bold text-[var(--brand-primary)]">
                            Temporada: {preview.seasonNames.join(", ")}
                          </span>
                        ) : (
                          <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                            Sin temporada (tarifa base)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-red-600">Elige un tipo y fechas válidas</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de temporadas */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : seasons.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay temporadas. Crea la primera arriba (ej. &quot;Temporada alta&quot; con precio fijo).
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {seasons.map((season) => (
                  <li
                    key={season.id}
                    className={`rounded-2xl border-2 bg-white p-4 ${
                      season.active
                        ? "border-[var(--brand-primary)]/20"
                        : "border-[var(--brand-primary)]/10 opacity-60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          {season.name}
                          <span className="ml-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                            {season.roomTypeId
                              ? typeNameById.get(season.roomTypeId) || "Tipo"
                              : "Todos los tipos"}
                          </span>
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange size={14} /> {season.startDate} → {season.endDate}
                          </span>
                          <span>
                            {season.mode === "fija"
                              ? `$${season.rate}/noche`
                              : `×${season.multiplier} sobre base`}
                          </span>
                          <span className="text-[var(--brand-ink-2)]/50">Prioridad {season.priority}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(season)}
                          disabled={busy}
                          className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase disabled:opacity-50 ${
                            season.active
                              ? "border-green-600/30 bg-green-50 text-green-700"
                              : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]/60"
                          }`}
                        >
                          {season.active ? "Activa" : "Inactiva"}
                        </button>
                        <button
                          onClick={() => removeSeason(season)}
                          disabled={busy}
                          title="Eliminar temporada"
                          className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
