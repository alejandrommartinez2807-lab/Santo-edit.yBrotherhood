"use client"

// Cuentas por pagar: vista de "lo que le debes a tus proveedores". No registra
// compras (eso es el módulo Compras); parte de las compras existentes y muestra
// lo pendiente por proveedor, vencidas y próximas a vencer, con abono rápido.
// Reusa /api/supplier-purchases y /api/supplier-purchases/[id]/payments.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Wallet, AlertTriangle } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type SupplierPaymentStatus = "Pendiente" | "Parcial" | "Pagado"

type Purchase = {
  id: string
  supplierId: string | null
  supplierName: string
  purchaseDate: string
  dueDate: string
  documentNumber: string
  totalUSD: number
  totalVES: number
  note: string
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  paymentStatus: SupplierPaymentStatus
  isOverdue: boolean
}

const STATUS_STYLES: Record<SupplierPaymentStatus, string> = {
  Pendiente: "bg-red-100 text-red-700",
  Parcial: "bg-amber-100 text-amber-700",
  Pagado: "bg-emerald-100 text-emerald-700",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined"
      ? window.localStorage.getItem(OWNER_STORAGE_KEY) || ""
      : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

function usd(n: number) {
  return `$${(Number(n) || 0).toFixed(2)}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isPending(p: Purchase) {
  return p.paymentStatus !== "Pagado" && (p.pendingUSD > 0.01 || p.pendingVES > 0.01)
}

export default function CuentasPorPagarPage() {
  return (
    <ModuleAccessGuard moduleKey="accountsPayable" moduleName="Cuentas por pagar">
      <CuentasPorPagarContent />
    </ModuleAccessGuard>
  )
}

function CuentasPorPagarContent() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Abono rápido sobre una compra pendiente.
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(todayISO())
  const [payMethod, setPayMethod] = useState("")
  const [payUSD, setPayUSD] = useState("")
  const [payVES, setPayVES] = useState("")
  const [payReference, setPayReference] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/supplier-purchases", {
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
      setPurchases(Array.isArray(data.purchases) ? data.purchases : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  function openPay(p: Purchase) {
    setPayingId(p.id)
    setPayDate(todayISO())
    setPayMethod("")
    setPayUSD("")
    setPayVES("")
    setPayReference("")
    setError("")
  }

  async function registerPayment(id: string) {
    if (!(Number(payUSD) > 0) && !(Number(payVES) > 0)) {
      setError("Indica un monto abonado mayor a cero (USD o Bs).")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/supplier-purchases/${id}/payments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          paymentDate: payDate || todayISO(),
          amountUSD: Number(payUSD) || 0,
          amountVES: Number(payVES) || 0,
          method: payMethod.trim(),
          reference: payReference.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el abono")
      setPayingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const pending = useMemo(() => purchases.filter(isPending), [purchases])

  const totals = useMemo(() => {
    return pending.reduce(
      (acc, p) => {
        acc.pendingUSD += p.pendingUSD
        if (p.isOverdue) {
          acc.overdueUSD += p.pendingUSD
          acc.overdueCount += 1
        }
        return acc
      },
      { pendingUSD: 0, overdueUSD: 0, overdueCount: 0 },
    )
  }, [pending])

  const groups = useMemo(() => {
    const bySupplier = new Map<
      string,
      { name: string; items: Purchase[]; pendingUSD: number; overdueUSD: number }
    >()
    for (const p of pending) {
      const key = p.supplierId || p.supplierName || "—"
      const group = bySupplier.get(key) || {
        name: p.supplierName || "—",
        items: [],
        pendingUSD: 0,
        overdueUSD: 0,
      }
      group.items.push(p)
      group.pendingUSD += p.pendingUSD
      if (p.isOverdue) group.overdueUSD += p.pendingUSD
      bySupplier.set(key, group)
    }
    return [...bySupplier.values()]
      .map((group) => ({
        ...group,
        items: group.items.sort(
          (a, b) =>
            Number(b.isOverdue) - Number(a.isOverdue) ||
            (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"),
        ),
      }))
      .sort((a, b) => b.pendingUSD - a.pendingUSD)
  }, [pending])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/local-santo/control-gastos"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]"
          >
            <ArrowLeft size={16} /> Control de gastos
          </Link>
          <Link
            href="/local-santo/compras"
            className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]/70"
          >
            Registrar compra →
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <Wallet size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-black uppercase text-[var(--brand-ink-3)]">
              Cuentas por pagar
            </h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
              Lo que le debes a tus proveedores, por vencimiento.
            </p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Para ver las cuentas por pagar necesitas iniciar sesión como dueño y
            tener activo el módulo de Proveedores/Compras desde la configuración
            del negocio.
          </p>
        ) : (
          <>
            {/* Resumen */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Total por pagar"
                value={usd(totals.pendingUSD)}
                hint={`${pending.length} compra(s) pendiente(s)`}
              />
              <SummaryCard
                label="Vencido"
                value={usd(totals.overdueUSD)}
                hint={`${totals.overdueCount} vencida(s)`}
                tone={totals.overdueCount > 0 ? "warning" : "soft"}
              />
              <SummaryCard
                label="Proveedores con deuda"
                value={String(groups.length)}
              />
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold">
                <Loader2 className="animate-spin" size={18} /> Cargando…
              </p>
            ) : pending.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[#1a1a1a]/60">
                No tienes cuentas por pagar. Todas las compras están al día. 🎉
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-black text-[var(--brand-ink-3)]">
                        {group.name}
                      </p>
                      <div className="text-right">
                        <p className="text-sm font-black text-red-600">
                          {usd(group.pendingUSD)} por pagar
                        </p>
                        {group.overdueUSD > 0 && (
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.06em] text-red-600">
                            {usd(group.overdueUSD)} vencido
                          </p>
                        )}
                      </div>
                    </div>

                    <ul className="mt-3 space-y-2">
                      {group.items.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-xl border-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] ${STATUS_STYLES[p.paymentStatus]}`}
                                >
                                  {p.paymentStatus}
                                </span>
                                {p.isOverdue && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] text-white">
                                    <AlertTriangle size={10} /> Vencida
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                                {p.purchaseDate}
                                {p.documentNumber ? ` · Doc. ${p.documentNumber}` : ""}
                                {p.dueDate ? ` · Vence ${p.dueDate}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-red-600">
                                {usd(p.pendingUSD)}
                                {p.pendingVES > 0 ? ` · Bs ${p.pendingVES.toFixed(2)}` : ""}
                              </p>
                              <button
                                onClick={() =>
                                  payingId === p.id ? setPayingId(null) : openPay(p)
                                }
                                disabled={busy}
                                className="mt-1 inline-flex items-center gap-1 rounded-lg border-2 border-emerald-300 bg-white px-3 py-1.5 text-[0.68rem] font-black uppercase text-emerald-700 disabled:opacity-50"
                              >
                                <Wallet size={13} /> Abonar
                              </button>
                            </div>
                          </div>

                          {payingId === p.id && (
                            <div className="mt-3 grid gap-2 border-t-2 border-emerald-200 pt-3 sm:grid-cols-2">
                              <input
                                type="date"
                                value={payDate}
                                max={todayISO()}
                                onChange={(e) => setPayDate(e.target.value)}
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                                placeholder="Método (transferencia, efectivo…)"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={payUSD}
                                onChange={(e) => setPayUSD(e.target.value)}
                                placeholder="Abono USD"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={payVES}
                                onChange={(e) => setPayVES(e.target.value)}
                                placeholder="Abono Bs"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                value={payReference}
                                onChange={(e) => setPayReference(e.target.value)}
                                placeholder="Referencia (opcional)"
                                className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 sm:col-span-2"
                              />
                              <button
                                onClick={() => registerPayment(p.id)}
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50 sm:col-span-2"
                              >
                                <Plus size={14} /> Registrar abono
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "soft",
}: {
  label: string
  value: string
  hint?: string
  tone?: "soft" | "warning"
}) {
  return (
    <div
      className={`rounded-xl border-2 p-3 ${
        tone === "warning"
          ? "border-amber-300 bg-amber-50"
          : "border-[var(--brand-primary)]/15 bg-white"
      }`}
    >
      <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[var(--brand-ink-3)]">{value}</p>
      {hint && (
        <p className="mt-0.5 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
          {hint}
        </p>
      )}
    </div>
  )
}
