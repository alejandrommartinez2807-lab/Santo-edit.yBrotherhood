import { describe, it, expect } from "vitest"
import {
  findRoomStayConflict,
  isValidStayRange,
  nightsBetween,
  normalizeHotelReservationStatus,
  normalizeStayDate,
  stayRangesOverlap,
  type ConflictCandidate,
} from "../hotelReservationConflicts"

describe("hotelReservationConflicts", () => {
  it("cuenta noches con checkout exclusivo", () => {
    expect(nightsBetween("2026-07-22", "2026-07-23")).toBe(1)
    expect(nightsBetween("2026-07-22", "2026-07-25")).toBe(3)
    expect(nightsBetween("2026-07-25", "2026-07-22")).toBe(0)
    expect(nightsBetween("2026-07-22", "2026-07-22")).toBe(0)
  })

  it("valida rangos (mínimo 1 noche)", () => {
    expect(isValidStayRange({ checkIn: "2026-07-22", checkOut: "2026-07-23" })).toBe(true)
    expect(isValidStayRange({ checkIn: "2026-07-22", checkOut: "2026-07-22" })).toBe(false)
    expect(isValidStayRange({ checkIn: "malo", checkOut: "2026-07-23" })).toBe(false)
  })

  it("normaliza fechas y estados", () => {
    expect(normalizeStayDate("2026-07-22T15:00:00Z")).toBe("2026-07-22")
    expect(normalizeStayDate("no")).toBe("")
    expect(normalizeHotelReservationStatus("CHECKIN")).toBe("checkin")
    expect(normalizeHotelReservationStatus("basura")).toBe("confirmada")
  })

  it("detecta solape de rangos [inicio, fin)", () => {
    const a = { checkIn: "2026-07-22", checkOut: "2026-07-25" }
    // Comparte noches
    expect(stayRangesOverlap(a, { checkIn: "2026-07-24", checkOut: "2026-07-26" })).toBe(true)
    // El checkout de uno = checkin del otro: NO solapa (habitación se libera ese día)
    expect(stayRangesOverlap(a, { checkIn: "2026-07-25", checkOut: "2026-07-27" })).toBe(false)
    // Totalmente antes
    expect(stayRangesOverlap(a, { checkIn: "2026-07-19", checkOut: "2026-07-22" })).toBe(false)
  })

  it("encuentra conflicto por habitación e ignora estados no bloqueantes", () => {
    const reservations: ConflictCandidate[] = [
      { id: "r1", roomId: "101", checkInDate: "2026-07-22", checkOutDate: "2026-07-25", status: "confirmada", guestName: "Ana" },
      { id: "r2", roomId: "101", checkInDate: "2026-07-26", checkOutDate: "2026-07-28", status: "cancelada", guestName: "Beto" },
    ]

    // Choca con r1 (confirmada)
    expect(
      findRoomStayConflict(reservations, {
        roomId: "101",
        range: { checkIn: "2026-07-24", checkOut: "2026-07-27" },
      })?.id,
    ).toBe("r1")

    // El rango de r2 está cancelado -> libre
    expect(
      findRoomStayConflict(reservations, {
        roomId: "101",
        range: { checkIn: "2026-07-26", checkOut: "2026-07-28" },
      }),
    ).toBeNull()

    // Otra habitación -> libre
    expect(
      findRoomStayConflict(reservations, {
        roomId: "102",
        range: { checkIn: "2026-07-22", checkOut: "2026-07-25" },
      }),
    ).toBeNull()

    // Editando la propia reserva -> se ignora a sí misma
    expect(
      findRoomStayConflict(reservations, {
        roomId: "101",
        range: { checkIn: "2026-07-22", checkOut: "2026-07-25" },
        ignoreReservationId: "r1",
      }),
    ).toBeNull()
  })
})
