// ============================================================
// DISPONIBILIDAD PÚBLICA POR TIPO DE HABITACIÓN · lógica pura (Hotel · Fase 8)
//
// El motor de reservas público muestra TIPOS de habitación (no habitaciones
// individuales: no se exponen los números internos). Para un rango de noches,
// cuenta cuántas habitaciones activas y en servicio de cada tipo están libres
// (sin solape) y cotiza el precio del tipo con las temporadas (quoteStay).
//
// Reutiliza la lógica de solapes (hotelReservationConflicts) y de precio
// (rateSeasons). Todo puro y testeable, sin DB.
// ============================================================

import {
  findRoomStayConflict,
  stayRangesOverlap,
  type ConflictCandidate,
} from "./hotelReservationConflicts"
import { quoteStay, type RateSeasonLike, type StayQuote } from "./rateSeasons"
import { evaluateStayRestrictions, type RateRestrictionLike } from "./rateRestrictions"

export type AvailabilityBlock = {
  roomId: string
  fromDate: string
  toDate: string
}

/** ¿La habitación tiene un bloqueo que solapa el rango [checkIn, checkOut)? */
export function roomHasBlockInRange(
  blocks: AvailabilityBlock[],
  roomId: string,
  checkIn: string,
  checkOut: string,
): boolean {
  const id = String(roomId || "")
  return blocks.some(
    (block) =>
      String(block.roomId || "") === id &&
      stayRangesOverlap(
        { checkIn, checkOut },
        { checkIn: block.fromDate, checkOut: block.toDate },
      ),
  )
}

export type AvailabilityRoom = {
  id: string
  roomTypeId: string
  baseRate?: number | null
  active?: boolean
  outOfService?: boolean
}

export type AvailabilityRoomType = {
  id: string
  name: string
  description?: string
  baseCapacity?: number
  baseRate?: number
  active?: boolean
}

export type AvailableType = {
  roomTypeId: string
  name: string
  description: string
  capacity: number
  freeCount: number
  quote: StayQuote
}

function isBookableRoom(room: AvailabilityRoom): boolean {
  return room.active !== false && room.outOfService !== true
}

/** Habitaciones de un tipo que están libres en el rango (activas, en servicio,
 * sin reserva que solape y sin bloqueo). */
export function freeRoomsOfType(params: {
  rooms: AvailabilityRoom[]
  reservations: ConflictCandidate[]
  roomTypeId: string
  checkIn: string
  checkOut: string
  blocks?: AvailabilityBlock[]
}): AvailabilityRoom[] {
  const type = String(params.roomTypeId || "")
  const blocks = params.blocks ?? []
  return params.rooms.filter((room) => {
    if (String(room.roomTypeId || "") !== type) return false
    if (!isBookableRoom(room)) return false
    if (roomHasBlockInRange(blocks, room.id, params.checkIn, params.checkOut)) return false
    const conflict = findRoomStayConflict(params.reservations, {
      roomId: room.id,
      range: { checkIn: params.checkIn, checkOut: params.checkOut },
    })
    return !conflict
  })
}

/** Primera habitación libre de un tipo (para asignar al reservar). null si no hay. */
export function pickFreeRoomOfType(params: {
  rooms: AvailabilityRoom[]
  reservations: ConflictCandidate[]
  roomTypeId: string
  checkIn: string
  checkOut: string
  blocks?: AvailabilityBlock[]
}): AvailabilityRoom | null {
  return freeRoomsOfType(params)[0] ?? null
}

/**
 * Tipos disponibles para la estadía, con cuántas habitaciones libres y el precio
 * del tipo cotizado con temporadas. Solo tipos activos con al menos una libre.
 */
export function availableTypesForStay(params: {
  rooms: AvailabilityRoom[]
  roomTypes: AvailabilityRoomType[]
  reservations: ConflictCandidate[]
  seasons: RateSeasonLike[]
  checkIn: string
  checkOut: string
  blocks?: AvailabilityBlock[]
  restrictions?: RateRestrictionLike[]
}): AvailableType[] {
  const restrictions = params.restrictions ?? []
  const result: AvailableType[] = []
  for (const type of params.roomTypes) {
    if (type.active === false) continue

    // Restricciones de venta (estancia mínima, CTA/CTD): si no se permite la
    // estadía para este tipo, no se ofrece.
    if (
      restrictions.length > 0 &&
      !evaluateStayRestrictions({
        restrictions,
        roomTypeId: type.id,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      }).allowed
    ) {
      continue
    }

    const free = freeRoomsOfType({
      rooms: params.rooms,
      reservations: params.reservations,
      roomTypeId: type.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      blocks: params.blocks,
    })
    if (free.length === 0) continue

    const quote = quoteStay({
      baseRate: Math.max(0, Number(type.baseRate) || 0),
      roomTypeId: type.id,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      seasons: params.seasons,
    })

    result.push({
      roomTypeId: type.id,
      name: type.name,
      description: type.description ?? "",
      capacity: Math.max(1, Number(type.baseCapacity) || 1),
      freeCount: free.length,
      quote,
    })
  }
  return result
}
