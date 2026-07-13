import { describe, it, expect } from "vitest"
import {
  bookedPeople,
  canBookService,
  normalizeServiceKind,
  remainingCapacity,
  type ServiceBookingLike,
} from "../resortServices"

const bookings: ServiceBookingLike[] = [
  { serviceId: "s1", date: "2026-08-01", time: "10:00", people: 2, status: "reservada" },
  { serviceId: "s1", date: "2026-08-01", time: "10:00", people: 1, status: "cumplida" },
  { serviceId: "s1", date: "2026-08-01", time: "10:00", people: 5, status: "cancelada" }, // no cuenta
  { serviceId: "s1", date: "2026-08-01", time: "12:00", people: 3, status: "reservada" }, // otra franja
  { serviceId: "s2", date: "2026-08-01", time: "10:00", people: 4, status: "reservada" }, // otro servicio
]

describe("resortServices", () => {
  it("normaliza el tipo de servicio", () => {
    expect(normalizeServiceKind("spa")).toBe("spa")
    expect(normalizeServiceKind("TOUR")).toBe("tour")
    expect(normalizeServiceKind("loquesea")).toBe("otro")
  })

  it("suma solo las personas de la misma franja y no cuenta canceladas", () => {
    expect(bookedPeople(bookings, "s1", "2026-08-01", "10:00")).toBe(3) // 2 + 1
    expect(bookedPeople(bookings, "s1", "2026-08-01", "12:00")).toBe(3)
    expect(bookedPeople(bookings, "s1", "2026-08-02", "10:00")).toBe(0)
  })

  it("calcula el cupo restante (nunca negativo)", () => {
    expect(remainingCapacity({ capacity: 4, bookings, serviceId: "s1", date: "2026-08-01", time: "10:00" })).toBe(1)
    expect(remainingCapacity({ capacity: 2, bookings, serviceId: "s1", date: "2026-08-01", time: "10:00" })).toBe(0)
  })

  it("permite reservar si cabe, y lo rechaza con razón si no", () => {
    const ok = canBookService({ capacity: 4, bookings, serviceId: "s1", date: "2026-08-01", time: "10:00", people: 1 })
    expect(ok.allowed).toBe(true)
    expect(ok.remaining).toBe(1)

    const no = canBookService({ capacity: 4, bookings, serviceId: "s1", date: "2026-08-01", time: "10:00", people: 2 })
    expect(no.allowed).toBe(false)
    expect(no.reason).toContain("Solo quedan 1")

    const full = canBookService({ capacity: 2, bookings, serviceId: "s1", date: "2026-08-01", time: "10:00", people: 1 })
    expect(full.allowed).toBe(false)
    expect(full.reason).toContain("Sin cupo")
  })
})
