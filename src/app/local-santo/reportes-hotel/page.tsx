"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  CalendarRange,
  Download,
  Loader2,
  Minus,
  Moon,
  Percent,
  Table2,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { buildCsvSections, downloadCsv } from "@/lib/csv"
import {
  fmtMoney,
  HotelBars,
  HotelColumnChart,
  HotelLineChart,
  HotelSplitBar,
} from "./charts"

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
type DailyPoint = { date: string; sold: number; occupancy: number; revenue: number }
type BreakdownRow = { key: string; nights: number; revenue: number; reservations: number; name?: string }
type StayStats = {
  avgStayNights: number
  adults: number
  children: number
  guests: number
  cancelled: number
  noShow: number
  cancellationRate: number
}
type AmountRow = { key: string; amount: number }
type ReportPayload = {
  report: Report
  previous: Report
  daily: DailyPoint[]
  byRoomType: BreakdownRow[]
  bySource: BreakdownRow[]
  stay: StayStats
  folioByCategory: AmountRow[]
  paymentsByMethod: AmountRow[]
  depositsConfirmed: number
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendientes",
  confirmada: "Confirmadas",
  checkin: "En casa",
  checkout: "Finalizadas",
}
const CATEGORY_LABELS: Record<string, string> = {
  habitacion: "Habitación",
  restaurante: "Restaurante",
  servicio: "Servicios",
  paquete: "Paquetes",
  minibar: "Minibar",
  extra: "Extras",
  pago: "Pagos",
}
const METHOD_LABELS: Record<string, string> = {
  pago_movil: "Pago móvil",
  zelle: "Zelle",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  otro: "Otro",
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
function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISO(d)
}
function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toISO(d)
}

const PRESETS = [
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
] as const
type PresetKey = (typeof PRESETS)[number]["key"]

function presetRange(key: PresetKey): { from: string; to: string } {
  if (key === "mes") return { from: monthStart(0), to: monthStart(1) }
  if (key === "mes-pasado") return { from: monthStart(-1), to: monthStart(0) }
  if (key === "7d") return { from: daysAgo(6), to: tomorrow() }
  if (key === "30d") return { from: daysAgo(29), to: tomorrow() }
  return { from: daysAgo(89), to: tomorrow() }
}

// Delta del KPI vs el periodo anterior (subir es bueno en los cuatro).
function Delta({ current, previous, format }: { current: number; previous: number; format: (v: number) => string }) {
  const diff = current - previous
  if (previous <= 0 && current <= 0) return null
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null
  const up = diff > 0.004
  const down = diff < -0.004
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  const tone = up ? "text-green-700" : down ? "text-red-600" : "text-[var(--brand-ink-2)]/55"
  return (
    <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold ${tone}`}>
      <Icon size={13} />
      {pct !== null ? `${pct > 0 ? "+" : ""}${pct}%` : format(diff)}
      <span className="font-semibold text-[var(--brand-ink-2)]/50">vs periodo anterior</span>
    </p>
  )
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
  const [activePreset, setActivePreset] = useState<PresetKey | "">("mes")
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [showTable, setShowTable] = useState(false)

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
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "No se pudo generar el reporte")
      setDenied(false)
      setData(payload.report ? (payload as ReportPayload) : null)
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

  function applyPreset(key: PresetKey) {
    const range = presetRange(key)
    setActivePreset(key)
    setFrom(range.from)
    setTo(range.to)
  }

  const report = data?.report || null
  const occupancyPct = report ? Math.round(report.occupancy * 100) : 0

  const occupancySeries = useMemo(
    () =>
      (data?.daily || []).map((d) => ({
        date: d.date,
        value: Math.round(d.occupancy * 100),
        extra: `${d.sold} de ${report?.roomCount ?? 0} hab.`,
      })),
    [data, report],
  )
  const revenueSeries = useMemo(
    () => (data?.daily || []).map((d) => ({ date: d.date, value: d.revenue })),
    [data],
  )
  const sourceRows = useMemo(() => {
    const bySource = data?.bySource || []
    const find = (key: string) => bySource.find((r) => r.key === key)
    return {
      web: find("web") || { key: "web", nights: 0, revenue: 0, reservations: 0 },
      recepcion: find("recepcion") || { key: "recepcion", nights: 0, revenue: 0, reservations: 0 },
    }
  }, [data])

  function exportCsv() {
    if (!data || !report) return
    const csv = buildCsvSections([
      {
        title: `Reporte del hotel · ${report.from} a ${report.to}`,
        rows: [
          ["Métrica", "Valor"],
          ["Ocupación %", occupancyPct],
          ["ADR", report.adr],
          ["RevPAR", report.revPar],
          ["Ingreso habitaciones", report.roomRevenue],
          ["Noches vendidas", report.roomNightsSold],
          ["Noches disponibles", report.roomNightsAvailable],
          ["Estancia media (noches)", data.stay.avgStayNights],
          ["Huéspedes", data.stay.guests],
          ["Canceladas", data.stay.cancelled],
          ["No-show", data.stay.noShow],
          ["Depósitos confirmados", data.depositsConfirmed],
        ],
      },
      {
        title: "Detalle por noche",
        rows: [
          ["Fecha", "Habitaciones ocupadas", "Ocupación %", "Ingreso $"],
          ...data.daily.map((d) => [d.date, d.sold, Math.round(d.occupancy * 100), d.revenue]),
        ],
      },
      {
        title: "Por tipo de habitación",
        rows: [
          ["Tipo", "Noches", "Ingreso $", "Reservas"],
          ...data.byRoomType.map((r) => [r.name || r.key, r.nights, r.revenue, r.reservations]),
        ],
      },
      {
        title: "Ingresos del folio por categoría",
        rows: [
          ["Categoría", "Monto $"],
          ...data.folioByCategory.map((r) => [CATEGORY_LABELS[r.key] || r.key, r.amount]),
        ],
      },
      {
        title: "Cobros por método",
        rows: [
          ["Método", "Monto $"],
          ...data.paymentsByMethod.map((r) => [METHOD_LABELS[r.key] || r.key, r.amount]),
        ],
      },
    ])
    downloadCsv(`reporte-hotel-${report.from}-a-${report.to}.csv`, csv)
  }

  const cardClass = "rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4"
  const kickerClass = "inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
              <BarChart3 size={24} />
            </span>
            <div>
              <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Reportes del hotel</h1>
              <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
                Ocupación, tarifas, ingresos y canales del periodo, con comparación contra el anterior.
              </p>
            </div>
          </div>
          {data && (
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/30 bg-white px-3.5 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] transition hover:bg-[var(--brand-cream)]"
            >
              <Download size={14} /> Descargar CSV
            </button>
          )}
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para ver los reportes del hotel, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Filtros: una sola fila arriba; primero los presets, luego el rango. */}
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => applyPreset(preset.key)}
                      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.06em] transition ${
                        activePreset === preset.key
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                          : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-cream)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase text-[var(--brand-primary)]">Desde</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => { setFrom(e.target.value); setActivePreset("") }}
                      className="bg-transparent text-sm font-bold outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase text-[var(--brand-primary)]">Hasta</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => { setTo(e.target.value); setActivePreset("") }}
                      className="bg-transparent text-sm font-bold outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading && !data ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Calculando…
              </p>
            ) : !data || !report || report.daysInPeriod <= 0 ? (
              !loading && (
                <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                  Elige un rango válido (la fecha “hasta” debe ser posterior a “desde”).
                </p>
              )
            ) : (
              // Mientras recarga, el reporte anterior queda atenuado (sin saltos).
              <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {/* ==== KPIs con delta vs periodo anterior ==== */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className={cardClass}>
                    <p className={kickerClass}><Percent size={13} /> Ocupación</p>
                    <p className="mt-1 text-3xl font-bold text-[var(--brand-ink-3)]">{occupancyPct}%</p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">
                      {report.roomNightsSold} de {report.roomNightsAvailable} noches
                    </p>
                    <Delta
                      current={report.occupancy}
                      previous={data.previous.occupancy}
                      format={(v) => `${Math.round(v * 100)} pts`}
                    />
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Wallet size={13} /> ADR</p>
                    <p className="mt-1 text-3xl font-bold text-[var(--brand-ink-3)]">${report.adr}</p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">tarifa media por noche vendida</p>
                    <Delta current={report.adr} previous={data.previous.adr} format={fmtMoney} />
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><TrendingUp size={13} /> RevPAR</p>
                    <p className="mt-1 text-3xl font-bold text-[var(--brand-ink-3)]">${report.revPar}</p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">ingreso por habitación disponible</p>
                    <Delta current={report.revPar} previous={data.previous.revPar} format={fmtMoney} />
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><BedDouble size={13} /> Ingreso habitaciones</p>
                    <p className="mt-1 text-3xl font-bold text-[var(--brand-ink-3)]">{fmtMoney(report.roomRevenue)}</p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">
                      {report.reservationsCounted} reserva(s) en el periodo
                    </p>
                    <Delta current={report.roomRevenue} previous={data.previous.roomRevenue} format={fmtMoney} />
                  </div>
                </div>

                {/* ==== Tendencias ==== */}
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className={cardClass}>
                    <p className={kickerClass}><Percent size={13} /> Ocupación por noche</p>
                    <div className="mt-3">
                      <HotelLineChart
                        data={occupancySeries}
                        valueLabel="Ocupación"
                        formatValue={(v) => `${Math.round(v)}%`}
                        maxValue={100}
                      />
                    </div>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Wallet size={13} /> Ingreso de habitación por noche</p>
                    <div className="mt-3">
                      <HotelColumnChart
                        data={revenueSeries}
                        valueLabel="Ingreso"
                        formatValue={fmtMoney}
                      />
                    </div>
                  </div>
                </div>

                {/* ==== Canales + facturación del folio ==== */}
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className={cardClass}>
                    <p className={kickerClass}><CalendarRange size={13} /> Reservas por canal</p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--brand-ink-2)]/60">
                      Ingreso de habitación según dónde nació la reserva.
                    </p>
                    <div className="mt-4">
                      <HotelSplitBar
                        a={{
                          label: "Motor web",
                          value: sourceRows.web.revenue,
                          detail: `${sourceRows.web.reservations} reserva(s) · ${sourceRows.web.nights} noche(s)`,
                        }}
                        b={{
                          label: "Recepción",
                          value: sourceRows.recepcion.revenue,
                          detail: `${sourceRows.recepcion.reservations} reserva(s) · ${sourceRows.recepcion.nights} noche(s)`,
                        }}
                        formatValue={fmtMoney}
                      />
                    </div>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Wallet size={13} /> Facturado en folios por categoría</p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--brand-ink-2)]/60">
                      Cargos reales a las cuentas de huéspedes en el periodo.
                    </p>
                    <div className="mt-4">
                      <HotelBars
                        data={data.folioByCategory.map((r) => ({
                          label: CATEGORY_LABELS[r.key] || r.key,
                          value: r.amount,
                        }))}
                        formatValue={fmtMoney}
                      />
                    </div>
                  </div>
                </div>

                {/* ==== Tipos de habitación + métodos de cobro ==== */}
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className={cardClass}>
                    <p className={kickerClass}><BedDouble size={13} /> Tipos de habitación más vendidos</p>
                    <div className="mt-4">
                      <HotelBars
                        data={data.byRoomType.slice(0, 6).map((r) => ({
                          label: r.name || "Sin tipo",
                          value: r.revenue,
                          detail: `${r.nights} noche(s) · ${r.reservations} reserva(s)`,
                        }))}
                        formatValue={fmtMoney}
                      />
                    </div>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Wallet size={13} /> Cobros por método</p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--brand-ink-2)]/60">
                      Pagos de folio + depósitos confirmados del periodo.
                    </p>
                    <div className="mt-4">
                      <HotelBars
                        data={data.paymentsByMethod.map((r) => ({
                          label: METHOD_LABELS[r.key] || r.key,
                          value: r.amount,
                        }))}
                        formatValue={fmtMoney}
                      />
                    </div>
                  </div>
                </div>

                {/* ==== Estadísticas de la operación ==== */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className={cardClass}>
                    <p className={kickerClass}><Moon size={13} /> Estancia media</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">
                      {data.stay.avgStayNights} noche(s)
                    </p>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Users size={13} /> Huéspedes</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">{data.stay.guests}</p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">
                      {data.stay.adults} adulto(s) · {data.stay.children} niño(s)
                    </p>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><XCircle size={13} /> Canceladas / no-show</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">
                      {data.stay.cancelled + data.stay.noShow}
                    </p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">
                      {Math.round(data.stay.cancellationRate * 100)}% de las reservas del periodo
                    </p>
                  </div>
                  <div className={cardClass}>
                    <p className={kickerClass}><Wallet size={13} /> Depósitos confirmados</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">
                      {fmtMoney(data.depositsConfirmed)}
                    </p>
                    <p className="text-sm font-semibold text-[var(--brand-ink-2)]/60">anticipos de reservas</p>
                  </div>
                </div>

                {/* Reservas por estado */}
                {Object.keys(report.countsByStatus).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(report.countsByStatus).map(([status, count]) => (
                      <span
                        key={status}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-white px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-ink-2)]/70"
                      >
                        {count} {STATUS_LABELS[status] || status}
                      </span>
                    ))}
                  </div>
                )}

                {/* ==== Tabla del detalle diario (vista accesible sin hover) ==== */}
                <div className="mt-3">
                  <button
                    onClick={() => setShowTable((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/30 bg-white px-3.5 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] transition hover:bg-[var(--brand-cream)]"
                  >
                    <Table2 size={14} /> {showTable ? "Ocultar tabla" : "Ver tabla del detalle diario"}
                  </button>
                  {showTable && (
                    <div className="mt-2 overflow-x-auto rounded-2xl border border-[var(--brand-primary)]/20 bg-white">
                      <table className="w-full min-w-96 text-sm">
                        <thead>
                          <tr className="border-b border-[var(--brand-primary)]/15 text-left text-xs font-bold uppercase text-[var(--brand-primary)]">
                            <th className="px-4 py-2.5">Fecha</th>
                            <th className="px-4 py-2.5 text-right">Ocupadas</th>
                            <th className="px-4 py-2.5 text-right">Ocupación</th>
                            <th className="px-4 py-2.5 text-right">Ingreso</th>
                          </tr>
                        </thead>
                        <tbody className="[font-variant-numeric:tabular-nums]">
                          {data.daily.map((d) => (
                            <tr key={d.date} className="border-b border-[var(--brand-primary)]/8 last:border-0">
                              <td className="px-4 py-2 font-semibold text-[var(--brand-ink)]">{d.date}</td>
                              <td className="px-4 py-2 text-right font-semibold">{d.sold}</td>
                              <td className="px-4 py-2 text-right font-semibold">{Math.round(d.occupancy * 100)}%</td>
                              <td className="px-4 py-2 text-right font-semibold">{fmtMoney(d.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Explicación */}
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-4 text-sm font-semibold text-[var(--brand-ink-2)]/70">
                  <p className="mb-1 text-xs font-bold uppercase text-[var(--brand-primary)]">Cómo se calcula</p>
                  <p>· <b>Ocupación</b> = noches vendidas ÷ noches disponibles (habitaciones × días).</p>
                  <p>· <b>ADR</b> = ingreso de habitaciones ÷ noches vendidas.</p>
                  <p>· <b>RevPAR</b> = ingreso ÷ noches disponibles (= ADR × ocupación).</p>
                  <p>· <b>Facturado en folios</b> = cargos reales a cuentas de huéspedes (habitación, restaurante, servicios, paquetes) registrados en el periodo.</p>
                  <p className="mt-1 text-[var(--brand-ink-2)]/55">
                    No cuentan las reservas canceladas ni las que no llegaron. La comparación usa el
                    periodo anterior de la misma duración.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
