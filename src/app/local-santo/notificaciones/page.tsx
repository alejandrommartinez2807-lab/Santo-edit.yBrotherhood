"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, Loader2, MessageCircle } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import { BRAND } from "@/lib/brand"
import { buildMessage, whatsappUrl, type NotificationKind } from "@/lib/hotelNotifications"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Reservation = {
  id: string
  guestName: string
  guestPhone: string
  code: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmount: number
  status: string
}
type LogEntry = { id: string; reservationId: string; kind: string }

const KINDS: { key: NotificationKind; label: string }[] = [
  { key: "confirmacion", label: "Confirmación" },
  { key: "recordatorio", label: "Recordatorio" },
  { key: "post", label: "Post-estadía" },
]

function authHeaders(): HeadersInit {
  const password = typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function NotificacionesPage() {
  return (
    <ModuleAccessGuard moduleKey="guestNotifications" moduleName="Notificaciones">
      <NotificacionesContent />
    </ModuleAccessGuard>
  )
}

function NotificacionesContent() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [kind, setKind] = useState<NotificationKind>("confirmacion")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/notifications", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) { setDenied(true); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setReservations(data.reservations || [])
      setLog(data.log || [])
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

  const sentKeys = useMemo(() => new Set(log.map((l) => `${l.reservationId}:${l.kind}`)), [log])

  function sendWhatsApp(r: Reservation) {
    const message = buildMessage(kind, r, BRAND.name)
    const url = whatsappUrl(r.guestPhone, message)
    if (!url) {
      setError(`${r.guestName} no tiene un teléfono válido.`)
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
    // Registra el envío (best-effort).
    fetch("/api/notifications", { method: "POST", headers: authHeaders(), body: JSON.stringify({ reservationId: r.id, kind }) })
      .then(() => load())
      .catch(() => {})
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]"><Bell size={24} /></span>
          <div>
            <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Notificaciones</h1>
            <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Envía el aviso por WhatsApp con el mensaje ya listo.</p>
          </div>
        </div>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para notificaciones, o el módulo está desactivado.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button key={k.key} onClick={() => setKind(k.key)} className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${kind === k.key ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-primary)]"}`}>
                  {k.label}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 font-bold text-red-600">{error}</p>}

            {loading ? (
              <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
            ) : reservations.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-white p-5 font-bold text-[var(--brand-ink-2)]/60">
                No hay reservas próximas.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {reservations.map((r) => {
                  const sent = sentKeys.has(`${r.id}:${kind}`)
                  return (
                    <li key={r.id} className="rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--brand-ink-3)]">{r.guestName} <span className="text-sm text-[var(--brand-ink-2)]/45">#{r.code}</span></p>
                          <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">{r.checkInDate} → {r.checkOutDate} · {r.guestPhone || "sin teléfono"}</p>
                        </div>
                        <button onClick={() => sendWhatsApp(r)} className="inline-flex items-center gap-1 rounded-full bg-green-600 px-4 py-2 text-xs font-bold uppercase text-white">
                          <MessageCircle size={14} /> {sent ? "Reenviar" : "WhatsApp"}
                        </button>
                      </div>
                      {sent && <p className="mt-1 text-xs font-bold text-green-700">Ya enviado ({KINDS.find((k) => k.key === kind)?.label})</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
