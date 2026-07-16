"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ChevronDown, Loader2, PlugZap, Save } from "lucide-react"
import {
  getProviderIntegrationDef,
  PROVIDER_STATUS_LABELS,
  PROVIDER_STATUSES,
  type ProviderIntegrationId,
  type ProviderIntegrationStatus,
} from "@/lib/providerIntegrations"

// ============================================================
// Hotel · V8-E · Tarjeta "Conexión con proveedor" (provider manual).
//
// Se monta dentro del módulo dueño de cada trámite (Facturación, Canales,
// Pagos online, CRM → Campañas). Explica qué funciona HOY sin el proveedor,
// qué credencial falta y el trámite para conseguirla (resumen de
// docs/CONEXIONES-PROVEEDORES.md), y deja al dueño registrar el avance.
// ============================================================

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

const STATUS_CHIP: Record<ProviderIntegrationStatus, string> = {
  manual: "border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] text-[var(--brand-primary-dark)]",
  tramite: "border-amber-300 bg-amber-50 text-amber-700",
  credenciales: "border-green-300 bg-green-50 text-green-700",
}

export default function ProviderConnectionCard({ providerId }: { providerId: ProviderIntegrationId }) {
  const def = getProviderIntegrationDef(providerId)
  const [status, setStatus] = useState<ProviderIntegrationStatus>("manual")
  const [notes, setNotes] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch("/api/provider-integrations", { headers: authHeaders(), cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const state = data?.providers?.[providerId]
        if (alive && state) {
          setStatus(PROVIDER_STATUSES.includes(state.status) ? state.status : "manual")
          setNotes(String(state.notes || ""))
        }
      } catch {
        // sin conexión no pasa nada: la tarjeta es informativa
      } finally {
        if (alive) setLoaded(true)
      }
    }
    const t = setTimeout(load, 0)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [providerId])

  async function save() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/provider-integrations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ providerId, status, notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  if (!def) return null

  return (
    <section className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
          <PlugZap size={15} /> {def.title}
        </p>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${STATUS_CHIP[status]}`}>
          {PROVIDER_STATUS_LABELS[status]}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">{def.blurb}</p>
      <p className="mt-2 rounded-xl border border-green-200 bg-green-50/60 px-3 py-2 text-xs font-bold text-green-800">
        {def.manualToday}
      </p>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary-dark)]">
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          Qué credencial falta y cómo conseguirla
        </summary>
        <div className="mt-2 grid gap-2 text-xs font-bold text-[var(--brand-ink-2)]/70">
          <div>
            <p className="text-[var(--brand-ink-2)]/50">Falta traer:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {def.missingCredentials.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[var(--brand-ink-2)]/50">El trámite:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              {def.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <p className="text-[var(--brand-ink-2)]/45">
            Guía completa: docs/CONEXIONES-PROVEEDORES.md · {def.guideSection}. Cuando tengas las credenciales, se enchufa el proveedor real sin rehacer nada.
          </p>
        </div>
      </details>

      {loaded && (
        <div className="mt-3 grid gap-2 border-t border-[var(--brand-primary)]/15 pt-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProviderIntegrationStatus)}
            className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-primary)]"
          >
            {PROVIDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROVIDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota del trámite (ej: en espera del proveedor)"
            className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-primary)]"
            maxLength={600}
          />
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-black uppercase text-[var(--brand-primary-dark)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : savedAt ? <CheckCircle2 size={13} /> : <Save size={13} />}
            Guardar
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </section>
  )
}
