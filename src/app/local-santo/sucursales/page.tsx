"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  CookingPot,
  DollarSign,
  Loader2,
  Package,
  Plus,
  Settings,
  Store,
  Trash2,
} from "lucide-react"
import { formatUSD } from "@/utils/formatCurrency"
import {
  BRANCH_CHANGE_EVENT,
  getSelectedBranchId,
  setSelectedBranchId,
} from "@/lib/branchClient"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Branch = { id: string; name: string; is_active: boolean; sort_order: number }

type CloseMoneySummary = {
  collectedUSD: number
  pendingUSD: number
  expensesUSD: number
  netUSD: number
  lastCloseAt: string
}

type BranchStats = {
  orders: number
  activeOrders: number
  openAccounts: number
  dayCloses: number
  collectedUSD: number
  pendingUSD: number
  expensesUSD: number
  netUSD: number
  lastCloseAt: string
  inventoryItems: number
  lowStock: number
  unavailableModules: string[]
}

const EMPTY_BRANCH_STATS: BranchStats = {
  orders: 0,
  activeOrders: 0,
  openAccounts: 0,
  dayCloses: 0,
  collectedUSD: 0,
  pendingUSD: 0,
  expensesUSD: 0,
  netUSD: 0,
  lastCloseAt: "",
  inventoryItems: 0,
  lowStock: 0,
  unavailableModules: [],
}

function authHeaders(branchId?: string): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-password": password,
  }

  if (branchId) headers["x-branch-id"] = branchId

  return headers
}

async function readJsonSafe(response: Response) {
  const text = await response.text()

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: text || "Respuesta inválida" }
  }
}

function isLowStockItem(item: Record<string, unknown>) {
  const quantity = Number(item.quantity ?? item.stock ?? 0)
  const minimumStock = Number(item.minimumStock ?? item.minimum_stock ?? item.minStock ?? 0)

  return Number.isFinite(quantity) && Number.isFinite(minimumStock) && minimumStock > 0 && quantity <= minimumStock
}

function getCloseNetUSD(close: Record<string, unknown>) {
  const collected = Number(close.realCollectedUSD || 0)
  const expenses = Number(close.expensesTotalUSD || 0)
  const savedNet = Number(close.netEstimatedUSD || 0)

  if (Number.isFinite(savedNet) && Math.abs(savedNet) > 0.01) return savedNet
  if (!Number.isFinite(collected) || !Number.isFinite(expenses)) return 0

  return collected - expenses
}

function formatShortDate(value: string) {
  if (!value) return "Sin cierre"

  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Caracas",
    }).format(date)
  } catch {
    return value
  }
}


async function loadStatsForBranch(branchId: string): Promise<BranchStats> {
  const unavailableModules: string[] = []

  const [ordersResult, accountsResult, closesResult, inventoryResult] = await Promise.allSettled([
    fetch("/api/orders", { headers: authHeaders(branchId), cache: "no-store" }),
    fetch("/api/open-accounts?status=Abierta", { headers: authHeaders(branchId), cache: "no-store" }),
    fetch("/api/day-closes?scope=selected", { headers: authHeaders(branchId), cache: "no-store" }),
    fetch("/api/inventory", { headers: authHeaders(branchId), cache: "no-store" }),
  ])

  let orders: Record<string, unknown>[] = []
  if (ordersResult.status === "fulfilled") {
    const data = await readJsonSafe(ordersResult.value)
    if (ordersResult.value.ok) orders = Array.isArray(data.orders) ? data.orders : []
    else unavailableModules.push("pedidos")
  } else {
    unavailableModules.push("pedidos")
  }

  let openAccounts: unknown[] = []
  if (accountsResult.status === "fulfilled") {
    const data = await readJsonSafe(accountsResult.value)
    if (accountsResult.value.ok) openAccounts = Array.isArray(data.openAccounts) ? data.openAccounts : []
    else unavailableModules.push("cuentas")
  } else {
    unavailableModules.push("cuentas")
  }

  let dayCloses: Record<string, unknown>[] = []
  if (closesResult.status === "fulfilled") {
    const data = await readJsonSafe(closesResult.value)
    if (closesResult.value.ok) dayCloses = Array.isArray(data.dayCloses) ? data.dayCloses : []
    else unavailableModules.push("cierres")
  } else {
    unavailableModules.push("cierres")
  }

  const closeMoney = dayCloses.reduce<CloseMoneySummary>(
    (summary, close) => {
      summary.collectedUSD += Number(close.realCollectedUSD || 0)
      summary.pendingUSD += Number(close.realPendingUSD || 0)
      summary.expensesUSD += Number(close.expensesTotalUSD || 0)
      summary.netUSD += getCloseNetUSD(close)

      const currentTime = new Date(summary.lastCloseAt).getTime()
      const closeTime = new Date(String(close.createdAt || "")).getTime()
      if (!summary.lastCloseAt || Number.isNaN(currentTime) || closeTime > currentTime) {
        summary.lastCloseAt = String(close.createdAt || "")
      }

      return summary
    },
    { collectedUSD: 0, pendingUSD: 0, expensesUSD: 0, netUSD: 0, lastCloseAt: "" },
  )

  let inventoryItems: Record<string, unknown>[] = []
  if (inventoryResult.status === "fulfilled") {
    const data = await readJsonSafe(inventoryResult.value)
    if (inventoryResult.value.ok) inventoryItems = Array.isArray(data.inventory) ? data.inventory : []
    else unavailableModules.push("inventario")
  } else {
    unavailableModules.push("inventario")
  }

  return {
    orders: orders.length,
    activeOrders: orders.filter((order) => !["Entregado", "Cancelado"].includes(String(order.status || ""))).length,
    openAccounts: openAccounts.length,
    dayCloses: dayCloses.length,
    collectedUSD: closeMoney.collectedUSD,
    pendingUSD: closeMoney.pendingUSD,
    expensesUSD: closeMoney.expensesUSD,
    netUSD: closeMoney.netUSD,
    lastCloseAt: closeMoney.lastCloseAt,
    inventoryItems: inventoryItems.length,
    lowStock: inventoryItems.filter(isLowStockItem).length,
    unavailableModules: Array.from(new Set(unavailableModules)),
  }
}

function isActiveBranch(branch: Branch) {
  return branch.is_active !== false
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null)
  const [branchStats, setBranchStats] = useState<Record<string, BranchStats>>({})
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  const activeBranches = useMemo(() => branches.filter(isActiveBranch), [branches])
  const totalStats = useMemo(
    () =>
      activeBranches.reduce(
        (summary, branch) => {
          const stats = branchStats[branch.id] || EMPTY_BRANCH_STATS

          summary.orders += stats.orders
          summary.activeOrders += stats.activeOrders
          summary.openAccounts += stats.openAccounts
          summary.dayCloses += stats.dayCloses
          summary.collectedUSD += stats.collectedUSD
          summary.pendingUSD += stats.pendingUSD
          summary.expensesUSD += stats.expensesUSD
          summary.netUSD += stats.netUSD
          summary.inventoryItems += stats.inventoryItems
          summary.lowStock += stats.lowStock

          return summary
        },
        { ...EMPTY_BRANCH_STATS, unavailableModules: [] },
      ),
    [activeBranches, branchStats],
  )

  const loadBranchStats = useCallback(async (list: Branch[]) => {
    const branchesToInspect = list.filter(isActiveBranch)

    if (!branchesToInspect.length) {
      setBranchStats({})
      return
    }

    setStatsLoading(true)

    try {
      const entries = await Promise.all(
        branchesToInspect.map(async (branch) => [branch.id, await loadStatsForBranch(branch.id)] as const),
      )

      setBranchStats(Object.fromEntries(entries))
    } catch {
      // La gestión de sucursales no debe bloquearse si algún módulo todavía no está activo.
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/branches", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")

      const nextBranches = Array.isArray(data.branches) ? data.branches : []
      const current = getSelectedBranchId()
      const validCurrent = current && nextBranches.some((branch: Branch) => branch.id === current)
      const fallback = nextBranches.find(isActiveBranch)?.id || nextBranches[0]?.id || null
      const nextSelectedBranchId = validCurrent ? current : fallback

      if (nextSelectedBranchId && !validCurrent) setSelectedBranchId(nextSelectedBranchId)

      setDenied(false)
      setBranches(nextBranches)
      setSelectedBranchIdState(nextSelectedBranchId)
      await loadBranchStats(nextBranches)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [loadBranchStats])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onChange = () => setSelectedBranchIdState(getSelectedBranchId())

    window.addEventListener(BRANCH_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(BRANCH_CHANGE_EVENT, onChange)
  }, [])

  async function create() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      })
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setNewName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(b: Branch) {
    if (
      !window.confirm(
        `¿Eliminar la sucursal "${b.name}"?\n\nSe borrarán TODOS sus datos (pedidos, menú, inventario, caja). Esta acción no se puede deshacer.`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function activateBranch(branchId: string, targetHref = "/local-santo") {
    setSelectedBranchId(branchId)
    setSelectedBranchIdState(branchId)
    window.location.href = targetHref
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <section className="mt-4 overflow-hidden rounded-[1.8rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)]">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />
          <div className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  <Building2 size={18} /> Sedes operativas
                </p>
                <h1 className="mt-2 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Sucursales
                </h1>
                <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Esta pantalla ahora no solo crea sedes: también te deja elegir en cuál está trabajando el sistema y revisar datos separados por sede. Al entrar a Caja, Cocina, Menú, Inventario o Cierres, las APIs usan la sucursal seleccionada.
                </p>
              </div>

              <div className="grid min-w-[260px] grid-cols-2 gap-2">
                <StatBox label="Sedes activas" value={activeBranches.length} />
                <StatBox label="Pedidos activos" value={totalStats.activeOrders} tone={totalStats.activeOrders > 0 ? "warning" : "default"} />
                <StatBox label="Cuentas abiertas" value={totalStats.openAccounts} />
                <StatBox label="Cobrado cierres" value={formatUSD(totalStats.collectedUSD)} />
                <StatBox label="Neto estimado" value={formatUSD(totalStats.netUSD)} tone={totalStats.netUSD < 0 ? "warning" : "default"} />
              </div>
            </div>
          </div>
        </section>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño puede gestionar las sucursales. Inicia sesión como dueño.
          </p>
        ) : (
          <>
            <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
              <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Crear sede
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/65">
                  Cada sede tendrá sus propios pedidos, menú, inventario, cuentas abiertas, proveedores, compras, cierres y reportes.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && create()}
                    placeholder="Nombre de la nueva sucursal"
                    className="flex-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
                  />
                  <button
                    onClick={create}
                    disabled={busy || !newName.trim()}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Crear
                  </button>
                </div>
                {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
              </div>

              <div className="rounded-[1.4rem] border-2 border-[var(--brand-primary)]/25 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Cómo se usa en la operación
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <UsageItem icon={<Store size={16} />} title="Selector global" text="La sede elegida se guarda y se envía como x-branch-id en las llamadas del sistema." />
                  <UsageItem icon={<DollarSign size={16} />} title="Caja y pedidos" text="Pedidos, pagos, cuentas abiertas y cierres quedan separados por sede." />
                  <UsageItem icon={<Package size={16} />} title="Inventario" text="Stock, recetas, compras y proveedores no se mezclan entre locales." />
                  <UsageItem icon={<BarChart3 size={16} />} title="Reportes" text="El historial puede verse por sede actual o como total general del dueño." />
                </div>
              </div>
            </section>

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : branches.length === 0 ? (
              <div className="mt-6 rounded-[1.4rem] border-2 border-dashed border-[var(--brand-primary)]/35 bg-white p-6 text-sm font-bold text-[var(--brand-ink-2)]/70">
                No hay sucursales creadas todavía.
              </div>
            ) : (
              <section className="mt-6 grid gap-4 lg:grid-cols-2">
                {branches.map((branch) => {
                  const stats = branchStats[branch.id] || EMPTY_BRANCH_STATS
                  const isSelected = selectedBranchId === branch.id
                  const isInactive = !isActiveBranch(branch)

                  return (
                    <article
                      key={branch.id}
                      className={`rounded-[1.4rem] border-2 bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)] ${
                        isSelected ? "border-[var(--brand-primary)]" : "border-[var(--brand-primary)]/20"
                      } ${isInactive ? "opacity-70" : ""}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
                              <Building2 size={20} />
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 rounded-full border-2 border-green-600/25 bg-green-50 px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-green-700">
                                <CheckCircle2 size={13} /> En uso
                              </span>
                            )}
                            <button
                              onClick={() => patch(branch.id, { is_active: !branch.is_active })}
                              disabled={busy}
                              className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                                branch.is_active
                                  ? "border-green-600/30 bg-green-50 text-green-700"
                                  : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                              }`}
                            >
                              {branch.is_active ? "Activa" : "Inactiva"}
                            </button>
                          </div>

                          <input
                            defaultValue={branch.name}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              if (value && value !== branch.name) patch(branch.id, { name: value })
                            }}
                            className="mt-3 w-full min-w-0 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-2xl font-black text-[var(--brand-ink-3)] outline-none hover:border-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                          />
                          <p className="px-2 text-xs font-bold text-[var(--brand-ink-2)]/55">
                            Orden operativo #{branch.sort_order || 1}
                          </p>
                        </div>

                        <button
                          onClick={() => remove(branch)}
                          disabled={busy}
                          title="Eliminar sucursal"
                          className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        <StatBox label="Pedidos" value={stats.orders} />
                        <StatBox label="Activos" value={stats.activeOrders} tone={stats.activeOrders > 0 ? "warning" : "default"} />
                        <StatBox label="Cuentas" value={stats.openAccounts} />
                        <StatBox label="Cierres" value={stats.dayCloses} />
                        <StatBox label="Cobrado" value={formatUSD(stats.collectedUSD)} />
                        <StatBox label="Pendiente" value={formatUSD(stats.pendingUSD)} tone={stats.pendingUSD > 0 ? "warning" : "default"} />
                        <StatBox label="Neto" value={formatUSD(stats.netUSD)} tone={stats.netUSD < 0 ? "warning" : "default"} />
                        <StatBox label="Último cierre" value={formatShortDate(stats.lastCloseAt)} />
                        <StatBox label="Inventario" value={stats.inventoryItems} />
                        <StatBox label="Stock bajo" value={stats.lowStock} tone={stats.lowStock > 0 ? "warning" : "default"} />
                      </div>

                      {statsLoading && (
                        <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--brand-ink-2)]/60">
                          <Loader2 className="animate-spin" size={14} /> Actualizando indicadores…
                        </p>
                      )}

                      {!statsLoading && !isInactive && (
                        <BranchHealthHint stats={stats} />
                      )}

                      {stats.unavailableModules.length > 0 && (
                        <p className="mt-3 rounded-2xl border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink)]">
                          Algunos indicadores no se pudieron leer o el módulo está desactivado: {stats.unavailableModules.join(", ")}.
                        </p>
                      )}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id)} icon={<Settings size={15} />} label="Trabajar aquí" primary />
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id, "/local-santo/caja")} icon={<DollarSign size={15} />} label="Caja" />
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id, "/local-santo/cocina")} icon={<CookingPot size={15} />} label="Cocina" />
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id, "/local-santo/menu")} icon={<ClipboardList size={15} />} label="Menú" />
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id, "/local-santo/inventario")} icon={<Package size={15} />} label="Inventario" />
                        <ActionButton disabled={isInactive} onClick={() => activateBranch(branch.id, "/local-santo/cierres")} icon={<BarChart3 size={15} />} label="Cierres" />
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function BranchHealthHint({ stats }: { stats: BranchStats }) {
  const messages: string[] = []

  if (stats.activeOrders > 0) {
    messages.push(`${stats.activeOrders} pedido(s) todavía activos.`)
  }
  if (stats.openAccounts > 0) {
    messages.push(`${stats.openAccounts} cuenta(s) abiertas.`)
  }
  if (stats.pendingUSD > 0.01) {
    messages.push(`${formatUSD(stats.pendingUSD)} pendiente en cierres guardados.`)
  }
  if (stats.lowStock > 0) {
    messages.push(`${stats.lowStock} insumo(s) con stock bajo.`)
  }

  if (!messages.length) {
    return (
      <p className="mt-3 rounded-2xl border border-green-600/25 bg-green-50 px-3 py-2 text-xs font-bold leading-5 text-green-800">
        Sede sin alertas operativas fuertes en los indicadores cargados.
      </p>
    )
  }

  return (
    <p className="mt-3 rounded-2xl border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs font-bold leading-5 text-[var(--brand-ink)]">
      Revisión sugerida: {messages.join(" ")}
    </p>
  )
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string | number
  tone?: "default" | "warning"
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-3 ${
        tone === "warning"
          ? "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]"
          : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] text-[var(--brand-ink-2)]"
      }`}
    >
      <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  )
}

function UsageItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">{text}</p>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  primary = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] transition disabled:opacity-45 ${
        primary
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-dark)]"
          : "border-[var(--brand-primary)]/35 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-accent-100)]"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
