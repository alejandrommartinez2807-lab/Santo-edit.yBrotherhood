"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Copy, Link2, Loader2, Plus, Trash2, Building2 } from "lucide-react"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Branch = { id: string; name: string; is_active: boolean; sort_order: number }

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

// Módulos operativos con enlace por sede: al abrir el enlace en un
// dispositivo, esa sede queda fijada ahí (ideal para la tablet de cada área).
const LINKABLE_MODULES = [
  { path: "caja", label: "Caja" },
  { path: "cocina", label: "Cocina" },
  { path: "mesonero", label: "Mesonero" },
  { path: "mesas", label: "Mesas y QR" },
  { path: "delivery", label: "Delivery" },
  { path: "inventario", label: "Inventario" },
] as const

function BranchLinksPanel({ branches }: { branches: Branch[] }) {
  const [copied, setCopied] = useState("")
  const active = branches.filter((b) => b.is_active)

  if (active.length === 0) return null

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(""), 1500)
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        <Link2 size={16} /> Enlaces por sede
      </h2>
      <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
        Abre el enlace en el dispositivo de cada área (o guárdalo como favorito):
        ese equipo queda fijado a su sede y el empleado solo pone su usuario.
      </p>
      <div className="mt-4 space-y-4">
        {active.map((b) => (
          <div key={b.id}>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-3)]">
              {b.name}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LINKABLE_MODULES.map((m) => {
                const url = `${origin}/local-santo/${m.path}?sede=${b.id}`
                return (
                  <button
                    key={m.path}
                    type="button"
                    onClick={() => copy(url)}
                    title={url}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    {copied === url ? (
                      <Check size={12} className="text-green-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/branches", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setBranches(data.branches || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Difiere la carga un tick para no hacer setState síncrono en el efecto.
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function create() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setNewName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove(b: Branch) {
    if (
      !window.confirm(
        `¿Eliminar la sucursal "${b.name}"?\n\nSe borrarán TODOS sus datos (pedidos, menú, inventario, caja). Esta acción no se puede deshacer.`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE", headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/local-santo"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Building2 size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Sucursales</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Cada sucursal tiene su propio menú, inventario, caja y reportes.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño puede gestionar las sucursales. Inicia sesión como dueño.
          </p>
        ) : (
          <>
            <div className="mt-6 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Nombre de la nueva sucursal"
                className="flex-1 rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <button
                onClick={create}
                disabled={busy || !newName.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
              >
                <Plus size={16} /> Crear
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {branches.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <input
                      defaultValue={b.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== b.name) patch(b.id, { name: v })
                      }}
                      className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-lg font-black text-[var(--brand-ink-3)] outline-none hover:border-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => patch(b.id, { is_active: !b.is_active })}
                        disabled={busy}
                        className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                          b.is_active
                            ? "border-green-600/30 bg-green-50 text-green-700"
                            : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                        }`}
                      >
                        {b.is_active ? "Activa" : "Inactiva"}
                      </button>
                      <button
                        onClick={() => remove(b)}
                        disabled={busy}
                        title="Eliminar sucursal"
                        className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!loading ? <BranchLinksPanel branches={branches} /> : null}
          </>
        )}
      </div>
    </main>
  )
}
