"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, FileText, Loader2, Plus } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { downloadCsv } from "@/lib/csv"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Invoice = {
  id: string
  number: number
  serie: string
  customerName: string
  customerRif: string
  subtotal: number
  tax: number
  total: number
  createdAt: string
}
type Billable = { id: string; guestName: string; status: string; checkInDate: string; checkOutDate: string }

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function FacturacionPage() {
  return (
    <ModuleAccessGuard moduleKey="fiscalInvoicing" moduleName="Facturación">
      <FacturacionContent />
    </ModuleAccessGuard>
  )
}

function FacturacionContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [billable, setBillable] = useState<Billable[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [reservationId, setReservationId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerRif, setCustomerRif] = useState("")
  const [taxRate, setTaxRate] = useState("0")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/invoices", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setInvoices(data.invoices || [])
      setBillable(data.billable || [])
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

  async function createInvoice() {
    if (!reservationId) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reservationId, customerName: customerName.trim(), customerRif: customerRif.trim(), taxRate: Number(taxRate) / 100 || 0 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setCustomerName("")
      setCustomerRif("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const inputClass = "rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><FileText size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Facturación</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Factura desde el folio con número correlativo e impuesto.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para facturar, o el módulo está desactivado.
          </p>
        ) : (
          <>
            {billable.length > 0 && (
              <div className="mt-6 grid gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4 sm:grid-cols-2">
                <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} className={inputClass}>
                  <option value="">Estadía a facturar…</option>
                  {billable.map((b) => (
                    <option key={b.id} value={b.id}>{b.guestName} ({b.checkInDate}→{b.checkOutDate})</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold">
                  <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">IVA %</span>
                  <input type="number" min={0} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                </label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Razón social / nombre" className={inputClass} />
                <input value={customerRif} onChange={(e) => setCustomerRif(e.target.value)} placeholder="RIF / cédula" className={inputClass} />
                <button onClick={createInvoice} disabled={busy || !reservationId} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50 sm:col-span-2">
                  <Plus size={16} /> Emitir factura
                </button>
              </div>
            )}

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : invoices.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                Aún no hay facturas. Emite la primera desde una estadía con folio.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {invoices.map((inv) => (
                  <li key={inv.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[var(--brand-ink-3)]">Factura {inv.serie}-{String(inv.number).padStart(5, "0")}</p>
                        <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">
                          {inv.customerName || "Consumidor final"}{inv.customerRif ? ` · ${inv.customerRif}` : ""}
                        </p>
                        <p className="text-sm font-bold text-[var(--brand-ink-2)]/55">Subtotal ${inv.subtotal} · IVA ${inv.tax}</p>
                      </div>
                      <span className="text-2xl font-bold text-[var(--brand-ink-3)]">${inv.total}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <AccountingExports />
          </>
        )}
      </div>
    </main>
  )
}

// P1-B · Exportes contables: CSV para el contador (libro de ventas SENIAT,
// resumen de cierres del hotel y export total). El BOM UTF-8 lo pone downloadCsv.
function AccountingExports() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  async function download(type: string) {
    setBusy(type)
    setError("")
    try {
      const params = new URLSearchParams({ type })
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const res = await fetch(`/api/accounting-exports?${params.toString()}`, {
        headers: authHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo generar el exporte")
      if (!data.csv) throw new Error("El exporte llegó vacío")
      downloadCsv(String(data.filename || `${type}.csv`), String(data.csv))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy("")
    }
  }

  const btn =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--brand-primary)]/30 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
  const dateInput =
    "mt-1 block rounded-xl border border-[var(--brand-primary)]/25 bg-white px-3 py-2 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <div className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5">
      <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        <Download size={16} /> Exportes contables
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/60">
        CSV listos para tu contador (abren en Excel sin acentos rotos). El documento fiscal lo emite la máquina fiscal SENIAT; aquí entregas los datos. Tus datos son tuyos.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase text-[var(--brand-primary)]">
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
        </label>
        <label className="text-xs font-bold uppercase text-[var(--brand-primary)]">
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInput} />
        </label>
        <span className="pb-2 text-xs font-bold text-[var(--brand-ink-2)]/50">Vacío = todo el histórico</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={busy !== ""} onClick={() => download("sales-book")} className={btn}>
          {busy === "sales-book" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Libro de ventas (SENIAT)
        </button>
        <button type="button" disabled={busy !== ""} onClick={() => download("day-closes")} className={btn}>
          {busy === "day-closes" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Resumen de cierres
        </button>
        <button type="button" disabled={busy !== ""} onClick={() => download("full")} className={btn}>
          {busy === "full" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Export total (todo)
        </button>
      </div>
      {error && <p className="mt-3 font-bold text-red-600">{error}</p>}
    </div>
  )
}
