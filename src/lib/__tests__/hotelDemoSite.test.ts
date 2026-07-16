import { describe, expect, it } from "vitest"
import {
  DEMO_ROOM_TYPES,
  DEMO_SERVICES,
  demoAvailabilityPayload,
  demoReservationPayload,
  demoReviewsPayload,
  demoServiceBookingPayload,
} from "../hotelDemoSite"

// El modo demo estático responde las APIs públicas del hotel sin base de
// datos: estas pruebas fijan la forma y la aritmética de esos payloads.

describe("demoAvailabilityPayload", () => {
  it("rango inválido: responde habilitado pero sin tipos ni noches", () => {
    const payload = demoAvailabilityPayload("2026-08-10", "2026-08-10")
    expect(payload.enabled).toBe(true)
    expect(payload.nights).toBe(0)
    expect(payload.types).toEqual([])
  })

  it("rango válido: cotiza cada tipo por noche sin temporada", () => {
    const payload = demoAvailabilityPayload("2026-08-10", "2026-08-13")
    expect(payload.nights).toBe(3)
    expect(payload.types).toHaveLength(DEMO_ROOM_TYPES.length)
    for (const [i, type] of payload.types.entries()) {
      expect(type.quote.total).toBe(DEMO_ROOM_TYPES[i].baseRate * 3)
      expect(type.quote.averageRate).toBe(DEMO_ROOM_TYPES[i].baseRate)
      expect(type.quote.seasonApplied).toBe(false)
    }
    expect(payload.upsell.services.length).toBeGreaterThan(0)
  })
})

describe("demoReservationPayload", () => {
  const base = {
    roomTypeId: DEMO_ROOM_TYPES[0].roomTypeId,
    guestName: "Ana Prueba",
    guestPhone: "04121234567",
    termsAccepted: true,
    checkIn: "2026-08-10",
    checkOut: "2026-08-12",
  }

  it("reserva simulada: 201 con código y total noches × tarifa", () => {
    const result = demoReservationPayload({ ...base })
    expect(result.status).toBe(201)
    if (result.payload.ok !== true) throw new Error("esperaba ok")
    const r = result.payload.reservation
    expect(String(r.code)).toMatch(/^[A-Z2-9]{5}$/)
    expect(r.nights).toBe(2)
    expect(r.totalAmount).toBe(DEMO_ROOM_TYPES[0].baseRate * 2)
    expect(r.roomTypeName).toBe(DEMO_ROOM_TYPES[0].name)
  })

  it("suma extras: servicios por persona + paquete", () => {
    const service = DEMO_SERVICES[0]
    const result = demoReservationPayload({
      ...base,
      services: [{ id: service.id, people: 2 }],
      packageId: "demo-romance",
    })
    if (result.payload.ok !== true) throw new Error("esperaba ok")
    const r = result.payload.reservation as { extrasTotal: number; packageName: string }
    expect(r.packageName).toBeTruthy()
    expect(r.extrasTotal).toBeGreaterThanOrEqual(service.price * 2)
  })

  it("valida igual que el endpoint real: términos, nombre y fechas", () => {
    expect(demoReservationPayload({ ...base, termsAccepted: false }).status).toBe(400)
    expect(demoReservationPayload({ ...base, guestName: "yo" }).status).toBe(400)
    expect(demoReservationPayload({ ...base, checkOut: base.checkIn }).status).toBe(400)
    expect(demoReservationPayload({ ...base, roomTypeId: "no-existe" }).status).toBe(404)
  })
})

describe("demo reseñas y servicios", () => {
  it("el resumen de reseñas promedia la lista demo", () => {
    const payload = demoReviewsPayload()
    expect(payload.summary.count).toBe(payload.reviews.length)
    expect(payload.summary.average).toBeGreaterThan(0)
    expect(payload.summary.average).toBeLessThanOrEqual(5)
  })

  it("reserva de servicio simulada: 201 con nombre y fecha", () => {
    const result = demoServiceBookingPayload({ serviceId: DEMO_SERVICES[0].id, date: "2026-08-10" })
    expect(result.status).toBe(201)
    if (result.payload.ok !== true) throw new Error("esperaba ok")
    expect(result.payload.booking.serviceName).toBe(DEMO_SERVICES[0].name)
    expect(demoServiceBookingPayload({ serviceId: "nada", date: "2026-08-10" }).status).toBe(404)
  })
})
