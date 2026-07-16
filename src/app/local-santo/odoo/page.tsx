"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Link2, Loader2, PlugZap, RefreshCw, Save, XCircle } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type OdooView = {
  configured: boolean
  baseUrl: string
  dbName: string
  login: string
  active: boolean
  liveSync: boolean
  hasApiKey: boolean
  lastUid: number | null
  lastSyncAt: string
  lastResult: string
}

type SyncEntityResult = { entity: string; model: string; created: number; updated: number; unchanged: number; errors: string[] }
type SyncReport = { ok: boolean; dryRun: boolean; message: string; entities: SyncEntityResult[] }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function OdooPage() {
  return (
    <ModuleAccessGuard moduleKey="odooSync" moduleName="Odoo / ERP">
      <OdooContent />
    </ModuleAccessGuard>
  )
}

function OdooContent() {
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null)

  const [view, setView] = useState<OdooView | null>(null)
  const [baseUrl, setBaseUrl] = useState("")
  const [dbName, setDbName] = useState("")
  const [login, setLogin] = useState("")
  const [apiKey, setApiKey] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/odoo", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      const v = data.integration as OdooView
      setView(v)
      setBaseUrl(v.baseUrl)
      setDbName(v.dbName)
      setLogin(v.login)
      setApiKey("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function currentFields() {
    return { baseUrl: baseUrl.trim(), dbName: dbName.trim(), login: login.trim(), apiKey: apiKey.trim() }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    setError("")
    try {
      const res = await fetch("/api/odoo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "testConnection", ...currentFields() }),
      })
      const data = await res.json()
      if (data.ok) setTestResult({ ok: true, message: data.message || "Conectado" })
      else setTestResult({ ok: false, message: data.error || "No se pudo conectar" })
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Error" })
    } finally {
      setTesting(false)
    }
  }

  async function save() {
    if (!baseUrl.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/odoo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "saveConfig", ...currentFields(), active: true }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function runSync() {
    setSyncing(true)
    setSyncReport(null)
    setError("")
    try {
      const res = await fetch("/api/odoo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "sync", dryRun }),
      })
      const data = await res.json()
      if (data.report) setSyncReport(data.report as SyncReport)
      else throw new Error(data.error || "No se pudo sincronizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setSyncing(false)
    }
  }

  const inputClass = "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Link2 size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[var(--brand-ink-3)]">Odoo / ERP</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Complementa Odoo con la operación hotelera: conecta una vez y sincroniza los datos con un botón.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para la integración con Odoo, o el módulo está desactivado.
          </p>
        ) : loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"><PlugZap size={15} /> Conexión</p>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/55">
                Pide estos 4 datos al cliente (los saca de su Odoo). Guía paso a paso en docs/CONEXIONES-PROVEEDORES.md, sección 1.
              </p>
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">URL de Odoo</span>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://cliente.odoo.com" className={inputClass} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Base de datos</span>
                  <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="cliente-prod" className={inputClass} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Usuario</span>
                  <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="integracion.hotel@cliente.com" className={inputClass} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={view?.hasApiKey ? "•••••••• (guardada — deja en blanco para conservarla)" : "clave de API del usuario"}
                    className={inputClass}
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={test} disabled={testing || busy} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-black uppercase text-[var(--brand-primary-dark)] disabled:opacity-50">
                  {testing ? <Loader2 className="animate-spin" size={15} /> : <PlugZap size={15} />} Probar conexión
                </button>
                <button onClick={save} disabled={busy || testing || !baseUrl.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Guardar
                </button>
              </div>

              {testResult && (
                <p className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${testResult.ok ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"}`}>
                  {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {testResult.message}
                </p>
              )}
              {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
            </section>

            {view?.configured && (
              <section className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 text-sm font-bold text-[var(--brand-ink-2)]/70">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">Estado</p>
                <p className="mt-1">Conexión guardada{view.hasApiKey ? " · API Key guardada" : " · falta la API Key"}.</p>
                {view.lastResult ? <p className="mt-0.5">Última prueba: {view.lastResult}</p> : null}
                {view.lastSyncAt ? <p className="mt-0.5">Última sincronización: {new Date(view.lastSyncAt).toLocaleString("es-VE")}</p> : null}
              </section>
            )}

            {view?.configured && (
              <section className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"><RefreshCw size={15} /> Sincronizar con Odoo</p>
                <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/55">
                  Empuja tus huéspedes (→ contactos) y productos (→ productos) a Odoo. Es idempotente: correrlo dos veces no duplica nada.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/80">
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
                  Simular (no escribe en Odoo, solo muestra qué haría)
                </label>
                <button onClick={runSync} disabled={syncing || busy} className={`mt-3 inline-flex items-center justify-center gap-1 rounded-xl px-4 py-3 text-sm font-black uppercase disabled:opacity-50 ${dryRun ? "border border-[var(--brand-primary)]/40 bg-white text-[var(--brand-primary-dark)]" : "bg-[var(--brand-primary)] text-white"}`}>
                  {syncing ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} {dryRun ? "Simular sincronización" : "Sincronizar ahora"}
                </button>

                {syncReport && (
                  <div className="mt-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3">
                    <p className={`text-sm font-black ${syncReport.ok ? "text-[var(--brand-ink-3)]" : "text-red-600"}`}>
                      {syncReport.dryRun ? "Simulación" : "Sincronización"}: {syncReport.message}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs font-bold text-[var(--brand-ink-2)]/70">
                      {syncReport.entities.map((en) => (
                        <li key={en.entity}>
                          {en.entity}: {syncReport.dryRun ? "crearía" : "creados"} {en.created} · {syncReport.dryRun ? "actualizaría" : "actualizados"} {en.updated} · sin cambios {en.unchanged}
                          {en.errors.length > 0 && <span className="text-red-600"> · {en.errors.length} errores</span>}
                        </li>
                      ))}
                    </ul>
                    {syncReport.entities.some((en) => en.errors.length > 0) && (
                      <ul className="mt-2 space-y-0.5 text-xs font-bold text-red-600">
                        {syncReport.entities.flatMap((en) => en.errors).slice(0, 6).map((err, i) => (
                          <li key={i}>· {err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {!view.hasApiKey && (
                  <p className="mt-2 text-xs font-bold text-amber-700">Falta la API Key para escribir en Odoo. La simulación funciona igual.</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
