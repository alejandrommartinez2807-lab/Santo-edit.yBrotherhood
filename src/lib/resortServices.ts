// ============================================================
// SERVICIOS DEL RESORT · lógica pura de cupo (Hotel · Fase 21)
//
// Un servicio tiene un cupo (capacity) por franja (fecha + hora). Al reservar,
// se cuenta cuánta gente ya está reservada en esa misma franja (estados que NO
// están cancelados) y se compara con el cupo. Puro y testeable, sin DB.
// ============================================================

export const SERVICE_KINDS = ["spa", "tour", "restaurante", "alquiler", "clase", "otro"] as const
export type ServiceKind = (typeof SERVICE_KINDS)[number]

export const SERVICE_BOOKING_STATUSES = ["reservada", "cumplida", "cancelada"] as const
export type ServiceBookingStatus = (typeof SERVICE_BOOKING_STATUSES)[number]

export function normalizeServiceKind(value: unknown): ServiceKind {
  const clean = String(value || "").trim().toLowerCase()
  return (SERVICE_KINDS as readonly string[]).includes(clean) ? (clean as ServiceKind) : "otro"
}

export function normalizeServiceBookingStatus(value: unknown): ServiceBookingStatus {
  const clean = String(value || "").trim().toLowerCase()
  return (SERVICE_BOOKING_STATUSES as readonly string[]).includes(clean)
    ? (clean as ServiceBookingStatus)
    : "reservada"
}

export type ServiceBookingLike = {
  serviceId: string
  date: string
  time?: string
  people?: number
  status?: unknown
}

function sameslot(b: ServiceBookingLike, serviceId: string, date: string, time: string) {
  return (
    String(b.serviceId || "") === serviceId &&
    String(b.date || "") === date &&
    String(b.time || "") === time
  )
}

/** Personas ya reservadas (no canceladas) en esa franja del servicio. */
export function bookedPeople(
  bookings: ServiceBookingLike[],
  serviceId: string,
  date: string,
  time = "",
): number {
  return bookings.reduce((sum, b) => {
    if (normalizeServiceBookingStatus(b.status) === "cancelada") return sum
    if (!sameslot(b, String(serviceId || ""), String(date || ""), String(time || ""))) return sum
    return sum + Math.max(0, Number(b.people) || 0)
  }, 0)
}

/** Cupo restante en la franja (nunca negativo). */
export function remainingCapacity(params: {
  capacity: number
  bookings: ServiceBookingLike[]
  serviceId: string
  date: string
  time?: string
  ignoreBookingId?: string
}): number {
  const cap = Math.max(0, Math.floor(Number(params.capacity) || 0))
  const booked = bookedPeople(params.bookings, params.serviceId, params.date, params.time || "")
  return Math.max(0, cap - booked)
}

export type CanBookResult = { allowed: boolean; remaining: number; reason: string }

/** ¿Cabe `people` en la franja? Devuelve el cupo restante y la razón si no. */
export function canBookService(params: {
  capacity: number
  bookings: ServiceBookingLike[]
  serviceId: string
  date: string
  time?: string
  people: number
}): CanBookResult {
  const people = Math.max(1, Math.floor(Number(params.people) || 1))
  const remaining = remainingCapacity(params)
  if (people > remaining) {
    return {
      allowed: false,
      remaining,
      reason: remaining <= 0 ? "Sin cupo en esa franja" : `Solo quedan ${remaining} lugar(es)`,
    }
  }
  return { allowed: true, remaining, reason: "" }
}
