import { describe, expect, it } from "vitest"
import { fillDailySeries } from "@/lib/reportSeries"

// Fechas en UTC que caen en días Caracas (UTC-4) conocidos.
const fromISO = "2026-06-01T04:00:00.000Z" // 2026-06-01 00:00 Caracas
const toISO = "2026-06-07T03:59:59.999Z" // 2026-06-06 23:59 Caracas

describe("fillDailySeries", () => {
  it("rellena con ceros los días sin ventas del rango", () => {
    const series = fillDailySeries(
      [{ date: "2026-06-03", orders: 2, totalUSD: 50 }],
      fromISO,
      toISO,
    )

    expect(series.map((d) => d.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
    ])
    expect(series[2]).toEqual({ date: "2026-06-03", orders: 2, totalUSD: 50 })
    expect(series[0]).toEqual({ date: "2026-06-01", orders: 0, totalUSD: 0 })
  })

  it("un solo día con ventas en un rango de 30 días produce la serie completa", () => {
    const series = fillDailySeries(
      [{ date: "2026-06-15", orders: 6, totalUSD: 101 }],
      "2026-06-01T04:00:00.000Z",
      "2026-07-01T03:59:59.999Z",
    )

    expect(series).toHaveLength(30)
    expect(series.filter((d) => d.orders > 0)).toHaveLength(1)
  })

  it("sin rango válido devuelve la serie original", () => {
    const byDay = [{ date: "2026-06-03", orders: 1, totalUSD: 10 }]
    expect(fillDailySeries(byDay, undefined, toISO)).toEqual(byDay)
    expect(fillDailySeries(byDay, "no-es-fecha", toISO)).toEqual(byDay)
    expect(fillDailySeries(byDay, toISO, fromISO)).toEqual(byDay)
  })
})
