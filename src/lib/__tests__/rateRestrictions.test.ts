import { describe, it, expect } from "vitest"
import { evaluateStayRestrictions, isStayAllowed, type RateRestrictionLike } from "../rateRestrictions"

describe("rateRestrictions", () => {
  it("sin restricciones, cualquier estadía válida se permite", () => {
    expect(isStayAllowed({ restrictions: [], roomTypeId: "A", checkIn: "2026-06-01", checkOut: "2026-06-02" })).toBe(true)
  })

  it("aplica estancia mínima según la fecha de llegada", () => {
    const restrictions: RateRestrictionLike[] = [
      { roomTypeId: "", fromDate: "2026-12-24", toDate: "2026-12-26", minStay: 3 },
    ]
    // 2 noches < 3 -> no
    const r2 = evaluateStayRestrictions({ restrictions, roomTypeId: "A", checkIn: "2026-12-24", checkOut: "2026-12-26" })
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toContain("mínima")
    // 3 noches -> sí
    expect(isStayAllowed({ restrictions, roomTypeId: "A", checkIn: "2026-12-24", checkOut: "2026-12-27" })).toBe(true)
  })

  it("cerrado a llegada (CTA) bloquea entrar ese día", () => {
    const restrictions: RateRestrictionLike[] = [
      { roomTypeId: "", fromDate: "2026-12-25", toDate: "2026-12-25", closedToArrival: true },
    ]
    expect(isStayAllowed({ restrictions, roomTypeId: "A", checkIn: "2026-12-25", checkOut: "2026-12-27" })).toBe(false)
    // Llegar el 24 (fuera del CTA) sí se permite.
    expect(isStayAllowed({ restrictions, roomTypeId: "A", checkIn: "2026-12-24", checkOut: "2026-12-26" })).toBe(true)
  })

  it("cerrado a salida (CTD) bloquea salir ese día", () => {
    const restrictions: RateRestrictionLike[] = [
      { roomTypeId: "", fromDate: "2026-12-25", toDate: "2026-12-25", closedToDeparture: true },
    ]
    expect(isStayAllowed({ restrictions, roomTypeId: "A", checkIn: "2026-12-23", checkOut: "2026-12-25" })).toBe(false)
  })

  it("una regla de un tipo no afecta a otro tipo, y las inactivas se ignoran", () => {
    const restrictions: RateRestrictionLike[] = [
      { roomTypeId: "A", fromDate: "2026-12-01", toDate: "2026-12-31", minStay: 5 },
      { roomTypeId: "", fromDate: "2026-12-01", toDate: "2026-12-31", minStay: 9, active: false },
    ]
    // Tipo B no está afectado por la regla de A; la global está inactiva.
    expect(isStayAllowed({ restrictions, roomTypeId: "B", checkIn: "2026-12-10", checkOut: "2026-12-11" })).toBe(true)
    // Tipo A sí: 1 noche < 5.
    expect(isStayAllowed({ restrictions, roomTypeId: "A", checkIn: "2026-12-10", checkOut: "2026-12-11" })).toBe(false)
  })
})
