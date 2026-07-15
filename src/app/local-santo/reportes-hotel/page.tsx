"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  BedDouble,
  CalendarRange,
  DollarSign,
  Loader2,
  Percent,
  TrendingUp,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Report = {
  from: string
  to: string
  daysInPeriod: number
  roomCount: number
  roomNightsAvailable: number
  roomNightsSold: number
  roomRevenue: number
  occupancy: number
  adr: number
  revPar: number
  reservationsCounted: number
  countsByStatus: Record<string, number>
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendientes",
  confirmada: "Confirmadas",
  checkin: "En casa",
  checkout: "Finalizadas",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function monthStart(offset = 0) {
  const d = new Date()
  return toISO(new Date(d.getFullYear(), d.getMonth() + offset, 1))
}

export default function ReportesHotelPage() {
  return (
    <ModuleAccessGuard moduleKey="hotelReports" moduleName="Reportes del hotel">
      <ReportesHotelContent />
    </ModuleAccessGuard>
  )
}

function ReportesHotelContent() {
  const [from, setFrom] = useState(monthStart(0))
  const [to, setTo] = useState(monthStart(1))
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/hotel-reports?from=${from}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo generar el reporte")
      setDenied(false)
      setReport(data.report || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  function preset(kind: "this" | "last") {
    if (kind === "this") {
      setFrom(monthStart(0))
      setTo(monthStart(1))
    } else {
      setFrom(monthStart(-1))
      setTo(monthStart(0))
    }
  }

  const occupancyPct = useMemo(
    () => (report ? Math.round(report.occupancy * 100) : 0),
    [report],
  )

  const inputClass =
    "w-full bg-transparent font-bold outline-none"

  const cardClass =
    "rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"

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
            <BarChart3 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Reportes del hotel</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Ocupación, tarifa media (ADR) e ingreso por habitación disponible (RevPAR) del periodo.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para ver los reportes del hotel, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Periodo */}
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold sm:col-span-1">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Desde</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold sm:col-span-1">
                <span className="text-xs font-black uppercase text-[var(--brand-primary)]">Hasta</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              </label>
              <button
                onClick={() => preset("this")}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-xs font-black uppercase text-[var(--brand-primary)]"
              >
                Este mes
              </button>
              <button
                onClick={() => preset("last")}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-xs font-black uppercase text-[var(--brand-primary)]"
              >
                Mes pasado
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Calculando…
              </p>
            ) : !report || report.daysInPeriod <= 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Elige un rango válido (la fecha “hasta” debe ser posterior a “desde”).
              </p>
            ) : (
              <>
                {/* KPIs principales */}
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className={cardClass}>
                    <p className="inline-flex items-center gap-1 text-xs font-black uppercase text-[var(--brand-primary)]">
                      <Percent size={14} /> Ocupación
                    </p>
                    <p className="mt-1 text-3xl font-black text-[var(--brand-ink-3)]">{occupancyPct}%</p>
                    <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">
                      {report.roomNightsSold} de {report.roomNightsAvailable} noches
                    </p>
                  </div>
                  <div className={cardClass}>
                    <p className="inline-flex items-center gap-1 text-xs font-black uppercase text-[var(--brand-primary)]">
                      <DollarSign size={14} /> ADR
                    </p>
                    <p className="mt-1 text-3xl font-black text-[var(--brand-ink-3)]">${report.adr}</p>
                    <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">tarifa media / noche vendida</p>
                  </div>
                  <div className={cardClass}>
                    <p className="inline-flex items-center gap-1 text-xs font-black uppercase text-[var(--brand-primary)]">
                      <TrendingUp size={14} /> RevPAR
                    </p>
                    <p className="mt-1 text-3xl font-black text-[var(--brand-ink-3)]">${report.revPar}</p>
                    <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">ingreso / habitación disponible</p>
                  </div>
                </div>

                {/* Detalle */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className={cardClass}>
                    <p className="inline-flex items-center gap-1 text-xs font-black uppercase text-[var(--brand-primary)]">
                      <DollarSign size={14} /> Ingreso de habitaciones
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">${report.roomRevenue}</p>
                    <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">
                      {report.reservationsCounted} reserva(s) en el periodo
                    </p>
                  </div>
                  <div className={cardClass}>
                    <p className="inline-flex items-center gap-1 text-xs font-black uppercase text-[var(--brand-primary)]">
                      <BedDouble size={14} /> Inventario
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
                      {report.roomCount} habitación(es)
                    </p>
                    <p className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
                      <CalendarRange size={13} /> {report.daysInPeriod} noche(s) en el periodo
                    </p>
                  </div>
                </div>

                {/* Reservas por estado */}
                {Object.keys(report.countsByStatus).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(report.countsByStatus).map(([status, count]) => (
                      <span
                        key={status}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-xs font-black uppercase text-[var(--brand-ink-2)]/70"
                      >
                        {count} {STATUS_LABELS[status] || status}
                      </span>
                    ))}
                  </div>
                )}

                {/* Explicación */}
                <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-4 text-sm font-bold text-[var(--brand-ink-2)]/70">
                  <p className="mb-1 text-xs font-black uppercase text-[var(--brand-primary)]">Cómo se calcula</p>
                  <p>· <b>Ocupación</b> = noches vendidas ÷ noches disponibles (habitaciones × días).</p>
                  <p>· <b>ADR</b> = ingreso de habitaciones ÷ noches vendidas.</p>
                  <p>· <b>RevPAR</b> = ingreso ÷ noches disponibles (= ADR × ocupación).</p>
                  <p className="mt-1 text-[var(--brand-ink-2)]/55">
                    No cuentan las reservas canceladas ni las que no llegaron. Solo ingreso de
                    habitación (no incluye consumos del restaurante).
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
