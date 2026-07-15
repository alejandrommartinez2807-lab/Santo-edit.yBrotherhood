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
  /** Campos opcionales para los desgloses (tipo, canal, huéspedes). */
  roomTypeId?: string
  source?: string
  adults?: number
  children?: number
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

// ---------------------------------------------------------------------------
// Series y desgloses para las gráficas del módulo Reportes del hotel.
// Igual que arriba: [from, to) con checkout exclusivo, canceladas/no-show
// fuera, y todo puro/testeable.
// ---------------------------------------------------------------------------

const MAX_SERIES_DAYS = 400
const DAY_MS = 24 * 60 * 60 * 1000

function addDaysISO(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`)
  const next = new Date(base.getTime() + days * DAY_MS)
  return next.toISOString().slice(0, 10)
}

export type HotelDailyPoint = {
  date: string
  /** Noches-habitación ocupadas esa noche. */
  sold: number
  /** 0..1 sobre el inventario vendible. */
  occupancy: number
  /** Ingreso de habitación devengado esa noche (tarifas de las estadías). */
  revenue: number
}

/** Ocupación e ingreso NOCHE A NOCHE (para las gráficas de tendencia). */
export function computeHotelDailySeries(params: {
  roomCount: number
  from: string
  to: string
  reservations: ReservationForReport[]
}): HotelDailyPoint[] {
  const from = normalizeStayDate(params.from)
  const to = normalizeStayDate(params.to)
  const days = Math.min(nightsBetween(from, to), MAX_SERIES_DAYS)
  const roomCount = Math.max(0, Math.floor(num(params.roomCount, 0)))
  if (!from || !to || days <= 0) return []

  const active = params.reservations.filter(
    (r) => !EXCLUDED_STATUSES.includes(normalizeHotelReservationStatus(r.status)),
  )

  const series: HotelDailyPoint[] = []
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(from, i)
    let sold = 0
    let revenue = 0
    for (const r of active) {
      const checkIn = normalizeStayDate(r.checkInDate)
      const checkOut = normalizeStayDate(r.checkOutDate)
      if (!checkIn || !checkOut) continue
      // La noche `date` está ocupada si checkIn <= date < checkOut.
      if (checkIn <= date && date < checkOut) {
        sold += 1
        revenue += Math.max(0, num(r.ratePerNight, 0))
      }
    }
    series.push({
      date,
      sold,
      occupancy: roomCount > 0 ? round2(sold / roomCount) : 0,
      revenue: round2(revenue),
    })
  }
  return series
}

export type HotelBreakdownRow = {
  key: string
  nights: number
  revenue: number
  reservations: number
}

/** Noches e ingreso del periodo agrupados por una clave de la reserva. */
function breakdownBy(
  keyOf: (r: ReservationForReport) => string,
  params: { from: string; to: string; reservations: ReservationForReport[] },
): HotelBreakdownRow[] {
  const rows = new Map<string, HotelBreakdownRow>()
  for (const r of params.reservations) {
    if (EXCLUDED_STATUSES.includes(normalizeHotelReservationStatus(r.status))) continue
    const nights = nightsInPeriod(r, params.from, params.to)
    if (nights <= 0) continue
    const key = keyOf(r) || "otro"
    const row = rows.get(key) || { key, nights: 0, revenue: 0, reservations: 0 }
    row.nights += nights
    row.revenue = round2(row.revenue + nights * Math.max(0, num(r.ratePerNight, 0)))
    row.reservations += 1
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue)
}

/** Desglose por tipo de habitación (key = roomTypeId). */
export function computeRoomTypeBreakdown(params: {
  from: string
  to: string
  reservations: ReservationForReport[]
}): HotelBreakdownRow[] {
  return breakdownBy((r) => String(r.roomTypeId || ""), params)
}

/** Desglose por canal de la reserva (web / recepción). */
export function computeSourceBreakdown(params: {
  from: string
  to: string
  reservations: ReservationForReport[]
}): HotelBreakdownRow[] {
  return breakdownBy((r) => (String(r.source || "").trim() === "web" ? "web" : "recepcion"), params)
}

export type HotelStayStats = {
  /** Estancia media (noches completas) de las reservas contadas. */
  avgStayNights: number
  adults: number
  children: number
  guests: number
  cancelled: number
  noShow: number
  /** Canceladas + no-show sobre el total de reservas que tocan el periodo. */
  cancellationRate: number
}

export function computeStayStats(params: {
  from: string
  to: string
  reservations: ReservationForReport[]
}): HotelStayStats {
  let counted = 0
  let totalNights = 0
  let adults = 0
  let children = 0
  let cancelled = 0
  let noShow = 0
  let touching = 0

  for (const r of params.reservations) {
    const status = normalizeHotelReservationStatus(r.status)
    const inPeriod = nightsInPeriod(r, params.from, params.to) > 0
    // Las canceladas/no-show no ocupan noches: se cuentan si su rango de
    // fechas toca el periodo (para la tasa de cancelación).
    const wouldTouch =
      inPeriod ||
      (normalizeStayDate(r.checkInDate) < normalizeStayDate(params.to) &&
        normalizeStayDate(r.checkOutDate) > normalizeStayDate(params.from))
    if (!wouldTouch) continue
    touching += 1
    if (status === "cancelada") {
      cancelled += 1
      continue
    }
    if (status === "no_show") {
      noShow += 1
      continue
    }
    if (!inPeriod) continue
    counted += 1
    totalNights += nightsBetween(r.checkInDate, r.checkOutDate)
    adults += Math.max(0, num(r.adults, 0))
    children += Math.max(0, num(r.children, 0))
  }

  return {
    avgStayNights: counted > 0 ? round2(totalNights / counted) : 0,
    adults,
    children,
    guests: adults + children,
    cancelled,
    noShow,
    cancellationRate: touching > 0 ? round2((cancelled + noShow) / touching) : 0,
  }
}
