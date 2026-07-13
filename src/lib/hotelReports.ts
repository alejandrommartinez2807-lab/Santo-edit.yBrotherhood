// ============================================================
// REPORTES DEL HOTEL · lógica pura (Hotel · Fase 7)
//
// Métricas hoteleras estándar sobre un periodo [from, to) (checkout exclusivo):
//   · Ocupación  = noches-habitación vendidas / noches-habitación disponibles
//   · ADR        = ingreso de habitaciones / noches vendidas   (Average Daily Rate)
//   · RevPAR     = ingreso de habitaciones / noches disponibles (= ADR × ocupación)
//
// Las noches de cada reserva se recortan al periodo (solo cuenta la parte que
// cae dentro). No cuentan las reservas canceladas ni no-show. Todo es lógica
// pura y testeable, como hotelReservationConflicts.ts y rateSeasons.ts.
// ============================================================

import {
  nightsBetween,
  normalizeHotelReservationStatus,
  normalizeStayDate,
  type HotelReservationStatus,
} from "./hotelReservationConflicts"

// Estados que NO cuentan como ocupación (liberan la habitación).
const EXCLUDED_STATUSES: HotelReservationStatus[] = ["cancelada", "no_show"]

export type ReservationForReport = {
  checkInDate: string
  checkOutDate: string
  ratePerNight: number
  status?: unknown
}

export type HotelReport = {
  from: string
  to: string
  daysInPeriod: number
  roomCount: number
  roomNightsAvailable: number
  roomNightsSold: number
  roomRevenue: number
  occupancy: number // 0..1
  adr: number
  revPar: number
  reservationsCounted: number
  countsByStatus: Record<string, number>
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

/** Noches de una reserva que caen dentro del periodo [from, to). */
export function nightsInPeriod(
  reservation: { checkInDate: string; checkOutDate: string },
  from: string,
  to: string,
): number {
  const checkIn = normalizeStayDate(reservation.checkInDate)
  const checkOut = normalizeStayDate(reservation.checkOutDate)
  const f = normalizeStayDate(from)
  const t = normalizeStayDate(to)
  if (!checkIn || !checkOut || !f || !t) return 0
  // Recorte del rango: las fechas "YYYY-MM-DD" se comparan lexicográficamente.
  const lo = checkIn > f ? checkIn : f
  const hi = checkOut < t ? checkOut : t
  return nightsBetween(lo, hi)
}

/**
 * Calcula ocupación, ADR y RevPAR para el periodo. `roomCount` es el inventario
 * de habitaciones vendibles (activas y en servicio). Las noches disponibles =
 * roomCount × noches del periodo.
 */
export function computeHotelReport(params: {
  roomCount: number
  from: string
  to: string
  reservations: ReservationForReport[]
}): HotelReport {
  const from = normalizeStayDate(params.from)
  const to = normalizeStayDate(params.to)
  const daysInPeriod = nightsBetween(from, to)
  const roomCount = Math.max(0, Math.floor(num(params.roomCount, 0)))
  const roomNightsAvailable = roomCount * daysInPeriod

  let roomNightsSold = 0
  let roomRevenue = 0
  let reservationsCounted = 0
  const countsByStatus: Record<string, number> = {}

  for (const reservation of params.reservations) {
    const status = normalizeHotelReservationStatus(reservation.status)
    if (EXCLUDED_STATUSES.includes(status)) continue

    const nights = nightsInPeriod(reservation, from, to)
    if (nights <= 0) continue

    roomNightsSold += nights
    roomRevenue += nights * Math.max(0, num(reservation.ratePerNight, 0))
    reservationsCounted += 1
    countsByStatus[status] = (countsByStatus[status] || 0) + 1
  }

  roomRevenue = round2(roomRevenue)
  const occupancy = roomNightsAvailable > 0 ? roomNightsSold / roomNightsAvailable : 0
  const adr = roomNightsSold > 0 ? roomRevenue / roomNightsSold : 0
  const revPar = roomNightsAvailable > 0 ? roomRevenue / roomNightsAvailable : 0

  return {
    from,
    to,
    daysInPeriod,
    roomCount,
    roomNightsAvailable,
    roomNightsSold,
    roomRevenue,
    occupancy: round2(occupancy),
    adr: round2(adr),
    revPar: round2(revPar),
    reservationsCounted,
    countsByStatus,
  }
}
