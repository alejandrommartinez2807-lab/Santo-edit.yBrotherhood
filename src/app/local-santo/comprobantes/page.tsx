"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { formatUSD, formatVES } from "@/utils/formatCurrency"

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session"

type PaymentProofStatus =
  | "Comprobante enviado"
  | "En revisión"
  | "Confirmado por caja"
  | "Rechazado"
  | "Necesita corrección"

type PaymentProof = {
  id: string
  orderId: string
  createdAt: string
  customerName: string
  customerPhone: string
  orderType: string
  orderTotalUSD: number
  reportedMethod: string
  amountReportedUSD: number
  amountReportedVES: number
  paymentReference: string
  customerNote: string
  proofImageUrl: string
  proofFileId: string
  proofFileName: string
  status: PaymentProofStatus
  reviewedBy: string
  reviewedAt: string
  internalNote: string
}

type ApiResponse = {
  ok?: boolean
  error?: string
  paymentProofs?: PaymentProof[]
  paymentProof?: PaymentProof
}

type StatusFilter = PaymentProofStatus | "Todos"

const STATUS_OPTIONS: PaymentProofStatus[] = [
  "Comprobante enviado",
  "En revisión",
  "Confirmado por caja",
  "Rechazado",
  "Necesita corrección",
]

function readStoredPassword() {
  if (typeof window === "undefined") return ""

  try {
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

async function readApiResponse(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text) as ApiResponse
  } catch {
    throw new Error(
      "El servidor respondió con una página HTML en vez de datos. Revisa la API de comprobantes."
    )
  }
}

function formatDateTime(value: string) {
  if (!value) return "Sin fecha"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function statusClasses(status: PaymentProofStatus) {
  if (status === "Confirmado por caja") {
    return "border-emerald-600 bg-emerald-100 text-emerald-800"
  }

  if (status === "Rechazado") {
    return "border-red-600 bg-red-100 text-red-800"
  }

  if (status === "Necesita corrección") {
    return "border-orange-500 bg-orange-100 text-orange-800"
  }

  if (status === "En revisión") {
    return "border-blue-600 bg-blue-100 text-blue-800"
  }

  return "border-[var(--brand-primary)] bg-[var(--brand-accent-100)] text-[var(--brand-primary)]"
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getPendingCount(proofs: PaymentProof[]) {
  return proofs.filter(
    (proof) =>
      proof.status === "Comprobante enviado" || proof.status === "En revisión"
  ).length
}

function getConfirmedCount(proofs: PaymentProof[]) {
  return proofs.filter((proof) => proof.status === "Confirmado por caja").length
}

function getRejectedCount(proofs: PaymentProof[]) {
  return proofs.filter(
    (proof) => proof.status === "Rechazado" || proof.status === "Necesita corrección"
  ).length
}

export default function PaymentProofsPage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReviewingId, setIsReviewingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos")
  const [notesByProofId, setNotesByProofId] = useState<Record<string, string>>({})

  async function loadProofs(silent = false) {
    if (!silent) {
      setIsLoading(true)
    }

    setError(null)
    setMessage(null)

    try {
      const password = readStoredPassword()
      const response = await fetch("/api/payment-proofs", {
        method: "GET",
        headers: {
          "x-admin-password": password,
        },
        cache: "no-store",
      })
      const data = await readApiResponse(response)

      if (!response.ok || data.error) {
        throw new Error(data.error || "No se pudieron cargar los comprobantes")
      }

      setProofs(Array.isArray(data.paymentProofs) ? data.paymentProofs : [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los comprobantes"
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProofs()
  }, [])

  const filteredProofs = useMemo(() => {
    const cleanQuery = normalizeSearch(query)

    return proofs.filter((proof) => {
      if (statusFilter !== "Todos" && proof.status !== statusFilter) return false

      if (!cleanQuery) return true

      const searchableText = normalizeSearch(
        [
          proof.id,
          proof.orderId,
          proof.customerName,
          proof.customerPhone,
          proof.reportedMethod,
          proof.paymentReference,
          proof.customerNote,
          proof.internalNote,
          proof.status,
        ].join(" ")
      )

      return searchableText.includes(cleanQuery)
    })
  }, [proofs, query, statusFilter])

  async function reviewProof(proof: PaymentProof, status: PaymentProofStatus) {
    setIsReviewingId(proof.id)
    setError(null)
    setMessage(null)

    try {
      const password = readStoredPassword()
      const response = await fetch(`/api/payment-proofs/${encodeURIComponent(proof.id)}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        cache: "no-store",
        body: JSON.stringify({
          status,
          internalNote: notesByProofId[proof.id] || "",
        }),
      })
      const data = await readApiResponse(response)

      if (!response.ok || data.error || !data.paymentProof) {
        throw new Error(data.error || "No se pudo revisar el comprobante")
      }

      const updatedProof = data.paymentProof

      setProofs((currentProofs) =>
        currentProofs.map((currentProof) =>
          currentProof.id === updatedProof.id ? updatedProof : currentProof
        )
      )
      setMessage(
        status === "Confirmado por caja"
          ? "Comprobante marcado como confirmado. Recuerda registrar el cobro real en Caja."
          : "Comprobante actualizado correctamente."
      )
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "No se pudo revisar el comprobante"
      )
    } finally {
      setIsReviewingId(null)
    }
  }

  return (
    <ModuleAccessGuard moduleKey="paymentProofs" moduleName="Comprobantes">
      <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-6 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="overflow-hidden rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.14)]">
            <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:30px_30px] bg-[position:0_0,0_15px,15px_-15px,0] bg-[var(--brand-cream)]" />

            <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-7">
              <div>
                <a
                  href="/local-santo"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  <ArrowLeft size={16} />
                  Volver al panel
                </a>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                  Revisión de pagos reportados
                </p>
                <h1 className="mt-2 text-4xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  Comprobantes
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Aquí caja y dueño revisan capturas enviadas por clientes. Confirmar un comprobante no cambia el pedido a pagado: el cobro real se sigue registrando desde Caja para que el cierre no se descuadre.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadProofs()}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:bg-[var(--brand-accent-200)] active:translate-y-1 active:shadow-none"
              >
                {isLoading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
                Actualizar
              </button>
            </div>
          </header>

          <section className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Por revisar</p>
              <p className="mt-2 text-4xl font-black text-[var(--brand-ink)]">{getPendingCount(proofs)}</p>
            </div>
            <div className="rounded-[1.5rem] border-2 border-emerald-600 bg-emerald-50 p-4 shadow-[0_6px_0_rgba(16,185,129,0.12)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Confirmados</p>
              <p className="mt-2 text-4xl font-black text-emerald-800">{getConfirmedCount(proofs)}</p>
            </div>
            <div className="rounded-[1.5rem] border-2 border-orange-500 bg-orange-50 p-4 shadow-[0_6px_0_rgba(249,115,22,0.12)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Observados</p>
              <p className="mt-2 text-4xl font-black text-orange-800">{getRejectedCount(proofs)}</p>
            </div>
          </section>

          <section className="sticky top-0 z-20 mt-5 rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]" size={18} />
                <input
                  value={query}
                  onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
                  placeholder="Buscar por pedido, cliente, teléfono, referencia o estado"
                  className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] py-4 pl-12 pr-4 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event: { target: { value: string } }) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-4 text-sm font-black text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="Todos">Todos los estados</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </section>

          {message ? (
            <div className="mt-5 rounded-2xl border-2 border-emerald-600 bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-800">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border-2 border-red-600 bg-red-100 px-4 py-3 text-sm font-black text-red-800">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <section className="mt-5 flex min-h-72 items-center justify-center rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white p-8 text-[var(--brand-primary)] shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <Loader2 className="animate-spin" size={34} />
            </section>
          ) : filteredProofs.length === 0 ? (
            <section className="mt-5 rounded-[2rem] border-2 border-[var(--brand-primary)] bg-white p-8 text-center shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]">
              <UploadCloud className="mx-auto text-[var(--brand-primary)]" size={44} />
              <h2 className="mt-4 text-2xl font-black uppercase text-[var(--brand-primary)]">Sin comprobantes</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Cuando un cliente reporte un pago, aparecerá aquí para revisión. El pago real se confirma después desde Caja.
              </p>
            </section>
          ) : (
            <section className="mt-5 grid gap-4">
              {filteredProofs.map((proof) => {
                const isReviewing = isReviewingId === proof.id

                return (
                  <article
                    key={proof.id}
                    className="overflow-hidden rounded-[1.8rem] border-2 border-[var(--brand-primary)] bg-white shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]"
                  >
                    <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                      <div className="border-b-2 border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] p-4 lg:border-b-0 lg:border-r-2">
                        {proof.proofImageUrl ? (
                          <a href={proof.proofImageUrl} target="_blank" rel="noreferrer" className="group block">
                            <img
                              src={proof.proofImageUrl}
                              alt={`Comprobante ${proof.id}`}
                              className="h-72 w-full rounded-[1.25rem] border-2 border-[var(--brand-primary)]/25 object-cover transition group-hover:scale-[1.01]"
                            />
                            <span className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase text-[var(--brand-primary)]">
                              <Eye size={15} />
                              Ver captura
                            </span>
                          </a>
                        ) : (
                          <div className="flex h-72 items-center justify-center rounded-[1.25rem] border-2 border-dashed border-[var(--brand-primary)]/30 bg-white text-center text-sm font-black text-[var(--brand-primary)]/60">
                            Sin imagen
                          </div>
                        )}
                      </div>

                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border-2 px-3 py-1 text-[0.68rem] font-black uppercase ${statusClasses(proof.status)}`}>
                                {proof.status}
                              </span>
                              <span className="rounded-full border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-3 py-1 text-[0.68rem] font-black uppercase text-[var(--brand-ink)]">
                                {proof.id}
                              </span>
                            </div>
                            <h2 className="mt-3 text-2xl font-black uppercase text-[var(--brand-primary)]">
                              Pedido {proof.orderId}
                            </h2>
                            <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/70">
                              {proof.customerName || "Cliente sin nombre"} · {proof.customerPhone || "Sin teléfono"}
                            </p>
                          </div>

                          <div className="rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3 text-sm font-black text-[var(--brand-ink)]">
                            <p>Total pedido: {formatUSD(Number(proof.orderTotalUSD || 0))}</p>
                            <p>Reportó: {formatUSD(Number(proof.amountReportedUSD || 0))}</p>
                            <p>Bs reportados: {formatVES(Number(proof.amountReportedVES || 0))}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Fecha</p>
                            <p className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{formatDateTime(proof.createdAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Método</p>
                            <p className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{proof.reportedMethod || "Sin método"}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Referencia</p>
                            <p className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{proof.paymentReference || "Sin referencia"}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Pedido</p>
                            <p className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{proof.orderType || "Sin tipo"}</p>
                          </div>
                        </div>

                        {proof.customerNote ? (
                          <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)] px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Nota del cliente</p>
                            <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink)]">{proof.customerNote}</p>
                          </div>
                        ) : null}

                        {proof.reviewedAt ? (
                          <div className="mt-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white px-4 py-3">
                            <p className="text-[0.65rem] font-black uppercase text-[var(--brand-primary)]">Última revisión</p>
                            <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink)]">
                              {proof.reviewedBy || "Caja"} · {formatDateTime(proof.reviewedAt)}
                              {proof.internalNote ? ` · ${proof.internalNote}` : ""}
                            </p>
                          </div>
                        ) : null}

                        <label className="mt-4 block">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">Nota interna para esta revisión</span>
                          <textarea
                            value={notesByProofId[proof.id] || ""}
                            onChange={(event: { target: { value: string } }) =>
                              setNotesByProofId((current) => ({
                                ...current,
                                [proof.id]: event.target.value,
                              }))
                            }
                            placeholder="Ejemplo: referencia confirmada, monto incompleto, captura borrosa..."
                            className="mt-2 min-h-20 w-full resize-none rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                          />
                        </label>

                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => reviewProof(proof, "En revisión")}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-blue-700 bg-blue-100 px-4 py-3 text-xs font-black uppercase text-blue-800 transition hover:bg-blue-200 disabled:opacity-60"
                          >
                            {isReviewing ? <Loader2 className="animate-spin" size={15} /> : <Clock size={15} />}
                            En revisión
                          </button>
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => reviewProof(proof, "Confirmado por caja")}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-emerald-700 bg-emerald-100 px-4 py-3 text-xs font-black uppercase text-emerald-800 transition hover:bg-emerald-200 disabled:opacity-60"
                          >
                            {isReviewing ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                            Confirmar
                          </button>
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => reviewProof(proof, "Necesita corrección")}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-orange-600 bg-orange-100 px-4 py-3 text-xs font-black uppercase text-orange-800 transition hover:bg-orange-200 disabled:opacity-60"
                          >
                            {isReviewing ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                            Corregir
                          </button>
                          <button
                            type="button"
                            disabled={isReviewing}
                            onClick={() => reviewProof(proof, "Rechazado")}
                            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-red-700 bg-red-100 px-4 py-3 text-xs font-black uppercase text-red-800 transition hover:bg-red-200 disabled:opacity-60"
                          >
                            {isReviewing ? <Loader2 className="animate-spin" size={15} /> : <XCircle size={15} />}
                            Rechazar
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </div>
      </main>
    </ModuleAccessGuard>
  )
}
