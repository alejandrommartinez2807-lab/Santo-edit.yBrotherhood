// ============================================================
// CIERRE DE DÍA · lógica pura (Hotel · Fase 15)
// Resumen de la operación de una fecha: llegadas, salidas, en casa, llegadas
// pendientes (deberían entrar y no han hecho check-in) e ingreso de la noche.
// Sin DB. Reutiliza los estados de reserva.
// ============================================================

import { normalizeHotelReservationStatus, normalizeStayDate } from "./hotelReservationConflicts"

export type AuditReservation = {
  checkInDate: string
  checkOutDate: string
  ratePerNight?: number
  status?: unknown
}

export type DayAudit = {
  date: string
  arrivals: number
  departures: number
  inHouse: number
  pendingArrivals: number
  roomRevenue: number
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function dayAuditSummary(params: { reservations: AuditReservation[]; date: string }): DayAudit {
  const date = normalizeStayDate(params.date)
  let arrivals = 0
  let departures = 0
  let inHouse = 0
  let pendingArrivals = 0
  let roomRevenue = 0

  for (const r of params.reservations) {
    const status = normalizeHotelReservationStatus(r.status)
    if (status === "cancelada" || status === "no_show") continue
    const checkIn = normalizeStayDate(r.checkInDate)
    const checkOut = normalizeStayDate(r.checkOutDate)

    if (checkIn === date) {
      arrivals += 1
      if (status === "pendiente" || status === "confirmada") pendingArrivals += 1
    }
    if (checkOut === date) departures += 1

    // En casa esa noche: ocupada [checkIn, checkOut) y ya con check-in hecho.
    if (checkIn <= date && date < checkOut && (status === "checkin")) {
      inHouse += 1
      roomRevenue += Math.max(0, num(r.ratePerNight, 0))
    }
  }

  return {
    date,
    arrivals,
    departures,
    inHouse,
    pendingArrivals,
    roomRevenue: Math.round(roomRevenue * 100) / 100,
  }
}
