// Generación de cupos de cita a partir del horario semanal del doctor.
// Venezuela usa UTC-4 fijo (sin horario de verano), así que construimos los
// instantes con offset -04:00 de forma determinista.
export type ScheduleBlock = { weekday: number; start_time: string; end_time: string; slot_minutes: number; active?: boolean }

const TZ = "-04:00"

function toMin(t: string): number {
  const [h, m] = String(t || "").split(":").map((x) => Number(x))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}
function pad(n: number): string { return String(n).padStart(2, "0") }

// weekday del string de fecha (0=domingo..6=sábado) en hora local Caracas.
export function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00${TZ}`).getUTCDay()
}

// Cupos candidatos para una fecha, según los bloques del día.
export function slotsForDate(dateIso: string, blocks: ScheduleBlock[]): { time: string; iso: string }[] {
  const wd = weekdayOf(dateIso)
  const out: { time: string; iso: string }[] = []
  const seen = new Set<string>()
  for (const b of blocks) {
    if (b.active === false) continue
    if (Number(b.weekday) !== wd) continue
    const step = Math.max(5, Number(b.slot_minutes) || 30)
    const start = toMin(b.start_time)
    const end = toMin(b.end_time)
    for (let t = start; t + step <= end; t += step) {
      const hh = pad(Math.floor(t / 60))
      const mm = pad(t % 60)
      const time = `${hh}:${mm}`
      if (seen.has(time)) continue
      seen.add(time)
      out.push({ time, iso: `${dateIso}T${time}:00${TZ}` })
    }
  }
  out.sort((a, b) => a.time.localeCompare(b.time))
  return out
}
