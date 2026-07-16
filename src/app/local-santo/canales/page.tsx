"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, Radio, RefreshCcw } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import ProviderConnectionCard from "@/components/local/ProviderConnectionCard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type SyncRoom = { id: string; name: string; icalImportUrl: string }
type SyncResult = { roomId: string; roomName: string; created: number; deleted: number; error: string }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function CanalesPage() {
  return (
    <ModuleAccessGuard moduleKey="channelManager" moduleName="Canales / OTAs">
      <CanalesContent />
    </ModuleAccessGuard>
  )
}

function CanalesContent() {
  const [url, setUrl] = useState("/api/public/hotel/ical")
  const [copied, setCopied] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setUrl(`${window.location.origin}/api/public/hotel/ical`)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  function copy(text: string, key: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(key)
        setTimeout(() => setCopied(""), 2000)
      }).catch(() => {})
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Radio size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Canales / OTAs</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Comparte tu disponibilidad con Booking, Airbnb y otras por iCal.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
          <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Enlace iCal de disponibilidad (todo el hotel)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--brand-cream)] px-3 py-2 font-bold text-[var(--brand-ink-3)]">{url}</code>
            <button onClick={() => copy(url, "hotel")} className="rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]">
              {copied === "hotel" ? "¡Copiado!" : "Copiar"}
            </button>
            <a href="/api/public/hotel/ical" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]">
              <ExternalLink size={14} /> Ver
            </a>
          </div>
          <div className="mt-4 text-sm font-bold text-[var(--brand-ink-2)]/70">
            <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Cómo usarlo</p>
            <p className="mt-1">· En Booking/Airbnb, en “Calendarios → Importar calendario / iCal”, pega este enlace.</p>
            <p>· El canal verá como <b>ocupadas</b> las fechas ya reservadas aquí y evitará el overbooking.</p>
            <p className="mt-1 text-[var(--brand-ink-2)]/55">El enlace se actualiza solo; no expone datos privados, solo fechas ocupadas.</p>
          </div>
        </div>

        <RoomSyncSection copiedKey={copied} onCopy={copy} />

        <ProviderConnectionCard providerId="channel" />
      </div>
    </main>
  )
}

// P3-G · Sincronización BIDIRECCIONAL por habitación: exportar el calendario
// de cada habitación (URL con ?roomId=) e importar el de Airbnb/Booking
// creando bloqueos de fuente "ical" (los manuales jamás se tocan).
function RoomSyncSection({ copiedKey, onCopy }: { copiedKey: string; onCopy: (text: string, key: string) => void }) {
  const [rooms, setRooms] = useState<SyncRoom[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [results, setResults] = useState<SyncResult[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/channel-sync", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setRooms(data.rooms || [])
      setDrafts(Object.fromEntries((data.rooms || []).map((r: SyncRoom) => [r.id, r.icalImportUrl])))
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

  async function saveUrl(roomId: string) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/channel-sync", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "setUrl", roomId, url: (drafts[roomId] || "").trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    setError("")
    setResults([])
    try {
      const res = await fetch("/api/channel-sync", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "sync" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo sincronizar")
      setResults(data.results || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  if (denied) return null

  const withUrl = rooms.filter((r) => r.icalImportUrl).length
  const exportBase = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">Sincronización por habitación (importar de Airbnb/Booking)</p>
        <button
          onClick={syncNow}
          disabled={busy || withUrl === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
        >
          <RefreshCcw size={14} className={busy ? "animate-spin" : ""} /> Sincronizar ahora
        </button>
      </div>
      <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
        Pega aquí la URL iCal del anuncio externo de cada habitación. Al sincronizar, las fechas
        ocupadas afuera se apartan aquí como bloqueos (los bloqueos manuales nunca se tocan).
      </p>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={16} /> Cargando…</p>
      ) : rooms.length === 0 ? (
        <p className="mt-4 font-bold text-[var(--brand-ink-2)]/60">Aún no hay habitaciones creadas.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rooms.map((room) => (
            <li key={room.id} className="rounded-xl border border-[var(--brand-primary)]/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[var(--brand-ink-3)]">Hab. {room.name}</p>
                <button
                  onClick={() => onCopy(`${exportBase}/api/public/hotel/ical?roomId=${room.id}`, room.id)}
                  className="rounded-lg border border-[var(--brand-primary)]/30 px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--brand-primary)]"
                  title="Calendario de ESTA habitación, para pegarlo en su anuncio de Airbnb/Booking"
                >
                  {copiedKey === room.id ? "¡Copiado!" : "Copiar URL de exportación"}
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={drafts[room.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [room.id]: e.target.value }))}
                  placeholder="https://…/calendar.ics (vacío = no importar)"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                />
                <button
                  onClick={() => saveUrl(room.id)}
                  disabled={busy || (drafts[room.id] ?? "") === room.icalImportUrl}
                  className="rounded-xl border border-[var(--brand-primary)]/40 px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <div className="mt-3 rounded-xl bg-[var(--brand-cream)]/70 p-3 text-sm font-bold">
          {results.map((r) => (
            <p key={r.roomId} className={r.error ? "text-red-600" : "text-emerald-700"}>
              Hab. {r.roomName}: {r.error ? r.error : `${r.created} fecha(s) apartada(s) · ${r.deleted} liberada(s)`}
            </p>
          ))}
        </div>
      )}
      {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
    </div>
  )
}
