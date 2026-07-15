"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Receipt, Store } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Reservation = { id: string; guestName: string; status: string }
type FolioItem = {
  id: string
  category: string
  description: string
  amount: number
  kind: string
}
type ChargeableService = {
  id: string
  serviceName: string
  date: string
  time: string
  people: number
  amount: number
}
type FolioView = {
  folio: { id: string; status: string } | null
  items: FolioItem[]
  balance: number
  chargeableServices?: ChargeableService[]
}

const OUTLETS = ["Bar", "Restaurante", "Spa", "Tienda", "Minibar", "Otro"]

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function CargosResortPage() {
  return (
    <ModuleAccessGuard moduleKey="resortCharges" moduleName="Cargo resort a habitación">
      <CargosResortContent />
    </ModuleAccessGuard>
  )
}

function CargosResortContent() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [view, setView] = useState<FolioView | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingFolio, setLoadingFolio] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [outlet, setOutlet] = useState(OUTLETS[0])
  const [concept, setConcept] = useState("")
  const [amount, setAmount] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const today = toISO(new Date())
      const to = toISO(new Date(new Date().getFullYear() + 1, 0, 1))
      const res = await fetch(`/api/hotel-reservations?from=${today}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      // Solo huéspedes EN CASA (check-in): su folio está abierto.
      setReservations((data.reservations || []).filter((r: Reservation) => r.status === "checkin"))
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

  const loadFolio = useCallback(async (reservationId: string) => {
    if (!reservationId) {
      setView(null)
      return
    }
    setLoadingFolio(true)
    setError("")
    try {
      const res = await fetch(`/api/folios?reservationId=${reservationId}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el folio")
      setView(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      setView(null)
    } finally {
      setLoadingFolio(false)
    }
  }, [])

  function selectReservation(id: string) {
    setSelectedId(id)
    loadFolio(id)
  }

  async function postFolio(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/folios", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...body, reservationId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setView(data)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addCharge() {
    const value = Number(amount) || 0
    if (!view?.folio || value <= 0) return
    const ok = await postFolio({
      action: "charge",
      folioId: view.folio.id,
      amount: value,
      category: "resort",
      description: `${outlet}${concept.trim() ? ` · ${concept.trim()}` : ""}`,
    })
    if (ok) {
      setConcept("")
      setAmount("")
    }
  }

  const folio = view?.folio || null
  const balance = view?.balance || 0
  const chargeableServices = view?.chargeableServices || []
  const resortItems = useMemo(
    () => (view?.items || []).filter((i) => i.category === "resort" || i.category === "servicio"),
    [view],
  )

  const inputClass =
    "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
        >
          <ArrowLeft size={16} /> Volver al panel
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Store size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Cargar a la habitación</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Carga consumo del bar, spa o tienda a la cuenta del huésped en casa.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para cargar al resort, o el módulo está desactivado.
          </p>
        ) : loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold">
            <Loader2 className="animate-spin" size={18} /> Cargando…
          </p>
        ) : (
          <>
            {/* Selección de huésped */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="text-xs font-black uppercase text-[var(--brand-primary)]">Huésped en casa</p>
              <select
                value={selectedId}
                onChange={(e) => selectReservation(e.target.value)}
                className={`${inputClass} mt-2 w-full`}
              >
                <option value="">Elige al huésped…</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.guestName}
                  </option>
                ))}
              </select>
              {reservations.length === 0 && (
                <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/55">
                  No hay huéspedes con check-in en este momento.
                </p>
              )}
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loadingFolio ? (
              <p className="mt-6 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Abriendo folio…
              </p>
            ) : selectedId && !folio ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Ese huésped aún no tiene folio abierto. Haz el check-in desde el módulo Folio.
              </p>
            ) : folio ? (
              <>
                {/* Saldo */}
                <div className="mt-6 flex items-center justify-between rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                  <span className="text-sm font-black uppercase text-[var(--brand-primary)]">Saldo actual</span>
                  <span className="text-2xl font-black text-[var(--brand-ink-3)]">${balance}</span>
                </div>

                {/* Nuevo cargo */}
                <div className="mt-4 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-4">
                  <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className={inputClass}>
                    {OUTLETS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Concepto (2 cervezas…)"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Monto $"
                    className={inputClass}
                  />
                  <button
                    onClick={addCharge}
                    disabled={busy || !(Number(amount) > 0)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-4"
                  >
                    <Plus size={16} /> Cargar a la habitación
                  </button>
                </div>

                {/* Servicios por cobrar */}
                {chargeableServices.length > 0 && (
                  <div className="mt-4 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-4">
                    <p className="text-xs font-black uppercase text-[var(--brand-primary)]">Servicios reservados por cobrar</p>
                    <ul className="mt-2 space-y-2">
                      {chargeableServices.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--brand-cream)] px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--brand-ink-3)]">{s.serviceName}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-ink-2)]/50">
                              {s.date}
                              {s.time ? ` · ${s.time}` : ""} · {s.people}p
                            </p>
                          </div>
                          <span className="font-black text-[var(--brand-ink-3)]">${s.amount}</span>
                          <button
                            onClick={() => postFolio({ action: "chargeService", folioId: folio.id, bookingId: s.id })}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-black uppercase text-white disabled:opacity-50"
                          >
                            <Plus size={13} /> Cargar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cargos del resort ya hechos */}
                <div className="mt-4">
                  <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                    <Receipt size={16} /> Cargos del resort en esta estadía
                  </h2>
                  {resortItems.length === 0 ? (
                    <p className="mt-2 text-sm font-bold text-[var(--brand-ink-2)]/55">Aún no hay cargos del resort.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {resortItems.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-[var(--brand-primary)]/15 bg-white px-3 py-2">
                          <span className="font-bold text-[var(--brand-ink-3)]">{i.description}</span>
                          <span className="font-black text-[var(--brand-ink-3)]">${i.amount}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
