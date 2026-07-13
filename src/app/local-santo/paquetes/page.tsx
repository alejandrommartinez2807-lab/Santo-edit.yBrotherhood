"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Gift, Loader2, Plus, Trash2 } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Package = {
  id: string
  name: string
  description: string
  includes: string
  price: number
  active: boolean
}
type InHouse = { id: string; guestName: string }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function PaquetesPage() {
  return (
    <ModuleAccessGuard moduleKey="hotelPackages" moduleName="Paquetes">
      <PaquetesContent />
    </ModuleAccessGuard>
  )
}

function PaquetesContent() {
  const [packages, setPackages] = useState<Package[]>([])
  const [inHouse, setInHouse] = useState<InHouse[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [includes, setIncludes] = useState("")
  const [applyPkg, setApplyPkg] = useState("")
  const [applyRes, setApplyRes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/packages", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setPackages(data.packages || [])
      setInHouse(data.inHouse || [])
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
    setOk("")
    try {
      const res = await fetch("/api/packages", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createPackage() {
    if (!name.trim()) return
    const done = await post({ action: "savePackage", name: name.trim(), price: Number(price) || 0, includes: includes.trim() })
    if (done) {
      setName("")
      setPrice("")
      setIncludes("")
    }
  }

  async function apply() {
    if (!applyPkg || !applyRes) return
    const done = await post({ action: "applyToReservation", packageId: applyPkg, reservationId: applyRes })
    if (done) setOk("Paquete cargado al folio del huésped.")
  }

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/local-santo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Gift size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Paquetes</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Todo incluido a un precio; se carga al folio del huésped.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para paquetes, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Nuevo paquete */}
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (Luna de miel…)" className={`${inputClass} sm:col-span-2`} />
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio" className={inputClass} />
              <button onClick={createPackage} disabled={busy || !name.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                <Plus size={16} /> Crear
              </button>
              <input value={includes} onChange={(e) => setIncludes(e.target.value)} placeholder="Incluye (2 cenas, spa, tour…)" className={`${inputClass} sm:col-span-4`} />
            </div>

            {/* Aplicar a estadía */}
            {inHouse.length > 0 && packages.length > 0 && (
              <div className="mt-4 grid gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-4 sm:grid-cols-3">
                <select value={applyPkg} onChange={(e) => setApplyPkg(e.target.value)} className={inputClass}>
                  <option value="">Paquete…</option>
                  {packages.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                  ))}
                </select>
                <select value={applyRes} onChange={(e) => setApplyRes(e.target.value)} className={inputClass}>
                  <option value="">Huésped en casa…</option>
                  {inHouse.map((r) => (
                    <option key={r.id} value={r.id}>{r.guestName}</option>
                  ))}
                </select>
                <button onClick={apply} disabled={busy || !applyPkg || !applyRes} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                  Cargar al folio
                </button>
              </div>
            )}

            {ok && <p className="mt-3 font-bold text-green-700">{ok}</p>}
            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : packages.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay paquetes. Crea el primero arriba.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {packages.map((p) => (
                  <li key={p.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">{p.name} <span className="text-sm text-[var(--brand-ink-2)]/55">${p.price}</span></p>
                        {p.includes && <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Incluye: {p.includes}</p>}
                      </div>
                      <button
                        onClick={() => { if (window.confirm(`¿Eliminar el paquete "${p.name}"?`)) post({ action: "deletePackage", id: p.id }) }}
                        disabled={busy}
                        title="Eliminar"
                        className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
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
