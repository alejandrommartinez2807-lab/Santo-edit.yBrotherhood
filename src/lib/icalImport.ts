// ============================================================
// Hotel · P3-G · Importar iCal (Airbnb/Booking) — lógica PURA.
//
// Parsea un .ics externo a rangos [from, to) y planifica la sincronización
// contra los bloqueos existentes: SOLO se crean/borran bloqueos de fuente
// "ical"; los manuales del staff jamás se tocan. Sin DB ni red.
// ============================================================

export type ParsedIcalEvent = {
  uid: string
  summary: string
  from: string // YYYY-MM-DD inclusive
  to: string // YYYY-MM-DD exclusivo (como el checkout)
}

const DAY_MS = 24 * 60 * 60 * 1000

function toIsoDate(icsValue: string): string {
  // Acepta 20260721 (DATE) y 20260721T140000Z (DATE-TIME): solo importa el día.
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(icsValue || "").trim())
  if (!m) return ""
  return `${m[1]}-${m[2]}-${m[3]}`
}

function addDaysISO(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/**
 * Des-dobla las líneas iCal (una línea que empieza con espacio o tab continúa
 * la anterior) y separa en líneas lógicas.
 */
export function unfoldIcsLines(ics: string): string[] {
  const raw = String(ics || "").split(/\r?\n/)
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** Extrae los VEVENT con su rango de días [from, to). */
export function parseIcalEvents(ics: string): ParsedIcalEvent[] {
  const lines = unfoldIcsLines(ics)
  const events: ParsedIcalEvent[] = []
  let current: Partial<ParsedIcalEvent> | null = null

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (upper.startsWith("BEGIN:VEVENT")) {
      current = {}
      continue
    }
    if (upper.startsWith("END:VEVENT")) {
      if (current?.from) {
        // DTEND ausente en eventos de día completo = dura un día.
        const to = current.to && current.to > current.from ? current.to : addDaysISO(current.from, 1)
        events.push({
          uid: current.uid || "",
          summary: current.summary || "",
          from: current.from,
          to,
        })
      }
      current = null
      continue
    }
    if (!current) continue

    // "PROP;PARAMS:valor" — separa nombre de propiedad y valor.
    const colon = line.indexOf(":")
    if (colon < 0) continue
    const prop = line.slice(0, colon).split(";")[0].toUpperCase()
    const value = line.slice(colon + 1)

    if (prop === "DTSTART") current.from = toIsoDate(value)
    if (prop === "DTEND") current.to = toIsoDate(value)
    if (prop === "UID") current.uid = value.trim()
    if (prop === "SUMMARY") current.summary = value.trim()
  }

  return events.filter((e) => e.from && e.to && e.to > e.from)
}

export type ExistingBlockForSync = {
  id: string
  fromDate: string
  toDate: string
  source: string
}

export type IcalSyncPlan = {
  toCreate: { fromDate: string; toDate: string; reason: string }[]
  toDeleteIds: string[]
}

/**
 * Compara el feed externo con los bloqueos existentes de UNA habitación.
 * - Crea bloqueos "ical" para eventos futuros que aún no existen.
 * - Borra bloqueos "ical" vigentes que ya no aparecen en el feed.
 * - NUNCA toca bloqueos manuales ni bloqueos "ical" ya pasados (historia).
 */
export function planIcalSync(params: {
  existing: ExistingBlockForSync[]
  events: { from: string; to: string; summary?: string }[]
  todayISO: string
}): IcalSyncPlan {
  const today = String(params.todayISO || "").slice(0, 10)

  // Solo los eventos con noches por delante importan (to exclusivo > hoy).
  const futureEvents = (params.events || []).filter((e) => e.to > today)
  const eventKeys = new Set(futureEvents.map((e) => `${e.from}|${e.to}`))

  const icalBlocks = (params.existing || []).filter((b) => b.source === "ical")
  const existingKeys = new Set(icalBlocks.map((b) => `${b.fromDate}|${b.toDate}`))

  const toCreate = futureEvents
    .filter((e) => !existingKeys.has(`${e.from}|${e.to}`))
    .map((e) => ({
      fromDate: e.from,
      toDate: e.to,
      reason: `OTA: ${String(e.summary || "reservado externo").slice(0, 80)}`,
    }))

  const toDeleteIds = icalBlocks
    .filter((b) => b.toDate > today) // los pasados quedan como historia
    .filter((b) => !eventKeys.has(`${b.fromDate}|${b.toDate}`))
    .map((b) => b.id)

  return { toCreate, toDeleteIds }
}
