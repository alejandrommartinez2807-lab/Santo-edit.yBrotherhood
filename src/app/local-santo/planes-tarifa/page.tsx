"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type RoomType = { id: string; name: string }
type Restriction = {
  id: string
  roomTypeId: string
  fromDate: string
  toDate: string
  minStay: number
  closedToArrival: boolean
  closedToDeparture: boolean
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

export default function PlanesTarifaPage() {
  return (
    <ModuleAccessGuard moduleKey="advancedRates" moduleName="Tarifas avanzadas">
      <PlanesTarifaContent />
    </ModuleAccessGuard>
  )
}

function PlanesTarifaContent() {
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [roomTypeId, setRoomTypeId] = useState("")
  const [fromDate, setFromDate] = useState(todayISO())
  const [toDate, setToDate] = useState(addDaysISO(todayISO(), 7))
  const [minStay, setMinStay] = useState("1")
  const [cta, setCta] = useState(false)
  const [ctd, setCtd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/rate-restrictions", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setRestrictions(data.restrictions || [])
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
    roomTypes.forEach((t) => map.set(t.id, t.name))
    return map
  }, [roomTypes])

  async function createRestriction() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate-restrictions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          roomTypeId,
          fromDate,
          toDate,
          minStay: Number(minStay) || 1,
          closedToArrival: cta,
          closedToDeparture: ctd,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setMinStay("1")
      setCta(false)
      setCtd(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function removeRestriction(r: Restriction) {
    if (!window.confirm("¿Quitar esta restricción?")) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/rate-restrictions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "delete", id: r.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo quitar")
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
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <SlidersHorizontal size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Tarifas avanzadas</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Reglas de venta por fecha: estancia mínima y días cerrados a llegada/salida. Aplican al
              motor de reservas online.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para tarifas avanzadas, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Nueva restricción */}
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass}>
                <option value="">Todos los tipos</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Mín. noches</span>
                <input
                  type="number"
                  min={1}
                  value={minStay}
                  onChange={(e) => setMinStay(e.target.value)}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Desde</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    const v = e.target.value || todayISO()
                    setFromDate(v)
                    if (toDate < v) setToDate(v)
                  }}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Hasta</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value || fromDate)}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <input type="checkbox" checked={cta} onChange={(e) => setCta(e.target.checked)} className="h-4 w-4" />
                Cerrado a llegada (CTA)
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <input type="checkbox" checked={ctd} onChange={(e) => setCtd(e.target.checked)} className="h-4 w-4" />
                Cerrado a salida (CTD)
              </label>
              <button
                onClick={createRestriction}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
              >
                <Plus size={16} /> Agregar restricción
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : restrictions.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Sin restricciones. Por defecto se acepta cualquier estadía de 1 noche en adelante.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {restrictions.map((r) => (
                  <li key={r.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          {r.roomTypeId ? typeNameById.get(r.roomTypeId) || "Tipo" : "Todos los tipos"}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange size={14} /> {r.fromDate} → {r.toDate}
                          </span>
                          {r.minStay > 1 && <span>Mín. {r.minStay} noches</span>}
                          {r.closedToArrival && <span className="text-amber-700">Cerrado a llegada</span>}
                          {r.closedToDeparture && <span className="text-amber-700">Cerrado a salida</span>}
                          {r.minStay <= 1 && !r.closedToArrival && !r.closedToDeparture && (
                            <span className="text-[var(--brand-ink-2)]/45">Sin efecto</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRestriction(r)}
                        disabled={busy}
                        title="Quitar"
                        className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
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
