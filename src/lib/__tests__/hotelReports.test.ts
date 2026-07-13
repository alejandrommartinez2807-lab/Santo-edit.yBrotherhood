import { describe, it, expect } from "vitest"
import { computeHotelReport, nightsInPeriod } from "../hotelReports"

describe("hotelReports", () => {
  it("recorta las noches de una reserva al periodo", () => {
    const r = { checkInDate: "2026-06-02", checkOutDate: "2026-06-05" }
    expect(nightsInPeriod(r, "2026-06-01", "2026-06-11")).toBe(3) // dentro
    expect(nightsInPeriod({ checkInDate: "2026-05-30", checkOutDate: "2026-06-03" }, "2026-06-01", "2026-06-11")).toBe(2) // entra por la izquierda
    expect(nightsInPeriod({ checkInDate: "2026-06-09", checkOutDate: "2026-06-14" }, "2026-06-01", "2026-06-11")).toBe(2) // sale por la derecha
    expect(nightsInPeriod({ checkInDate: "2026-06-15", checkOutDate: "2026-06-18" }, "2026-06-01", "2026-06-11")).toBe(0) // fuera
  })

  it("calcula ocupación, ADR y RevPAR e ignora canceladas/no-show", () => {
    const report = computeHotelReport({
      roomCount: 2,
      from: "2026-06-01",
      to: "2026-06-11", // 10 noches → 20 noches disponibles
      reservations: [
        { checkInDate: "2026-06-02", checkOutDate: "2026-06-05", ratePerNight: 100, status: "confirmada" }, // 3n × 100
        { checkInDate: "2026-05-30", checkOutDate: "2026-06-03", ratePerNight: 200, status: "checkin" }, // 2n × 200 (recortada)
        { checkInDate: "2026-06-04", checkOutDate: "2026-06-06", ratePerNight: 999, status: "cancelada" }, // ignorada
        { checkInDate: "2026-06-20", checkOutDate: "2026-06-22", ratePerNight: 999, status: "confirmada" }, // fuera
      ],
    })

    expect(report.daysInPeriod).toBe(10)
    expect(report.roomNightsAvailable).toBe(20)
    expect(report.roomNightsSold).toBe(5) // 3 + 2
    expect(report.roomRevenue).toBe(700) // 300 + 400
    expect(report.occupancy).toBe(0.25) // 5 / 20
    expect(report.adr).toBe(140) // 700 / 5
    expect(report.revPar).toBe(35) // 700 / 20
    expect(report.reservationsCounted).toBe(2)
    expect(report.countsByStatus).toEqual({ confirmada: 1, checkin: 1 })
  })

  it("evita dividir por cero sin habitaciones o sin ventas", () => {
    const empty = computeHotelReport({
      roomCount: 0,
      from: "2026-06-01",
      to: "2026-06-11",
      reservations: [],
    })
    expect(empty.occupancy).toBe(0)
    expect(empty.adr).toBe(0)
    expect(empty.revPar).toBe(0)
  })
})
