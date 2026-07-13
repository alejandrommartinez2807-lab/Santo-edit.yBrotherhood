import { describe, it, expect } from "vitest"
import {
  availableTypesForStay,
  freeRoomsOfType,
  pickFreeRoomOfType,
  type AvailabilityRoom,
  type AvailabilityRoomType,
} from "../hotelAvailability"
import type { ConflictCandidate } from "../hotelReservationConflicts"

const rooms: AvailabilityRoom[] = [
  { id: "r1", roomTypeId: "A", active: true, outOfService: false },
  { id: "r2", roomTypeId: "A", active: true, outOfService: false },
  { id: "r3", roomTypeId: "A", active: true, outOfService: true }, // fuera de servicio
  { id: "r4", roomTypeId: "B", active: true, outOfService: false },
  { id: "r5", roomTypeId: "B", active: false, outOfService: false }, // inactiva
]

const roomTypes: AvailabilityRoomType[] = [
  { id: "A", name: "Doble", baseRate: 100, baseCapacity: 2, active: true },
  { id: "B", name: "Suite", baseRate: 200, baseCapacity: 3, active: true },
]

const checkIn = "2026-06-10"
const checkOut = "2026-06-12" // 2 noches

// r1 ocupada por una reserva confirmada que solapa el rango.
const reservations: ConflictCandidate[] = [
  { id: "x1", roomId: "r1", checkInDate: "2026-06-11", checkOutDate: "2026-06-13", status: "confirmada" },
  // cancelada NO bloquea:
  { id: "x2", roomId: "r2", checkInDate: "2026-06-10", checkOutDate: "2026-06-12", status: "cancelada" },
]

describe("hotelAvailability", () => {
  it("cuenta habitaciones libres de un tipo (activa, en servicio, sin solape)", () => {
    const freeA = freeRoomsOfType({ rooms, reservations, roomTypeId: "A", checkIn, checkOut })
    // r1 bloqueada, r3 fuera de servicio, r2 libre (su reserva está cancelada)
    expect(freeA.map((r) => r.id)).toEqual(["r2"])

    const freeB = freeRoomsOfType({ rooms, reservations, roomTypeId: "B", checkIn, checkOut })
    // r4 libre, r5 inactiva
    expect(freeB.map((r) => r.id)).toEqual(["r4"])
  })

  it("lista tipos disponibles con precio cotizado (sin temporada = base)", () => {
    const types = availableTypesForStay({ rooms, roomTypes, reservations, seasons: [], checkIn, checkOut })
    const a = types.find((t) => t.roomTypeId === "A")
    const b = types.find((t) => t.roomTypeId === "B")

    expect(a?.freeCount).toBe(1)
    expect(a?.quote.nights).toBe(2)
    expect(a?.quote.total).toBe(200) // 2 × 100
    expect(b?.freeCount).toBe(1)
    expect(b?.quote.total).toBe(400) // 2 × 200
  })

  it("omite un tipo sin habitaciones libres", () => {
    // Bloquea también r2 -> tipo A sin libres
    const full: ConflictCandidate[] = [
      ...reservations,
      { id: "x3", roomId: "r2", checkInDate: "2026-06-09", checkOutDate: "2026-06-15", status: "checkin" },
    ]
    const types = availableTypesForStay({ rooms, roomTypes, reservations: full, seasons: [], checkIn, checkOut })
    expect(types.map((t) => t.roomTypeId)).toEqual(["B"])
  })

  it("elige la primera habitación libre del tipo", () => {
    const pick = pickFreeRoomOfType({ rooms, reservations, roomTypeId: "A", checkIn, checkOut })
    expect(pick?.id).toBe("r2")
    const none = pickFreeRoomOfType({ rooms, reservations, roomTypeId: "ZZ", checkIn, checkOut })
    expect(none).toBeNull()
  })

  it("un bloqueo que solapa quita la habitación de la disponibilidad", () => {
    // Bloqueo de r2 (única Doble libre) solapando el rango -> tipo A sin libres.
    const blocks = [{ roomId: "r2", fromDate: "2026-06-11", toDate: "2026-06-13" }]
    const freeA = freeRoomsOfType({ rooms, reservations, roomTypeId: "A", checkIn, checkOut, blocks })
    expect(freeA).toEqual([])

    const types = availableTypesForStay({ rooms, roomTypes, reservations, seasons: [], checkIn, checkOut, blocks })
    expect(types.map((t) => t.roomTypeId)).toEqual(["B"])

    // Un bloqueo que NO solapa (otras fechas) no afecta.
    const otherBlocks = [{ roomId: "r2", fromDate: "2026-07-01", toDate: "2026-07-05" }]
    const stillFree = freeRoomsOfType({ rooms, reservations, roomTypeId: "A", checkIn, checkOut, blocks: otherBlocks })
    expect(stillFree.map((r) => r.id)).toEqual(["r2"])
  })
})
