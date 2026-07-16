import { describe, expect, it } from "vitest"
import {
  buildDayClosesRows,
  buildFullExportCsv,
  buildSalesBookRows,
} from "@/lib/accountingExports"

const invoices = [
  { createdAt: "2026-07-10T12:00:00Z", serie: "A", number: 2, customerName: "Ana", customerRif: "V-1", subtotal: 100, taxRate: 0.16, tax: 16, total: 116 },
  { createdAt: "2026-07-10T09:00:00Z", serie: "A", number: 1, customerName: "Beto", customerRif: "J-2", subtotal: 50, taxRate: 0.16, tax: 8, total: 58 },
  { createdAt: "2026-06-30T09:00:00Z", serie: "A", number: 0, customerName: "Vieja", customerRif: "", subtotal: 999, taxRate: 0.16, tax: 159.84, total: 1158.84 },
]

describe("buildSalesBookRows", () => {
  it("filtra por rango, ordena por fecha+numero y totaliza", () => {
    const rows = buildSalesBookRows(invoices, { from: "2026-07-01", to: "2026-07-31" })
    // encabezado + 2 facturas de julio + fila de totales
    expect(rows).toHaveLength(4)
    // ordena por fecha y luego numero: la #1 (09:00) antes que la #2 (12:00)
    expect(rows[1][2]).toBe(1)
    expect(rows[2][2]).toBe(2)
    // % IVA a partir de la fracción 0.16
    expect(rows[1][6]).toBe(16)
    // fila de totales: base 150, IVA 24, total 174
    const totals = rows[3]
    expect(totals[4]).toBe("TOTALES")
    expect(totals[5]).toBe(150)
    expect(totals[7]).toBe(24)
    expect(totals[9]).toBe(174)
  })

  it("cliente vacio cae a 'Consumidor final'", () => {
    const rows = buildSalesBookRows(
      [{ createdAt: "2026-07-05", serie: "A", number: 5, customerName: "", customerRif: "", subtotal: 10, taxRate: 0.16, tax: 1.6, total: 11.6 }],
      {},
    )
    expect(rows[1][3]).toBe("Consumidor final")
  })
})

describe("buildDayClosesRows", () => {
  it("intercala subtotales por mes y un total general", () => {
    const rows = buildDayClosesRows([
      { date: "2026-06-30", arrivals: 1, departures: 0, inHouse: 2, roomRevenue: 100, note: "" },
      { date: "2026-07-01", arrivals: 2, departures: 1, inHouse: 3, roomRevenue: 200, note: "x" },
      { date: "2026-07-02", arrivals: 0, departures: 2, inHouse: 1, roomRevenue: 300, note: "" },
    ])
    // encabezado + jun(1 dia + total) + jul(2 dias + total) + total general = 7
    expect(rows).toHaveLength(7)
    expect(rows[2][0]).toBe("Total 2026-06")
    expect(rows[2][4]).toBe(100)
    expect(rows[5][0]).toBe("Total 2026-07")
    expect(rows[5][4]).toBe(500)
    expect(rows[6][0]).toBe("TOTAL GENERAL")
    expect(rows[6][4]).toBe(600)
  })
})

describe("buildFullExportCsv", () => {
  it("arma todas las secciones con datos", () => {
    const csv = buildFullExportCsv({
      reservations: [{ code: "ABC", guestName: "Ana", guestPhone: "0414", checkInDate: "2026-07-10", checkOutDate: "2026-07-12", nights: 2, adults: 2, children: 0, totalAmount: 160, status: "confirmada", source: "web" }],
      invoices: [invoices[0]],
      guests: [{ fullName: "Ana", phone: "0414", email: "a@b.co", tags: "vip", vip: true, notes: "" }],
      payments: [{ createdAt: "2026-07-09", reservationCode: "ABC", method: "pago_movil", amount: 60, reference: "R1", status: "confirmado" }],
      folioLines: [{ createdAt: "2026-07-11", reservationCode: "ABC", guestName: "Ana", description: "Noche", kind: "cargo", amount: 80 }],
    })
    expect(csv).toContain("RESERVAS")
    expect(csv).toContain("FOLIOS (cargos y pagos)")
    expect(csv).toContain("FACTURAS")
    expect(csv).toContain("CLIENTES (CRM)")
    expect(csv).toContain("DEPOSITOS DE RESERVA")
    expect(csv).toContain("ABC")
    expect(csv).toContain("pago_movil") // el deposito reportado aparece en su seccion
    expect(csv).toContain("a@b.co") // el email del CRM aparece en Clientes
  })
})
