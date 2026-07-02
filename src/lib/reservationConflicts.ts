import type { Reservation, ReservationStatus } from "@/types/localOrders"

// ============================================================
// Reservas · lógica pura de franjas y solapes (Fase 5)
//
// Las mesas viven en businessConfig.localTables (no en SQL), así que la
// reserva referencia table_id como texto y toda la detección de conflictos
// se resuelve aquí, en memoria, sobre las reservas del día de esa sucursal.
// Sin dependencias de Supabase para poder testearla con vitest.
// ============================================================

export const RESERVATION_STATUSES: ReservationStatus[] = [
  "activa",
  "completada",
  "cancelada",
  "no_show",
]

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No llegó",
}

export function isKnownReservationStatus(value: unknown): value is ReservationStatus {
  return RESERVATION_STATUSES.includes(value as ReservationStatus)
}

export function normalizeReservationStatus(value: unknown): ReservationStatus {
  return isKnownReservationStatus(value) ? value : "activa"
}

// "9:5" | "09:05:00" | " 9:05 " → "09:05"; inválido → ""
export function normalizeReservationTime(value: unknown): string {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/)

  if (!match) return ""

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > 23 || minutes > 59) return ""

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function normalizeReservationDate(value: unknown): string {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)

  if (!match) return ""

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || day > 31) return ""

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function reservationTimeToMinutes(time: string): number {
  const normalized = normalizeReservationTime(time)

  if (!normalized) return -1

  const [hours, minutes] = normalized.split(":").map(Number)

  return hours * 60 + minutes
}

export type ReservationSlot = {
  reservationDate: string
  startTime: string
  endTime: string
}

export function isValidReservationSlot(slot: ReservationSlot): boolean {
  const start = reservationTimeToMinutes(slot.startTime)
  const end = reservationTimeToMinutes(slot.endTime)

  return Boolean(normalizeReservationDate(slot.reservationDate)) && start >= 0 && end > start
}

// Solape de intervalos semiabiertos [inicio, fin): 12:00-14:00 y 14:00-16:00
// NO chocan (una reserva puede empezar justo cuando termina la anterior).
export function reservationSlotsOverlap(a: ReservationSlot, b: ReservationSlot): boolean {
  if (normalizeReservationDate(a.reservationDate) !== normalizeReservationDate(b.reservationDate)) {
    return false
  }

  const startA = reservationTimeToMinutes(a.startTime)
  const endA = reservationTimeToMinutes(a.endTime)
  const startB = reservationTimeToMinutes(b.startTime)
  const endB = reservationTimeToMinutes(b.endTime)

  if (startA < 0 || endA < 0 || startB < 0 || endB < 0) return false

  return startA < endB && startB < endA
}

export type ReservationConflictCandidate = ReservationSlot & {
  id: string
  tableId: string
  status: ReservationStatus
}

// Reserva activa de la misma mesa cuya franja choca con la solicitada.
// `ignoreReservationId` permite editar una reserva sin chocar consigo misma.
export function findReservationConflict<T extends ReservationConflictCandidate>(
  existing: T[],
  candidate: { tableId: string; slot: ReservationSlot; ignoreReservationId?: string }
): T | null {
  if (!candidate.tableId) return null

  return (
    existing.find(
      (reservation) =>
        reservation.status === "activa" &&
        reservation.id !== candidate.ignoreReservationId &&
        reservation.tableId === candidate.tableId &&
        reservationSlotsOverlap(reservation, candidate.slot)
    ) || null
  )
}

// ¿Esta reserva bloquea la mesa "ahora"? Se considera vigente desde
// `holdMinutesBefore` minutos antes del inicio hasta el fin de la franja.
export function isReservationBlockingNow(
  reservation: Pick<Reservation, "status" | "reservationDate" | "startTime" | "endTime">,
  now: { date: string; minutes: number },
  holdMinutesBefore = 30
): boolean {
  if (reservation.status !== "activa") return false
  if (normalizeReservationDate(reservation.reservationDate) !== normalizeReservationDate(now.date)) {
    return false
  }

  const start = reservationTimeToMinutes(reservation.startTime)
  const end = reservationTimeToMinutes(reservation.endTime)

  if (start < 0 || end < 0) return false

  return now.minutes >= start - holdMinutesBefore && now.minutes < end
}

export function findBlockingReservationForTable<
  T extends Pick<Reservation, "tableId" | "status" | "reservationDate" | "startTime" | "endTime">,
>(reservations: T[], tableId: string, now: { date: string; minutes: number }): T | null {
  if (!tableId) return null

  return (
    reservations.find(
      (reservation) =>
        reservation.tableId === tableId && isReservationBlockingNow(reservation, now)
    ) || null
  )
}

// Fecha y minutos actuales en la zona del negocio (Venezuela), en el mismo
// formato que usan las reservas (YYYY-MM-DD + minutos desde medianoche).
export function getReservationNow(timeZone = "America/Caracas", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00"
  const hours = Number(get("hour")) % 24 // Intl puede devolver "24" a medianoche

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hours * 60 + Number(get("minute")),
  }
}
