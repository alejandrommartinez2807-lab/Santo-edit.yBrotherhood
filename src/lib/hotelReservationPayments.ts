// ============================================================
// Hotel · P1-A · Resumen de depósitos/abonos de una reserva
//
// Funciones PURAS (sin DB) para calcular cuánto abonó el huésped y cuánto
// le falta, y para filtrar los datos de cobro a los métodos que el dueño
// tiene activos. Se usan en el endpoint público de pago y en la UI, y son
// fáciles de testear.
// ============================================================

export type ReservationPaymentEntry = {
  amount: number
  status: string
}

export type ReservationPaymentSummary = {
  /** Abonos ya confirmados por caja. */
  paidConfirmed: number
  /** Abonos reportados por el huésped, aún por confirmar. */
  paidReported: number
  /** Lo que falta contra el total tomando SOLO lo confirmado. */
  balance: number
  /** Lo que faltaría si se confirmaran también los reportados. */
  pendingBalance: number
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function summarizeReservationPayments(
  payments: ReservationPaymentEntry[],
  totalAmount: number,
): ReservationPaymentSummary {
  let paidConfirmed = 0
  let paidReported = 0
  for (const payment of payments) {
    const amount = Math.max(0, Number(payment.amount) || 0)
    if (payment.status === "confirmado") paidConfirmed += amount
    else if (payment.status === "reportado") paidReported += amount
  }
  const total = Math.max(0, Number(totalAmount) || 0)
  return {
    paidConfirmed: round2(paidConfirmed),
    paidReported: round2(paidReported),
    balance: round2(Math.max(0, total - paidConfirmed)),
    pendingBalance: round2(Math.max(0, total - paidConfirmed - paidReported)),
  }
}

// Datos de cobro (pago móvil, Zelle…) SOLO de los métodos que el dueño dejó
// activos y que tienen datos cargados. Devuelve {} si no hay ninguno.
export function activeReservationPaymentMethodDetails(
  methods: string[],
  details: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const method of methods) {
    const value = String(details?.[method] || "").trim()
    if (value) result[method] = value
  }
  return result
}
