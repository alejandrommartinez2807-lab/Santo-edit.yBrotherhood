import { describe, it, expect } from "vitest"
import {
  computeHotelDailySeries,
  computeHotelReport,
  computeRoomTypeBreakdown,
  computeSourceBreakdown,
  computeStayStats,
  consolidateHotelReports,
  nightsInPeriod,
} from "../hotelReports"

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

  it("arma la serie noche a noche (ocupación e ingreso devengado)", () => {
    const daily = computeHotelDailySeries({
      roomCount: 2,
      from: "2026-06-01",
      to: "2026-06-04", // 3 noches
      reservations: [
        { checkInDate: "2026-06-01", checkOutDate: "2026-06-03", ratePerNight: 100, status: "confirmada" },
        { checkInDate: "2026-06-02", checkOutDate: "2026-06-05", ratePerNight: 50, status: "checkin" },
        { checkInDate: "2026-06-01", checkOutDate: "2026-06-04", ratePerNight: 999, status: "cancelada" },
      ],
    })
    expect(daily).toEqual([
      { date: "2026-06-01", sold: 1, occupancy: 0.5, revenue: 100 },
      { date: "2026-06-02", sold: 2, occupancy: 1, revenue: 150 },
      { date: "2026-06-03", sold: 1, occupancy: 0.5, revenue: 50 },
    ])
  })

  it("desglosa por tipo de habitación y por canal", () => {
    const reservations = [
      { checkInDate: "2026-06-01", checkOutDate: "2026-06-03", ratePerNight: 100, status: "confirmada", roomTypeId: "suite", source: "web" },
      { checkInDate: "2026-06-02", checkOutDate: "2026-06-04", ratePerNight: 50, status: "checkin", roomTypeId: "doble", source: "recepcion" },
      { checkInDate: "2026-06-01", checkOutDate: "2026-06-02", ratePerNight: 80, status: "confirmada", roomTypeId: "suite", source: "" },
    ]
    const byType = computeRoomTypeBreakdown({ from: "2026-06-01", to: "2026-06-11", reservations })
    expect(byType[0]).toEqual({ key: "suite", nights: 3, revenue: 280, reservations: 2 })
    expect(byType[1]).toEqual({ key: "doble", nights: 2, revenue: 100, reservations: 1 })

    const bySource = computeSourceBreakdown({ from: "2026-06-01", to: "2026-06-11", reservations })
    const web = bySource.find((r) => r.key === "web")
    const desk = bySource.find((r) => r.key === "recepcion")
    expect(web).toEqual({ key: "web", nights: 2, revenue: 200, reservations: 1 })
    // Sin source declarado cuenta como recepción.
    expect(desk).toEqual({ key: "recepcion", nights: 3, revenue: 180, reservations: 2 })
  })

  it("calcula estancia media, huéspedes y tasa de cancelación", () => {
    const stats = computeStayStats({
      from: "2026-06-01",
      to: "2026-06-11",
      reservations: [
        { checkInDate: "2026-06-01", checkOutDate: "2026-06-03", ratePerNight: 100, status: "confirmada", adults: 2, children: 1 },
        { checkInDate: "2026-06-02", checkOutDate: "2026-06-06", ratePerNight: 100, status: "checkin", adults: 1, children: 0 },
        { checkInDate: "2026-06-04", checkOutDate: "2026-06-06", ratePerNight: 100, status: "cancelada", adults: 2, children: 0 },
        { checkInDate: "2026-06-05", checkOutDate: "2026-06-07", ratePerNight: 100, status: "no_show", adults: 1, children: 0 },
      ],
    })
    expect(stats.avgStayNights).toBe(3) // (2 + 4) / 2
    expect(stats.adults).toBe(3)
    expect(stats.children).toBe(1)
    expect(stats.guests).toBe(4)
    expect(stats.cancelled).toBe(1)
    expect(stats.noShow).toBe(1)
    expect(stats.cancellationRate).toBe(0.5) // 2 de 4
  })
})

describe("consolidateHotelReports", () => {
  const reportOf = (roomCount: number, sold: number, revenue: number, days = 10) => ({
    from: "2026-06-01",
    to: "2026-06-11",
    daysInPeriod: days,
    roomCount,
    roomNightsAvailable: roomCount * days,
    roomNightsSold: sold,
    roomRevenue: revenue,
    occupancy: 0,
    adr: 0,
    revPar: 0,
    reservationsCounted: 0,
    countsByStatus: {},
  })

  it("suma sedes y recalcula los KPIs desde las sumas (no promedia %)", () => {
    const grande = { branchId: "a", branchName: "Valencia", report: reportOf(20, 100, 8000), arrivalsToday: 3, departuresToday: 2, inHouse: 12 }
    const chica = { branchId: "b", branchName: "Morrocoy", report: reportOf(2, 20, 1000), arrivalsToday: 1, departuresToday: 0, inHouse: 2 }
    const c = consolidateHotelReports([grande, chica])
    expect(c.properties).toBe(2)
    expect(c.roomCount).toBe(22)
    expect(c.roomNightsAvailable).toBe(220)
    expect(c.roomNightsSold).toBe(120)
    expect(c.roomRevenue).toBe(9000)
    expect(c.occupancy).toBe(round2Test(120 / 220))
    expect(c.adr).toBe(75)
    expect(c.revPar).toBe(round2Test(9000 / 220))
    expect(c.arrivalsToday).toBe(4)
    expect(c.departuresToday).toBe(2)
    expect(c.inHouse).toBe(14)
  })

  it("grupo vacío o sin disponibilidad no divide por cero", () => {
    expect(consolidateHotelReports([]).occupancy).toBe(0)
    const sinHab = { branchId: "x", branchName: "Nueva", report: reportOf(0, 0, 0), arrivalsToday: 0, departuresToday: 0, inHouse: 0 }
    const c = consolidateHotelReports([sinHab])
    expect(c.adr).toBe(0)
    expect(c.revPar).toBe(0)
  })
})

function round2Test(v: number) {
  return Math.round(v * 100) / 100
}
