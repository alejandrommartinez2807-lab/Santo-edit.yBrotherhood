export type SupplierPaymentStatus = "Pendiente" | "Parcial" | "Pagado"

export type SupplierPayableTotals = {
  totalUSD: number
  totalVES: number
  paidUSD: number
  paidVES: number
  pendingUSD: number
  pendingVES: number
  status: SupplierPaymentStatus
}

function money(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function normalizeSupplierPaymentStatus(value: unknown): SupplierPaymentStatus {
  const text = String(value || "").trim().toLowerCase()
  if (text === "pagado") return "Pagado"
  if (text === "parcial") return "Parcial"
  return "Pendiente"
}

export function calculateSupplierPayableTotals(input: {
  totalUSD?: unknown
  totalVES?: unknown
  paidUSD?: unknown
  paidVES?: unknown
}): SupplierPayableTotals {
  const totalUSD = money(input.totalUSD)
  const totalVES = money(input.totalVES)
  const paidUSD = money(input.paidUSD)
  const paidVES = money(input.paidVES)
  const pendingUSD = Math.max(0, money(totalUSD - paidUSD))
  const pendingVES = Math.max(0, money(totalVES - paidVES))

  // "Pagado" exige AMBAS monedas saldadas (B1, 2026-07-24): antes una compra
  // mixta de $50 + Bs 1.000 pasaba a Pagado al abonar solo los $50, y la deuda
  // en bolívares desaparecía de Cuentas por pagar.
  const hasTotal = totalUSD > 0 || totalVES > 0
  const usdSettled = totalUSD <= 0 || paidUSD >= totalUSD - 0.01
  const vesSettled = totalVES <= 0 || paidVES >= totalVES - 0.01

  let status: SupplierPaymentStatus = "Pendiente"
  if (hasTotal && usdSettled && vesSettled) {
    status = "Pagado"
  } else if (paidUSD > 0 || paidVES > 0) {
    status = "Parcial"
  }

  return {
    totalUSD,
    totalVES,
    paidUSD,
    paidVES,
    pendingUSD,
    pendingVES,
    status,
  }
}

export function isSupplierPurchaseOverdue(input: {
  dueDate?: string | null
  paymentStatus?: SupplierPaymentStatus | string
  today?: string
}) {
  const dueDate = String(input.dueDate || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false
  if (normalizeSupplierPaymentStatus(input.paymentStatus) === "Pagado") return false
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(input.today || ""))
    ? String(input.today)
    : new Date().toISOString().slice(0, 10)
  return dueDate < today
}
