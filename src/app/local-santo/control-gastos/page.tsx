"use client"

// Hub "Control de gastos": punto de entrada único para el lado de egresos del
// negocio. Reúne en una sola pantalla el resumen del día (ventas, proveedores y
// alertas, con toggle Esta sede / Negocio completo reusando /api/reports), el
// registro de gastos del día de la sede (/api/day-expenses) y accesos ordenados
// a Compras, Proveedores y Alertas según lo que el rol pueda ver.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Loader2,
  Plus,
  Trash2,
  Wallet,
  ShoppingCart,
  Truck,
  Bell,
  PackageCheck,
  Building2,
  MapPin,
  AlertTriangle,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import type { DayExpense } from "@/lib/ordersDayClose"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Scope = "branch" | "all"

type ManagerAlert = {
  level: "danger" | "warning" | "info"
  title: string
  detail: string
  action: string
}

type ReportsResponse = {
  ok?: boolean
  error?: string
  scope?: Scope
  summary?: {
    orders: number
    totalUSD: number
    collectedUSD: number
    pendingUSD: number
    avgTicket: number
  }
  supplierPurchases?: {
    summary: { purchases: number; totalUSD: number; totalVES: number }
  } | null
  supplierPayables?: {
    summary: {
      purchases: number
      totalUSD: number
      pendingUSD: number
      overdueCount: number
      overdueUSD: number
    }
  } | null
  inventoryHealth?: { lowStockCount: number } | null
  managerAlerts?: ManagerAlert[]
  range?: { label: string }
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || ""
      : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function usd(n: number) {
  return `$${(Number(n) || 0).toFixed(2)}`
}

// Fecha YYYY-MM-DD en la zona del negocio, para agrupar los gastos del día
// igual que hace el resto del panel (misma convención que /api/reports).
function todayKeyCaracas() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

const EXPENSE_CATEGORIES = [
  "Materia prima",
  "Compra de productos",
  "Servicios",
  "Sueldos",
  "Delivery / motorizado",
  "Mantenimiento",
  "Otros",
]

const ALERT_STYLES: Record<ManagerAlert["level"], string> = {
  danger: "border-red-300 bg-red-50 text-red-700",
  warning: "border-amber-300 bg-amber-50 text-amber-700",
  info: "border-[var(--brand-primary)]/25 bg-[var(--brand-accent-100)] text-[var(--brand-primary)]",
}

export default function ControlGastosPage() {
  return (
    <ModuleAccessGuard moduleKey="expenses" moduleName="Control de gastos">
      <ControlGastosContent />
    </ModuleAccessGuard>
  )
}

function ControlGastosContent() {
  const [role, setRole] = useState<string>("")
  const [navModules, setNavModules] = useState<string[]>([])
  const [scope, setScope] = useState<Scope>("branch")

  const [reports, setReports] = useState<ReportsResponse | null>(null)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState("")

  const [dayExpenses, setDayExpenses] = useState<DayExpense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [expensesError, setExpensesError] = useState("")
  const [busy, setBusy] = useState(false)

  // Formulario rápido de gasto del día (esta sede). Monto en USD para evitar
  // depender de la tasa aquí; el flujo con Bs+tasa sigue en Compras/cierre.
  const [concept, setConcept] = useState("")
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [method, setMethod] = useState("")
  const [amountUSD, setAmountUSD] = useState("")
  const [note, setNote] = useState("")

  const canConsolidate = role === "owner" || role === "support"

  // Rol + módulos navegables (para mostrar solo los accesos que el rol ve, igual
  // que la barra superior). Reusa el mismo endpoint que ModuleAccessGuard.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/local-auth?moduleKey=expenses", {
          headers: authHeaders(),
          cache: "no-store",
        })
        const data = await res.json()
        if (!active) return
        setRole(String(data?.access?.role || ""))
        setNavModules(
          Array.isArray(data?.access?.navModules) ? data.access.navModules : [],
        )
      } catch {
        /* si falla, quedan los accesos ocultos por defecto */
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const loadReports = useCallback(async (nextScope: Scope) => {
    setReportsLoading(true)
    setReportsError("")
    try {
      const scopeQuery = nextScope === "all" ? "&scope=all" : ""
      const res = await fetch(`/api/reports?period=today${scopeQuery}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = (await res.json()) as ReportsResponse
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el resumen")
      setReports(data)
    } catch (e) {
      setReports(null)
      setReportsError(e instanceof Error ? e.message : "Error")
    } finally {
      setReportsLoading(false)
    }
  }, [])

  const loadDayExpenses = useCallback(async () => {
    setExpensesLoading(true)
    setExpensesError("")
    try {
      const res = await fetch(
        `/api/day-expenses?dateValue=${todayKeyCaracas()}`,
        { headers: authHeaders(), cache: "no-store" },
      )
      const data = await res.json()
      if (!res.ok)
        throw new Error(data.error || "No se pudieron cargar los gastos del día")
      setDayExpenses(Array.isArray(data.dayExpenses) ? data.dayExpenses : [])
    } catch (e) {
      setExpensesError(e instanceof Error ? e.message : "Error")
    } finally {
      setExpensesLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadReports(scope), 0)
    return () => clearTimeout(timer)
  }, [scope, loadReports])

  useEffect(() => {
    const timer = setTimeout(() => loadDayExpenses(), 0)
    return () => clearTimeout(timer)
  }, [loadDayExpenses])

  const dayExpenseTotalUSD = useMemo(
    () =>
      dayExpenses.reduce(
        (sum, expense) =>
          sum + (expense.equivalentUSD || expense.amountUSD || 0),
        0,
      ),
    [dayExpenses],
  )

  async function addExpense() {
    const value = Number(amountUSD)
    if (!concept.trim()) {
      setExpensesError("Escribe el concepto del gasto.")
      return
    }
    if (!(value > 0)) {
      setExpensesError("Indica un monto en USD mayor a cero.")
      return
    }
    setBusy(true)
    setExpensesError("")
    try {
      const res = await fetch("/api/day-expenses", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          concept: concept.trim(),
          category,
          method: method.trim() || "Sin registrar",
          amountUSD: value,
          equivalentUSD: value,
          note: note.trim(),
          dateValue: todayKeyCaracas(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el gasto")
      setConcept("")
      setMethod("")
      setAmountUSD("")
      setNote("")
      await loadDayExpenses()
    } catch (e) {
      setExpensesError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function removeExpense(expense: DayExpense) {
    if (
      !window.confirm(
        `¿Eliminar el gasto "${expense.concept}" por ${usd(expense.equivalentUSD || expense.amountUSD)}?`,
      )
    )
      return
    setBusy(true)
    setExpensesError("")
    try {
      const res = await fetch(
        `/api/day-expenses?id=${encodeURIComponent(expense.id)}`,
        { method: "DELETE", headers: authHeaders() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await loadDayExpenses()
    } catch (e) {
      setExpensesError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const purchases = reports?.supplierPurchases?.summary || null
  const payables = reports?.supplierPayables?.summary || null
  const alerts = reports?.managerAlerts || []
  const lowStock = reports?.inventoryHealth?.lowStockCount ?? null

  const accessCards = [
    {
      key: "supplierPurchases",
      href: "/local-santo/compras",
      icon: <ShoppingCart size={22} />,
      title: "Compras",
      description: "Registra compras a proveedores, abonos y vencimientos.",
    },
    {
      key: "accountsPayable",
      href: "/local-santo/cuentas-por-pagar",
      icon: <Wallet size={22} />,
      title: "Cuentas por pagar",
      description: "Lo que le debes a cada proveedor y las compras vencidas.",
    },
    {
      key: "suppliers",
      href: "/local-santo/proveedores",
      icon: <Truck size={22} />,
      title: "Proveedores",
      description: "Lista de proveedores con contacto para tus compras.",
    },
    {
      key: "inventoryAlerts",
      href: "/local-santo/inventario-alertas",
      icon: <Bell size={22} />,
      title: "Alertas de inventario",
      description: "Stock bajo, insumos sin costo y productos sin receta.",
    },
    {
      key: "inventory",
      href: "/local-santo/inventario",
      icon: <PackageCheck size={22} />,
      title: "Inventario",
      description: "Existencias, entradas y salidas de insumos.",
    },
  ].filter((card) => navModules.includes(card.key))

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo"
            className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70"
          >
            Panel
          </Link>
          <Link
            href="/local-santo/cierres"
            className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70"
          >
            Cierre del día →
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Wallet size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">
              Control de gastos
            </h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Gastos, compras, proveedores e inventario en un solo lugar.
            </p>
          </div>
        </div>

        {/* Alcance: esta sede o negocio completo (solo dueño/soporte) */}
        {canConsolidate && (
          <div className="mt-6 inline-flex rounded-full border-2 border-[var(--brand-primary)]/20 bg-white p-1">
            <button
              type="button"
              onClick={() => setScope("branch")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                scope === "branch"
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--brand-primary)]"
              }`}
            >
              <MapPin size={14} /> Esta sede
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                scope === "all"
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--brand-primary)]"
              }`}
            >
              <Building2 size={14} /> Negocio completo
            </button>
          </div>
        )}

        {/* Resumen del día */}
        <section className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Resumen de hoy
              {reports?.scope === "all" ? " · Negocio completo" : " · Esta sede"}
            </p>
            {reportsLoading && (
              <Loader2
                className="animate-spin text-[var(--brand-primary)]"
                size={16}
              />
            )}
          </div>

          {reportsError ? (
            <p className="mt-3 font-bold text-red-600">{reportsError}</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Ventas de hoy"
                value={usd(reports?.summary?.totalUSD ?? 0)}
                hint={`Cobrado ${usd(reports?.summary?.collectedUSD ?? 0)}`}
              />
              <SummaryCard
                label="Por pagar a proveedores"
                value={usd(payables?.pendingUSD ?? 0)}
                hint={
                  payables
                    ? `${payables.overdueCount} vencida(s)`
                    : "Compras desactivado"
                }
                tone={payables && payables.overdueCount > 0 ? "warning" : "soft"}
              />
              <SummaryCard
                label="Compras registradas"
                value={usd(purchases?.totalUSD ?? 0)}
                hint={
                  purchases
                    ? `${purchases.purchases} compra(s)`
                    : "Compras desactivado"
                }
              />
              <SummaryCard
                label="Gastos del día (sede)"
                value={usd(dayExpenseTotalUSD)}
                hint={`${dayExpenses.length} registro(s)`}
              />
            </div>
          )}

          {/* Alertas conectadas con inventario */}
          {alerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {alerts.slice(0, 4).map((alert, index) => (
                <div
                  key={`${alert.title}-${index}`}
                  className={`flex items-start gap-2 rounded-xl border-2 px-3 py-2 ${ALERT_STYLES[alert.level]}`}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-black">{alert.title}</p>
                    <p className="text-xs font-bold opacity-80">{alert.detail}</p>
                  </div>
                </div>
              ))}
              {lowStock !== null && lowStock > 0 && alerts.length === 0 && (
                <p className="text-xs font-bold text-amber-700">
                  {lowStock} insumo(s) bajo el mínimo.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Accesos a las secciones (según permisos del rol) */}
        {accessCards.length > 0 && (
          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {accessCards.map((card) => (
              <Link
                key={card.key}
                href={card.href}
                className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 transition hover:border-[var(--brand-primary)]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
                  {card.icon}
                </span>
                <p className="mt-2 text-sm font-black uppercase text-[var(--brand-ink-3)]">
                  {card.title}
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                  {card.description}
                </p>
              </Link>
            ))}
          </section>
        )}

        {/* Gastos del día (esta sede) */}
        <section className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Gastos del día · esta sede
            </p>
            <span className="text-sm font-black text-[var(--brand-ink-3)]">
              {usd(dayExpenseTotalUSD)}
            </span>
          </div>

          {/* Alta rápida */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Concepto (ej. verduras, gas, sueldo…)"
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)] sm:col-span-2"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Método (efectivo, pago móvil…)"
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
              placeholder="Monto USD"
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
            />
            <div className="sm:col-span-2">
              <button
                onClick={addExpense}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
              >
                <Plus size={16} /> Registrar gasto
              </button>
            </div>
          </div>

          {expensesError && (
            <p className="mt-3 font-bold text-red-600">{expensesError}</p>
          )}

          {/* Lista */}
          <div className="mt-4">
            {expensesLoading ? (
              <p className="inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : dayExpenses.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-4 text-sm font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay gastos registrados hoy en esta sede.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[var(--brand-ink-3)]">
                        {expense.concept}
                      </p>
                      <p className="text-xs font-bold text-[var(--brand-ink-2)]/55">
                        {expense.category || "Otros"}
                        {expense.method ? ` · ${expense.method}` : ""}
                        {expense.note ? ` · ${expense.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-[var(--brand-ink-3)]">
                        {usd(expense.equivalentUSD || expense.amountUSD)}
                      </span>
                      <button
                        onClick={() => removeExpense(expense)}
                        disabled={busy}
                        title="Eliminar gasto"
                        className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-4 text-xs font-bold text-[var(--brand-ink-2)]/55">
            El neto oficial del día (ventas menos gastos y salidas a proveedores)
            se calcula en el{" "}
            <Link
              href="/local-santo/cierres"
              className="text-[var(--brand-primary)] underline"
            >
              Cierre del día
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "soft",
}: {
  label: string
  value: string
  hint?: string
  tone?: "soft" | "warning"
}) {
  return (
    <div
      className={`rounded-xl border-2 p-3 ${
        tone === "warning"
          ? "border-amber-300 bg-amber-50"
          : "border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]"
      }`}
    >
      <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[var(--brand-ink-3)]">{value}</p>
      {hint && (
        <p className="mt-0.5 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
          {hint}
        </p>
      )}
    </div>
  )
}
