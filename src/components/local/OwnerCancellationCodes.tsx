"use client"

import { useEffect, useState } from "react"
import { KeyRound, ShieldAlert } from "lucide-react"

// Códigos de anulación — SOLO en el panel del dueño. Cuando un trabajador
// pide anular un pedido (con la aprobación por código activada), el código
// de un solo uso aparece aquí (además del push/WhatsApp): el dueño lo dicta
// al trabajador si está de acuerdo.

type CancellationRequestView = {
  id: string
  orderId: string
  displayNumber: string
  reason: string
  requestedBy: string
  code: string
  status: string
  createdAt: string
}

function formatAge(createdAt: string) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ""
  const minutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60_000))
  if (minutes < 1) return "hace segundos"
  if (minutes < 60) return `hace ${minutes} min`
  return `hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export default function OwnerCancellationCodes({
  adminPassword,
}: {
  adminPassword: string
}) {
  const [requests, setRequests] = useState<CancellationRequestView[]>([])

  useEffect(() => {
    if (!adminPassword) return

    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/cancellation-requests", {
          headers: { "x-admin-password": adminPassword },
          cache: "no-store",
        })
        const data = await response.json().catch(() => ({}))
        if (cancelled || !response.ok || data.ok !== true) return
        setRequests(Array.isArray(data.requests) ? data.requests : [])
      } catch {
        // Sin datos la tarjeta simplemente no aparece.
      }
    }

    load()
    // Sondeo suave: los códigos nuevos aparecen sin recargar el panel.
    const timer = window.setInterval(load, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [adminPassword])

  const pending = requests.filter((request) => request.status === "pending")
  const recent = requests.filter((request) => request.status !== "pending").slice(0, 3)

  if (pending.length === 0 && recent.length === 0) return null

  return (
    <section className="mt-4 rounded-[1.6rem] border-2 border-red-500 bg-white p-4 shadow-[0_8px_0_rgba(220,38,38,0.12)]">
      <h2 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-red-600">
        <ShieldAlert size={17} />
        Códigos de anulación (solo tú los ves)
      </h2>

      {pending.length > 0 ? (
        <div className="mt-3 space-y-2">
          {pending.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border-2 border-red-500/40 bg-red-50 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-red-900">
                    Pedido {request.displayNumber || request.orderId}
                    <span className="ml-2 text-[0.7rem] font-bold text-red-900/60">
                      {formatAge(request.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-[0.78rem] font-bold leading-4 text-red-900/75">
                    Motivo: {request.reason}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] font-bold text-red-900/55">
                    Solicitado por: {request.requestedBy || "Personal"}
                  </p>
                </div>
                <p className="inline-flex items-center gap-2 rounded-2xl border-2 border-red-600 bg-white px-4 py-2 text-2xl font-black tracking-[0.2em] text-red-600">
                  <KeyRound size={20} />
                  {request.code}
                </p>
              </div>
              <p className="mt-2 text-[0.7rem] font-bold leading-4 text-red-900/60">
                Si estás de acuerdo con anular, dile este código al trabajador.
                Si NO, simplemente no lo compartas (vence solo en 2 horas).
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="mt-3 space-y-1">
          {recent.map((request) => (
            <p
              key={request.id}
              className="text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/60"
            >
              {request.status === "used" ? "✓ Usado" : "· Vencido"} — Pedido{" "}
              {request.displayNumber || request.orderId} ({request.reason}) ·{" "}
              {formatAge(request.createdAt)}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
