// Serie diaria de reportes. El API (/api/reports) solo devuelve los días que
// tuvieron pedidos; para graficar hay que rellenar con ceros el resto del
// rango, si no la gráfica muestra 1-2 barras gigantes (o desaparece cuando
// todas las ventas cayeron en un solo día).

export type DailyPoint = { date: string; orders: number; totalUSD: number }

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DAYS = 400

// Las claves de día del API vienen en formato YYYY-MM-DD zona Caracas
// (Intl en-CA), así que usamos el mismo formateador para no desfasar días.
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Caracas",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function fillDailySeries(
  byDay: DailyPoint[],
  fromISO: string | null | undefined,
  toISO: string | null | undefined,
): DailyPoint[] {
  const source = Array.isArray(byDay) ? byDay : []
  const from = fromISO ? new Date(fromISO) : null
  const to = toISO ? new Date(toISO) : new Date()

  if (!from || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return source
  }

  const byDate = new Map(source.map((d) => [d.date, d]))
  const series: DailyPoint[] = []
  let previousKey = ""

  // Avanzamos en pasos de 24h y dejamos que el formateador (zona Caracas)
  // decida el día; el dedupe cubre saltos por cambios de hora.
  for (
    let cursor = from.getTime(), steps = 0;
    cursor <= to.getTime() + DAY_MS - 1 && steps < MAX_DAYS;
    cursor += DAY_MS, steps += 1
  ) {
    const key = dayFmt.format(new Date(cursor))
    if (key === previousKey) continue
    if (key > dayFmt.format(to)) break
    previousKey = key
    series.push(byDate.get(key) || { date: key, orders: 0, totalUSD: 0 })
  }

  return series
}
