"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2, Truck, Phone, User, ShoppingCart } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Supplier = {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  note: string
  isActive: boolean
  sortOrder: number
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.localStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function ProveedoresPage() {
  return (
    <ModuleAccessGuard moduleKey="suppliers" moduleName="Proveedores">
      <ProveedoresPageContent />
    </ModuleAccessGuard>
  )
}

function ProveedoresPageContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [newContact, setNewContact] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/suppliers", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setSuppliers(data.suppliers || [])
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
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          contactName: newContact.trim(),
          phone: newPhone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setNewName("")
      setNewContact("")
      setNewPhone("")
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
      const res = await fetch(`/api/suppliers/${id}`, {
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

  async function remove(s: Supplier) {
    if (!window.confirm(`¿Eliminar el proveedor "${s.name}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, { method: "DELETE", headers: authHeaders() })
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} /> Volver al panel
          </Link>
          <Link
            href="/local-santo/compras"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]"
          >
            <ShoppingCart size={14} /> Historial de compras
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Truck size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Proveedores</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Lista de proveedores del local: contacto y teléfono para tus compras.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Solo el dueño puede gestionar los proveedores, y el módulo debe estar activo desde la
            configuración del negocio. Inicia sesión como dueño.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Nombre del proveedor"
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)] sm:col-span-3"
              />
              <input
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Contacto (opcional)"
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Teléfono (opcional)"
                className="rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
              />
              <button
                onClick={create}
                disabled={busy || !newName.trim()}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
              >
                <Plus size={16} /> Crear
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : suppliers.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay proveedores. Agrega el primero arriba.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {suppliers.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        defaultValue={s.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== s.name) patch(s.id, { name: v })
                        }}
                        className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 text-lg font-black text-[var(--brand-ink-3)] outline-none hover:border-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => patch(s.id, { isActive: !s.isActive })}
                          disabled={busy}
                          className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${
                            s.isActive
                              ? "border-green-600/30 bg-green-50 text-green-700"
                              : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/60"
                          }`}
                        >
                          {s.isActive ? "Activo" : "Inactivo"}
                        </button>
                        <button
                          onClick={() => remove(s)}
                          disabled={busy}
                          title="Eliminar proveedor"
                          className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-2 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-lg border-2 border-[var(--brand-primary)]/15 px-3 py-2">
                        <User size={15} className="shrink-0 text-[var(--brand-primary)]" />
                        <input
                          defaultValue={s.contactName}
                          placeholder="Contacto"
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v !== s.contactName) patch(s.id, { contactName: v })
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border-2 border-[var(--brand-primary)]/15 px-3 py-2">
                        <Phone size={15} className="shrink-0 text-[var(--brand-primary)]" />
                        <input
                          defaultValue={s.phone}
                          placeholder="Teléfono"
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v !== s.phone) patch(s.id, { phone: v })
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                        />
                      </label>
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
