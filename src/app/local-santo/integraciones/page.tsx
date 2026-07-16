"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plug, Plus, Send, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { HOTEL_WEBHOOK_EVENTS, isValidWebhookUrl } from "@/lib/hotelWebhooks"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Webhook = {
  id: string
  name: string
  url: string
  events: string
  secret: string
  active: boolean
  lastStatus: string
  lastFiredAt: string
}

// Eventos ofrecidos al configurar (la "prueba" se dispara con su botón).
const CONFIGURABLE_EVENTS = HOTEL_WEBHOOK_EVENTS.filter((e) => e.id !== "prueba")

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function randomSecret(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let out = "whsec_"
  const values = new Uint32Array(24)
  window.crypto.getRandomValues(values)
  for (const v of values) out += alphabet[v % alphabet.length]
  return out
}

export default function IntegracionesPage() {
  return (
    <ModuleAccessGuard moduleKey="webhooks" moduleName="Integraciones">
      <IntegracionesContent />
    </ModuleAccessGuard>
  )
}

function IntegracionesContent() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [events, setEvents] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/webhooks", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setWebhooks(data.webhooks || [])
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

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/webhooks", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return null
    } finally {
      setBusy(false)
    }
  }

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  async function addWebhook() {
    if (!isValidWebhookUrl(url)) {
      setError("La URL debe ser http(s) completa, ej. https://…")
      return
    }
    const ok = await post({
      action: "save",
      name: name.trim() || "Integración",
      url: url.trim(),
      events: events.join(","),
      secret: secret.trim(),
      active: true,
    })
    if (ok) {
      setName("")
      setUrl("")
      setSecret("")
      setEvents([])
      setNotice("Webhook registrado. Pruébalo con el botón «Probar».")
      window.setTimeout(() => setNotice(""), 4000)
    }
  }

  async function testWebhook(id: string) {
    const data = await post({ action: "test", id })
    if (data) {
      const status = String(data.status || "")
      setNotice(
        status.startsWith("2")
          ? `El destino respondió ${status}. La integración funciona.`
          : `El destino respondió «${status}». Revisa la URL o el receptor.`,
      )
      window.setTimeout(() => setNotice(""), 5000)
    }
  }

  const inputClass =
    "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Plug size={24} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Integraciones</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Webhooks salientes: avisa a otros sistemas cuando pasa algo en el hotel.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para integraciones, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="font-serif text-lg font-semibold text-[var(--brand-ink-3)]">Nuevo webhook</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Contabilidad)" className={inputClass} />
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://destino.com/webhook" className={inputClass} />
                <div className="flex gap-2 sm:col-span-2">
                  <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Secreto (firma HMAC, opcional)" className={`${inputClass} flex-1`} />
                  <button onClick={() => setSecret(randomSecret())} className="rounded-xl border border-[var(--brand-primary)]/40 px-3 text-xs font-bold uppercase text-[var(--brand-primary)]">
                    Generar
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/60">
                Eventos que escucha (ninguno = todos)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONFIGURABLE_EVENTS.map((e) => (
                  <label key={e.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${events.includes(e.id) ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-[var(--brand-primary)]" : "border-[var(--brand-primary)]/25 text-[var(--brand-ink-2)]/70"}`}>
                    <input type="checkbox" checked={events.includes(e.id)} onChange={() => toggleEvent(e.id)} className="hidden" />
                    {e.label}
                  </label>
                ))}
              </div>
              <button onClick={addWebhook} disabled={busy || !url.trim()} className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50">
                <Plus size={16} /> Registrar webhook
              </button>
            </div>

            {notice && <p className="mt-3 font-bold text-emerald-700">{notice}</p>}
            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : webhooks.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay webhooks. Registra el primero: recibirá un POST JSON firmado en cada evento.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {webhooks.map((w) => (
                  <li key={w.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--brand-ink-3)]">{w.name || "Integración"}</p>
                        <p className="break-all text-sm font-bold text-[var(--brand-ink-2)]/65">{w.url}</p>
                        <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/55">
                          {w.events
                            ? w.events.split(",").map((id) => CONFIGURABLE_EVENTS.find((e) => e.id === id)?.label || id).join(" · ")
                            : "Todos los eventos"}
                          {w.lastStatus && (
                            <span className={`ml-2 ${w.lastStatus.startsWith("2") ? "text-emerald-700" : "text-red-600"}`}>
                              Último disparo: {w.lastStatus}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => testWebhook(w.id)} disabled={busy} title="Enviar evento de prueba" className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)] disabled:opacity-50">
                          <Send size={14} /> Probar
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`¿Eliminar el webhook ${w.name || w.url}?`)) post({ action: "delete", id: w.id }) }}
                          disabled={busy}
                          title="Eliminar"
                          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/70 p-4 text-sm font-medium text-[var(--brand-ink-2)]/75">
              <p className="font-bold text-[var(--brand-ink-3)]">Cómo recibirlo</p>
              <p className="mt-1">
                Cada evento llega como <span className="font-bold">POST JSON</span> con los headers{" "}
                <code className="font-bold">x-hotel-event</code> y <code className="font-bold">x-hotel-signature</code>{" "}
                (HMAC-SHA256 hexadecimal del cuerpo con tu secreto). El detalle y ejemplos están en{" "}
                <span className="font-bold">docs/API-HOTEL.md</span> del proyecto.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
