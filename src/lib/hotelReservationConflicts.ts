// ============================================================
// RESERVAS HOTELERAS · lógica de solape por RANGO DE NOCHES (Hotel · Fase 2)
//
// A diferencia de las reservas de restaurante (franja horaria del mismo día),
// una reserva de hotel ocupa una habitación desde `checkIn` (inclusive) hasta
// `checkOut` (exclusivo). Dos estadías de la MISMA habitación chocan si sus
// rangos se solapan. Solo bloquean los estados "vivos" (pendiente/confirmada/
// checkin); cancelada, checkout y no_show liberan la habitación.
//
// Todo es lógica pura y testeable (sin DB), como reservationConflicts.ts.
// ============================================================

export const HOTEL_RESERVATION_STATUSES = [
  "pendiente",
  "confirmada",
  "checkin",
  "checkout",
  "cancelada",
  "no_show",
] as const

export type HotelReservationStatus = (typeof HOTEL_RESERVATION_STATUSES)[number]

// Estados que MANTIENEN ocupada la habitación (bloquean el rango).
export const BLOCKING_HOTEL_STATUSES: HotelReservationStatus[] = [
  "pendiente",
  "confirmada",
  "checkin",
]

export const HOTEL_RESERVATION_STATUS_LABELS: Record<HotelReservationStatus, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  checkin: "Check-in",
  checkout: "Check-out",
  cancelada: "Cancelada",
  no_show: "No llegó",
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeStayDate(value: unknown): string {
  const clean = String(value || "").trim().slice(0, 10)
  return DATE_RE.test(clean) ? clean : ""
}

export function normalizeHotelReservationStatus(value: unknown): HotelReservationStatus {
  const clean = String(value || "").trim().toLowerCase()
  return (HOTEL_RESERVATION_STATUSES as readonly string[]).includes(clean)
    ? (clean as HotelReservationStatus)
    : "confirmada"
}

export function isKnownHotelReservationStatus(value: unknown): value is HotelReservationStatus {
  return (HOTEL_RESERVATION_STATUSES as readonly string[]).includes(String(value || "").trim().toLowerCase())
}

export function isBlockingHotelStatus(value: unknown): boolean {
  return BLOCKING_HOTEL_STATUSES.includes(normalizeHotelReservationStatus(value))
}

/** Noches entre dos fechas "YYYY-MM-DD" (checkOut exclusivo). 0 si inválido. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = normalizeStayDate(checkIn)
  const b = normalizeStayDate(checkOut)
  if (!a || !b) return 0
  const start = Date.parse(`${a}T00:00:00Z`)
  const end = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  const diff = Math.round((end - start) / 86_400_000)
  return diff > 0 ? diff : 0
}

export type StayRange = { checkIn: string; checkOut: string }

/** Un rango es válido si ambas fechas existen y checkOut > checkIn (≥1 noche). */
export function isValidStayRange(range: StayRange): boolean {
  return nightsBetween(range.checkIn, range.checkOut) >= 1
}

/** Dos rangos [inicio, fin) se solapan si a.inicio < b.fin && b.inicio < a.fin. */
export function stayRangesOverlap(a: StayRange, b: StayRange): boolean {
  const aIn = normalizeStayDate(a.checkIn)
  const aOut = normalizeStayDate(a.checkOut)
  const bIn = normalizeStayDate(b.checkIn)
  const bOut = normalizeStayDate(b.checkOut)
  if (!aIn || !aOut || !bIn || !bOut) return false
  return aIn < bOut && bIn < aOut
}

export type ConflictCandidate = {
  id?: string
  roomId?: string | null
  checkInDate: string
  checkOutDate: string
  status?: unknown
  guestName?: string
}

/**
 * Devuelve la primera reserva que choca con el rango pedido para esa habitación,
 * o null si la habitación está libre. Ignora la reserva `ignoreReservationId`
 * (al editar) y las que no están en un estado bloqueante.
 */
export function findRoomStayConflict(
  reservations: ConflictCandidate[],
  target: { roomId: string; range: StayRange; ignoreReservationId?: string },
): ConflictCandidate | null {
  if (!target.roomId) return null
  for (const reservation of reservations) {
    if (target.ignoreReservationId && reservation.id === target.ignoreReservationId) continue
    if (String(reservation.roomId || "") !== target.roomId) continue
    if (!isBlockingHotelStatus(reservation.status)) continue
    if (
      stayRangesOverlap(target.range, {
        checkIn: reservation.checkInDate,
        checkOut: reservation.checkOutDate,
      })
    ) {
      return reservation
    }
  }
  return null
}
