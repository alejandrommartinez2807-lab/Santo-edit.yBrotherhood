// ============================================================
// TARIFAS POR TEMPORADA · lógica pura (Hotel · Fase 6)
//
// Una "temporada" ajusta la tarifa por noche de un tipo de habitación en un
// rango de fechas [startDate, endDate] (ambos inclusive; la noche del check-out
// no se cobra). Dos modos:
//   · fija   → la noche cuesta `rate` (precio cerrado de temporada).
//   · factor → la noche cuesta baseRate × `multiplier` (recargo/descuento).
// Si varias temporadas cubren una noche gana la de mayor `priority` (empate =
// rango más estrecho). Una temporada sin room_type_id aplica a TODOS los tipos.
//
// Todo es lógica pura y testeable (sin DB), como hotelReservationConflicts.ts,
// para poder calcular la sugerencia también en el cliente.
// ============================================================

import { nightsBetween, normalizeStayDate } from "./hotelReservationConflicts"

export const RATE_SEASON_MODES = ["fija", "factor"] as const
export type RateSeasonMode = (typeof RATE_SEASON_MODES)[number]

export function normalizeSeasonMode(value: unknown): RateSeasonMode {
  const clean = String(value || "").trim().toLowerCase()
  return (RATE_SEASON_MODES as readonly string[]).includes(clean)
    ? (clean as RateSeasonMode)
    : "fija"
}

// Forma mínima que necesita el cálculo (la comparten store y cliente).
export type RateSeasonLike = {
  id?: string
  name?: string
  roomTypeId?: string
  startDate: string
  endDate: string
  mode: RateSeasonMode | string
  rate?: number
  multiplier?: number
  priority?: number
  active?: boolean
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function daySpan(startISO: string, endISO: string): number {
  const start = Date.parse(`${startISO}T00:00:00Z`)
  const end = Date.parse(`${endISO}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

/** Suma `days` días a una fecha "YYYY-MM-DD" (en UTC). "" si la fecha es inválida. */
export function addDaysISO(iso: string, days: number): string {
  const base = normalizeStayDate(iso)
  if (!base) return ""
  const t = Date.parse(`${base}T00:00:00Z`)
  if (!Number.isFinite(t)) return ""
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10)
}

/** Noches de la estadía como fechas "YYYY-MM-DD" (checkOut exclusivo). */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const start = normalizeStayDate(checkIn)
  const nights = nightsBetween(checkIn, checkOut)
  if (!start || nights <= 0) return []
  return Array.from({ length: nights }, (_, i) => addDaysISO(start, i))
}

/** Una temporada cubre una noche si start ≤ noche ≤ end (ambos inclusive). */
export function seasonCoversNight(season: RateSeasonLike, nightISO: string): boolean {
  const start = normalizeStayDate(season.startDate)
  const end = normalizeStayDate(season.endDate)
  const night = normalizeStayDate(nightISO)
  if (!start || !end || !night) return false
  return start <= night && night <= end
}

/**
 * Elige la temporada aplicable a una noche para un tipo de habitación:
 * activa, que cubra la noche y que sea del tipo (o global). Gana la de mayor
 * prioridad; en empate, la de rango más estrecho. null si ninguna aplica.
 */
export function pickSeasonForNight(
  seasons: RateSeasonLike[],
  nightISO: string,
  roomTypeId: string,
): RateSeasonLike | null {
  const type = String(roomTypeId || "")
  const candidates = seasons.filter((season) => {
    if (season.active === false) return false
    const seasonType = String(season.roomTypeId || "")
    if (seasonType && seasonType !== type) return false
    return seasonCoversNight(season, nightISO)
  })
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const priorityDiff = (Number(b.priority) || 0) - (Number(a.priority) || 0)
    if (priorityDiff !== 0) return priorityDiff
    // Empate de prioridad: gana el rango más específico (más estrecho).
    return (
      daySpan(normalizeStayDate(a.startDate), normalizeStayDate(a.endDate)) -
      daySpan(normalizeStayDate(b.startDate), normalizeStayDate(b.endDate))
    )
  })
  return candidates[0]
}

/** Tarifa de una noche dada la tarifa base y la temporada aplicable (o null). */
export function nightlyRateFor(baseRate: number, season: RateSeasonLike | null): number {
  const base = Math.max(0, Number(baseRate) || 0)
  if (!season) return base
  const mode = normalizeSeasonMode(season.mode)
  if (mode === "fija") return Math.max(0, round2(Number(season.rate) || 0))
  const multiplier = Number(season.multiplier)
  return round2(base * (Number.isFinite(multiplier) ? multiplier : 1))
}

export type StayQuote = {
  nights: number
  total: number
  averageRate: number
  seasonApplied: boolean
  seasonNames: string[]
}

/**
 * Cotiza una estadía sumando la tarifa noche a noche según las temporadas.
 * `averageRate` es el promedio por noche (útil para rellenar el campo $/noche,
 * que el usuario siempre puede ajustar).
 */
export function quoteStay(params: {
  baseRate: number
  roomTypeId: string
  checkIn: string
  checkOut: string
  seasons: RateSeasonLike[]
}): StayQuote {
  const base = Math.max(0, Number(params.baseRate) || 0)
  const nights = eachNight(params.checkIn, params.checkOut)
  if (nights.length === 0) {
    return { nights: 0, total: 0, averageRate: base, seasonApplied: false, seasonNames: [] }
  }

  let total = 0
  const names = new Set<string>()
  for (const night of nights) {
    const season = pickSeasonForNight(params.seasons, night, params.roomTypeId)
    total += nightlyRateFor(base, season)
    if (season?.name) names.add(String(season.name))
  }
  total = round2(total)

  return {
    nights: nights.length,
    total,
    averageRate: round2(total / nights.length),
    seasonApplied: names.size > 0,
    seasonNames: Array.from(names),
  }
}
