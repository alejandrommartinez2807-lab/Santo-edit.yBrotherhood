import { describe, expect, it } from "vitest"
import {
  canMarkShift,
  isValidShiftTime,
  shiftAttendanceStatus,
  weekDaysFrom,
  weekStartISO,
} from "@/lib/hotelStaffShifts"

describe("weekStartISO", () => {
  it("devuelve el lunes de la semana (domingo pertenece a la semana anterior)", () => {
    expect(weekStartISO("2026-07-16")).toBe("2026-07-13") // jueves → lunes 13
    expect(weekStartISO("2026-07-13")).toBe("2026-07-13") // lunes → sí mismo
    expect(weekStartISO("2026-07-19")).toBe("2026-07-13") // domingo → lunes anterior
    expect(weekStartISO("basura")).toBe("")
  })
})

describe("weekDaysFrom", () => {
  it("lista los 7 días de la semana", () => {
    const days = weekDaysFrom("2026-07-13")
    expect(days).toHaveLength(7)
    expect(days[0]).toBe("2026-07-13")
    expect(days[6]).toBe("2026-07-19")
  })
})

describe("asistencia", () => {
  it("calcula el estado y las reglas de marcado", () => {
    const pendiente = {}
    const presente = { checkInAt: "2026-07-16T08:01:00Z" }
    const cumplido = { checkInAt: "2026-07-16T08:01:00Z", checkOutAt: "2026-07-16T16:00:00Z" }

    expect(shiftAttendanceStatus(pendiente)).toBe("pendiente")
    expect(shiftAttendanceStatus(presente)).toBe("presente")
    expect(shiftAttendanceStatus(cumplido)).toBe("cumplido")

    expect(canMarkShift(pendiente, "in")).toBe(true)
    expect(canMarkShift(pendiente, "out")).toBe(false) // no hay salida sin entrada
    expect(canMarkShift(presente, "in")).toBe(false) // la entrada solo una vez
    expect(canMarkShift(presente, "out")).toBe(true)
    expect(canMarkShift(cumplido, "out")).toBe(false)
  })
})

describe("isValidShiftTime", () => {
  it("acepta HH:MM de 24h y vacío; rechaza el resto", () => {
    expect(isValidShiftTime("07:00")).toBe(true)
    expect(isValidShiftTime("23:59")).toBe(true)
    expect(isValidShiftTime("")).toBe(true)
    expect(isValidShiftTime("24:00")).toBe(false)
    expect(isValidShiftTime("7am")).toBe(false)
  })
})
