import { NextRequest, NextResponse } from "next/server"
import {
  createInvoice,
  getFolioByReservation,
  getFolioItems,
  getHotelReservations,
  getInvoices,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { computeInvoiceTotals, invoiceBaseFromFolio } from "@/lib/invoiceTotals"

import { checkInvoicesAccess } from "./guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

// GET : facturas emitidas + estadías facturables (con folio).
export async function GET(request: NextRequest) {
  try {
    const access = await checkInvoicesAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const today = new Date().toISOString().slice(0, 10)
    const to = `${new Date().getFullYear() + 1}-01-01`
    const [invoices, reservations] = await Promise.all([
      getInvoices(branchId),
      getHotelReservations({ from: `${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}`, to }, branchId),
    ])
    // Estadías con check-in o check-out (tienen folio) para poder facturar.
    const billable = reservations
      .filter((r) => r.status === "checkin" || r.status === "checkout")
      .map((r) => ({ id: r.id, guestName: r.guestName, status: r.status, checkInDate: r.checkInDate, checkOutDate: r.checkOutDate }))
      .slice(0, 60)
    void today
    return NextResponse.json({ ok: true, invoices, billable })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las facturas" },
      { status: 500 }
    )
  }
}

// POST : crea la factura desde el folio de una reserva.
export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-invoices-post",
    limit: 40,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage: "Espera unos segundos e intenta nuevamente.",
  })
  if (guardResponse) return guardResponse

  try {
    const access = await checkInvoicesAccess(request, ["owner", "manager"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const reservationId = cleanText(body.reservationId)
    if (!reservationId) return NextResponse.json({ error: "Indica la reserva" }, { status: 400 })

    const folio = await getFolioByReservation(reservationId, branchId)
    if (!folio) return NextResponse.json({ error: "La estadía no tiene folio. Haz el check-in primero." }, { status: 409 })

    const items = await getFolioItems(folio.id, branchId)
    const base = invoiceBaseFromFolio(items)
    if (base <= 0) return NextResponse.json({ error: "El folio no tiene cargos para facturar" }, { status: 400 })

    const taxRate = Math.max(0, Number(body.taxRate) || 0)
    const totals = computeInvoiceTotals(base, taxRate)

    const invoice = await createInvoice(
      {
        reservationId,
        folioId: folio.id,
        customerName: cleanText(body.customerName),
        customerRif: cleanText(body.customerRif),
        subtotal: totals.subtotal,
        taxRate,
        tax: totals.tax,
        total: totals.total,
        serie: cleanText(body.serie) || "A",
      },
      branchId,
    )
    return NextResponse.json({ ok: true, invoice }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la factura" },
      { status: 500 }
    )
  }
}
