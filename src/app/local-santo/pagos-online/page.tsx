"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BadgeCheck,
  BadgeDollarSign,
  CalendarRange,
  Check,
  CreditCard,
  Loader2,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import ProviderConnectionCard from "@/components/local/ProviderConnectionCard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"
const METHODS = ["pago_movil", "zelle", "transferencia", "tarjeta", "efectivo", "otro"]
const METHOD_LABELS: Record<string, string> = {
  pago_movil: "Pago móvil",
  zelle: "Zelle",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  otro: "Otro",
}
const STATUS_LABELS: Record<string, string> = {
  reportado: "Por confirmar",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
}
const STATUS_FILTERS = ["todos", "reportado", "confirmado", "rechazado"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type Payment = {
  id: string
  reservationId: string
  method: string
  amount: number
  reference: string
  status: string
  note: string
  proofImageUrl?: string
  createdAt: string
}
type ReservationSummary = {
  id: string
  guestName: string
  code: string
  status: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmount: number
  source: string
}

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function money(value: number) {
  return `$${(Math.round(value * 100) / 100).toLocaleString("es-VE")}`
}

function formatDate(value: string) {
  if (!value) return ""
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function PagosOnlinePage() {
  return (
    <ModuleAccessGuard moduleKey="onlinePayments" moduleName="Pagos y depósitos">
      <PagosContent />
    </ModuleAccessGuard>
  )
}

function PagosContent() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [reservations, setReservations] = useState<ReservationSummary[]>([])
  const [referenced, setReferenced] = useState<ReservationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [busy, setBusy] = useState(false)

  // Formulario de registro
  const [reservationId, setReservationId] = useState("")
  const [method, setMethod] = useState("transferencia")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")

  // Filtros de la lista
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos")
  const [methodFilter, setMethodFilter] = useState("")
  const [search, setSearch] = useState("")

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
      setReferenced(data.referenced || [])
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

  // Reserva por id: junta las próximas (formulario) y las referenciadas (lista).
  const resById = useMemo(() => {
    const m = new Map<string, ReservationSummary>()
    referenced.forEach((r) => m.set(r.id, r))
    reservations.forEach((r) => m.set(r.id, r))
    return m
  }, [reservations, referenced])

  // Abonos confirmados por reserva (para "abonado X de Y").
  const confirmedByReservation = useMemo(() => {
    const m = new Map<string, number>()
    payments.forEach((p) => {
      if (p.status !== "confirmado") return
      m.set(p.reservationId, (m.get(p.reservationId) || 0) + p.amount)
    })
    return m
  }, [payments])

  const selectedReservation = reservationId ? resById.get(reservationId) || null : null
  const selectedConfirmed = selectedReservation
    ? confirmedByReservation.get(selectedReservation.id) || 0
    : 0
  const selectedRemaining = selectedReservation
    ? Math.max(0, selectedReservation.totalAmount - selectedConfirmed)
    : 0

  // Métricas del módulo
  const metrics = useMemo(() => {
    const base = { reportadoCount: 0, reportadoTotal: 0, confirmadoCount: 0, confirmadoTotal: 0, rechazadoCount: 0 }
    for (const p of payments) {
      if (p.status === "reportado") { base.reportadoCount++; base.reportadoTotal += p.amount }
      else if (p.status === "confirmado") { base.confirmadoCount++; base.confirmadoTotal += p.amount }
      else if (p.status === "rechazado") base.rechazadoCount++
    }
    return base
  }, [payments])

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false
      if (methodFilter && p.method !== methodFilter) return false
      if (!term) return true
      const r = resById.get(p.reservationId)
      const haystack = [r?.guestName, r?.code, p.reference, p.method, METHOD_LABELS[p.method], String(p.amount)]
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [payments, statusFilter, methodFilter, search, resById])

  async function post(body: Record<string, unknown>, okMessage = "") {
    setBusy(true)
    setError("")
    setOk("")
    try {
      const res = await fetch("/api/reservation-payments", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo procesar")
      await load()
      if (okMessage) setOk(okMessage)
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
    const done = await post(
      { reservationId, method, amount: Number(amount), reference: reference.trim() },
      "Depósito registrado. Queda como reportado hasta que lo confirmes.",
    )
    if (done) { setAmount(""); setReference("") }
  }

  const inputClass =
    "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"
  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition ${
      active
        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
        : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-cream)]"
    }`

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><CreditCard size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Pagos y depósitos</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Anticipos y abonos de reservas: regístralos, confírmalos y ve cuánto falta por cobrar.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para pagos, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {/* Métricas */}
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-amber-700">
                  <Wallet size={13} /> Por confirmar
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{metrics.reportadoCount}</p>
                <p className="text-sm font-bold text-amber-800/80">{money(metrics.reportadoTotal)}</p>
              </div>
              <div className="rounded-2xl border border-green-600/25 bg-green-50 p-4">
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-green-700">
                  <BadgeCheck size={13} /> Confirmados
                </p>
                <p className="mt-1 text-2xl font-bold text-green-900">{metrics.confirmadoCount}</p>
                <p className="text-sm font-bold text-green-800/80">{money(metrics.confirmadoTotal)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--brand-primary)]">
                  <BadgeDollarSign size={13} /> Total confirmado
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">{money(metrics.confirmadoTotal)}</p>
                <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">en depósitos recibidos</p>
              </div>
              <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[var(--brand-primary)]">
                  <X size={13} /> Rechazados
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--brand-ink-3)]">{metrics.rechazadoCount}</p>
                <p className="text-sm font-bold text-[var(--brand-ink-2)]/60">no se cuentan como abono</p>
              </div>
            </div>

            {/* Registrar depósito */}
            <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Registrar depósito
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} className={inputClass}>
                  <option value="">Reserva…</option>
                  {reservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.guestName} (#{r.code}) · {r.checkInDate}
                    </option>
                  ))}
                </select>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                </select>
                <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto $" className={inputClass} />
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia / #confirmación" className={inputClass} />

                {/* Contexto de la reserva elegida: cuánto es, cuánto abonó y
                    atajos para llenar el monto sin calculadora. */}
                {selectedReservation && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--brand-cream)] px-4 py-3 sm:col-span-2">
                    <p className="text-sm font-bold text-[var(--brand-ink-3)]">
                      Estadía {money(selectedReservation.totalAmount)} ({selectedReservation.nights}n)
                      <span className="ml-2 text-[var(--brand-ink-2)]/65">
                        Abonado {money(selectedConfirmed)} · Restante {money(selectedRemaining)}
                      </span>
                    </p>
                    <span className="flex gap-2">
                      {selectedRemaining > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAmount(String(Math.round(selectedRemaining * 50) / 100))}
                            className="rounded-full border border-[var(--brand-primary)]/30 bg-white px-3 py-1 text-xs font-bold uppercase text-[var(--brand-primary)]"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmount(String(selectedRemaining))}
                            className="rounded-full border border-[var(--brand-primary)]/30 bg-white px-3 py-1 text-xs font-bold uppercase text-[var(--brand-primary)]"
                          >
                            Restante
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )}

                <button
                  onClick={record}
                  disabled={busy || !reservationId || !(Number(amount) > 0)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-2"
                >
                  <Plus size={16} /> Registrar depósito
                </button>
              </div>
            </div>

            {ok && <p className="mt-3 font-bold text-green-700">{ok}</p>}
            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {/* Filtros */}
            <div className="mt-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {STATUS_FILTERS.map((s) => (
                    <button key={s} type="button" onClick={() => setStatusFilter(s)} className={chipClass(statusFilter === s)}>
                      {s === "todos" ? "Todos" : STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 text-sm font-bold outline-none"
                  >
                    <option value="">Todos los métodos</option>
                    {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                  </select>
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2">
                    <Search size={15} className="shrink-0 text-[var(--brand-primary)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Huésped, código o referencia"
                      className="w-40 bg-transparent text-sm font-bold outline-none sm:w-56"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Lista */}
            {loading ? (
              <p className="mt-6 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : filteredPayments.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                {payments.length === 0
                  ? "Aún no hay depósitos registrados."
                  : "Ningún depósito coincide con los filtros."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {filteredPayments.map((p) => {
                  const r = resById.get(p.reservationId)
                  const confirmed = r ? confirmedByReservation.get(r.id) || 0 : 0
                  return (
                    <li key={p.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-[var(--brand-ink-3)]">
                            {money(p.amount)}
                            <span className="ml-2 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-primary-dark)]">
                              {METHOD_LABELS[p.method] || p.method}
                            </span>
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-[var(--brand-ink-2)]/75">
                            {r ? (
                              <>
                                {r.guestName} <span className="text-[var(--brand-ink-2)]/45">#{r.code}</span>
                                <span className="ml-2 inline-flex items-center gap-1 text-[var(--brand-ink-2)]/60">
                                  <CalendarRange size={13} /> {r.checkInDate} → {r.checkOutDate}
                                </span>
                              </>
                            ) : (
                              "Reserva no disponible"
                            )}
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-[var(--brand-ink-2)]/55">
                            {p.reference ? `Ref: ${p.reference} · ` : ""}
                            {formatDate(p.createdAt)}
                            {r && r.totalAmount > 0 ? ` · Abonado ${money(confirmed)} de ${money(r.totalAmount)}` : ""}
                          </p>
                          {p.proofImageUrl ? (
                            <a
                              href={p.proofImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-[var(--brand-primary-dark)] underline"
                            >
                              <CreditCard size={13} /> Ver captura
                            </a>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${p.status === "confirmado" ? "border-green-600/30 bg-green-50 text-green-700" : p.status === "rechazado" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                          {p.status === "reportado" && (
                            <>
                              <button
                                onClick={() => post({ action: "status", id: p.id, status: "confirmado" }, "Depósito confirmado.")}
                                disabled={busy}
                                title="Confirmar"
                                className="inline-flex items-center gap-1 rounded-full border border-green-600/30 bg-green-50 px-3 py-1.5 text-xs font-bold uppercase text-green-700 disabled:opacity-50"
                              >
                                <Check size={13} /> Confirmar
                              </button>
                              <button
                                onClick={() => post({ action: "status", id: p.id, status: "rechazado" }, "Depósito rechazado.")}
                                disabled={busy}
                                title="Rechazar"
                                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <ProviderConnectionCard providerId="gateway" />
          </>
        )}
      </div>
    </main>
  )
}
