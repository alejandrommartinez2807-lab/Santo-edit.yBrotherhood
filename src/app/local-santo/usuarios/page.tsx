"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, UserPlus, Power, Trash2, ShieldCheck, KeyRound } from "lucide-react"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

const ROLES: { value: string; label: string }[] = [
  { value: "owner", label: "Dueño" },
  { value: "manager", label: "Encargado" },
  { value: "cashier", label: "Caja" },
  { value: "waiter", label: "Mesonero" },
  { value: "kitchen", label: "Cocina" },
  { value: "delivery", label: "Delivery" },
  { value: "support", label: "Soporte" },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
)

type StaffUser = {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || ""
      : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function UsuariosPage() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("cashier")
  const [fullName, setFullName] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/staff", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setStaff(data.staff || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError("")
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email, password, role, fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setEmail("")
      setPassword("")
      setFullName("")
      setRole("cashier")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(u: StaffUser) {
    setBusyId(u.id)
    setError("")
    try {
      const res = await fetch(`/api/staff/${u.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !u.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(u: StaffUser) {
    const newPassword = window.prompt(`Nueva contraseña para ${u.email} (mín. 6):`)
    if (!newPassword) return
    setBusyId(u.id)
    setError("")
    try {
      const res = await fetch(`/api/staff/${u.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la clave")
      window.alert("Contraseña actualizada.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(u: StaffUser) {
    if (!window.confirm(`¿Eliminar a ${u.email}?`)) return
    setBusyId(u.id)
    setError("")
    try {
      const res = await fetch(`/api/staff/${u.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/local-santo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Usuarios del personal</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Crea y administra las cuentas de tu equipo.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white p-5 text-sm font-bold text-[var(--brand-primary)]">
            Solo el dueño puede gestionar usuarios. Inicia sesión como dueño en <Link href="/acceso" className="underline">/acceso</Link>.
          </p>
        ) : (
          <>
            <form onSubmit={handleCreate} className="mt-6 rounded-[1.6rem] border-2 border-[var(--brand-primary)]/20 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Nuevo usuario</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input required type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]" />
                <input required type="text" placeholder="Contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]" />
                <input type="text" placeholder="Nombre (opcional)" value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]" />
                <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand-primary)]">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating} className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-60">
                {creating ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />} Crear usuario
              </button>
            </form>

            {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}

            <div className="mt-6 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--brand-primary)]" size={24} /></div>
              ) : staff.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/30 bg-white p-5 text-sm font-bold text-[var(--brand-ink-2)]/60">Aún no hay usuarios. Crea el primero arriba.</p>
              ) : (
                staff.map((u) => (
                  <div key={u.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 ${u.is_active ? "border-[var(--brand-primary)]/20 bg-white" : "border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5"}`}>
                    <div>
                      <p className="text-sm font-black text-[var(--brand-ink-3)]">{u.full_name || u.email}</p>
                      <p className="text-xs font-bold text-[var(--brand-ink-2)]/60">{u.email} · {ROLE_LABEL[u.role] || u.role}{u.is_active ? "" : " · inactivo"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleActive(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)] bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50">
                        <Power size={13} /> {u.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => resetPassword(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] disabled:opacity-50">
                        <KeyRound size={13} /> Clave
                      </button>
                      <button onClick={() => remove(u)} disabled={busyId === u.id} className="inline-flex items-center gap-1 rounded-full border-2 border-red-600 bg-white px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-red-700 disabled:opacity-50">
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
