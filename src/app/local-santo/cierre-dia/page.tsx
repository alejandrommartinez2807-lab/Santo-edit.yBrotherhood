"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRightCircle, LogIn, LogOut, Moon, Users } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Summary = { date: string; arrivals: number; departures: number; inHouse: number; pendingArrivals: number; roomRevenue: number }
type Day = { id: string; date: string; arrivals: number; departures: number; inHouse: number; roomRevenue: number; closedAt: string }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function CierreDiaPage() {
  return (
    <ModuleAccessGuard moduleKey="nightAudit" moduleName="Cierre de día">
      <CierreDiaContent />
    </ModuleAccessGuard>
  )
}

function CierreDiaContent() {
  const [date, setDate] = useState(todayISO())
  const [summary, setSummary] = useState<Summary | null>(null)
  const [history, setHistory] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/night-audit?date=${date}`, { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setSummary(data.summary || null)
      setHistory(data.history || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function closeDay() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/night-audit", { method: "POST", headers: authHeaders(), body: JSON.stringify({ date }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cerrar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const cards = summary
    ? [
        { label: "Llegadas", value: summary.arrivals, icon: <LogIn size={16} /> },
        { label: "Por llegar", value: summary.pendingArrivals, icon: <ArrowRightCircle size={16} /> },
        { label: "Salidas", value: summary.departures, icon: <LogOut size={16} /> },
        { label: "En casa", value: summary.inHouse, icon: <Users size={16} /> },
      ]
    : []

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Moon size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Cierre de día</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Resumen de la jornada y cierre con snapshot.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para el cierre de día, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <label className="mt-6 flex w-fit items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 font-bold">
              <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Fecha</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} className="bg-transparent font-bold outline-none" />
            </label>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading || !summary ? (
              <p className="mt-6 font-bold">Cargando…</p>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {cards.map((c) => (
                    <div key={c.label} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                      <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--brand-primary)]">{c.icon} {c.label}</p>
                      <p className="mt-1 text-3xl font-bold text-[var(--brand-ink-3)]">{c.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                  <span className="text-sm font-bold uppercase text-[var(--brand-primary)]">Ingreso de la noche</span>
                  <span className="text-2xl font-bold text-[var(--brand-ink-3)]">${summary.roomRevenue}</span>
                </div>
                <button onClick={closeDay} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50">
                  <Moon size={16} /> Cerrar el día {date}
                </button>
              </>
            )}

            {history.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Cierres anteriores</h2>
                <ul className="mt-3 space-y-2">
                  {history.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--brand-primary)]/15 bg-white px-4 py-2 font-bold">
                      <span className="text-[var(--brand-ink-3)]">{d.date}</span>
                      <span className="text-sm text-[var(--brand-ink-2)]/65">{d.arrivals} llegadas · {d.departures} salidas · {d.inHouse} en casa · ${d.roomRevenue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
