import { describe, it, expect } from "vitest"
import { buildIcal } from "../icalFeed"

describe("icalFeed", () => {
  it("arma un VCALENDAR con un VEVENT por reserva (día completo)", () => {
    const ics = buildIcal(
      [{ uid: "res-1", start: "2026-08-01", end: "2026-08-03", summary: "Ocupada 101" }],
      "Lidotel",
    )
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("X-WR-CALNAME:Lidotel")
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("UID:res-1")
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801")
    expect(ics).toContain("DTEND;VALUE=DATE:20260803")
    expect(ics).toContain("END:VCALENDAR")
    expect(ics).toContain("\r\n")
  })

  it("omite eventos con fechas inválidas", () => {
    const ics = buildIcal([{ uid: "x", start: "", end: "2026-08-03", summary: "mala" }])
    expect(ics).not.toContain("BEGIN:VEVENT")
  })
})
