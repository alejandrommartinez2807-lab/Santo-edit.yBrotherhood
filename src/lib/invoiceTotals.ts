// ============================================================
// FACTURACIÓN · lógica pura (Hotel · Fase 16)
// Totales de la factura a partir de una base imponible y una tasa de impuesto.
// La base sale de los cargos del folio. Sin DB.
// ============================================================

export type InvoiceTotals = { subtotal: number; tax: number; total: number }

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

/** subtotal = base; tax = base × rate; total = base + tax. */
export function computeInvoiceTotals(base: number, taxRate: number): InvoiceTotals {
  const subtotal = round2(Math.max(0, Number(base) || 0))
  const rate = Math.max(0, Number(taxRate) || 0)
  const tax = round2(subtotal * rate)
  return { subtotal, tax, total: round2(subtotal + tax) }
}

export type FolioLine = { kind?: string; amount?: number }

/** Base imponible = suma de los cargos del folio (ignora los pagos). */
export function invoiceBaseFromFolio(items: FolioLine[]): number {
  return round2(
    items.reduce((sum, item) => (item.kind === "pago" ? sum : sum + (Number(item.amount) || 0)), 0),
  )
}
