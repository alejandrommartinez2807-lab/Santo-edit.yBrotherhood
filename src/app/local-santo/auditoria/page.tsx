"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  CreditCard,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/auditActions"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type AuditLogEntry = {
  id: string
  branchId: string | null
  action: string
  actionLabel: string
  entityType: string
  entityId: string | null
  actorRole: string | null
  actorLabel: string | null
  actorSource: string | null
  ipAddress: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

// Rol en español (el actor suele traer el nombre de la persona en actorLabel y
// el rol técnico en actorRole).
const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  manager: "Encargado",
  cashier: "Cajero",
  kitchen: "Cocina",
  delivery: "Delivery",
  waiter: "Mesonero",
  promoter: "Promotor",
  support: "Soporte",
}

// Categoría visual (icono + color) según el prefijo de la acción. Así de un
// vistazo se distingue un cobro de un cambio de configuración o de usuario.
type Category = {
  label: string
  icon: LucideIcon
  ring: string // borde + fondo suave + color de texto del icono
}

function getCategory(action: string): Category {
  if (action.startsWith("order.payment") || action.startsWith("payment_proof")) {
    return { label: "Pagos", icon: CreditCard, ring: "border-emerald-500/30 bg-emerald-50 text-emerald-700" }
  }
  if (action.startsWith("order")) {
    return { label: "Pedidos", icon: ShoppingBag, ring: "border-sky-500/30 bg-sky-50 text-sky-700" }
  }
  if (action.startsWith("open_account")) {
    return { label: "Cuentas abiertas", icon: Users, ring: "border-violet-500/30 bg-violet-50 text-violet-700" }
  }
  if (action.startsWith("day_close")) {
    return { label: "Cierres de caja", icon: Lock, ring: "border-slate-500/30 bg-slate-100 text-slate-700" }
  }
  if (action.startsWith("supplier_purchase")) {
    return { label: "Compras", icon: Package, ring: "border-orange-500/30 bg-orange-50 text-orange-700" }
  }
  if (action.startsWith("business_config")) {
    return { label: "Configuración", icon: Settings, ring: "border-gray-500/30 bg-gray-100 text-gray-700" }
  }
  if (action.startsWith("staff")) {
    return { label: "Usuarios", icon: UserCog, ring: "border-teal-500/30 bg-teal-50 text-teal-700" }
  }
  if (action.startsWith("inventory")) {
    return { label: "Inventario", icon: Boxes, ring: "border-amber-500/30 bg-amber-50 text-amber-700" }
  }
  return { label: "Otras", icon: ClipboardList, ring: "border-gray-400/30 bg-gray-50 text-gray-600" }
}

const ENTITY_LABELS: Record<string, string> = {
  order: "Pedido",
  open_account: "Cuenta abierta",
  payment_proof: "Comprobante",
  day_close: "Cierre",
  supplier_purchase: "Compra",
  business_config: "Configuración",
  staff: "Usuario",
  inventory_item: "Insumo",
}

function friendlyEntity(entityType: string) {
  if (!entityType) return ""
  return ENTITY_LABELS[entityType] || entityType.replace(/_/g, " ")
}

function actorName(log: AuditLogEntry) {
  const role = log.actorRole ? ROLE_LABELS[log.actorRole] || log.actorRole : ""
  const label = (log.actorLabel || "").trim()
  if (label && role) return `${label} · ${role}`
  if (label) return label
  if (role) return role
  return "Sistema / sin identificar"
}

// camelCase → "camel case" para que las claves de detalle se lean.
function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
}

function metadataChips(metadata: Record<string, unknown>): { key: string; text: string }[] {
  return Object.entries(metadata || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8)
    .map(([key, value]) => {
      const text = Array.isArray(value)
        ? value.join(", ")
        : value && typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
      return { key, text: `${humanizeKey(key)}: ${text}` }
    })
}

function caracasDayKey(value: string | Date) {
  try {
    return new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Caracas" })
  } catch {
    return ""
  }
}

function dayLabel(dayKey: string) {
  const todayKey = caracasDayKey(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = caracasDayKey(yesterday)

  if (dayKey === todayKey) return "Hoy"
  if (dayKey === yesterdayKey) return "Ayer"
  try {
    return new Date(`${dayKey}T12:00:00`).toLocaleDateString("es-VE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })
  } catch {
    return dayKey
  }
}

function timeOnly(value: string) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleTimeString("es-VE", {
      timeZone: "America/Caracas",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

const ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]

export default function AuditoriaPage() {
  return (
    <ModuleAccessGuard moduleKey="auditLog" moduleName="Auditoría">
      <AuditoriaPageContent />
    </ModuleAccessGuard>
  )
}

function AuditoriaPageContent() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")

  const [actionFilter, setActionFilter] = useState("")
  const [actorFilter, setActorFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set("action", actionFilter)
      if (fromDate) params.set("fromDate", fromDate)
      if (toDate) params.set("toDate", toDate)
      params.set("limit", "200")

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la bitácora")
      setDenied(false)
      setLogs(data.logs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [actionFilter, fromDate, toDate])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(loadLogs, 0)
    return () => clearTimeout(timer)
  }, [loadLogs])

  // El filtro por usuario es del lado del cliente (sobre lo ya cargado): así el
  // dueño ve rápido "todo lo que hizo Fulano" sin recargar.
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>()
    logs.forEach((log) => {
      const name = actorName(log)
      if (!seen.has(name)) seen.set(name, name)
    })
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b))
  }, [logs])

  const visibleLogs = useMemo(
    () => (actorFilter ? logs.filter((log) => actorName(log) === actorFilter) : logs),
    [logs, actorFilter],
  )

  // Resumen "qué hizo cada usuario": conteo de acciones por persona, para ver de
  // un vistazo quién estuvo más activo y saltar a su detalle con un toque.
  const actorSummary = useMemo(() => {
    const counts = new Map<string, number>()
    logs.forEach((log) => {
      const name = actorName(log)
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [logs])

  // Agrupado por día (más reciente primero) para leerlo como una línea de tiempo.
  const groups = useMemo(() => {
    const map = new Map<string, AuditLogEntry[]>()
    visibleLogs.forEach((log) => {
      const key = caracasDayKey(log.createdAt)
      const list = map.get(key)
      if (list) list.push(log)
      else map.set(key, [log])
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [visibleLogs])

  const hasActiveFilters = Boolean(actionFilter || actorFilter || fromDate || toDate)

  function clearFilters() {
    setActionFilter("")
    setActorFilter("")
    setFromDate("")
    setToDate("")
  }

  const inputClass =
    "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"

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
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl leading-tight text-[var(--brand-ink-3)] font-semibold">
              Auditoría
            </h1>
            <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
              Quién hizo qué, cuándo y desde dónde. Solo lectura.
            </p>
          </div>
        </div>

        {denied ? (
          <div className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5">
            <p className="font-bold text-[var(--brand-ink-3)]">
              Solo el dueño o soporte pueden ver la bitácora.
            </p>
            <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/65">
              Además, el módulo de auditoría debe estar activo en Configuración del negocio.
              Inicia sesión como dueño e inténtalo de nuevo.
            </p>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Usuario
                  <select
                    value={actorFilter}
                    onChange={(e) => setActorFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Todos los usuarios</option>
                    {actorOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Acción
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Todas las acciones</option>
                    {ACTION_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Desde
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Hasta
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/40 bg-[var(--brand-primary)] px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
                {!loading && (
                  <span className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                    {visibleLogs.length} registro{visibleLogs.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {!loading && actorSummary.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  Qué hizo cada usuario
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {actorSummary.map((actor) => {
                    const isActive = actorFilter === actor.name
                    return (
                      <button
                        key={actor.name}
                        type="button"
                        onClick={() => setActorFilter(isActive ? "" : actor.name)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                            : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-3)] hover:border-[var(--brand-primary)]"
                        }`}
                      >
                        {actor.name}
                        <span
                          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.62rem] ${
                            isActive
                              ? "bg-white/25 text-white"
                              : "bg-[var(--brand-cream)] text-[var(--brand-primary)]"
                          }`}
                        >
                          {actor.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {actorFilter && (
                  <p className="mt-2.5 text-xs font-bold text-[var(--brand-ink-2)]/65">
                    Mostrando solo lo que hizo{" "}
                    <span className="font-bold text-[var(--brand-primary)]">{actorFilter}</span>.{" "}
                    <button
                      type="button"
                      onClick={() => setActorFilter("")}
                      className="font-bold text-[var(--brand-primary)] underline"
                    >
                      Ver a todos
                    </button>
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 font-bold text-red-700">
                {error}
              </p>
            )}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : visibleLogs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-6 text-center">
                <p className="font-bold uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
                  Sin registros
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
                  No hay acciones con estos filtros. Prueba con otro rango de fechas o usuario.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {groups.map(([dayKey, dayLogs]) => (
                  <section key={dayKey}>
                    <div className="sticky top-0 z-10 -mx-1 mb-2 bg-[var(--brand-cream)]/95 px-1 py-1 backdrop-blur">
                      <h2 className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white">
                        {dayLabel(dayKey)}
                        <span className="text-white/70">· {dayLogs.length}</span>
                      </h2>
                    </div>

                    <ul className="space-y-2">
                      {dayLogs.map((log) => {
                        const category = getCategory(log.action)
                        const Icon = category.icon
                        const chips = metadataChips(log.metadata)
                        const entityLabel = friendlyEntity(log.entityType)

                        return (
                          <li
                            key={log.id}
                            className="flex gap-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-3.5"
                          >
                            <span
                              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${category.ring}`}
                              title={category.label}
                            >
                              <Icon size={17} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <p className="text-sm font-bold text-[var(--brand-primary)]">
                                  {actorName(log)}
                                </p>
                                <span className="text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
                                  {timeOnly(log.createdAt)}
                                </span>
                              </div>

                              <p className="mt-0.5 text-xs font-bold text-[var(--brand-ink-2)]/75">
                                <span className="font-bold text-[var(--brand-ink-3)]">
                                  {log.actionLabel}
                                </span>
                                {entityLabel ? ` · ${entityLabel}` : ""}
                                {log.ipAddress ? ` · IP ${log.ipAddress}` : ""}
                              </p>

                              {chips.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {chips.map((chip) => (
                                    <span
                                      key={chip.key}
                                      className="max-w-full truncate rounded-lg bg-[var(--brand-cream)] px-2 py-1 text-[0.66rem] font-bold text-[var(--brand-ink-2)]/70"
                                      title={chip.text}
                                    >
                                      {chip.text}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
