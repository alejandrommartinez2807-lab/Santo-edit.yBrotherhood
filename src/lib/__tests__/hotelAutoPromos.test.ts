import { describe, it, expect } from "vitest"
import {
  DEFAULT_HOTEL_AUTO_PROMOS,
  normalizeHotelAutoPromos,
  planAutoPromos,
  subMonthsISO,
} from "@/lib/hotelAutoPromos"
import type { CampaignGuestRow } from "@/lib/hotelCampaigns"

function row(overrides: Partial<CampaignGuestRow>): CampaignGuestRow {
  return {
    name: "María González",
    phone: "04121112233",
    email: "",
    tags: "",
    vip: false,
    stays: 0,
    totalSpent: 0,
    lastCheckIn: "",
    birthMonth: null,
    isMember: false,
    stayRanges: [],
    ...overrides,
  }
}

const allOn = normalizeHotelAutoPromos({
  birthday: { enabled: true, message: DEFAULT_HOTEL_AUTO_PROMOS.birthday.message },
  postStay: { enabled: true, days: 7, message: DEFAULT_HOTEL_AUTO_PROMOS.postStay.message },
  winback: { enabled: true, months: 6, message: DEFAULT_HOTEL_AUTO_PROMOS.winback.message },
})

describe("hotelAutoPromos · normalize", () => {
  it("devuelve defaults con enabled=false", () => {
    const c = normalizeHotelAutoPromos(undefined)
    expect(c.birthday.enabled).toBe(false)
    expect(c.postStay.days).toBe(7)
    expect(c.winback.months).toBe(6)
    expect(c.birthday.message).toContain("{nombre}")
  })

  it("acota días (1-90) y meses (1-36)", () => {
    const c = normalizeHotelAutoPromos({
      postStay: { days: 999 },
      winback: { months: 0 },
    })
    expect(c.postStay.days).toBe(90)
    expect(c.winback.months).toBe(1)
  })

  it("conserva mensaje y enabled dados", () => {
    const c = normalizeHotelAutoPromos({ birthday: { enabled: true, message: "Hola {nombre}" } })
    expect(c.birthday.enabled).toBe(true)
    expect(c.birthday.message).toBe("Hola {nombre}")
  })
})

describe("hotelAutoPromos · subMonthsISO", () => {
  it("resta meses", () => {
    expect(subMonthsISO("2026-07-18", 6)).toBe("2026-01-18")
    expect(subMonthsISO("2026-01-15", 1)).toBe("2025-12-15")
  })
})

describe("hotelAutoPromos · planAutoPromos", () => {
  const hotelName = "Lidotel"

  it("cumpleaños: incluye a quien cumple este mes", () => {
    const jobs = planAutoPromos({
      rows: [row({ birthMonth: 7 }), row({ name: "Otro", phone: "04149998877", birthMonth: 3 })],
      todayISO: "2026-07-18",
      config: allOn,
      hotelName,
    })
    const bday = jobs.filter((j) => j.promoKind === "cumpleanos")
    expect(bday).toHaveLength(1)
    expect(bday[0].periodKey).toBe("bday:2026-07")
    expect(bday[0].text).toContain("María")
    expect(bday[0].templateParams).toEqual(["María", "Lidotel"])
  })

  it("cumpleaños apagado: sin jobs de cumpleaños", () => {
    const cfg = normalizeHotelAutoPromos({ birthday: { enabled: false } })
    const jobs = planAutoPromos({ rows: [row({ birthMonth: 7 })], todayISO: "2026-07-18", config: cfg, hotelName })
    expect(jobs.filter((j) => j.promoKind === "cumpleanos")).toHaveLength(0)
  })

  it("post-estadía: check-out hace exactamente N días", () => {
    const jobs = planAutoPromos({
      rows: [row({ stays: 1, stayRanges: [{ checkIn: "2026-07-05", checkOut: "2026-07-11" }] })],
      todayISO: "2026-07-18", // 18 - 7 = 11
      config: allOn,
      hotelName,
    })
    const post = jobs.filter((j) => j.promoKind === "post_estadia")
    expect(post).toHaveLength(1)
    expect(post[0].periodKey).toBe("post:2026-07-11")
  })

  it("win-back: última llegada más vieja que el umbral", () => {
    const jobs = planAutoPromos({
      rows: [row({ stays: 2, lastCheckIn: "2025-12-01" })],
      todayISO: "2026-07-18", // umbral = 2026-01-18; 2025-12-01 es anterior
      config: allOn,
      hotelName,
    })
    const win = jobs.filter((j) => j.promoKind === "inactivo")
    expect(win).toHaveLength(1)
    expect(win[0].periodKey).toBe("winback:2025-12-01")
  })

  it("win-back: no dispara si la última llegada es reciente", () => {
    const jobs = planAutoPromos({
      rows: [row({ stays: 1, lastCheckIn: "2026-07-01" })],
      todayISO: "2026-07-18",
      config: allOn,
      hotelName,
    })
    expect(jobs.filter((j) => j.promoKind === "inactivo")).toHaveLength(0)
  })

  it("respeta sentKeys (no reenvía) y salta sin teléfono", () => {
    const sentKeys = new Set<string>(["cumpleanos|bday:2026-07|04121112233"])
    const jobs = planAutoPromos({
      rows: [
        row({ birthMonth: 7 }), // ya enviado
        row({ name: "Sin Tel", phone: "", birthMonth: 7 }), // sin teléfono
      ],
      todayISO: "2026-07-18",
      config: allOn,
      hotelName,
      sentKeys,
    })
    expect(jobs).toHaveLength(0)
  })
})
