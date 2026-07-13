import { describe, it, expect } from "vitest"
import {
  addDaysISO,
  eachNight,
  nightlyRateFor,
  normalizeSeasonMode,
  pickSeasonForNight,
  quoteStay,
  seasonCoversNight,
  type RateSeasonLike,
} from "../rateSeasons"

const high: RateSeasonLike = {
  id: "s1",
  name: "Alta",
  roomTypeId: "",
  startDate: "2026-12-20",
  endDate: "2026-12-31",
  mode: "fija",
  rate: 200,
  multiplier: 1,
  priority: 10,
  active: true,
}

const weekendFactor: RateSeasonLike = {
  id: "s2",
  name: "Recargo",
  roomTypeId: "doble",
  startDate: "2026-12-25",
  endDate: "2026-12-26",
  mode: "factor",
  rate: 0,
  multiplier: 1.5,
  priority: 5,
  active: true,
}

describe("rateSeasons", () => {
  it("normaliza el modo (fallback a fija)", () => {
    expect(normalizeSeasonMode("fija")).toBe("fija")
    expect(normalizeSeasonMode("FACTOR")).toBe("factor")
    expect(normalizeSeasonMode("otro")).toBe("fija")
  })

  it("suma días y enumera las noches (checkout exclusivo)", () => {
    expect(addDaysISO("2026-12-20", 3)).toBe("2026-12-23")
    expect(eachNight("2026-12-20", "2026-12-23")).toEqual([
      "2026-12-20",
      "2026-12-21",
      "2026-12-22",
    ])
    expect(eachNight("2026-12-20", "2026-12-20")).toEqual([])
  })

  it("determina si una temporada cubre una noche (bordes inclusive)", () => {
    expect(seasonCoversNight(high, "2026-12-20")).toBe(true)
    expect(seasonCoversNight(high, "2026-12-31")).toBe(true)
    expect(seasonCoversNight(high, "2026-12-19")).toBe(false)
    expect(seasonCoversNight(high, "2027-01-01")).toBe(false)
  })

  it("elige por prioridad y respeta el tipo de habitación", () => {
    const seasons = [high, weekendFactor]
    // 25-dic: ambas cubren para 'doble'; gana prioridad 10 (Alta).
    expect(pickSeasonForNight(seasons, "2026-12-25", "doble")?.id).toBe("s1")
    // El factor es solo de 'doble'; para 'suite' no aplica ese día -> Alta.
    expect(pickSeasonForNight(seasons, "2026-12-25", "suite")?.id).toBe("s1")
    // 27-dic: solo Alta cubre.
    expect(pickSeasonForNight(seasons, "2026-12-27", "doble")?.id).toBe("s1")
    // Fuera de rango: ninguna.
    expect(pickSeasonForNight(seasons, "2026-11-01", "doble")).toBeNull()
  })

  it("calcula la tarifa de una noche según el modo", () => {
    expect(nightlyRateFor(100, null)).toBe(100)
    expect(nightlyRateFor(100, high)).toBe(200)
    expect(nightlyRateFor(100, weekendFactor)).toBe(150)
  })

  it("cotiza la estadía sumando noche a noche", () => {
    // Sin temporadas -> tarifa base.
    const plain = quoteStay({
      baseRate: 100,
      roomTypeId: "doble",
      checkIn: "2026-06-01",
      checkOut: "2026-06-04",
      seasons: [],
    })
    expect(plain.nights).toBe(3)
    expect(plain.total).toBe(300)
    expect(plain.averageRate).toBe(100)
    expect(plain.seasonApplied).toBe(false)

    // Temporada fija que cubre toda la estadía.
    const highSeason = quoteStay({
      baseRate: 100,
      roomTypeId: "doble",
      checkIn: "2026-12-21",
      checkOut: "2026-12-24",
      seasons: [high],
    })
    expect(highSeason.total).toBe(600)
    expect(highSeason.averageRate).toBe(200)
    expect(highSeason.seasonApplied).toBe(true)
    expect(highSeason.seasonNames).toEqual(["Alta"])
  })

  it("cotiza mezclando temporada y tarifa base en distintas noches", () => {
    // 18,19-dic base (100); 20-dic entra Alta (200). Total = 100+100+200 = 400.
    const mixed = quoteStay({
      baseRate: 100,
      roomTypeId: "doble",
      checkIn: "2026-12-18",
      checkOut: "2026-12-21",
      seasons: [high],
    })
    expect(mixed.nights).toBe(3)
    expect(mixed.total).toBe(400)
    expect(mixed.seasonNames).toEqual(["Alta"])
  })
})
