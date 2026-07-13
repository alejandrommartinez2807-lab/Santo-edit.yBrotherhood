// ============================================================
// RESTRICCIONES DE TARIFA · lógica pura (Hotel · Fase 18)
//
// Decide si una estadía [checkIn, checkOut) de un tipo de habitación se puede
// vender según las reglas por fecha: estancia mínima (según llegada), cerrado a
// llegada (CTA) y cerrado a salida (CTD). Una regla sin room_type_id aplica a
// todos los tipos. Rango [from_date, to_date] inclusive.
//
// Puro y testeable (sin DB). Lo usan el motor de reservas público y la API.
// ============================================================

import { nightsBetween, normalizeStayDate } from "./hotelReservationConflicts"

export type RateRestrictionLike = {
  roomTypeId?: string
  fromDate: string
  toDate: string
  minStay?: number
  closedToArrival?: boolean
  closedToDeparture?: boolean
  active?: boolean
}

export type RestrictionResult = { allowed: boolean; reason: string }

/** ¿La regla cubre esa fecha para ese tipo? (activa, rango, tipo o global). */
function coversDateForType(
  restriction: RateRestrictionLike,
  dateISO: string,
  roomTypeId: string,
): boolean {
  if (restriction.active === false) return false
  const rType = String(restriction.roomTypeId || "")
  if (rType && rType !== String(roomTypeId || "")) return false
  const from = normalizeStayDate(restriction.fromDate)
  const to = normalizeStayDate(restriction.toDate)
  const date = normalizeStayDate(dateISO)
  if (!from || !to || !date) return false
  return from <= date && date <= to
}

/**
 * Evalúa las restricciones para la estadía. Devuelve la primera razón por la que
 * NO se puede vender, o { allowed: true } si pasa todas.
 */
export function evaluateStayRestrictions(params: {
  restrictions: RateRestrictionLike[]
  roomTypeId: string
  checkIn: string
  checkOut: string
}): RestrictionResult {
  const { restrictions, roomTypeId } = params
  const checkIn = normalizeStayDate(params.checkIn)
  const checkOut = normalizeStayDate(params.checkOut)
  const nights = nightsBetween(checkIn, checkOut)
  if (nights <= 0) return { allowed: false, reason: "Rango de fechas inválido" }

  // Reglas que aplican a la fecha de LLEGADA.
  const arrivalRules = restrictions.filter((r) => coversDateForType(r, checkIn, roomTypeId))

  if (arrivalRules.some((r) => r.closedToArrival)) {
    return { allowed: false, reason: "No se permite la llegada en esa fecha" }
  }

  const minStay = Math.max(1, ...arrivalRules.map((r) => Math.max(1, Number(r.minStay) || 1)))
  if (nights < minStay) {
    return { allowed: false, reason: `Estancia mínima de ${minStay} noche(s) para esa fecha` }
  }

  // Reglas que aplican a la fecha de SALIDA (día del check-out).
  const departureRules = restrictions.filter((r) => coversDateForType(r, checkOut, roomTypeId))
  if (departureRules.some((r) => r.closedToDeparture)) {
    return { allowed: false, reason: "No se permite la salida en esa fecha" }
  }

  return { allowed: true, reason: "" }
}

/** Atajo booleano. */
export function isStayAllowed(params: {
  restrictions: RateRestrictionLike[]
  roomTypeId: string
  checkIn: string
  checkOut: string
}): boolean {
  return evaluateStayRestrictions(params).allowed
}
