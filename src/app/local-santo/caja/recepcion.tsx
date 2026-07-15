"use client"

// CAJA DE RECEPCIÓN (submódulo hotel): cobros de estadías — folios de los
// huéspedes en casa, salidas del día con su saldo, depósitos por confirmar y
// lo cobrado hoy. El POS del restaurante vive en el otro submódulo.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  BedDouble,
  Check,
  ConciergeBell,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react"
import { formatUSD } from "@/utils/formatCurrency"
import { InputBox, MetricCard, ModalShell, SelectBox } from "./components"

// El método viaja como texto legible (así lo guarda el folio y así se lee en
// reportes); METHOD_LABELS traduce también los códigos de los depósitos.
const PAYMENT_METHOD_OPTIONS = ["Efectivo", "Tarjeta", "Pago móvil", "Zelle", "Transferencia", "Otro"]
const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  pago_movil: "Pago móvil",
  zelle: "Zelle",
  transferencia: "Transferencia",
  otro: "Otro",
}

type InHouseRow = {
  id: string
  code: string
  guestName: string
  roomName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmount: number
  folioId: string
  folioStatus: string
  balance: number
  charges: number
  payments: number
  departsToday: boolean
}
type ArrivalRow = {
  id: string
  code: string
  guestName: string
  roomName: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmount: number
  status: string
  source: string
}
type DepositRow = {
  id: string
  amount: number
  method: string
  reference: string
  createdAt: string
  guestName: string
  code: string
}
type Summary = {
  today: string
  inHouse: InHouseRow[]
  arrivals: ArrivalRow[]
  depositsPending: DepositRow[]
  totals: {
    inHouseCount: number
    balanceDue: number
    arrivalsCount: number
    departuresCount: number
    depositsPendingCount: number
    collectedToday: number
    collectedByMethod: { method: string; amount: number }[]
  }
}

export default function CajaRecepcion({ adminPassword }: { adminPassword: string }) {
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-password": adminPassword }),
    [adminPassword],
  )

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")

  // Modal de cobro al folio.
  const [paying, setPaying] = useState<InHouseRow | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Efectivo")
  const [note, setNote] = useState("")
  const [alsoCheckout, setAlsoCheckout] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch("/api/folios/summary", { headers, cache: "no-store" })
        if (res.status === 401 || res.status === 403) {
          setDenied(true)
          return
        }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "No se pudo cargar")
        setDenied(false)
        setSummary(data)
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Error")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [headers],
  )

  useEffect(() => {
    const timer = setTimeout(load, 0)
    const interval = window.setInterval(() => load(true), 10000)
    return () => {
      clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [load])

  function openPayment(row: InHouseRow) {
    setPaying(row)
    setAmount(row.balance > 0 ? String(row.balance) : "")
    setMethod("Efectivo")
    setNote("")
    setAlsoCheckout(row.departsToday)
    setError("")
    setOk("")
  }

  async function savePayment() {
    if (!paying) return
    const value = Number(amount) || 0
    if (value <= 0) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/folios", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "payment",
          folioId: paying.folioId,
          reservationId: paying.id,
          amount: value,
          method,
          description: note.trim() || `Cobro en recepción (${method})`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el cobro")

      let message = `Cobro de ${formatUSD(value)} registrado para ${paying.guestName}.`
      // Check-out opcional cuando el saldo quedó en cero.
      if (alsoCheckout) {
        const balanceAfter = Number(data.balance) || 0
        if (balanceAfter <= 0) {
          const closeRes = await fetch("/api/folios", {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "close",
              folioId: paying.folioId,
              reservationId: paying.id,
            }),
          })
          const closeData = await closeRes.json()
          if (closeRes.ok) {
            message += " Folio cerrado y check-out hecho."
          } else {
            message += ` (No se cerró el folio: ${closeData.error || "revisa el saldo"}.)`
          }
        } else {
          message += ` Queda saldo de ${formatUSD(balanceAfter)}; el folio sigue abierto.`
        }
      }
      setOk(message)
      setPaying(null)
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  // Huésped en casa SIN folio (check-in hecho desde reservas): lo abre aquí
  // mismo y publica el cargo de habitación, para poder cobrarle.
  async function openFolioFor(row: InHouseRow) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/folios", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "open", reservationId: row.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo abrir el folio")
      setOk(`Folio de ${row.guestName} abierto con su cargo de habitación.`)
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function setDepositStatus(deposit: DepositRow, status: "confirmado" | "rechazado") {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/reservation-payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "status", id: deposit.id, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el depósito")
      setOk(
        status === "confirmado"
          ? `Depósito de ${formatUSD(deposit.amount)} de ${deposit.guestName} confirmado.`
          : `Depósito de ${deposit.guestName} rechazado.`,
      )
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  if (denied) {
    return (
      <section className="mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-6 shadow-sm">
        <p className="font-bold text-[var(--brand-primary)]">
          Tu clave no tiene permiso para el folio de huéspedes (caja de recepción). Pide al
          dueño activarte el módulo <b>Folio</b> en Usuarios, o entra con la clave de gerencia.
        </p>
      </section>
    )
  }

  const totals = summary?.totals
  const departures = (summary?.inHouse || []).filter((r) => r.departsToday)
  const staying = (summary?.inHouse || []).filter((r) => !r.departsToday)

  return (
    <>
      {/* Métricas de recepción */}
      <section className="mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              <ConciergeBell size={16} /> Caja de recepción
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
              Cobros de estadías: folios de huéspedes en casa, salidas del día y depósitos.
              Los consumos del restaurante se cobran en el submódulo Restaurante.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <MetricCard label="En casa" value={totals?.inHouseCount ?? "—"} tone="soft" />
          <MetricCard
            label="Saldo por cobrar"
            value={totals ? formatUSD(totals.balanceDue) : "—"}
            tone={totals && totals.balanceDue > 0 ? "yellow" : "soft"}
          />
          <MetricCard label="Salidas hoy" value={totals?.departuresCount ?? "—"} tone={totals && totals.departuresCount > 0 ? "yellow" : "soft"} />
          <MetricCard label="Llegadas hoy" value={totals?.arrivalsCount ?? "—"} tone="soft" />
          <MetricCard label="Cobrado hoy" value={totals ? formatUSD(totals.collectedToday) : "—"} tone="soft" />
        </div>
        {totals && totals.collectedByMethod.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[var(--brand-ink-2)]/65">
            {totals.collectedByMethod.map((m) => (
              <span key={m.method}>
                {METHOD_LABELS[m.method] || m.method}: {formatUSD(m.amount)}
              </span>
            ))}
          </p>
        )}
      </section>

      {ok && (
        <p className="mt-3 rounded-2xl border border-green-600/35 bg-green-100 px-4 py-3 text-sm font-bold text-green-800">
          {ok}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-2xl border border-red-500/35 bg-red-100 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </p>
      )}

      {/* Salidas de hoy: lo primero que cobra recepción en la mañana */}
      {departures.length > 0 && (
        <section className="mt-4 rounded-[1.4rem] border border-yellow-400 bg-[var(--brand-accent-100)] p-4 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-amber)]">
            <LogOut size={16} /> Salidas de hoy · cobra y despide
          </p>
          <ul className="mt-3 space-y-2">
            {departures.map((r) => (
              <GuestRow key={r.id} row={r} onPay={() => openPayment(r)} onOpenFolio={() => openFolioFor(r)} highlight />
            ))}
          </ul>
        </section>
      )}

      {/* Huéspedes en casa */}
      <section className="mt-4 rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-4 shadow-sm">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          <BedDouble size={16} /> Huéspedes en casa
        </p>
        {loading && !summary ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </p>
        ) : staying.length === 0 && departures.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]/70">
            No hay huéspedes con check-in ahora mismo. Las llegadas de hoy aparecen abajo.
          </p>
        ) : staying.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/60">
            Todos los huéspedes en casa salen hoy (arriba).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {staying.map((r) => (
              <GuestRow key={r.id} row={r} onPay={() => openPayment(r)} onOpenFolio={() => openFolioFor(r)} />
            ))}
          </ul>
        )}
      </section>

      {/* Llegadas de hoy + depósitos por confirmar */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <LogIn size={16} /> Llegadas de hoy
          </p>
          {(summary?.arrivals || []).length === 0 ? (
            <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/60">
              No hay llegadas pendientes hoy.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(summary?.arrivals || []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--brand-ink-3)]">
                      {r.guestName} <span className="text-xs text-[var(--brand-ink-2)]/45">#{r.code}</span>
                    </p>
                    <p className="text-xs font-bold text-[var(--brand-ink-2)]/65">
                      {r.roomName || "Sin habitación asignada"} · {r.nights}n · {formatUSD(r.totalAmount)}
                      {r.source === "web" ? " · Web" : ""}
                    </p>
                  </div>
                  <a
                    href="/local-santo/folio"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
                  >
                    Check-in <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <Wallet size={16} /> Depósitos por confirmar
          </p>
          {(summary?.depositsPending || []).length === 0 ? (
            <p className="mt-3 text-sm font-bold text-[var(--brand-ink-2)]/60">
              No hay depósitos reportados por revisar.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(summary?.depositsPending || []).map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--brand-ink-3)]">
                      {formatUSD(d.amount)}{" "}
                      <span className="text-xs font-bold text-[var(--brand-ink-2)]/60">
                        {METHOD_LABELS[d.method] || d.method}
                      </span>
                    </p>
                    <p className="text-xs font-bold text-[var(--brand-ink-2)]/65">
                      {d.guestName}
                      {d.code ? ` #${d.code}` : ""}
                      {d.reference ? ` · Ref ${d.reference}` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDepositStatus(d, "confirmado")}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-full border border-green-600/30 bg-green-50 px-3 py-1.5 text-xs font-bold uppercase text-green-700 disabled:opacity-50"
                    >
                      <Check size={13} /> Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositStatus(d, "rechazado")}
                      disabled={busy}
                      title="Rechazar"
                      className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modal de cobro */}
      {paying && (
        <ModalShell
          title={`Cobrar a ${paying.guestName}`}
          onClose={() => {
            if (!busy) setPaying(null)
          }}
        >
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-[var(--brand-primary)]/25 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                {paying.roomName || "Sin habitación"} · #{paying.code} · {paying.checkInDate} → {paying.checkOutDate}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                Cargos {formatUSD(paying.charges)} · Abonado {formatUSD(paying.payments)} ·{" "}
                <b>Saldo {formatUSD(paying.balance)}</b>
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputBox label="Monto a cobrar $" value={amount} onChange={setAmount} placeholder="0.00" />
              <SelectBox
                label="Método"
                value={method}
                onChange={setMethod}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </div>
            <InputBox label="Nota (opcional)" value={note} onChange={setNote} placeholder="Referencia, autorización…" />
            <label className="flex items-center gap-2.5 rounded-2xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink-2)]">
              <input
                type="checkbox"
                checked={alsoCheckout}
                onChange={(e) => setAlsoCheckout(e.target.checked)}
                className="h-5 w-5 accent-[var(--brand-primary)]"
              />
              Hacer check-out al saldar (cierra el folio si el saldo queda en $0)
            </label>
            <button
              type="button"
              onClick={savePayment}
              disabled={busy || !(Number(amount) > 0)}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
              Registrar cobro
            </button>
          </div>
        </ModalShell>
      )}
    </>
  )
}

function GuestRow({
  row,
  onPay,
  onOpenFolio,
  highlight = false,
}: {
  row: InHouseRow
  onPay: () => void
  onOpenFolio: () => void
  highlight?: boolean
}) {
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 ${
        highlight ? "border-yellow-500/60 bg-white" : "border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/60"
      }`}
    >
      <div className="min-w-0">
        <p className="font-bold text-[var(--brand-ink-3)]">
          {row.guestName} <span className="text-xs text-[var(--brand-ink-2)]/45">#{row.code}</span>
        </p>
        <p className="text-xs font-bold text-[var(--brand-ink-2)]/65">
          {row.roomName || "Sin habitación"} · sale {row.checkOutDate}
          {row.folioStatus === "cerrado" ? " · folio cerrado" : ""}
        </p>
      </div>
      <span className="flex items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${
            row.balance > 0
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-green-600/30 bg-green-50 text-green-700"
          }`}
        >
          {row.balance > 0 ? `Debe ${formatUSD(row.balance)}` : "Al día"}
        </span>
        {!row.folioId ? (
          <button
            type="button"
            onClick={onOpenFolio}
            title="Crea el folio y publica el cargo de habitación"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-bold uppercase text-white transition hover:bg-[var(--brand-primary-dark)]"
          >
            Abrir folio
          </button>
        ) : (
          row.folioStatus !== "cerrado" && (
            <button
              type="button"
              onClick={onPay}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-bold uppercase text-white transition hover:bg-[var(--brand-primary-dark)]"
            >
              Cobrar
            </button>
          )
        )}
        <a
          href="/local-santo/folio"
          title="Abrir el folio completo"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-primary)]/40 bg-white px-3 py-1.5 text-xs font-bold uppercase text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
        >
          Folio <ExternalLink size={12} />
        </a>
      </span>
    </li>
  )
}
