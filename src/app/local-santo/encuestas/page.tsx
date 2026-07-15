"use client"

// Resultados de la encuesta post-venta: promedio de estrellas por aspecto y
// las respuestas del cliente (con sus sugerencias). Solo dueño/encargado.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Star,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type SurveyResponseEntry = {
  id: string
  orderId: string
  ratings: Record<string, number>
  comment: string
  customerName: string
  createdAt: string
}

type SurveyAverage = { aspect: string; average: number; count: number }

function authHeaders(): HeadersInit {
  let password = ""
  try {
    password =
      window.sessionStorage.getItem(OWNER_STORAGE_KEY) ||
      window.localStorage.getItem(OWNER_STORAGE_KEY) ||
      ""
  } catch {
    /* sin storage */
  }
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function formatDate(value: string) {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function StarsInline({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={
            star <= Math.round(value)
              ? "fill-amber-400 text-amber-500"
              : "text-[var(--brand-ink-2)]/20"
          }
        />
      ))}
    </span>
  )
}

export default function EncuestasPage() {
  return (
    <ModuleAccessGuard moduleKey="ownerDashboard" moduleName="Encuestas">
      <EncuestasPageContent />
    </ModuleAccessGuard>
  )
}

function EncuestasPageContent() {
  const [responses, setResponses] = useState<SurveyResponseEntry[]>([])
  const [averages, setAverages] = useState<SurveyAverage[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [onlyWithComment, setOnlyWithComment] = useState(false)

  const loadResults = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/surveys?limit=500", {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las encuestas")
      setDenied(false)
      setResponses(Array.isArray(data.responses) ? data.responses : [])
      setAverages(Array.isArray(data.averages) ? data.averages : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(loadResults, 0)
    return () => clearTimeout(timer)
  }, [loadResults])

  const visibleResponses = useMemo(
    () =>
      onlyWithComment
        ? responses.filter((response) => response.comment.trim())
        : responses,
    [responses, onlyWithComment],
  )

  const overallAverage = useMemo(() => {
    const values = averages.filter((entry) => entry.count > 0)
    if (!values.length) return 0
    const sum = values.reduce((total, entry) => total + entry.average, 0)
    return Math.round((sum / values.length) * 10) / 10
  }, [averages])

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
            <MessageSquareText size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase leading-none text-[var(--brand-ink-3)]">
              Encuestas de clientes
            </h1>
            <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/65">
              Estrellas por aspecto y sugerencias de los pedidos entregados.
            </p>
          </div>
        </div>

        {denied ? (
          <div className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
            <p className="font-bold text-[var(--brand-ink-3)]">
              Solo el dueño o el encargado pueden ver las encuestas.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={loadResults}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
              </button>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--brand-ink-2)]/70">
                <input
                  type="checkbox"
                  checked={onlyWithComment}
                  onChange={(e) => setOnlyWithComment(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                Solo con sugerencias escritas
              </label>
            </div>

            {error && (
              <p className="mt-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 font-bold text-red-700">
                {error}
              </p>
            )}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : responses.length === 0 ? (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-6 text-center">
                <p className="font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
                  Sin respuestas todavía
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
                  Cuando los clientes respondan la encuesta de sus pedidos
                  entregados, aquí verás las estrellas y sus sugerencias.
                </p>
              </div>
            ) : (
              <>
                {/* Promedios por aspecto */}
                <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      Promedios ({responses.length} respuesta{responses.length === 1 ? "" : "s"})
                    </p>
                    {overallAverage > 0 && (
                      <p className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-ink-3)]">
                        General: {overallAverage.toFixed(1)} <StarsInline value={overallAverage} />
                      </p>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {averages.map((entry) => (
                      <div
                        key={entry.aspect}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--brand-ink-3)]">
                            {entry.aspect}
                          </p>
                          <p className="text-[0.66rem] font-bold text-[var(--brand-ink-2)]/55">
                            {entry.count} calificación{entry.count === 1 ? "" : "es"}
                          </p>
                        </div>
                        <p className="flex shrink-0 items-center gap-2 text-lg font-black text-[var(--brand-ink-3)]">
                          {entry.average.toFixed(1)}
                          <StarsInline value={entry.average} />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Respuestas individuales */}
                <ul className="mt-4 space-y-2">
                  {visibleResponses.map((response) => (
                    <li
                      key={response.id}
                      className="rounded-2xl border-2 border-[var(--brand-primary)]/15 bg-white p-3.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-sm font-black text-[var(--brand-primary)]">
                          {response.customerName || "Cliente"}
                          <span className="ml-2 text-[0.7rem] font-bold text-[var(--brand-ink-2)]/50">
                            {response.orderId}
                          </span>
                        </p>
                        <span className="text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
                          {formatDate(response.createdAt)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(response.ratings).map(([aspect, value]) => (
                          <span
                            key={aspect}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-cream)] px-2 py-1 text-[0.66rem] font-bold text-[var(--brand-ink-2)]/75"
                          >
                            {aspect}: <StarsInline value={Number(value)} />
                          </span>
                        ))}
                      </div>

                      {response.comment && (
                        <p className="mt-2 rounded-xl border border-[var(--brand-primary)]/10 bg-[var(--brand-cream)] px-3 py-2 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/85">
                          “{response.comment}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
