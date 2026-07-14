// ============================================================
// CHANNEL MANAGER · iCal (Hotel · Fase 17)
// Genera un feed iCal (.ics) de las reservas del hotel para que las OTAs
// (Booking, Airbnb) se suscriban y vean las fechas ocupadas. Sin API externa.
// Solo lógica pura de armado de texto. Sin DB.
// ============================================================

export type IcalEvent = {
  uid: string
  start: string // "YYYY-MM-DD" (inclusive)
  end: string // "YYYY-MM-DD" (exclusive, como el checkout)
  summary: string
}

function icsDate(iso: string): string {
  return String(iso || "").replace(/-/g, "").slice(0, 8)
}

function escapeText(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

/** Arma el texto iCal (VCALENDAR con un VEVENT por reserva, día completo). */
export function buildIcal(events: IcalEvent[], calendarName = "Hotel"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santo Hotel//PMS//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]
  for (const event of events) {
    const start = icsDate(event.start)
    const end = icsDate(event.end)
    if (start.length !== 8 || end.length !== 8) continue
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(event.summary)}`,
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  // iCal usa CRLF entre líneas.
  return lines.join("\r\n")
}
