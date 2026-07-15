// ============================================================
// CAJA DE RECEPCIÓN · cobros de un día (server)
//
// Junta TODO lo cobrado por recepción en una fecha (hora Caracas):
//   · pagos registrados en folios (cobros de estadía), y
//   · depósitos de reserva CONFIRMADOS ese día.
// Devuelve total, desglose por método y el detalle fila por fila (hora,
// huésped, método, monto, quién lo registró) para la caja y el cierre de día.
// ============================================================

import {
  getFolioItemsInRange,
  getFoliosByIds,
  getHotelReservations,
  getReservationPayments,
} from "@/lib/orders"

const DAY_MS = 24 * 60 * 60 * 1000

export type ReceptionCashRow = {
  /** ISO completo del registro (para ordenar) */
  createdAt: string
  /** Hora local legible (Caracas), p. ej. "14:35" */
  time: string
  guestName: string
  code: string
  method: string
  amount: number
  /** "folio" = cobro de estadía · "deposito" = anticipo confirmado */
  kind: "folio" | "deposito"
  registeredBy: string
  description: string
}

export type ReceptionCashDay = {
  date: string
  total: number
  folioTotal: number
  depositsTotal: number
  byMethod: { method: string; amount: number }[]
  rows: ReceptionCashRow[]
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function caracasTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Caracas",
    }).format(new Date(iso))
  } catch {
    return ""
  }
}

function caracasDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso))
  } catch {
    return String(iso || "").slice(0, 10)
  }
}

export async function getReceptionCashForDate(
  date: string,
  branchId?: string | null,
): Promise<ReceptionCashDay> {
  const nextDay = new Date(new Date(`${date}T00:00:00Z`).getTime() + DAY_MS)
    .toISOString()
    .slice(0, 10)

  // Reservas alrededor de la fecha, para ponerle nombre a cada cobro.
  const windowFrom = new Date(new Date(`${date}T00:00:00Z`).getTime() - 90 * DAY_MS)
    .toISOString()
    .slice(0, 10)
  const windowTo = new Date(new Date(`${date}T00:00:00Z`).getTime() + 30 * DAY_MS)
    .toISOString()
    .slice(0, 10)

  const [folioItems, payments, reservations] = await Promise.all([
    getFolioItemsInRange({ from: date, to: nextDay }, branchId).catch(() => []),
    getReservationPayments({}, branchId).catch(() => []),
    getHotelReservations({ from: windowFrom, to: windowTo }, branchId).catch(() => []),
  ])

  const reservationById = new Map(reservations.map((r) => [r.id, r]))

  // folio → reserva (una consulta con todos los ids, sin N+1).
  const folioPayments = folioItems.filter((item) => item.kind === "pago")
  const folios = await getFoliosByIds(
    folioPayments.map((item) => item.folioId),
    branchId,
  ).catch(() => [])
  const folioById = new Map(folios.map((f) => [f.id, f]))

  const rows: ReceptionCashRow[] = []
  let folioTotal = 0
  let depositsTotal = 0
  const byMethod = new Map<string, number>()

  for (const item of folioPayments) {
    const folio = folioById.get(item.folioId)
    const reservation = folio ? reservationById.get(folio.reservationId) : undefined
    folioTotal += item.amount
    const method = item.method || "otro"
    byMethod.set(method, (byMethod.get(method) || 0) + item.amount)
    rows.push({
      createdAt: item.createdAt,
      time: caracasTime(item.createdAt),
      guestName: reservation?.guestName || "Huésped",
      code: reservation?.code || "",
      method,
      amount: round2(item.amount),
      kind: "folio",
      registeredBy: item.createdBy,
      description: item.description,
    })
  }

  for (const payment of payments) {
    if (payment.status !== "confirmado") continue
    if (caracasDay(payment.createdAt) !== date) continue
    const reservation = reservationById.get(payment.reservationId)
    depositsTotal += payment.amount
    const method = payment.method || "otro"
    byMethod.set(method, (byMethod.get(method) || 0) + payment.amount)
    rows.push({
      createdAt: payment.createdAt,
      time: caracasTime(payment.createdAt),
      guestName: reservation?.guestName || "Reserva",
      code: reservation?.code || "",
      method,
      amount: round2(payment.amount),
      kind: "deposito",
      registeredBy: "",
      description: payment.reference ? `Depósito · Ref ${payment.reference}` : "Depósito de reserva",
    })
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return {
    date,
    total: round2(folioTotal + depositsTotal),
    folioTotal: round2(folioTotal),
    depositsTotal: round2(depositsTotal),
    byMethod: [...byMethod.entries()]
      .map(([method, amount]) => ({ method, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    rows: rows.slice(0, 100),
  }
}

/** Resumen de una línea para la nota del cierre de día (columna de texto). */
export function receptionCashNoteLine(cash: ReceptionCashDay): string {
  if (cash.total <= 0) return ""
  const methods = cash.byMethod.map((m) => `${m.method} $${m.amount}`).join(" · ")
  return `Caja recepción $${cash.total} (${methods})`
}
