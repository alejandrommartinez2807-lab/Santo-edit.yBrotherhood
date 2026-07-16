import { describe, expect, it } from "vitest"
import {
  generateCode,
  isGuestMembershipActive,
  membershipDiscountAmount,
  membershipNetAmount,
  normalizeDiscountPct,
} from "@/lib/hotelMemberships"

describe("normalizeDiscountPct", () => {
  it("acota entre 0 y 100 e ignora basura", () => {
    expect(normalizeDiscountPct(10)).toBe(10)
    expect(normalizeDiscountPct(-5)).toBe(0)
    expect(normalizeDiscountPct(150)).toBe(100)
    expect(normalizeDiscountPct("abc")).toBe(0)
    expect(normalizeDiscountPct(12.345)).toBe(12.35)
  })
})

describe("membershipDiscountAmount / membershipNetAmount", () => {
  it("calcula el descuento y el neto redondeados", () => {
    expect(membershipDiscountAmount(200, 10)).toBe(20)
    expect(membershipNetAmount(200, 10)).toBe(180)
    expect(membershipDiscountAmount(99.99, 15)).toBe(15) // 14.9985 → 15
    expect(membershipNetAmount(99.99, 15)).toBe(84.99)
  })
  it("descuento 0 deja el total intacto", () => {
    expect(membershipNetAmount(150, 0)).toBe(150)
  })
})

describe("generateCode", () => {
  it("respeta prefijo, largo y alfabeto sin caracteres confusos", () => {
    for (let i = 0; i < 40; i += 1) {
      const code = generateCode("M", 5)
      expect(code).toMatch(/^M-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
      expect(code).not.toMatch(/[O01I]/)
    }
  })
})

describe("isGuestMembershipActive", () => {
  const today = "2026-07-16"
  it("activa sin vencimiento", () => {
    expect(isGuestMembershipActive({ active: true }, today)).toBe(true)
  })
  it("inactiva si active=false", () => {
    expect(isGuestMembershipActive({ active: false, expiresAt: "2027-01-01" }, today)).toBe(false)
  })
  it("respeta el vencimiento", () => {
    expect(isGuestMembershipActive({ active: true, expiresAt: "2026-07-16" }, today)).toBe(true)
    expect(isGuestMembershipActive({ active: true, expiresAt: "2026-07-15" }, today)).toBe(false)
  })
})
