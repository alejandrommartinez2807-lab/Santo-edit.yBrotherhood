"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, CreditCard, Loader2, Plus, X } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"
const METHODS = ["pago_movil", "zelle", "transferencia", "efectivo", "otro"]
const METHOD_LABELS: Record<string, string> = { pago_movil: "Pago móvil", zelle: "Zelle", transferencia: "Transferencia", efectivo: "Efectivo", otro: "Otro" }
const STATUS_LABELS: Record<string, string> = { reportado: "Reportado", confirmado: "Confirmado", rechazado: "Rechazado" }

type Payment = { id: string; reservationId: string; method: string; amount: number; reference: string; status: string; createdAt: string }
type Reservation = { id: string; guestName: string; code: string; status: string }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function PagosOnlinePage() {
  return (
    <ModuleAccessGuard moduleKey="onlinePayments" moduleName="Pagos online">
      <PagosContent />
    </ModuleAccessGuard>
  )
}

function PagosContent() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [reservationId, setReservationId] = useState("")
  const [method, setMethod] = useState("transferencia")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/reservation-payments", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setPayments(data.payments || [])
      setReservations(data.reservations || [])
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

  const resById = useMemo(() => {
    const m = new Map<string, Reservation>()
    reservations.forEach((r) => m.set(r.id, r))
    return m
  }, [reservations])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/reservation-payments", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
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

  async function record() {
    if (!reservationId || !(Number(amount) > 0)) return
    const ok = await post({ reservationId, method, amount: Number(amount), reference: reference.trim() })
    if (ok) { setAmount(""); setReference("") }
  }

  const inputClass = "rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/local-santo" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><CreditCard size={24} /></span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">Pagos / depósitos</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Registra el depósito reportado y confírmalo.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para pagos, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-2 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
              <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} className={inputClass}>
                <option value="">Reserva…</option>
                {reservations.map((r) => <option key={r.id} value={r.id}>{r.guestName} (#{r.code})</option>)}
              </select>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </select>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto $" className={inputClass} />
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia / #confirmación" className={inputClass} />
              <button onClick={record} disabled={busy || !reservationId || !(Number(amount) > 0)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50 sm:col-span-2">
                <Plus size={16} /> Registrar depósito
              </button>
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : payments.length === 0 ? (
              <p className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay depósitos registrados.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[var(--brand-ink-3)]">
                          ${p.amount} <span className="text-sm text-[var(--brand-ink-2)]/55">{METHOD_LABELS[p.method] || p.method}</span>
                        </p>
                        <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
                          {resById.get(p.reservationId)?.guestName || "Reserva"}{p.reference ? ` · ${p.reference}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase ${p.status === "confirmado" ? "border-green-600/30 bg-green-50 text-green-700" : p.status === "rechazado" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                        {p.status === "reportado" && (
                          <>
                            <button onClick={() => post({ action: "status", id: p.id, status: "confirmado" })} disabled={busy} title="Confirmar" className="inline-flex items-center justify-center rounded-full border-2 border-green-600/30 bg-green-50 p-1.5 text-green-700 disabled:opacity-50"><Check size={14} /></button>
                            <button onClick={() => post({ action: "status", id: p.id, status: "rechazado" })} disabled={busy} title="Rechazar" className="inline-flex items-center justify-center rounded-full border-2 border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"><X size={14} /></button>
                          </>
                        )}
                      </div>
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
