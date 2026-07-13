"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, Loader2, Lock, Plus, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Room = { id: string; name: string; floor: string }
type Block = {
  id: string
  roomId: string
  fromDate: string
  toDate: string
  reason: string
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

export default function GruposPage() {
  return (
    <ModuleAccessGuard moduleKey="groupBookings" moduleName="Grupos y bloqueos">
      <GruposContent />
    </ModuleAccessGuard>
  )
}

function GruposContent() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [roomId, setRoomId] = useState("")
  const [fromDate, setFromDate] = useState(todayISO())
  const [toDate, setToDate] = useState(addDaysISO(todayISO(), 1))
  const [reason, setReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/room-blocks", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setRooms(data.rooms || [])
      setBlocks(data.blocks || [])
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

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>()
    rooms.forEach((r) => map.set(r.id, r.name))
    return map
  }, [rooms])

  async function createBlock() {
    if (!roomId) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/room-blocks", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ roomId, fromDate, toDate, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear el bloqueo")
      setReason("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function removeBlock(block: Block) {
    if (!window.confirm("¿Quitar este bloqueo?")) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/room-blocks", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "delete", id: block.id }),
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
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Lock size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Bloqueos de habitación</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Aparta una habitación por un rango (mantenimiento, evento). No se podrá reservar en la
              web y sale marcada en el calendario.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para gestionar bloqueos, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Nuevo bloqueo */}
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass}>
                <option value="">Habitación a bloquear…</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                    {room.floor ? ` · Piso ${room.floor}` : ""}
                  </option>
                ))}
              </select>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (mantenimiento, evento…)"
                className={inputClass}
              />
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Desde</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    const v = e.target.value || todayISO()
                    setFromDate(v)
                    if (toDate <= v) setToDate(addDaysISO(v, 1))
                  }}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Hasta</span>
                <input
                  type="date"
                  value={toDate}
                  min={addDaysISO(fromDate, 1)}
                  onChange={(e) => setToDate(e.target.value || addDaysISO(fromDate, 1))}
                  className="w-full bg-transparent font-bold outline-none"
                />
              </label>
              <button
                onClick={createBlock}
                disabled={busy || !roomId}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
              >
                <Plus size={16} /> Bloquear habitación
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de bloqueos */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : blocks.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay bloqueos activos. Crea uno arriba cuando una habitación no se pueda vender.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {blocks.map((block) => (
                  <li key={block.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          {roomNameById.get(block.roomId) || "Habitación"}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange size={14} /> {block.fromDate} → {block.toDate}
                          </span>
                          {block.reason && <span>{block.reason}</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => removeBlock(block)}
                        disabled={busy}
                        title="Quitar bloqueo"
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
