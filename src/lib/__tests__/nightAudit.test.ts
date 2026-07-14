import { describe, it, expect } from "vitest"
import { dayAuditSummary } from "../nightAudit"

describe("nightAudit", () => {
  it("resume llegadas, salidas, en casa y pendientes de la fecha", () => {
    const reservations = [
      { checkInDate: "2026-06-10", checkOutDate: "2026-06-12", ratePerNight: 100, status: "checkin" }, // en casa el 10 y 11
      { checkInDate: "2026-06-10", checkOutDate: "2026-06-11", status: "confirmada" }, // llega hoy, aún no check-in (pendiente de llegada)
      { checkInDate: "2026-06-08", checkOutDate: "2026-06-10", status: "checkin" }, // sale hoy
      { checkInDate: "2026-06-10", checkOutDate: "2026-06-13", status: "cancelada" }, // ignorada
    ]
    const audit = dayAuditSummary({ reservations, date: "2026-06-10" })
    expect(audit.arrivals).toBe(2) // dos con checkIn = 10 (no la cancelada)
    expect(audit.pendingArrivals).toBe(1) // la confirmada sin check-in
    expect(audit.departures).toBe(1) // checkOut = 10
    expect(audit.inHouse).toBe(1) // solo la de status checkin que cubre la noche del 10
    expect(audit.roomRevenue).toBe(100)
  })
})
