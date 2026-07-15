"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Loader2, Star, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Review = {
  id: string
  guestName: string
  rating: number
  comment: string
  published: boolean
  createdAt: string
}
type Summary = { count: number; average: number; distribution: Record<number, number> }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className={i <= n ? "fill-amber-400 text-amber-400" : "text-[var(--brand-ink-2)]/25"} />
      ))}
    </span>
  )
}

export default function ResenasPage() {
  return (
    <ModuleAccessGuard moduleKey="guestReviews" moduleName="Reseñas">
      <ResenasContent />
    </ModuleAccessGuard>
  )
}

function ResenasContent() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/reviews", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setReviews(data.reviews || [])
      setSummary(data.summary || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/reviews", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Star size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Reseñas</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Lo que opinan tus huéspedes tras la estadía.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para ver reseñas, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {summary && (
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-[var(--brand-ink-3)]">{summary.average || "—"}</p>
                  <Stars n={Math.round(summary.average)} />
                </div>
                <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">{summary.count} reseña(s)</p>
              </div>
            )}

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : reviews.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay reseñas. El huésped puede dejar la suya desde /hotel/mi-reserva.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className={`rounded-2xl border bg-white p-4 ${r.published ? "border-[var(--brand-primary)]/20" : "border-[var(--brand-primary)]/10 opacity-60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--brand-ink-3)]">{r.guestName} <Stars n={r.rating} /></p>
                        {r.comment && <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/70">{r.comment}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => post({ id: r.id, published: !r.published })}
                          disabled={busy}
                          title={r.published ? "Ocultar" : "Publicar"}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--brand-primary)]/25 bg-white p-2 text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          {r.published ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button
                          onClick={() => { if (window.confirm("¿Eliminar esta reseña?")) post({ action: "delete", id: r.id }) }}
                          disabled={busy}
                          title="Eliminar"
                          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
