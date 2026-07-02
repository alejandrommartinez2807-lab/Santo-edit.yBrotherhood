import { describe, expect, it } from "vitest"
import {
  findBlockingReservationForTable,
  findReservationConflict,
  getReservationNow,
  isReservationBlockingNow,
  isValidReservationSlot,
  normalizeReservationDate,
  normalizeReservationTime,
  reservationSlotsOverlap,
  reservationTimeToMinutes,
} from "@/lib/reservationConflicts"
import type { Reservation } from "@/types/localOrders"

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    tableId: "mesa-1",
    tableName: "Mesa 1",
    customerName: "Ana",
    customerPhone: "",
    partySize: 2,
    reservationDate: "2026-07-02",
    startTime: "19:00",
    endTime: "21:00",
    status: "activa",
    note: "",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

describe("Reservas · franjas y solapes", () => {
  it("normaliza horas y fechas con formatos sueltos", () => {
    expect(normalizeReservationTime("9:5")).toBe("09:05")
    expect(normalizeReservationTime("19:30:00")).toBe("19:30")
    expect(normalizeReservationTime("25:00")).toBe("")
    expect(normalizeReservationTime("hola")).toBe("")
    expect(normalizeReservationDate("2026-7-2")).toBe("2026-07-02")
    expect(normalizeReservationDate("2026-07-02T19:00:00Z")).toBe("2026-07-02")
    expect(normalizeReservationDate("ayer")).toBe("")
    expect(reservationTimeToMinutes("19:30")).toBe(1170)
  })

  it("valida franjas: fin después del inicio y fecha válida", () => {
    expect(isValidReservationSlot({ reservationDate: "2026-07-02", startTime: "19:00", endTime: "21:00" })).toBe(true)
    expect(isValidReservationSlot({ reservationDate: "2026-07-02", startTime: "21:00", endTime: "19:00" })).toBe(false)
    expect(isValidReservationSlot({ reservationDate: "2026-07-02", startTime: "19:00", endTime: "19:00" })).toBe(false)
    expect(isValidReservationSlot({ reservationDate: "", startTime: "19:00", endTime: "21:00" })).toBe(false)
  })

  it("detecta solape de franjas como intervalos semiabiertos [inicio, fin)", () => {
    const base = { reservationDate: "2026-07-02", startTime: "12:00", endTime: "14:00" }

    expect(reservationSlotsOverlap(base, { reservationDate: "2026-07-02", startTime: "13:00", endTime: "15:00" })).toBe(true)
    // Empezar justo cuando termina la anterior NO choca.
    expect(reservationSlotsOverlap(base, { reservationDate: "2026-07-02", startTime: "14:00", endTime: "16:00" })).toBe(false)
    expect(reservationSlotsOverlap(base, { reservationDate: "2026-07-03", startTime: "13:00", endTime: "15:00" })).toBe(false)
  })

  it("encuentra conflicto solo con reservas activas de la misma mesa", () => {
    const existing = [
      makeReservation({ id: "r1", tableId: "mesa-1" }),
      makeReservation({ id: "r2", tableId: "mesa-2" }),
      makeReservation({ id: "r3", tableId: "mesa-1", status: "cancelada" }),
    ]
    const slot = { reservationDate: "2026-07-02", startTime: "20:00", endTime: "22:00" }

    expect(findReservationConflict(existing, { tableId: "mesa-1", slot })?.id).toBe("r1")
    expect(findReservationConflict(existing, { tableId: "mesa-3", slot })).toBeNull()
    // Editar la propia reserva no choca consigo misma.
    expect(findReservationConflict(existing, { tableId: "mesa-1", slot, ignoreReservationId: "r1" })).toBeNull()
  })

  it("bloquea la mesa desde 30 min antes del inicio hasta el fin de la franja", () => {
    const reservation = makeReservation()

    expect(isReservationBlockingNow(reservation, { date: "2026-07-02", minutes: 18 * 60 })).toBe(false)
    expect(isReservationBlockingNow(reservation, { date: "2026-07-02", minutes: 18 * 60 + 40 })).toBe(true)
    expect(isReservationBlockingNow(reservation, { date: "2026-07-02", minutes: 20 * 60 })).toBe(true)
    expect(isReservationBlockingNow(reservation, { date: "2026-07-02", minutes: 21 * 60 })).toBe(false)
    expect(isReservationBlockingNow(reservation, { date: "2026-07-03", minutes: 20 * 60 })).toBe(false)
    expect(isReservationBlockingNow(makeReservation({ status: "cancelada" }), { date: "2026-07-02", minutes: 20 * 60 })).toBe(false)

    const list = [makeReservation({ tableId: "mesa-2" }), reservation]
    expect(findBlockingReservationForTable(list, "mesa-1", { date: "2026-07-02", minutes: 20 * 60 })?.id).toBe("r1")
    expect(findBlockingReservationForTable(list, "barra", { date: "2026-07-02", minutes: 20 * 60 })).toBeNull()
  })

  it("getReservationNow devuelve fecha y minutos en la zona pedida", () => {
    const now = getReservationNow("America/Caracas", new Date("2026-07-02T00:30:00Z"))

    // 00:30 UTC = 20:30 del día anterior en Caracas (UTC-4).
    expect(now.date).toBe("2026-07-01")
    expect(now.minutes).toBe(20 * 60 + 30)
  })
})
