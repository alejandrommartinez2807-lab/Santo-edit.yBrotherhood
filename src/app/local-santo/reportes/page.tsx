"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, BarChart3, TrendingUp, TrendingDown, Clock, PieChart, Download, Printer, CreditCard, Truck, Percent, Boxes, Wallet } from "lucide-react"
import { DonutChart, HBarChart, VBarChart } from "@/components/charts"
import { buildCsvSections, downloadCsv } from "@/lib/csv"
import { fillDailySeries } from "@/lib/reportSeries"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Report = {
  range: { label: string; from?: string; to?: string }
  summary: { orders: number; totalUSD: number; collectedUSD: number; pendingUSD: number; avgTicket: number }
  comparison?: {
    previous: { orders: number; totalUSD: number; avgTicket: number }
    deltas: { ordersPct: number | null; totalPct: number | null; avgTicketPct: number | null }
  }
  delivery?: { orders: number; revenueUSD: number; deliveryCostUSD: number; avgDeliveryUSD: number }
  byPaymentMethod?: { method: string; count: number; totalUSD: number }[]
  byType: { type: string; count: number; totalUSD: number }[]
  byPayment: { status: string; count: number }[]
  byHour: { hour: number; totalUSD: number }[]
  byDay: { date: string; orders: number; totalUSD: number }[]
  topProducts: { name: string; quantity: number; totalUSD: number }[]
  managerAlerts?: { level: "danger" | "warning" | "info"; title: string; detail: string; action: string }[]
  productMargins?: {
    summary: { menuProducts: number; productsWithRecipe: number; recipeCoveragePct: number; avgMarginPct: number | null; lowMarginCount: number; estimatedGrossProfitUSD: number }
    lowMargin: { productName: string; marginPct: number | null; salePriceUSD: number; costUSD: number }[]
    noRecipeTopProducts: { name: string }[]
  } | null
  inventoryHealth?: {
    lowStockCount: number
    lowStockItems: { name: string; quantity: number; minimumStock: number; unit: string }[]
    activeRecipes: number
  } | null
  supplierPayables?: {
    summary: { pendingUSD: number; overdueCount: number; overdueUSD: number; dueSoonCount: number; dueSoonUSD: number }
    bySupplier: { supplierName: string; pendingUSD: number }[]
  } | null
}

type BranchSummary = { id: string; name: string; orders: number; totalUSD: number; pendingUSD: number }

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "7 días" },
  { value: "month", label: "30 días" },
  { value: "custom", label: "Personalizado" },
]

// Venezuela no usa horario de verano: zona fija UTC-04:00. Construimos el rango
// del día completo en hora local del negocio para que el filtro from/to calce
// con el agrupado por día (America/Caracas) que hace la API.
const CARACAS_OFFSET = "-04:00"
function dayStartISO(date: string) {
  return `${date}T00:00:00.000${CARACAS_OFFSET}`
}
function dayEndISO(date: string) {
  return `${date}T23:59:59.999${CARACAS_OFFSET}`
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "x-admin-password": password }
}

function usd(n: number) {
  return `$${(n || 0).toFixed(2)}`
}

// Variación porcentual vs período anterior (verde sube, rojo baja, gris sin base).
function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) {
    return <span className="text-[0.62rem] font-bold text-[var(--brand-ink-2)]/45">sin comparación</span>
  }
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[0.7rem] font-black ${
        up ? "text-green-600" : "text-red-600"
      }`}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {pct}%
    </span>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
        {icon} {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function ReportesPage() {
  return (
    <ModuleAccessGuard moduleKey="reports" moduleName="Reportes">
      <ReportesPageContent />
    </ModuleAccessGuard>
  )
}

function ReportesPageContent() {
  const [period, setPeriod] = useState("today")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [consolidated, setConsolidated] = useState(false)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [byBranch, setByBranch] = useState<BranchSummary[]>([])
  const multiBranch = branches.length > 1

  // Lista de sucursales activas: habilita el toggle "Consolidado" y la
  // comparación por sede. (Un usuario restringido solo verá las suyas.)
  useEffect(() => {
    fetch("/api/branches", { headers: authHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const active = (j?.branches || [])
          .filter((b: { is_active?: boolean }) => b.is_active !== false)
          .map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
        setBranches(active)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (p: string, scopeAll: boolean, from: string, to: string) => {
    const scopeQuery = scopeAll ? "&scope=all" : ""
    let query: string
    if (p === "custom") {
      // Sin las dos fechas todavía no consultamos (esperamos a que el dueño elija).
      if (!from || !to) {
        setReport(null)
        setError("")
        setLoading(false)
        return
      }
      if (from > to) {
        setError("La fecha inicial no puede ser posterior a la final.")
        setLoading(false)
        return
      }
      query = `from=${encodeURIComponent(dayStartISO(from))}&to=${encodeURIComponent(dayEndISO(to))}`
    } else {
      query = `period=${p}`
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/reports?${query}${scopeQuery}`, { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(() => load(period, consolidated, fromDate, toDate), 0)
    return () => clearTimeout(timer)
  }, [period, consolidated, fromDate, toDate, load])

  // Comparación por sucursal: pide el resumen de cada sede para el mismo período.
  useEffect(() => {
    let cancelled = false

    const loadByBranch = async () => {
      if (!multiBranch) {
        if (!cancelled) setByBranch([])
        return
      }

      let query: string
      if (period === "custom") {
        if (!fromDate || !toDate || fromDate > toDate) {
          if (!cancelled) setByBranch([])
          return
        }
        query = `from=${encodeURIComponent(dayStartISO(fromDate))}&to=${encodeURIComponent(dayEndISO(toDate))}`
      } else {
        query = `period=${period}`
      }

      const rows = await Promise.all(
        branches.map(async (b) => {
          try {
            const res = await fetch(`/api/reports?${query}`, {
              headers: { ...authHeaders(), "x-branch-id": b.id },
              cache: "no-store",
            })
            if (!res.ok) return null
            const data = await res.json()
            return {
              id: b.id,
              name: b.name,
              orders: data.summary?.orders ?? 0,
              totalUSD: data.summary?.totalUSD ?? 0,
              pendingUSD: data.summary?.pendingUSD ?? 0,
            } as BranchSummary
          } catch {
            return null
          }
        }),
      )

      if (!cancelled) {
        setByBranch(rows.filter((r): r is BranchSummary => r !== null).sort((a, b) => b.totalUSD - a.totalUSD))
      }
    }

    loadByBranch()
    return () => {
      cancelled = true
    }
  }, [period, fromDate, toDate, branches, multiBranch])

  function exportCsv() {
    if (!report) return
    const s = report.summary
    const csv = buildCsvSections([
      { title: `Reporte · ${report.range.label}`, rows: [] },
      {
        title: "Resumen",
        rows: [
          ["Pedidos", s.orders],
          ["Total USD", s.totalUSD],
          ["Cobrado USD", s.collectedUSD],
          ["Pendiente USD", s.pendingUSD],
          ["Ticket promedio USD", s.avgTicket],
        ],
      },
      {
        title: "Ventas por día",
        rows: [["Fecha", "Pedidos", "Total USD"], ...report.byDay.map((d) => [d.date, d.orders, d.totalUSD])],
      },
      {
        title: "Productos más vendidos",
        rows: [["Producto", "Cantidad", "Total USD"], ...report.topProducts.map((p) => [p.name, p.quantity, p.totalUSD])],
      },
      {
        title: "Por tipo de pedido",
        rows: [["Tipo", "Pedidos", "Total USD"], ...report.byType.map((t) => [t.type, t.count, t.totalUSD])],
      },
      {
        title: "Por estado de cobro",
        rows: [["Estado", "Pedidos"], ...report.byPayment.map((p) => [p.status, p.count])],
      },
      ...(report.byPaymentMethod && report.byPaymentMethod.length
        ? [
            {
              title: "Por método de pago",
              rows: [["Método", "Pedidos", "Total USD"], ...report.byPaymentMethod.map((m) => [m.method, m.count, m.totalUSD])] as (string | number)[][],
            },
          ]
        : []),
      ...(report.delivery && report.delivery.orders
        ? [
            {
              title: "Delivery",
              rows: [
                ["Pedidos delivery", report.delivery.orders],
                ["Ventas delivery USD", report.delivery.revenueUSD],
                ["Cobrado por envíos USD", report.delivery.deliveryCostUSD],
                ["Envío promedio USD", report.delivery.avgDeliveryUSD],
              ] as (string | number)[][],
            },
          ]
        : []),
      ...(report.comparison
        ? [
            {
              title: "Variación vs período anterior",
              rows: [
                ["Métrica", "Actual", "Anterior", "Variación %"],
                ["Pedidos", report.summary.orders, report.comparison.previous.orders, report.comparison.deltas.ordersPct ?? "—"],
                ["Total USD", report.summary.totalUSD, report.comparison.previous.totalUSD, report.comparison.deltas.totalPct ?? "—"],
                ["Ticket promedio USD", report.summary.avgTicket, report.comparison.previous.avgTicket, report.comparison.deltas.avgTicketPct ?? "—"],
              ] as (string | number)[][],
            },
          ]
        : []),
    ])
    const today = new Date().toISOString().slice(0, 10)
    const tag = period === "custom" && fromDate && toDate ? `${fromDate}_a_${toDate}` : period
    downloadCsv(`reporte-${tag}-${today}.csv`, csv)
  }

  // El API solo devuelve días con ventas; se rellena el resto del rango con
  // ceros para que la gráfica muestre el período completo (y no desaparezca
  // cuando todas las ventas cayeron en un solo día).
  const dailySeries = report
    ? fillDailySeries(report.byDay, report.range?.from, report.range?.to)
    : []
  const showDaily = period !== "today" && dailySeries.length > 1

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/local-santo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)] print:hidden">
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
              <BarChart3 size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Reportes</h1>
              <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Resumen de ventas del negocio.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                  period === p.value
                    ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-ink)]"
                    : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={exportCsv}
              disabled={!report}
              className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={!report}
              className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50"
            >
              <Printer size={14} /> Imprimir
            </button>
            {multiBranch && (
              <button
                onClick={() => setConsolidated((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                  consolidated
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                    : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"
                }`}
                title="Sumar todas las sucursales"
              >
                🏢 {consolidated ? "Consolidado: todas" : "Solo esta sucursal"}
              </button>
            )}
          </div>
        </div>

        {period === "custom" && (
          <div className="mt-4 flex flex-wrap items-end gap-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 print:hidden">
            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
              Desde
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
              Hasta
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <span className="pb-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
              {fromDate && toDate
                ? `Mostrando ${fromDate} → ${toDate}`
                : "Elige las dos fechas para ver el reporte."}
            </span>
          </div>
        )}

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-5 text-sm font-bold text-[var(--brand-primary)]">
            No tienes permiso para ver reportes. Inicia sesión como dueño, encargado o caja.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} /></div>
        ) : error ? (
          <p className="mt-6 text-sm font-bold text-red-700">{error}</p>
        ) : report ? (
          <div className="mt-6 space-y-6">
            {/* Tarjetas de resumen (con variación vs período anterior) */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {([
                ["Pedidos", String(report.summary.orders), report.comparison?.deltas.ordersPct],
                ["Total", usd(report.summary.totalUSD), report.comparison?.deltas.totalPct],
                ["Cobrado", usd(report.summary.collectedUSD), undefined],
                ["Pendiente", usd(report.summary.pendingUSD), undefined],
                ["Ticket prom.", usd(report.summary.avgTicket), report.comparison?.deltas.avgTicketPct],
              ] as [string, string, number | null | undefined][]).map(([label, value, pct]) => (
                <div key={label} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70">{label}</p>
                  <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">{value}</p>
                  {pct !== undefined && report.comparison ? (
                    <div className="mt-1"><Delta pct={pct} /></div>
                  ) : null}
                </div>
              ))}
            </div>
            {report.comparison ? (
              <p className="-mt-3 text-[0.66rem] font-bold text-[var(--brand-ink-2)]/55">
                Variación vs período anterior ({report.comparison.previous.orders} pedidos · {usd(report.comparison.previous.totalUSD)}).
              </p>
            ) : null}

            {/* Alertas del dueño (vencimientos, márgenes bajos, bajo stock) */}
            {report.managerAlerts && report.managerAlerts.length > 0 ? (
              <div className="space-y-2">
                {report.managerAlerts.map((alert, i) => {
                  const tone =
                    alert.level === "danger"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : alert.level === "warning"
                        ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                        : "border-[var(--brand-primary)]/20 bg-white text-[var(--brand-ink-2)]"
                  return (
                    <div key={i} className={`rounded-2xl border-2 p-4 ${tone}`}>
                      <p className="text-sm font-black">{alert.title}</p>
                      <p className="mt-1 text-xs font-bold opacity-80">{alert.detail}</p>
                      <p className="mt-1 text-[0.68rem] font-bold opacity-70">→ {alert.action}</p>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* Comparación por sucursal (todas las sedes en el mismo período) */}
            {byBranch.length > 1 ? (
              <Card title="Comparación por sucursal" icon={<BarChart3 size={16} />}>
                <VBarChart
                  height={170}
                  data={byBranch.map((b) => ({
                    label: b.name,
                    value: b.totalUSD,
                    tip: `${b.name}: ${usd(b.totalUSD)} · ${b.orders} pedidos`,
                  }))}
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]/70">
                        <th className="pb-2">Sucursal</th>
                        <th className="pb-2 text-right">Pedidos</th>
                        <th className="pb-2 text-right">Total</th>
                        <th className="pb-2 text-right">Pendiente</th>
                        <th className="pb-2 text-right">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grand = byBranch.reduce((s, b) => s + b.totalUSD, 0) || 1
                        return byBranch.map((b) => (
                          <tr key={b.id} className="border-t border-[var(--brand-primary)]/10">
                            <td className="py-2 font-bold text-[var(--brand-ink-3)]">{b.name}</td>
                            <td className="py-2 text-right font-bold">{b.orders}</td>
                            <td className="py-2 text-right font-black text-[var(--brand-ink-3)]">{usd(b.totalUSD)}</td>
                            <td className="py-2 text-right font-bold text-red-700">{usd(b.pendingUSD)}</td>
                            <td className="py-2 text-right font-bold">{((b.totalUSD / grand) * 100).toFixed(0)}%</td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {/* Tendencia diaria (semana/mes) */}
            {showDaily ? (
              <Card title="Ventas por día" icon={<TrendingUp size={16} />}>
                <VBarChart
                  height={160}
                  highlightEvery={Math.max(1, Math.ceil(dailySeries.length / 8))}
                  data={dailySeries.map((d) => ({
                    label: d.date.slice(5),
                    value: d.totalUSD,
                    tip: `${d.date}: ${usd(d.totalUSD)} · ${d.orders} pedidos`,
                  }))}
                />
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Productos más vendidos" icon={<TrendingUp size={16} />}>
                <HBarChart
                  data={report.topProducts.map((p) => ({
                    label: p.name,
                    value: p.quantity,
                    suffix: `x${p.quantity} · ${usd(p.totalUSD)}`,
                  }))}
                />
              </Card>

              <Card title="Ventas por tipo de pedido" icon={<PieChart size={16} />}>
                <DonutChart unit="$" data={report.byType.map((t) => ({ label: t.type, value: t.totalUSD }))} />
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Estado de los cobros" icon={<PieChart size={16} />}>
                <DonutChart data={report.byPayment.map((p) => ({ label: p.status, value: p.count }))} />
              </Card>

              <Card title="Ventas por hora del día" icon={<Clock size={16} />}>
                <VBarChart
                  height={140}
                  highlightEvery={3}
                  data={report.byHour.map((h) => ({
                    label: String(h.hour),
                    value: h.totalUSD,
                    tip: `${h.hour}:00 · ${usd(h.totalUSD)}`,
                  }))}
                />
              </Card>
            </div>

            {/* Métodos de pago + delivery (avanzado) */}
            <div className="grid gap-6 lg:grid-cols-2">
              {report.byPaymentMethod && report.byPaymentMethod.length > 0 ? (
                <Card title="Métodos de pago" icon={<CreditCard size={16} />}>
                  <HBarChart
                    data={report.byPaymentMethod.map((m) => ({
                      label: m.method,
                      value: m.totalUSD,
                      suffix: `${usd(m.totalUSD)} · ${m.count}`,
                    }))}
                  />
                </Card>
              ) : null}

              {report.delivery && report.delivery.orders > 0 ? (
                <Card title="Delivery" icon={<Truck size={16} />}>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Pedidos delivery", String(report.delivery.orders)],
                      ["Ventas delivery", usd(report.delivery.revenueUSD)],
                      ["Cobrado por envíos", usd(report.delivery.deliveryCostUSD)],
                      ["Envío promedio", usd(report.delivery.avgDeliveryUSD)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                        <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">{label}</p>
                        <p className="mt-1 text-lg font-black text-[var(--brand-ink-3)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>

            {/* Rentabilidad por recetas (márgenes) */}
            {report.productMargins ? (
              <Card title="Rentabilidad y márgenes" icon={<Percent size={16} />}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Cobertura recetas", `${report.productMargins.summary.recipeCoveragePct}%`],
                    ["Margen promedio", report.productMargins.summary.avgMarginPct === null ? "—" : `${report.productMargins.summary.avgMarginPct}%`],
                    ["Ganancia estimada", usd(report.productMargins.summary.estimatedGrossProfitUSD)],
                    ["Productos margen bajo", String(report.productMargins.summary.lowMarginCount)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                      <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]/70">{label}</p>
                      <p className="mt-1 text-lg font-black text-[var(--brand-ink-3)]">{value}</p>
                    </div>
                  ))}
                </div>
                {report.productMargins.lowMargin.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]/70">Productos con menor margen</p>
                    <div className="mt-2 space-y-1">
                      {report.productMargins.lowMargin.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--brand-primary)]/10 bg-white px-3 py-1.5 text-sm">
                          <span className="font-bold text-[var(--brand-ink-3)]">{p.productName}</span>
                          <span className="font-black text-red-700">{p.marginPct === null ? "—" : `${p.marginPct}%`} <span className="font-bold text-[var(--brand-ink-2)]/55">({usd(p.costUSD)}/{usd(p.salePriceUSD)})</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {report.productMargins.noRecipeTopProducts.length > 0 ? (
                  <p className="mt-3 text-xs font-bold text-[var(--brand-ink-2)]/60">
                    Sin receta (no se puede estimar margen): {report.productMargins.noRecipeTopProducts.map((p) => p.name).join(", ")}
                  </p>
                ) : null}
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Salud de inventario */}
              {report.inventoryHealth ? (
                <Card title="Salud de inventario" icon={<Boxes size={16} />}>
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3 text-center">
                      <p className="text-3xl font-black text-red-700">{report.inventoryHealth.lowStockCount}</p>
                      <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]/70">Insumos bajo mínimo</p>
                    </div>
                    <p className="text-xs font-bold text-[var(--brand-ink-2)]/60">{report.inventoryHealth.activeRecipes} recetas activas.</p>
                  </div>
                  {report.inventoryHealth.lowStockItems.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {report.inventoryHealth.lowStockItems.map((it, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--brand-primary)]/10 bg-white px-3 py-1.5 text-sm">
                          <span className="font-bold text-[var(--brand-ink-3)]">{it.name}</span>
                          <span className="font-black text-red-700">{it.quantity}/{it.minimumStock} {it.unit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-green-700">Todo el inventario está por encima del mínimo.</p>
                  )}
                </Card>
              ) : null}

              {/* Cuentas por pagar a proveedores */}
              {report.supplierPayables ? (
                <Card title="Cuentas por pagar" icon={<Wallet size={16} />}>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Pendiente", usd(report.supplierPayables.summary.pendingUSD), "text-[var(--brand-ink-3)]"],
                      ["Vencido", usd(report.supplierPayables.summary.overdueUSD), "text-red-700"],
                      ["Vence pronto", usd(report.supplierPayables.summary.dueSoonUSD), "text-yellow-700"],
                    ].map(([label, value, tone]) => (
                      <div key={label} className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
                        <p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]/70">{label}</p>
                        <p className={`mt-1 text-base font-black ${tone}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {report.supplierPayables.bySupplier.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {report.supplierPayables.bySupplier.slice(0, 6).map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--brand-primary)]/10 bg-white px-3 py-1.5 text-sm">
                          <span className="font-bold text-[var(--brand-ink-3)]">{s.supplierName}</span>
                          <span className="font-black text-[var(--brand-ink-3)]">{usd(s.pendingUSD)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
