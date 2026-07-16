// ============================================================
// Hotel · P3-H · Turnos / asistencia — lógica PURA (sin DB).
//
// Semana laboral (lunes a domingo), presets de turno y reglas de marcado
// (no hay salida sin entrada). Nada de sueldos.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000

export const SHIFT_PRESETS = [
  { id: "manana", label: "Mañana", start: "07:00", end: "15:00" },
  { id: "tarde", label: "Tarde", start: "15:00", end: "23:00" },
  { id: "noche", label: "Noche", start: "23:00", end: "07:00" },
] as const

export function addDaysISO(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/** Lunes de la semana a la que pertenece la fecha (ISO, lunes = inicio). */
export function weekStartISO(dateISO: string): string {
  const date = new Date(`${String(dateISO).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  const day = date.getUTCDay() // 0 = domingo … 6 = sábado
  const diff = day === 0 ? -6 : 1 - day
  return addDaysISO(date.toISOString().slice(0, 10), diff)
}

/** Los 7 días ISO de la semana que arranca en startISO. */
export function weekDaysFrom(startISO: string): string[] {
  const start = String(startISO).slice(0, 10)
  if (!start) return []
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
}

export type ShiftAttendanceLike = {
  checkInAt?: string | null
  checkOutAt?: string | null
}

export type ShiftAttendanceStatus = "pendiente" | "presente" | "cumplido"

/** pendiente = sin marcar · presente = entró y no ha salido · cumplido = entró y salió. */
export function shiftAttendanceStatus(shift: ShiftAttendanceLike): ShiftAttendanceStatus {
  const checkedIn = Boolean(String(shift.checkInAt || "").trim())
  const checkedOut = Boolean(String(shift.checkOutAt || "").trim())
  if (checkedIn && checkedOut) return "cumplido"
  if (checkedIn) return "presente"
  return "pendiente"
}

/** Reglas de marcado: la entrada solo una vez; la salida exige entrada previa. */
export function canMarkShift(shift: ShiftAttendanceLike, kind: "in" | "out"): boolean {
  const status = shiftAttendanceStatus(shift)
  if (kind === "in") return status === "pendiente"
  return status === "presente"
}

/** Valida "HH:MM" de 24 horas (vacío también vale: turno sin hora fija). */
export function isValidShiftTime(value: unknown): boolean {
  const raw = String(value || "").trim()
  if (!raw) return true
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw)
}
