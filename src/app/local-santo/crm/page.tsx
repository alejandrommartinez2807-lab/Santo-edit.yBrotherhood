"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Star, Trash2, UserRound } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Profile = {
  id: string
  fullName: string
  phone: string
  email: string
  tags: string
  vip: boolean
  notes: string
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function CrmPage() {
  return (
    <ModuleAccessGuard moduleKey="guestCrm" moduleName="CRM de huéspedes">
      <CrmContent />
    </ModuleAccessGuard>
  )
}

function CrmContent() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [tags, setTags] = useState("")
  const [vip, setVip] = useState(false)
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setProfiles(data.profiles || [])
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q) || p.tags.toLowerCase().includes(q),
    )
  }, [profiles, search])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/guest-profiles", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
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

  async function addProfile() {
    if (!fullName.trim()) return
    const ok = await post({ fullName: fullName.trim(), phone: phone.trim(), tags: tags.trim(), vip, notes: notes.trim() })
    if (ok) {
      setFullName("")
      setPhone("")
      setTags("")
      setVip(false)
      setNotes("")
    }
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
            <UserRound size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">CRM de huéspedes</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Fichas con etiquetas, VIP y notas para fidelizar.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para el CRM, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre del huésped" className={inputClass} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className={inputClass} />
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Etiquetas (habitual, luna de miel…)" className={inputClass} />
              <label className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="h-4 w-4" /> VIP
              </label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (preferencias, alergias…)" className={`${inputClass} sm:col-span-2`} />
              <button onClick={addProfile} disabled={busy || !fullName.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2">
                <Plus size={16} /> Agregar ficha
              </button>
            </div>

            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o etiqueta…" className={`${inputClass} mt-4 w-full`} />

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                {profiles.length === 0 ? "Aún no hay fichas de huéspedes." : "Sin resultados para la búsqueda."}
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {filtered.map((p) => (
                  <li key={p.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-[var(--brand-ink-3)]">
                          {p.fullName}
                          {p.vip && <span className="ml-2 inline-flex items-center gap-1 text-xs font-black uppercase text-amber-600"><Star size={12} className="fill-amber-400 text-amber-400" /> VIP</span>}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 text-sm font-bold text-[var(--brand-ink-2)]/65">
                          {p.phone && <span>{p.phone}</span>}
                          {p.tags && <span className="text-[var(--brand-primary)]">{p.tags}</span>}
                        </p>
                        {p.notes && <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/55">{p.notes}</p>}
                      </div>
                      <button
                        onClick={() => { if (window.confirm(`¿Eliminar la ficha de ${p.fullName}?`)) post({ action: "delete", id: p.id }) }}
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
