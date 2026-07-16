"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  Send,
  Wallet,
  XCircle,
} from "lucide-react"
import PaymentMethodDetailsList from "@/components/PaymentMethodDetailsList"

// Sección "Abona tu reserva" (P1-A · cobro online): se muestra en la
// confirmación de /hotel/reservar y en /hotel/mi-reserva. El huésped ve cuánto
// le falta, paga con los datos del hotel y REPORTA su abono (con captura
// opcional). Cae como depósito por confirmar en Caja recepción.

type PublicReservationPayment = {
  createdAt: string
  method: string
  amount: number
  reference: string
  status: string
}

type PayInfo = {
  reservation: {
    code: string
    guestName: string
    totalAmount: number
    status: string
    statusLabel: string
  }
  methods: string[]
  methodDetails: Record<string, string>
  summary: {
    paidConfirmed: number
    paidReported: number
    balance: number
    pendingBalance: number
  }
  payments: PublicReservationPayment[]
}

const CLOSED_STATUSES = new Set(["cancelada", "no_show"])

function money(value: number) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100
  return `$${rounded.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDateTime(value: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(date)
}

function statusChip(status: string) {
  if (status === "confirmado") {
    return {
      label: "Confirmado",
      classes: "border-green-600/50 bg-green-600/10 text-green-700",
      icon: <BadgeCheck size={13} />,
    }
  }
  if (status === "rechazado") {
    return {
      label: "Rechazado",
      classes: "border-red-500/50 bg-red-500/10 text-red-600",
      icon: <XCircle size={13} />,
    }
  }
  return {
    label: "En revisión",
    classes: "border-amber-500/50 bg-amber-500/10 text-amber-700",
    icon: <Clock3 size={13} />,
  }
}

export default function ReservationPaymentSection({
  code,
  phone,
  totalAmount,
}: {
  code: string
  phone: string
  totalAmount?: number
}) {
  const [info, setInfo] = useState<PayInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [method, setMethod] = useState("")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [dataUrl, setDataUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [mimeType, setMimeType] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadInfo = useCallback(async () => {
    if (!code.trim() || phone.trim().length < 4) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/public/hotel/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "info", code: code.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) setInfo(data as PayInfo)
    } catch {
      // Sin datos de pago, la página sigue funcionando igual.
    } finally {
      setLoading(false)
    }
  }, [code, phone])

  useEffect(() => {
    const timer = setTimeout(() => void loadInfo(), 0)
    return () => clearTimeout(timer)
  }, [loadInfo])

  function handleFile(file: File | undefined) {
    setError("")
    if (!file) {
      setDataUrl("")
      setFileName("")
      setMimeType("")
      return
    }
    if (!file.type.startsWith("image/")) {
      setError("El comprobante debe ser una imagen (captura o foto).")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen pesa más de 5 MB. Usa una captura más liviana.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      if (!result.startsWith("data:image/")) {
        setError("No se pudo leer la imagen del comprobante.")
        return
      }
      setDataUrl(result)
      setFileName(file.name || "comprobante.jpg")
      setMimeType(file.type || "image/jpeg")
    }
    reader.onerror = () => setError("No se pudo leer la imagen del comprobante.")
    reader.readAsDataURL(file)
  }

  function openForm() {
    setSuccess("")
    setError("")
    if (!amount && info && info.summary.balance > 0) {
      setAmount(info.summary.balance.toFixed(2))
    }
    setFormOpen(true)
  }

  async function submit() {
    const value = Math.round((Number(amount.replace(",", ".")) || 0) * 100) / 100
    if (!(value > 0)) {
      setError("Indica el monto que abonaste (en $).")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/public/hotel/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          code: code.trim(),
          phone: phone.trim(),
          method,
          amount: value,
          reference: reference.trim(),
          note: note.trim(),
          dataUrl,
          fileName,
          mimeType,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo reportar el pago")
      setSuccess("¡Abono reportado! Recepción lo confirmará y aquí verás el estado.")
      setFormOpen(false)
      setMethod("")
      setAmount("")
      setReference("")
      setNote("")
      setDataUrl("")
      setFileName("")
      setMimeType("")
      await loadInfo()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reportar el pago")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !info) return null
  if (CLOSED_STATUSES.has(String(info.reservation.status || ""))) return null

  const total = info.reservation.totalAmount || totalAmount || 0
  const { balance, paidConfirmed, paidReported } = info.summary
  const fullyPaid = total > 0 && balance <= 0
  const hasMethods = Object.keys(info.methodDetails).length > 0

  const labelClass =
    "text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]"
  const inputClass =
    "mt-1.5 w-full rounded-xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <div className="mt-4 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-white p-5 text-left">
      <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary-dark)]">
        <Wallet size={16} /> Abona tu reserva
      </p>

      {/* Resumen del saldo */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {total > 0 && (
          <span className="text-sm font-bold text-[var(--brand-ink-2)]">
            Total <span className="text-[var(--brand-ink-3)]">{money(total)}</span>
          </span>
        )}
        {paidConfirmed > 0 && (
          <span className="text-sm font-bold text-green-700">Abonado {money(paidConfirmed)}</span>
        )}
        {paidReported > 0 && (
          <span className="text-sm font-bold text-amber-700">En revisión {money(paidReported)}</span>
        )}
        {total > 0 && (
          <span className="text-sm font-black text-[var(--brand-ink-3)]">
            {balance > 0 ? `Faltan ${money(balance)}` : "Reserva pagada"}
          </span>
        )}
      </div>

      {fullyPaid && (
        <p className="mt-3 inline-flex w-full items-center gap-2 rounded-xl border-2 border-green-600/40 bg-green-600/10 px-4 py-3 text-sm font-bold text-green-700">
          <CheckCircle2 size={17} className="shrink-0" /> Tu reserva está pagada. ¡Gracias!
        </p>
      )}

      {/* Paso 1: datos para pagar */}
      {!fullyPaid && hasMethods && (
        <div className="mt-4 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)]/50 px-4 py-3">
          <p className={labelClass}>Paga con estos datos</p>
          <div className="mt-2">
            <PaymentMethodDetailsList details={info.methodDetails} />
          </div>
        </div>
      )}

      {/* Abonos ya reportados */}
      {info.payments.length > 0 && (
        <ul className="mt-4 space-y-2">
          {info.payments.map((payment, index) => {
            const chip = statusChip(payment.status)
            return (
              <li
                key={`${payment.createdAt}-${index}`}
                className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/40 px-4 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] ${chip.classes}`}
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                  <span className="text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-black text-[var(--brand-ink-3)]">
                  {money(payment.amount)}
                  {payment.method ? ` · ${payment.method}` : ""}
                </p>
                {payment.reference ? (
                  <p className="text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    Ref: {payment.reference}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {success && (
        <p className="mt-3 rounded-xl border-2 border-green-600/40 bg-green-600/10 px-4 py-3 text-sm font-bold text-green-700">
          {success}
        </p>
      )}

      {/* Paso 2: reportar el abono */}
      {!formOpen && !fullyPaid && (
        <button
          type="button"
          onClick={openForm}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:opacity-90"
        >
          <ImagePlus size={16} /> Reportar mi abono
        </button>
      )}

      {formOpen && (
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelClass}>¿Cómo pagaste?</label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona el método</option>
              {info.methods.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Monto abonado ($)</label>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Referencia (opcional)</label>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Últimos dígitos de la operación"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Captura del pago (opcional)</label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--brand-primary)]/30 bg-[var(--brand-cream)]/40 px-4 py-3.5 text-sm font-bold text-[var(--brand-ink-2)]/70 transition hover:border-[var(--brand-primary)]">
              <ImagePlus size={17} />
              {fileName || "Toca para adjuntar la imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </div>

          {error && (
            <p className="rounded-xl border-2 border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Reportar abono
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setFormOpen(false)
                setError("")
              }}
              className="rounded-xl border-2 border-[var(--brand-primary)]/25 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!hasMethods && !fullyPaid && !formOpen && (
        <p className="mt-2 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/55">
          Coordina el pago con el hotel y reporta aquí tu abono con la referencia.
        </p>
      )}
    </div>
  )
}
