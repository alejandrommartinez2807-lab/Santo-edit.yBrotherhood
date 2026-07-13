// ============================================================
// TAPE CHART · lógica pura del calendario de ocupación (Hotel · Fase 14)
//
// Construye una grilla habitaciones × días: para una ventana [startDate, +days)
// marca cada celda como libre / ocupada (por qué reserva) / fuera de servicio.
// Una reserva ocupa la habitación desde checkIn (inclusive) hasta checkOut
// (exclusivo) y solo cuenta si su estado bloquea (pendiente/confirmada/checkin);
// cancelada/checkout/no_show liberan. Reutiliza la lógica de estados de solapes.
//
// Todo puro y testeable, sin DB (como hotelReservationConflicts / hotelReports).
// ============================================================

import { isBlockingHotelStatus, normalizeStayDate } from "./hotelReservationConflicts"
import { addDaysISO } from "./rateSeasons"

export type CalendarRoom = {
  id: string
  name: string
  floor?: string
  outOfService?: boolean
  sortOrder?: number
}

export type CalendarReservation = {
  id: string
  roomId: string
  code?: string
  guestName?: string
  checkInDate: string
  checkOutDate: string
  status?: unknown
}

export type CalendarCell = {
  date: string
  state: "free" | "occupied" | "out"
  isStart: boolean // primer día de la reserva (para pintar la etiqueta)
  reservationId?: string
  code?: string
  guestName?: string
  status?: string
}

export type CalendarRow = {
  room: CalendarRoom
  cells: CalendarCell[]
}

export type TapeChart = {
  days: string[]
  rows: CalendarRow[]
  occupancyByDay: number[] // habitaciones ocupadas por día (mismo orden que days)
}

/** Lista de fechas "YYYY-MM-DD" desde start (inclusive) por `days` días. */
export function calendarDays(startDate: string, days: number): string[] {
  const start = normalizeStayDate(startDate)
  const n = Math.max(1, Math.min(60, Math.floor(Number(days) || 0)))
  if (!start) return []
  return Array.from({ length: n }, (_, i) => addDaysISO(start, i))
}

/** Reserva bloqueante que ocupa esa habitación en ese día (o null). */
function reservationOnDay(
  reservations: CalendarReservation[],
  roomId: string,
  dayISO: string,
): CalendarReservation | null {
  for (const r of reservations) {
    if (String(r.roomId || "") !== roomId) continue
    if (!isBlockingHotelStatus(r.status)) continue
    const checkIn = normalizeStayDate(r.checkInDate)
    const checkOut = normalizeStayDate(r.checkOutDate)
    if (!checkIn || !checkOut) continue
    if (checkIn <= dayISO && dayISO < checkOut) return r
  }
  return null
}

export function buildTapeChart(params: {
  rooms: CalendarRoom[]
  reservations: CalendarReservation[]
  startDate: string
  days: number
}): TapeChart {
  const days = calendarDays(params.startDate, params.days)
  const occupancyByDay = new Array(days.length).fill(0)

  const rooms = [...params.rooms].sort(
    (a, b) =>
      (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
      String(a.name).localeCompare(String(b.name)),
  )

  const rows: CalendarRow[] = rooms.map((room) => {
    const cells = days.map((date, dayIndex): CalendarCell => {
      if (room.outOfService) {
        return { date, state: "out", isStart: false }
      }
      const reservation = reservationOnDay(params.reservations, room.id, date)
      if (!reservation) {
        return { date, state: "free", isStart: false }
      }
      occupancyByDay[dayIndex] += 1
      return {
        date,
        state: "occupied",
        isStart: normalizeStayDate(reservation.checkInDate) === date,
        reservationId: reservation.id,
        code: reservation.code,
        guestName: reservation.guestName,
        status: String(reservation.status || ""),
      }
    })
    return { room, cells }
  })

  return { days, rows, occupancyByDay }
}
