import { describe, it, expect } from "vitest"
import { computeParkingFee } from "@/lib/parkingFee"

const ENTER = "2026-07-20T10:00:00.000Z"
const enterMs = new Date(ENTER).getTime()
const at = (minutes: number) => enterMs + minutes * 60_000

const cfg = (over: Partial<{ free_minutes: number; rate_per_hour: number; daily_cap: number }> = {}) => ({
  free_minutes: 15,
  rate_per_hour: 1,
  daily_cap: 0,
  ...over,
})

describe("computeParkingFee", () => {
  it("no cobra dentro de la gracia", () => {
    expect(computeParkingFee(ENTER, at(10), cfg())).toEqual({ minutes: 10, amount: 0 })
  })

  it("no cobra justo en el límite de la gracia", () => {
    expect(computeParkingFee(ENTER, at(15), cfg())).toEqual({ minutes: 15, amount: 0 })
  })

  it("cobra una hora al pasar 1 minuto de la gracia (fracción = hora)", () => {
    expect(computeParkingFee(ENTER, at(16), cfg())).toEqual({ minutes: 16, amount: 1 })
  })

  it("sigue en 1 hora hasta completar 60 min facturables", () => {
    // 75 min - 15 gracia = 60 facturables -> 1 hora
    expect(computeParkingFee(ENTER, at(75), cfg()).amount).toBe(1)
    // 76 min -> 61 facturables -> 2 horas
    expect(computeParkingFee(ENTER, at(76), cfg()).amount).toBe(2)
  })

  it("multiplica por la tarifa por hora", () => {
    expect(computeParkingFee(ENTER, at(75), cfg({ rate_per_hour: 2.5 })).amount).toBe(2.5)
  })

  it("redondea a 2 decimales", () => {
    expect(computeParkingFee(ENTER, at(75), cfg({ rate_per_hour: 0.333 })).amount).toBe(0.33)
  })

  it("aplica el tope diario", () => {
    // 10h sin gracia a $1/h = $10, tope $5 -> $5
    const r = computeParkingFee(ENTER, at(600), cfg({ free_minutes: 0, daily_cap: 5 }))
    expect(r.minutes).toBe(600)
    expect(r.amount).toBe(5)
  })

  it("el tope diario escala por día", () => {
    // 25h (1500 min) -> ceil(1500/1440)=2 días -> tope 5*2=10
    const r = computeParkingFee(ENTER, at(1500), cfg({ free_minutes: 0, rate_per_hour: 1, daily_cap: 5 }))
    expect(r.amount).toBe(10)
  })

  it("fecha inválida devuelve cero", () => {
    expect(computeParkingFee("no-es-fecha", at(120), cfg())).toEqual({ minutes: 0, amount: 0 })
  })

  it("entrada en el futuro (reloj adelantado) no da minutos negativos", () => {
    expect(computeParkingFee(ENTER, at(-30), cfg())).toEqual({ minutes: 0, amount: 0 })
  })

  it("tarifa 0 nunca cobra aunque pase tiempo", () => {
    expect(computeParkingFee(ENTER, at(300), cfg({ rate_per_hour: 0 })).amount).toBe(0)
  })
})
