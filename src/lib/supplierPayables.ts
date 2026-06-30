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

  // Para compras en divisas, el estado se decide por USD. Para compras solo en
  // bolívares, se decide por VES. Si no hay monto cargado, queda pendiente.
  const totalForStatus = totalUSD > 0 ? totalUSD : totalVES
  const paidForStatus = totalUSD > 0 ? paidUSD : paidVES

  let status: SupplierPaymentStatus = "Pendiente"
  if (totalForStatus > 0 && paidForStatus >= totalForStatus - 0.01) {
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
