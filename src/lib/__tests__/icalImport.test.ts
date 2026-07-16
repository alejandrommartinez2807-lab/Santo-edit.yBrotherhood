import { describe, expect, it } from "vitest"
import { parseIcalEvents, planIcalSync, unfoldIcsLines } from "@/lib/icalImport"

const SAMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260810",
  "DTEND;VALUE=DATE:20260813",
  "UID:abc123@airbnb.com",
  "SUMMARY:Reserved - Airbnb",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20260901T140000Z",
  "DTEND:20260903T100000Z",
  "UID:xyz@booking.com",
  // Línea doblada (continuación con espacio inicial), como manda el RFC 5545.
  "SUMMARY:CLOSED - ",
  " Not available",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261005",
  "UID:un-dia@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n")

describe("parseIcalEvents", () => {
  it("parsea DATE, DATE-TIME, líneas dobladas y DTEND ausente", () => {
    const events = parseIcalEvents(SAMPLE_ICS)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ from: "2026-08-10", to: "2026-08-13", uid: "abc123@airbnb.com" })
    expect(events[1]).toMatchObject({ from: "2026-09-01", to: "2026-09-03" })
    expect(events[1].summary).toBe("CLOSED - Not available")
    // Sin DTEND: dura un día.
    expect(events[2]).toMatchObject({ from: "2026-10-05", to: "2026-10-06" })
  })

  it("ignora eventos rotos y texto que no es iCal", () => {
    expect(parseIcalEvents("")).toEqual([])
    expect(parseIcalEvents("no es un calendario")).toEqual([])
    const broken = "BEGIN:VEVENT\r\nSUMMARY:sin fechas\r\nEND:VEVENT"
    expect(parseIcalEvents(broken)).toEqual([])
  })
})

describe("unfoldIcsLines", () => {
  it("une continuaciones con espacio o tab", () => {
    expect(unfoldIcsLines("A:1\r\n b\r\nB:2")).toEqual(["A:1b", "B:2"])
  })
})

describe("planIcalSync", () => {
  const TODAY = "2026-07-16"

  it("crea los eventos nuevos y borra los ical que ya no están, sin tocar manuales", () => {
    const plan = planIcalSync({
      existing: [
        { id: "m1", fromDate: "2026-08-10", toDate: "2026-08-13", source: "manual" },
        { id: "i1", fromDate: "2026-08-20", toDate: "2026-08-22", source: "ical" },
        { id: "i2", fromDate: "2026-09-01", toDate: "2026-09-03", source: "ical" },
      ],
      events: [
        { from: "2026-09-01", to: "2026-09-03" }, // ya existe como i2 → no se recrea
        { from: "2026-10-01", to: "2026-10-04", summary: "Airbnb" }, // nuevo
      ],
      todayISO: TODAY,
    })
    expect(plan.toCreate).toEqual([{ fromDate: "2026-10-01", toDate: "2026-10-04", reason: "OTA: Airbnb" }])
    // i1 desapareció del feed → se borra; m1 es manual → intocable.
    expect(plan.toDeleteIds).toEqual(["i1"])
  })

  it("ignora eventos pasados y conserva bloqueos ical históricos", () => {
    const plan = planIcalSync({
      existing: [{ id: "viejo", fromDate: "2026-06-01", toDate: "2026-06-03", source: "ical" }],
      events: [{ from: "2026-05-01", to: "2026-05-04" }],
      todayISO: TODAY,
    })
    expect(plan.toCreate).toEqual([])
    expect(plan.toDeleteIds).toEqual([])
  })
})
