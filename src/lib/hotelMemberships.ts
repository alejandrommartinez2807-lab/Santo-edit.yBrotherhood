// ============================================================
// Hotel · P2-C · Membresías / fidelización — lógica PURA (sin DB).
//
// Descuentos sugeridos sobre la tarifa, generación de códigos y validez de la
// membresía del huésped (activa + no vencida). Fácil de testear.
// ============================================================

export function normalizeDiscountPct(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 100) return 100
  return Math.round(n * 100) / 100
}

/** Monto del descuento (%) sobre una base, redondeado a centavos. */
export function membershipDiscountAmount(baseAmount: number, discountPct: number): number {
  const base = Math.max(0, Number(baseAmount) || 0)
  const pct = normalizeDiscountPct(discountPct)
  return Math.round(base * (pct / 100) * 100) / 100
}

/** Base menos el descuento sugerido. */
export function membershipNetAmount(baseAmount: number, discountPct: number): number {
  const base = Math.max(0, Number(baseAmount) || 0)
  return Math.round((base - membershipDiscountAmount(base, discountPct)) * 100) / 100
}

// Alfabeto sin caracteres confusos (O/0/1/I) para códigos legibles al teléfono.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateCode(prefix: string, length = 5): string {
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `${prefix}-${out}`
}

export const generateMembershipCode = () => generateCode("M")
export const generateGuestPassCode = () => generateCode("PASE")

/** La membresía del huésped vale si está activa y no venció. */
export function isGuestMembershipActive(
  membership: { active?: boolean; expiresAt?: string | null },
  todayISO: string,
): boolean {
  if (membership.active === false) return false
  const expires = String(membership.expiresAt || "").slice(0, 10)
  if (!expires) return true
  return expires >= todayISO
}
