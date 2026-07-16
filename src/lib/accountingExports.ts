// ============================================================
// Hotel · P1-B · EXPORTES CONTABLES (para el contador, no para competir)
//
// Funciones PURAS que arman los CSV de salida contable a partir de datos ya
// consultados. NO emiten documentos fiscales: eso lo hace la máquina fiscal
// SENIAT. Aquí solo entregamos "sus datos son suyos" en CSV que abre Excel
// (el BOM UTF-8 lo pone downloadCsv/csv.ts, así no hay mojibake).
// ============================================================
import { buildCsvSections, toCsv } from "@/lib/csv"

export type DateRange = { from?: string; to?: string }

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}
function ymd(iso: string | undefined): string {
  return String(iso || "").slice(0, 10)
}
function inRange(dateISO: string | undefined, range: DateRange): boolean {
  const d = ymd(dateISO)
  if (!d) return false
  if (range.from && d < range.from) return false
  if (range.to && d > range.to) return false
  return true
}
// taxRate se guarda como fracción (0.16). Se muestra como porcentaje (16).
function pct(rate: number): number {
  const r = Number(rate) || 0
  return Math.round((r <= 1 ? r * 100 : r) * 100) / 100
}

// ---------- 1. Libro de ventas estilo SENIAT ----------
export type SalesBookInvoice = {
  createdAt: string
  serie: string
  number: number
  customerName: string
  customerRif: string
  subtotal: number
  taxRate: number
  tax: number
  total: number
}

export function buildSalesBookRows(
  invoices: SalesBookInvoice[],
  range: DateRange = {},
): (string | number)[][] {
  const rows: (string | number)[][] = [[
    "Fecha", "Serie", "Numero", "Cliente", "RIF / CI",
    "Base imponible", "% IVA", "IVA", "IGTF", "Total",
  ]]
  const filtered = invoices
    .filter((inv) => inRange(inv.createdAt, range))
    .sort((a, b) =>
      ymd(a.createdAt) === ymd(b.createdAt)
        ? a.number - b.number
        : ymd(a.createdAt) < ymd(b.createdAt) ? -1 : 1,
    )
  let base = 0, iva = 0, igtf = 0, total = 0
  for (const inv of filtered) {
    const b = round2(inv.subtotal)
    const i = round2(inv.tax)
    const g = 0 // El IGTF lo aplica la máquina fiscal sobre el pago en divisas.
    const t = round2(inv.total)
    base += b; iva += i; igtf += g; total += t
    rows.push([
      ymd(inv.createdAt), inv.serie || "A", inv.number,
      inv.customerName || "Consumidor final", inv.customerRif || "",
      b, pct(inv.taxRate), i, g, t,
    ])
  }
  rows.push(["", "", "", "", "TOTALES", round2(base), "", round2(iva), round2(igtf), round2(total)])
  return rows
}

export function buildSalesBookCsv(invoices: SalesBookInvoice[], range: DateRange = {}): string {
  return toCsv(buildSalesBookRows(invoices, range))
}

// ---------- 2. Resumen mensual de cierres ----------
export type DayCloseRow = {
  date: string
  arrivals: number
  departures: number
  inHouse: number
  roomRevenue: number
  note: string
}

export function buildDayClosesRows(days: DayCloseRow[], range: DateRange = {}): (string | number)[][] {
  const rows: (string | number)[][] = [[
    "Fecha", "Llegadas", "Salidas", "En casa", "Ingreso habitaciones ($)", "Nota",
  ]]
  const filtered = days
    .filter((d) => inRange(d.date, range))
    .sort((a, b) => (ymd(a.date) < ymd(b.date) ? -1 : 1))
  let month = ""
  let mRev = 0, mArr = 0, mDep = 0, gRev = 0
  const flush = () => {
    if (month) rows.push([`Total ${month}`, mArr, mDep, "", round2(mRev), ""])
  }
  for (const d of filtered) {
    const m = ymd(d.date).slice(0, 7)
    if (m !== month) { flush(); month = m; mRev = 0; mArr = 0; mDep = 0 }
    mRev += Number(d.roomRevenue) || 0
    mArr += Number(d.arrivals) || 0
    mDep += Number(d.departures) || 0
    gRev += Number(d.roomRevenue) || 0
    rows.push([ymd(d.date), d.arrivals, d.departures, d.inHouse, round2(d.roomRevenue), d.note || ""])
  }
  flush()
  rows.push(["TOTAL GENERAL", "", "", "", round2(gRev), ""])
  return rows
}

export function buildDayClosesCsv(days: DayCloseRow[], range: DateRange = {}): string {
  return toCsv(buildDayClosesRows(days, range))
}

// ---------- 3. Export total (sus datos son suyos) ----------
export type FullExportData = {
  reservations: {
    code: string; guestName: string; guestPhone: string
    checkInDate: string; checkOutDate: string; nights: number
    adults: number; children: number; totalAmount: number
    status: string; source: string
  }[]
  invoices: SalesBookInvoice[]
  guests: { fullName: string; phone: string; email: string; tags: string; vip: boolean; notes: string }[]
  payments: { createdAt: string; reservationCode: string; method: string; amount: number; reference: string; status: string }[]
  folioLines: { createdAt: string; reservationCode: string; guestName: string; description: string; kind: string; amount: number }[]
}

export function buildFullExportCsv(data: FullExportData): string {
  const reservas: (string | number)[][] = [
    ["Codigo", "Huesped", "Telefono", "Entrada", "Salida", "Noches", "Adultos", "Ninos", "Total ($)", "Estado", "Origen"],
    ...data.reservations.map((r) => [r.code, r.guestName, r.guestPhone, r.checkInDate, r.checkOutDate, r.nights, r.adults, r.children, round2(r.totalAmount), r.status, r.source]),
  ]
  const folios: (string | number)[][] = [
    ["Fecha", "Reserva", "Huesped", "Concepto", "Tipo", "Monto ($)"],
    ...data.folioLines.map((f) => [ymd(f.createdAt), f.reservationCode, f.guestName, f.description, f.kind === "pago" ? "Pago" : "Cargo", round2(f.amount)]),
  ]
  const facturas: (string | number)[][] = [
    ["Fecha", "Serie", "Numero", "Cliente", "RIF / CI", "Base ($)", "% IVA", "IVA ($)", "Total ($)"],
    ...data.invoices.map((i) => [ymd(i.createdAt), i.serie || "A", i.number, i.customerName, i.customerRif, round2(i.subtotal), pct(i.taxRate), round2(i.tax), round2(i.total)]),
  ]
  const clientes: (string | number)[][] = [
    ["Nombre", "Telefono", "Email", "Etiquetas", "VIP", "Notas"],
    ...data.guests.map((g) => [g.fullName, g.phone, g.email, g.tags, g.vip ? "Si" : "No", g.notes]),
  ]
  const depositos: (string | number)[][] = [
    ["Fecha", "Reserva", "Metodo", "Monto ($)", "Referencia", "Estado"],
    ...data.payments.map((p) => [ymd(p.createdAt), p.reservationCode, p.method, round2(p.amount), p.reference, p.status]),
  ]
  return buildCsvSections([
    { title: "RESERVAS", rows: reservas },
    { title: "FOLIOS (cargos y pagos)", rows: folios },
    { title: "FACTURAS", rows: facturas },
    { title: "CLIENTES (CRM)", rows: clientes },
    { title: "DEPOSITOS DE RESERVA", rows: depositos },
  ])
}
