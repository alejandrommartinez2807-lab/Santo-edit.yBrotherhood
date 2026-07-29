// Libro contable ESPERADO, independiente del sistema. Nunca usa los totales
// que calcula la app: cada venta/pago/gasto se asienta aquí desde el guion,
// y al cierre se compara contra la base al centavo. Diferencia ≥ 0,01 = bug.
import { readJson, writeJson } from "./evidence-writer.mjs"

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function loadLedger() {
  return (
    readJson("contabilidad-esperada.json") || {
      // por día simulado → por sede → asientos
      days: {},
      suppliers: {}, // saldo esperado por factura
    }
  )
}

export function saveLedger(ledger) {
  writeJson("contabilidad-esperada.json", ledger)
}

function dayBranch(ledger, day, branchId) {
  ledger.days[day] ||= {}
  ledger.days[day][branchId] ||= {
    ordersCreated: 0,
    equivalentCustomers: 0,
    grossSalesUSD: 0, // ventas originadas (pedidos no cancelados)
    collectedUSD: 0, // dinero recibido este día (independiente del origen)
    collectedByMethodUSD: {}, // método → { count, totalUSD }
    collectedByMethodVES: {}, // método → { count, totalVES, totalUSD }
    cashUSD: 0,
    changeGivenUSD: 0,
    pendingUSD: 0,
    cancellations: 0,
    cancelledUSD: 0,
    expensesUSD: 0,
    purchasesPaidUSD: 0,
    bySeller: {},
    byChannel: {},
  }
  return ledger.days[day][branchId]
}

export function recordOrder(ledger, { day, branchId, totalUSD, channel, seller, people = 1 }) {
  const book = dayBranch(ledger, day, branchId)
  book.ordersCreated += 1
  book.equivalentCustomers += people
  book.grossSalesUSD = round(book.grossSalesUSD + totalUSD)
  book.pendingUSD = round(book.pendingUSD + totalUSD)
  book.bySeller[seller || "público"] = round((book.bySeller[seller || "público"] || 0) + totalUSD)
  book.byChannel[channel] = round((book.byChannel[channel] || 0) + totalUSD)
}

// payment: { usdMethod?, usdAmount?, vesMethod?, vesAmount?, rate, changeUSD? }
// day = día en que ENTRA el dinero (puede diferir del día de origen del pedido)
export function recordPayment(ledger, { day, branchId, payment, orderTotalUSD }) {
  const book = dayBranch(ledger, day, branchId)
  let applied = 0
  if (payment.usdAmount) {
    const method = payment.usdMethod || "Efectivo divisas"
    const net = round(payment.usdAmount - (payment.changeUSD || 0))
    const slot = (book.collectedByMethodUSD[method] ||= { count: 0, totalUSD: 0 })
    slot.count += 1
    slot.totalUSD = round(slot.totalUSD + net)
    if (/efectivo/i.test(method)) {
      book.cashUSD = round(book.cashUSD + net)
      book.changeGivenUSD = round(book.changeGivenUSD + (payment.changeUSD || 0))
    }
    applied = round(applied + net)
  }
  if (payment.vesAmount) {
    const method = payment.vesMethod || "Pago móvil"
    const usdEquiv = round(payment.vesAmount / payment.rate)
    const slot = (book.collectedByMethodVES[method] ||= { count: 0, totalVES: 0, totalUSD: 0 })
    slot.count += 1
    slot.totalVES = round(slot.totalVES + payment.vesAmount)
    slot.totalUSD = round(slot.totalUSD + usdEquiv)
    applied = round(applied + usdEquiv)
  }
  book.collectedUSD = round(book.collectedUSD + applied)
  return applied
}

// El pendiente baja en el día/sede de ORIGEN del pedido cuando se cobra.
export function reducePending(ledger, { originDay, branchId, amountUSD }) {
  const book = dayBranch(ledger, originDay, branchId)
  book.pendingUSD = round(book.pendingUSD - amountUSD)
}

export function recordCancellation(ledger, { day, branchId, totalUSD, wasPending = true }) {
  const book = dayBranch(ledger, day, branchId)
  book.cancellations += 1
  book.cancelledUSD = round(book.cancelledUSD + totalUSD)
  if (wasPending) book.pendingUSD = round(book.pendingUSD - totalUSD)
  book.grossSalesUSD = round(book.grossSalesUSD - totalUSD)
}

export function recordExpense(ledger, { day, branchId, amountUSD }) {
  const book = dayBranch(ledger, day, branchId)
  book.expensesUSD = round(book.expensesUSD + amountUSD)
}

export function recordSupplierInvoice(ledger, { invoiceKey, totalUSD, paidUSD = 0 }) {
  ledger.suppliers[invoiceKey] = {
    totalUSD: round(totalUSD),
    paidUSD: round(paidUSD),
    pendingUSD: round(totalUSD - paidUSD),
  }
}

export function recordSupplierPayment(ledger, { invoiceKey, amountUSD, day, branchId, isCashOut = false }) {
  const invoice = ledger.suppliers[invoiceKey]
  if (invoice) {
    invoice.paidUSD = round(invoice.paidUSD + amountUSD)
    invoice.pendingUSD = round(invoice.totalUSD - invoice.paidUSD)
  }
  if (day && branchId) {
    const book = dayBranch(ledger, day, branchId)
    book.purchasesPaidUSD = round(book.purchasesPaidUSD + amountUSD)
  }
}

export function expectedCloseFor(ledger, day, branchId) {
  const book = dayBranch(ledger, day, branchId)
  return {
    collectedUSD: book.collectedUSD,
    cashUSD: book.cashUSD,
    vesTotal: round(
      Object.values(book.collectedByMethodVES).reduce((s, v) => s + v.totalVES, 0),
    ),
    vesEquivalentUSD: round(
      Object.values(book.collectedByMethodVES).reduce((s, v) => s + v.totalUSD, 0),
    ),
    byMethodUSD: book.collectedByMethodUSD,
    byMethodVES: book.collectedByMethodVES,
    expensesUSD: book.expensesUSD,
    cancellations: book.cancellations,
    orders: book.ordersCreated,
  }
}

export { round }
