"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ShieldCheck, RefreshCw } from "lucide-react"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/auditActions"

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

function formatDateTime(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-VE", { timeZone: "America/Caracas" })
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  const keys = Object.keys(metadata || {})
  if (keys.length === 0) return ""
  return keys
    .map((key) => {
      const value = metadata[key]
      const text = Array.isArray(value)
        ? value.join(", ")
        : value && typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
      return `${key}: ${text}`
    })
    .join(" · ")
}

const ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")

  const [actionFilter, setActionFilter] = useState("")
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
    loadLogs()
  }, [loadLogs])

  const count = useMemo(() => logs.length, [logs])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} /> Panel
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Auditoría de acciones</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Quién hizo qué, cuándo y desde dónde. Solo lectura.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño o soporte pueden ver la bitácora, y el módulo de auditoría debe estar activo
            desde la configuración del negocio. Inicia sesión como dueño.
          </p>
        ) : (
          <>
            {/* Filtros */}
            <div className="mt-6 grid gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] sm:col-span-2">
                Acción
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                >
                  <option value="">Todas las acciones</option>
                  {ACTION_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Desde
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                Hasta
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2.5 text-sm font-bold text-[var(--brand-ink-3)] outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={loadLogs}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary)] disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
              </button>
              {!loading && (
                <span className="text-sm font-bold text-[var(--brand-ink-2)]/70">
                  {count} registro{count === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : logs.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay acciones registradas con estos filtros.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {logs.map((log) => {
                  const metadataText = summarizeMetadata(log.metadata)
                  return (
                    <li
                      key={log.id}
                      className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-black text-[var(--brand-ink-3)]">{log.actionLabel}</p>
                        <span className="text-xs font-bold text-[var(--brand-ink-2)]/55">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
                        {log.actorLabel || log.actorRole || "—"}
                        {log.entityType ? ` · ${log.entityType}` : ""}
                        {log.entityId ? ` ${log.entityId}` : ""}
                        {log.ipAddress ? ` · IP ${log.ipAddress}` : ""}
                      </p>
                      {metadataText && (
                        <p className="mt-1 break-words text-xs font-bold text-[var(--brand-ink-2)]/80">
                          {metadataText}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
