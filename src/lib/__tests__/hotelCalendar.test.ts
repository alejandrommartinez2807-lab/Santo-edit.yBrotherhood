import { describe, it, expect } from "vitest"
import { buildTapeChart, calendarDays } from "../hotelCalendar"

const rooms = [
  { id: "r1", name: "101", sortOrder: 1 },
  { id: "r2", name: "102", sortOrder: 2, outOfService: true },
  { id: "r3", name: "103", sortOrder: 3 },
]

const reservations = [
  { id: "A", roomId: "r1", code: "AAA", guestName: "Ana Perez", checkInDate: "2026-06-10", checkOutDate: "2026-06-12", status: "confirmada" },
  { id: "B", roomId: "r3", code: "BBB", guestName: "Beto Ruiz", checkInDate: "2026-06-11", checkOutDate: "2026-06-13", status: "checkin" },
  // cancelada NO ocupa:
  { id: "C", roomId: "r1", code: "CCC", guestName: "Cancel", checkInDate: "2026-06-11", checkOutDate: "2026-06-14", status: "cancelada" },
]

describe("hotelCalendar", () => {
  it("genera la ventana de días", () => {
    expect(calendarDays("2026-06-10", 4)).toEqual([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
    ])
  })

  it("marca ocupación por habitación y día (checkout exclusivo)", () => {
    const chart = buildTapeChart({ rooms, reservations, startDate: "2026-06-10", days: 4 })
    expect(chart.days).toHaveLength(4)

    const byId = Object.fromEntries(chart.rows.map((row) => [row.room.id, row.cells]))

    // r1: ocupada 10 (inicio, Ana) y 11; libre 12 y 13 (la cancelada no cuenta)
    expect(byId.r1.map((c) => c.state)).toEqual(["occupied", "occupied", "free", "free"])
    expect(byId.r1[0].isStart).toBe(true)
    expect(byId.r1[0].guestName).toBe("Ana Perez")
    expect(byId.r1[1].isStart).toBe(false)

    // r2: fuera de servicio -> todo "out"
    expect(byId.r2.every((c) => c.state === "out")).toBe(true)

    // r3: libre 10; ocupada 11 (inicio) y 12; libre 13
    expect(byId.r3.map((c) => c.state)).toEqual(["free", "occupied", "occupied", "free"])
    expect(byId.r3[1].isStart).toBe(true)
  })

  it("cuenta la ocupación por día (sin contar fuera de servicio)", () => {
    const chart = buildTapeChart({ rooms, reservations, startDate: "2026-06-10", days: 4 })
    expect(chart.occupancyByDay).toEqual([1, 2, 1, 0])
  })
})
