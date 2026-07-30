"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  Search,
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

// Tamaño de página de la bitácora (el server la acota a 500 filas por tanda);
// "Cargar más" pide la siguiente tanda con offset.
const PAGE_SIZE = 500

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
    typeof window !== "undefined" ? window.localStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
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
  system: "Sistema",
  staff: "Personal",
  cliente: "Cliente",
}

// Categoría visual (icono + color) según el prefijo de la acción. Así de un
// vistazo se distingue un cobro de un cambio de configuración o de usuario.
type Category = {
  key: string
  label: string
  icon: LucideIcon
  ring: string // borde + fondo suave + color de texto del icono
}

function getCategory(action: string): Category {
  if (action.startsWith("order.payment") || action.startsWith("payment_proof")) {
    return { key: "pagos", label: "Pagos", icon: CreditCard, ring: "border-emerald-500/30 bg-emerald-50 text-emerald-700" }
  }
  if (action.startsWith("order")) {
    return { key: "pedidos", label: "Pedidos", icon: ShoppingBag, ring: "border-sky-500/30 bg-sky-50 text-sky-700" }
  }
  if (action.startsWith("open_account")) {
    return { key: "cuentas", label: "Cuentas abiertas", icon: Users, ring: "border-violet-500/30 bg-violet-50 text-violet-700" }
  }
  if (action.startsWith("day_close")) {
    return { key: "cierres", label: "Cierres de caja", icon: Lock, ring: "border-slate-500/30 bg-slate-100 text-slate-700" }
  }
  if (action.startsWith("supplier_purchase") || action.startsWith("payables")) {
    return { key: "compras", label: "Compras", icon: Package, ring: "border-orange-500/30 bg-orange-50 text-orange-700" }
  }
  if (action.startsWith("business_config")) {
    return { key: "config", label: "Configuración", icon: Settings, ring: "border-gray-500/30 bg-gray-100 text-gray-700" }
  }
  if (action.startsWith("staff")) {
    return { key: "usuarios", label: "Usuarios", icon: UserCog, ring: "border-teal-500/30 bg-teal-50 text-teal-700" }
  }
  if (action.startsWith("inventory")) {
    return { key: "inventario", label: "Inventario", icon: Boxes, ring: "border-amber-500/30 bg-amber-50 text-amber-700" }
  }
  return { key: "otras", label: "Otras", icon: ClipboardList, ring: "border-gray-400/30 bg-gray-50 text-gray-600" }
}

const ENTITY_LABELS: Record<string, string> = {
  order: "Pedido",
  open_account: "Cuenta abierta",
  payment_proof: "Comprobante",
  day_close: "Cierre",
  supplier_purchase: "Compra",
  supplier: "Proveedor",
  business_config: "Configuración",
  staff: "Usuario",
  inventory_item: "Insumo",
  reservation: "Reserva",
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

// Color estable por usuario: siempre el mismo tono para la misma persona, para
// seguirla con la vista dentro de la línea de tiempo. El sistema va en gris.
const ACTOR_COLORS = [
  "bg-rose-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-cyan-600",
]

function actorColor(name: string) {
  if (/sistema|sin identificar/i.test(name)) return "bg-gray-400"
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997
  return ACTOR_COLORS[hash % ACTOR_COLORS.length]
}

function actorInitials(name: string) {
  const base = name.split("·")[0]?.trim() || name
  const words = base.split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() || "")
  return initials.join("") || "?"
}

// camelCase → "camel case" para que las claves de detalle se lean.
function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
}

// Claves frecuentes de metadata → etiqueta corta en español. Lo que no esté
// aquí cae al humanizado genérico.
const METADATA_LABELS: Record<string, string> = {
  orderId: "pedido",
  accountId: "cuenta",
  openAccountId: "cuenta",
  amountUSD: "monto $",
  amountVES: "monto Bs",
  amountReportedUsd: "reportado $",
  amountReportedVes: "reportado Bs",
  totalUSD: "total $",
  totalVES: "total Bs",
  pendingUSD: "pendiente $",
  pendingVES: "pendiente Bs",
  paymentMethod: "método",
  method: "método",
  methods: "métodos",
  reference: "referencia",
  status: "estado",
  previousStatus: "antes",
  newStatus: "ahora",
  paymentStatus: "estado del pago",
  supplierName: "proveedor",
  documentNumber: "documento",
  customerName: "cliente",
  tableNumber: "mesa",
  branchName: "sede",
  note: "nota",
  reason: "motivo",
  itemName: "producto",
  quantity: "cantidad",
  actorStaffId: "id del usuario",
}

function formatMetadataValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "sí" : "no"
  if (Array.isArray(value)) return value.join(", ")
  if (value && typeof value === "object") return JSON.stringify(value)

  const num = Number(value)
  if (value !== "" && Number.isFinite(num)) {
    if (/usd$/i.test(key)) return `$${num}`
    if (/ves$/i.test(key)) return `Bs ${num.toLocaleString("es-VE")}`
  }
  return String(value)
}

function metadataChips(metadata: Record<string, unknown>): { key: string; text: string }[] {
  return Object.entries(metadata || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8)
    .map(([key, value]) => {
      const label = METADATA_LABELS[key] || humanizeKey(key)
      return { key, text: `${label}: ${formatMetadataValue(key, value)}` }
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

// Select de acciones agrupado por categoría (antes era una lista plana larga).
const ACTION_GROUPS = (() => {
  const groups = new Map<string, { label: string; options: [AuditAction, string][] }>()
  ;(Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]).forEach(([key, label]) => {
    const category = getCategory(key)
    const group = groups.get(category.key)
    if (group) group.options.push([key, label])
    else groups.set(category.key, { label: category.label, options: [[key, label]] })
  })
  return Array.from(groups.values())
})()

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")

  const [actionFilter, setActionFilter] = useState("")
  const [actorFilter, setActorFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dayFilter, setDayFilter] = useState("")
  const [searchText, setSearchText] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  // Por defecto la bitácora es de la SEDE activa; este toggle consolida las
  // dos sedes (antes siempre venían mezcladas sin poder distinguirlas).
  const [allBranches, setAllBranches] = useState(false)
  // id de sede → nombre, para etiquetar cada registro cuando se consolida.
  const [branchNames, setBranchNames] = useState<Record<string, string>>({})

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams()
      if (actionFilter) params.set("action", actionFilter)
      if (fromDate) params.set("fromDate", fromDate)
      if (toDate) params.set("toDate", toDate)
      if (allBranches) params.set("scope", "all")
      params.set("limit", String(PAGE_SIZE))
      if (offset > 0) params.set("offset", String(offset))
      return params
    },
    [actionFilter, fromDate, toDate, allBranches],
  )

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/audit-logs?${buildParams(0).toString()}`, {
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
      const page: AuditLogEntry[] = data.logs || []
      setLogs(page)
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // Siguiente tanda del MISMO filtro de servidor; se pega debajo sin duplicar
  // (mientras tanto pudieron entrar registros nuevos que corren el offset).
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/audit-logs?${buildParams(logs.length).toString()}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar más")
      const page: AuditLogEntry[] = data.logs || []
      setLogs((prev) => {
        const seen = new Set(prev.map((log) => log.id))
        return [...prev, ...page.filter((log) => !seen.has(log.id))]
      })
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, logs.length])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(loadLogs, 0)
    return () => clearTimeout(timer)
  }, [loadLogs])

  // Nombres de sede (una sola vez): etiquetan los registros consolidados.
  useEffect(() => {
    let cancelled = false
    fetch("/api/branches", { headers: authHeaders(), cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.branches) return
        const map: Record<string, string> = {}
        for (const branch of data.branches) map[String(branch.id)] = String(branch.name || "")
        setBranchNames(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Filtros del lado del cliente (sobre lo ya cargado): usuario, categoría,
  // día puntual y búsqueda libre. Componen entre sí.
  const searchNeedle = searchText.trim().toLowerCase()

  const matchesClientFilters = useCallback(
    (log: AuditLogEntry, opts: { ignoreDay?: boolean; ignoreCategory?: boolean } = {}) => {
      if (actorFilter && actorName(log) !== actorFilter) return false
      if (!opts.ignoreCategory && categoryFilter && getCategory(log.action).key !== categoryFilter) return false
      if (!opts.ignoreDay && dayFilter && caracasDayKey(log.createdAt) !== dayFilter) return false
      if (searchNeedle) {
        const haystack = [
          actorName(log),
          log.actionLabel,
          log.action,
          friendlyEntity(log.entityType),
          log.entityId || "",
          log.ipAddress || "",
          JSON.stringify(log.metadata || {}),
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(searchNeedle)) return false
      }
      return true
    },
    [actorFilter, categoryFilter, dayFilter, searchNeedle],
  )

  const visibleLogs = useMemo(
    () => logs.filter((log) => matchesClientFilters(log)),
    [logs, matchesClientFilters],
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

  // Conteo por categoría (pagos, pedidos, compras…) sobre lo cargado, para
  // filtrar por tipo de acción con un toque.
  const categorySummary = useMemo(() => {
    const counts = new Map<string, { category: Category; count: number }>()
    logs.forEach((log) => {
      if (!matchesClientFilters(log, { ignoreCategory: true, ignoreDay: true })) return
      const category = getCategory(log.action)
      const entry = counts.get(category.key)
      if (entry) entry.count += 1
      else counts.set(category.key, { category, count: 1 })
    })
    return Array.from(counts.values()).sort((a, b) => b.count - a.count)
  }, [logs, matchesClientFilters])

  // Días disponibles para el navegador (ignora el filtro de día para poder
  // saltar de un día a otro sin perderlos de vista).
  const dayNavigator = useMemo(() => {
    const counts = new Map<string, number>()
    logs.forEach((log) => {
      if (!matchesClientFilters(log, { ignoreDay: true })) return
      const key = caracasDayKey(log.createdAt)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [logs, matchesClientFilters])

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

  const hasActiveFilters = Boolean(
    actionFilter || actorFilter || categoryFilter || dayFilter || searchText || fromDate || toDate,
  )

  function clearFilters() {
    setActionFilter("")
    setActorFilter("")
    setCategoryFilter("")
    setDayFilter("")
    setSearchText("")
    setFromDate("")
    setToDate("")
  }

  // Accesos rápidos de fecha: un toque en vez de armar el rango a mano.
  function applyDatePreset(preset: "today" | "yesterday" | "week") {
    setDayFilter("")
    const todayKey = caracasDayKey(new Date())

    if (preset === "today") {
      setFromDate(todayKey)
      setToDate(todayKey)
      return
    }

    if (preset === "yesterday") {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayKey = caracasDayKey(yesterday)
      setFromDate(yesterdayKey)
      setToDate(yesterdayKey)
      return
    }

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    setFromDate(caracasDayKey(weekAgo))
    setToDate(todayKey)
  }

  const activePreset = (() => {
    if (!fromDate || !toDate) return ""
    const todayKey = caracasDayKey(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = caracasDayKey(yesterday)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    if (fromDate === todayKey && toDate === todayKey) return "today"
    if (fromDate === yesterdayKey && toDate === yesterdayKey) return "yesterday"
    if (fromDate === caracasDayKey(weekAgo) && toDate === todayKey) return "week"
    return ""
  })()

  // Descarga lo VISIBLE (con los filtros aplicados) como CSV que Excel abre
  // directo: BOM UTF-8 y punto y coma como separador.
  function exportCsv() {
    const header = ["Fecha", "Hora", "Usuario", "Acción", "Categoría", "Entidad", "Sede", "IP", "Detalles"]
    const rows = visibleLogs.map((log) => [
      caracasDayKey(log.createdAt),
      timeOnly(log.createdAt),
      actorName(log),
      log.actionLabel,
      getCategory(log.action).label,
      friendlyEntity(log.entityType),
      (log.branchId && branchNames[log.branchId]) || "",
      log.ipAddress || "",
      Object.entries(log.metadata || {})
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => `${METADATA_LABELS[key] || humanizeKey(key)}: ${formatMetadataValue(key, value)}`)
        .join(" · "),
    ])
    const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const csv =
      "\uFEFF" + [header, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `auditoria-${caracasDayKey(new Date())}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[var(--brand-primary)]"

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
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase leading-none text-[var(--brand-ink-3)]">
              Auditoría
            </h1>
            <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
              Quién hizo qué, cuándo y desde dónde. Solo lectura.
            </p>
          </div>
        </div>

        {denied ? (
          <div className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
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
            <div className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
              {/* Rango de fechas en un toque */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "today", label: "Hoy" },
                    { key: "yesterday", label: "Ayer" },
                    { key: "week", label: "Últimos 7 días" },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyDatePreset(preset.key)}
                    className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition ${
                      activePreset === preset.key
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("")
                      setToDate("")
                    }}
                    className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#1a1a1a]/60"
                  >
                    Todas las fechas
                  </button>
                )}
              </div>

              {/* Búsqueda libre: pedido, referencia, monto, IP, lo que sea */}
              <label className="mb-3 flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 focus-within:border-[var(--brand-primary)]">
                <Search size={16} className="shrink-0 text-[var(--brand-primary)]" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar: pedido, referencia, monto, usuario, IP…"
                  className="w-full bg-transparent text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
                    className="text-xs font-black uppercase text-[var(--brand-primary)]"
                  >
                    Borrar
                  </button>
                )}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Usuario
                  <select
                    value={actorFilter}
                    onChange={(e) => setActorFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Todos los usuarios</option>
                    {actorSummary.map((actor) => (
                      <option key={actor.name} value={actor.name}>
                        {actor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Acción
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Todas las acciones</option>
                    {ACTION_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Desde
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  Hasta
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                  <input
                    type="checkbox"
                    checked={allBranches}
                    onChange={(e) => setAllBranches(e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand-primary)]"
                  />
                  Todas las sedes
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]"
                    >
                      Limpiar filtros
                    </button>
                  )}
                  {!loading && visibleLogs.length > 0 && (
                    <button
                      onClick={exportCsv}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)]"
                      title="Descarga lo que se ve (con los filtros aplicados) en Excel"
                    >
                      <Download size={14} /> Excel
                    </button>
                  )}
                </div>
                {!loading && (
                  <span className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                    {hasActiveFilters ? `${visibleLogs.length} de ${logs.length}` : logs.length} registro
                    {(hasActiveFilters ? visibleLogs.length : logs.length) === 1 ? "" : "s"}
                    {" · "}
                    {actorSummary.length} usuario{actorSummary.length === 1 ? "" : "s"}
                    {" · "}
                    {dayNavigator.length} día{dayNavigator.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {/* Tipo de acción: pagos, pedidos, compras… con un toque */}
            {!loading && categorySummary.length > 1 && (
              <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                  Tipo de acción
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {categorySummary.map(({ category, count }) => {
                    const isActive = categoryFilter === category.key
                    const Icon = category.icon
                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setCategoryFilter(isActive ? "" : category.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-black transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                            : `${category.ring} hover:brightness-95`
                        }`}
                      >
                        <Icon size={13} />
                        {category.label}
                        <span
                          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.62rem] ${
                            isActive ? "bg-white/25 text-white" : "bg-white/70"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!loading && actorSummary.length > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
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
                        className={`inline-flex items-center gap-2 rounded-full border-2 px-2.5 py-1.5 text-xs font-black transition ${
                          isActive
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                            : "border-[var(--brand-primary)]/25 bg-white text-[#1a1a1a] hover:border-[var(--brand-primary)]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.55rem] font-black text-white ${actorColor(actor.name)}`}
                        >
                          {actorInitials(actor.name)}
                        </span>
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
                    <span className="font-black text-[var(--brand-primary)]">{actorFilter}</span>.{" "}
                    <button
                      type="button"
                      onClick={() => setActorFilter("")}
                      className="font-black text-[var(--brand-primary)] underline"
                    >
                      Ver a todos
                    </button>
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 font-bold text-red-700">
                {error}
              </p>
            )}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : visibleLogs.length === 0 ? (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-6 text-center">
                <p className="font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
                  Sin registros
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
                  No hay acciones con estos filtros. Prueba con otro rango de fechas, usuario o
                  búsqueda.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {/* Navegador por día: cuántas acciones hubo cada día; un toque
                    filtra ese día, otro toque vuelve a mostrarlos todos. */}
                {dayNavigator.length > 1 && (
                  <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      Registros por día
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {dayNavigator.map(([dayKey, count]) => {
                        const isActive = dayFilter === dayKey
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => setDayFilter(isActive ? "" : dayKey)}
                            className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-black transition ${
                              isActive
                                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                                : "border-[var(--brand-primary)]/25 bg-white text-[#1a1a1a] hover:border-[var(--brand-primary)]"
                            }`}
                          >
                            {dayLabel(dayKey)}
                            <span
                              className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.62rem] ${
                                isActive
                                  ? "bg-white/25 text-white"
                                  : "bg-[var(--brand-cream)] text-[var(--brand-primary)]"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        )
                      })}
                      {dayFilter && (
                        <button
                          type="button"
                          onClick={() => setDayFilter("")}
                          className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#1a1a1a]/60"
                        >
                          Todos los días
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {groups.map(([dayKey, dayLogs]) => (
                  <section key={dayKey} id={`audit-day-${dayKey}`} className="scroll-mt-16">
                    <div className="sticky top-0 z-10 -mx-1 mb-2 bg-[var(--brand-cream)]/95 px-1 py-1 backdrop-blur">
                      <h2 className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white">
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
                        const name = actorName(log)
                        const branchName =
                          allBranches && log.branchId ? branchNames[log.branchId] || "" : ""

                        return (
                          <li
                            key={log.id}
                            className="flex gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white p-3.5"
                          >
                            <span
                              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${category.ring}`}
                              title={category.label}
                            >
                              <Icon size={17} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <p className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--brand-primary)]">
                                  <span
                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-black text-white ${actorColor(name)}`}
                                  >
                                    {actorInitials(name)}
                                  </span>
                                  {name}
                                </p>
                                <span className="text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
                                  {timeOnly(log.createdAt)}
                                </span>
                              </div>

                              <p className="mt-0.5 text-xs font-bold text-[var(--brand-ink-2)]/75">
                                <span className="font-black text-[var(--brand-ink-3)]">
                                  {log.actionLabel}
                                </span>
                                {entityLabel ? ` · ${entityLabel}` : ""}
                                {branchName ? (
                                  <span className="font-black text-[var(--brand-primary)]">
                                    {" "}
                                    · {branchName}
                                  </span>
                                ) : (
                                  ""
                                )}
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

                {hasMore && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)] disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ClipboardList size={14} />
                      )}
                      Cargar registros más antiguos
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
