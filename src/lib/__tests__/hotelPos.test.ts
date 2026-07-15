import { describe, it, expect } from "vitest"
import { hotelPosAreaForLocation, isRoomServiceLocation } from "../hotelPos"

describe("hotelPos", () => {
  it("detecta habitaciones con los nombres usuales de los QR", () => {
    expect(isRoomServiceLocation("Habitación 101")).toBe(true)
    expect(isRoomServiceLocation("habitacion 5")).toBe(true) // sin acento
    expect(isRoomServiceLocation("HABITACIÓN 12")).toBe(true)
    expect(isRoomServiceLocation("Hab 7")).toBe(true)
    expect(isRoomServiceLocation("Hab. 3")).toBe(true)
    expect(isRoomServiceLocation("Suite 2")).toBe(true)
    expect(isRoomServiceLocation("Room 44")).toBe(true)
    expect(isRoomServiceLocation("Suite Presidencial")).toBe(true)
  })

  it("las ubicaciones del restaurante NO son habitaciones", () => {
    expect(isRoomServiceLocation("Mesa 4")).toBe(false)
    expect(isRoomServiceLocation("Barra")).toBe(false)
    expect(isRoomServiceLocation("Afuera")).toBe(false)
    expect(isRoomServiceLocation("Para llevar")).toBe(false)
    expect(isRoomServiceLocation("Delivery - Centro")).toBe(false)
    expect(isRoomServiceLocation("")).toBe(false)
    expect(isRoomServiceLocation(null)).toBe(false)
    // "Rehabilitación" u otras palabras que contienen "hab" no cuentan.
    expect(isRoomServiceLocation("Rehabilitacion")).toBe(false)
  })

  it("asigna el submódulo del POS", () => {
    expect(hotelPosAreaForLocation("Habitación 101")).toBe("habitaciones")
    expect(hotelPosAreaForLocation("Mesa 1")).toBe("restaurante")
  })
})
