"use client"

// Botonera de avisos WhatsApp DENTRO de los módulos de reservas: confirmación,
// recordatorio y post-estadía sin saltar al módulo Notificaciones. Abre wa.me
// con el mensaje listo y registra el envío en /api/notifications (para el ✓).

import { useMemo, useState } from "react"
import { Check, MessageCircle } from "lucide-react"
import { BRAND } from "@/lib/brand"
import { buildMessage, whatsappUrl, type NotificationKind } from "@/lib/hotelNotifications"

export type NotifiableReservation = {
  id: string
  guestName: string
  guestPhone: string
  code: string
  checkInDate: string
  checkOutDate: string
  nights?: number
  totalAmount?: number
  status: string
}

const KINDS: { key: NotificationKind; label: string }[] = [
  { key: "confirmacion", label: "Confirmación" },
  { key: "recordatorio", label: "Recordatorio" },
  { key: "post", label: "Post-estadía" },
]

/** Aviso sugerido según el momento de la estadía. */
function suggestedKind(reservation: NotifiableReservation): NotificationKind {
  if (reservation.status === "checkout") return "post"
  if (reservation.status === "checkin") return "recordatorio"
  return "confirmacion"
}

export function reservationNotifyKey(reservationId: string, kind: string) {
  return `${reservationId}:${kind}`
}

export default function ReservationNotifyButtons({
  reservation,
  sentKeys,
  authHeaders,
  onLogged,
  onError,
}: {
  reservation: NotifiableReservation
  /** Claves `${reservationId}:${kind}` ya enviadas (del log de notificaciones). */
  sentKeys: Set<string>
  authHeaders: () => HeadersInit
  /** Se llama tras registrar el envío (para refrescar el log). */
  onLogged?: () => void
  onError?: (message: string) => void
}) {
  const [busyKind, setBusyKind] = useState<NotificationKind | null>(null)
  const suggested = useMemo(() => suggestedKind(reservation), [reservation])
  const hasPhone = whatsappUrl(reservation.guestPhone, "x") !== ""

  function send(kind: NotificationKind) {
    const message = buildMessage(kind, reservation, BRAND.name)
    const url = whatsappUrl(reservation.guestPhone, message)
    if (!url) {
      onError?.(`${reservation.guestName} no tiene un teléfono válido para WhatsApp.`)
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
    // Registro best-effort: si falla, el WhatsApp ya salió igual.
    setBusyKind(kind)
    fetch("/api/notifications", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reservationId: reservation.id, kind }),
    })
      .then(() => onLogged?.())
      .catch(() => {})
      .finally(() => setBusyKind(null))
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-green-700">
        <MessageCircle size={12} /> Avisos
      </span>
      {KINDS.map((kind) => {
        const sent = sentKeys.has(reservationNotifyKey(reservation.id, kind.key))
        const isSuggested = kind.key === suggested
        return (
          <button
            key={kind.key}
            type="button"
            onClick={() => send(kind.key)}
            disabled={!hasPhone || busyKind !== null}
            title={
              !hasPhone
                ? "Sin teléfono válido"
                : sent
                  ? `${kind.label} ya enviado (puedes reenviar)`
                  : `Enviar ${kind.label.toLowerCase()} por WhatsApp`
            }
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              sent
                ? "border-green-600/30 bg-green-50 text-green-700"
                : isSuggested
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                  : "border-[var(--brand-primary)]/25 bg-white text-[var(--brand-ink-2)]/75 hover:bg-[var(--brand-cream)]"
            }`}
          >
            {sent && <Check size={11} />}
            {kind.label}
          </button>
        )
      })}
    </span>
  )
}
