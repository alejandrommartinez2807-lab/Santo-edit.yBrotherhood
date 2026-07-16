"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, Copy, Loader2, Plus, Star, Ticket, Trash2, UserPlus } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Membership = {
  id: string
  name: string
  level: string
  benefits: string
  discountPct: number
  active: boolean
}
type GuestMembership = {
  id: string
  membershipId: string
  membershipName: string
  discountPct: number
  guestName: string
  code: string
  guestPassCode: string
  passUses: number
  lastReferral: string
  expiresAt: string
  active: boolean
}
type CrmGuest = { id: string; fullName: string; phone: string }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function MembresiasPage() {
  return (
    <ModuleAccessGuard moduleKey="guestMemberships" moduleName="Membresías">
      <MembresiasContent />
    </ModuleAccessGuard>
  )
}

function MembresiasContent() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [guestMemberships, setGuestMemberships] = useState<GuestMembership[]>([])
  const [guests, setGuests] = useState<CrmGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [benefits, setBenefits] = useState("")
  const [discount, setDiscount] = useState("10")

  const [assignMembershipId, setAssignMembershipId] = useState("")
  const [assignGuestName, setAssignGuestName] = useState("")
  const [assignGuestProfileId, setAssignGuestProfileId] = useState("")
  const [assignExpires, setAssignExpires] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/memberships", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setMemberships(data.memberships || [])
      setGuestMemberships(data.guestMemberships || [])
      setGuests(data.guests || [])
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

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/memberships", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo")
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createMembership() {
    if (!name.trim()) return
    const ok = await post({ action: "saveMembership", name: name.trim(), level: level.trim(), benefits: benefits.trim(), discountPct: Number(discount) || 0 })
    if (ok) {
      setName("")
      setLevel("")
      setBenefits("")
      setDiscount("10")
    }
  }

  async function assign() {
    if (!assignMembershipId || !assignGuestName.trim()) return
    const ok = await post({ action: "assign", membershipId: assignMembershipId, guestName: assignGuestName.trim(), guestProfileId: assignGuestProfileId, expiresAt: assignExpires })
    if (ok) {
      setAssignGuestName("")
      setAssignGuestProfileId("")
      setAssignExpires("")
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  const inputClass = "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Star size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-[var(--brand-ink-3)]">Membresías</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Niveles de fidelización con descuento sugerido y pase de invitado transferible.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para membresías, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Crear nivel de membresía */}
            <section className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"><Plus size={15} /> Crear membresía</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Club del Hotel)" className={inputClass} />
                <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Nivel (ej. Oro)" className={inputClass} />
                <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Descuento %</span>
                  <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                </label>
                <input value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Beneficios (texto libre)" className={inputClass} />
              </div>
              <button onClick={createMembership} disabled={busy || !name.trim()} className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} Guardar membresía
              </button>
            </section>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Lista de niveles */}
            {memberships.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="min-w-0">
                      <p className="font-black text-[var(--brand-ink-3)]">{m.name} {m.level ? <span className="text-[var(--brand-primary-dark)]">· {m.level}</span> : null}</p>
                      <p className="text-sm font-bold text-[var(--brand-primary-dark)]">-{m.discountPct}% sugerido</p>
                      {m.benefits ? <p className="mt-0.5 text-xs font-bold text-[var(--brand-ink-2)]/60">{m.benefits}</p> : null}
                    </div>
                    <button onClick={() => post({ action: "deleteMembership", id: m.id })} disabled={busy} title="Borrar" className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-50">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Asignar a un huésped */}
            {memberships.length > 0 && (
              <section className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"><UserPlus size={15} /> Asignar a un huésped</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={assignMembershipId} onChange={(e) => setAssignMembershipId(e.target.value)} className={inputClass}>
                    <option value="">Membresía…</option>
                    {memberships.filter((m) => m.active).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}{m.level ? ` · ${m.level}` : ""} (-{m.discountPct}%)</option>
                    ))}
                  </select>
                  {guests.length > 0 && (
                    <select
                      value={assignGuestProfileId}
                      onChange={(e) => {
                        const g = guests.find((x) => x.id === e.target.value)
                        setAssignGuestProfileId(e.target.value)
                        if (g) setAssignGuestName(g.fullName)
                      }}
                      className={inputClass}
                    >
                      <option value="">Elegir del CRM (opcional)…</option>
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>{g.fullName}{g.phone ? ` · ${g.phone}` : ""}</option>
                      ))}
                    </select>
                  )}
                  <input value={assignGuestName} onChange={(e) => setAssignGuestName(e.target.value)} placeholder="Nombre del huésped" className={inputClass} />
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                    <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Vence</span>
                    <input type="date" value={assignExpires} onChange={(e) => setAssignExpires(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                  </label>
                </div>
                <button onClick={assign} disabled={busy || !assignMembershipId || !assignGuestName.trim()} className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <BadgeCheck size={15} />} Asignar membresía
                </button>
              </section>
            )}

            {/* Membresías de huéspedes */}
            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : guestMemberships.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {guestMemberships.map((gm) => (
                  <li key={gm.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-[var(--brand-ink-3)]">{gm.guestName}</p>
                        <p className="text-sm font-bold text-[var(--brand-primary-dark)]">{gm.membershipName || "Membresía"} · -{gm.discountPct}% sugerido{gm.expiresAt ? ` · vence ${gm.expiresAt}` : ""}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                          <button onClick={() => copy(gm.code)} className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[var(--brand-primary-dark)]" title="Copiar código del huésped">
                            <Copy size={12} /> {gm.code}
                          </button>
                          <button onClick={() => copy(gm.guestPassCode)} className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[var(--brand-primary-dark)]" title="Copiar pase de invitado">
                            <Ticket size={12} /> Pase: {gm.guestPassCode}
                          </button>
                        </div>
                        {gm.passUses > 0 && (
                          <p className="mt-1.5 text-xs font-bold text-[var(--brand-ink-2)]/60">Pase usado {gm.passUses} vez(es){gm.lastReferral ? ` · último: ${gm.lastReferral}` : ""}</p>
                        )}
                      </div>
                      <button onClick={() => post({ action: "deleteGuestMembership", id: gm.id })} disabled={busy} title="Borrar" className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay huéspedes con membresía. Crea un nivel y asígnalo arriba.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
