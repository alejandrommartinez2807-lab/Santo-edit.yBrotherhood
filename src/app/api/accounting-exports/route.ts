import { NextRequest, NextResponse } from "next/server"
import {
  getBusinessDays,
  getFolioItemsInRange,
  getFoliosByIds,
  getGuestProfiles,
  getHotelReservations,
  getInvoices,
  getReservationPayments,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import {
  buildDayClosesCsv,
  buildFullExportCsv,
  buildSalesBookCsv,
} from "@/lib/accountingExports"

import { checkInvoicesAccess } from "../invoices/guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET ?type=sales-book|day-closes|full & from & to → CSV contable para el
// contador. No compite con la contabilidad: entrega los datos para importarlos.
// Gate: rol owner/manager/support + módulo fiscalInvoicing (mismo que Facturación).

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function shift(days: number) {
  return isoDate(new Date(Date.now() + days * 86400000))
}
function cleanDate(value: string | null): string {
  const v = String(value || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""
}

export async function GET(request: NextRequest) {
  try {
    const access = await checkInvoicesAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response
    const branchId = await resolveBranchId(request)

    const type = String(request.nextUrl.searchParams.get("type") || "").trim()
    const from = cleanDate(request.nextUrl.searchParams.get("from"))
    const to = cleanDate(request.nextUrl.searchParams.get("to"))
    const stamp = isoDate(new Date())
    const range = { from: from || undefined, to: to || undefined }

    if (type === "sales-book") {
      const invoices = await getInvoices(branchId)
      return NextResponse.json({
        ok: true,
        filename: `libro-ventas_${from || "todo"}_${to || stamp}.csv`,
        csv: buildSalesBookCsv(invoices, range),
      })
    }

    if (type === "day-closes") {
      const days = await getBusinessDays(branchId)
      return NextResponse.json({
        ok: true,
        filename: `cierres_${from || "todo"}_${to || stamp}.csv`,
        csv: buildDayClosesCsv(days, range),
      })
    }

    if (type === "full") {
      const rFrom = from || shift(-365)
      const rTo = to || shift(365)
      const [reservations, invoices, guests, payments] = await Promise.all([
        getHotelReservations({ from: rFrom, to: rTo }, branchId),
        getInvoices(branchId),
        getGuestProfiles(branchId),
        getReservationPayments({}, branchId).catch(() => []),
      ])
      const resById = new Map(reservations.map((r) => [r.id, r]))

      // Folios: una consulta por rango + folios por id (sin N+1).
      const folioItems = await getFolioItemsInRange(
        { from: from || shift(-365), to: to || shift(1) },
        branchId,
      ).catch(() => [])
      const folioIds = [...new Set(folioItems.map((i) => i.folioId).filter(Boolean))]
      const folios = folioIds.length ? await getFoliosByIds(folioIds, branchId).catch(() => []) : []
      const folioById = new Map(folios.map((f) => [f.id, f]))
      const folioLines = folioItems.map((item) => {
        const folio = folioById.get(item.folioId)
        const reservation = folio ? resById.get(folio.reservationId) : undefined
        return {
          createdAt: item.createdAt,
          reservationCode: reservation?.code || "",
          guestName: reservation?.guestName || "",
          description: item.description,
          kind: item.kind,
          amount: item.amount,
        }
      })

      const csv = buildFullExportCsv({
        reservations: reservations.map((r) => ({
          code: r.code,
          guestName: r.guestName,
          guestPhone: r.guestPhone,
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          nights: r.nights,
          adults: r.adults,
          children: r.children,
          totalAmount: r.totalAmount,
          status: r.status,
          source: r.source,
        })),
        invoices,
        guests: guests.map((g) => ({
          fullName: g.fullName,
          phone: g.phone,
          email: g.email,
          tags: g.tags,
          vip: g.vip,
          notes: g.notes,
        })),
        payments: payments.map((p) => ({
          createdAt: p.createdAt,
          reservationCode: resById.get(p.reservationId)?.code || "",
          method: p.method,
          amount: p.amount,
          reference: p.reference,
          status: p.status,
        })),
        folioLines,
      })
      return NextResponse.json({ ok: true, filename: `export-total_${stamp}.csv`, csv })
    }

    return NextResponse.json({ error: "Tipo de exporte no válido" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el exporte" },
      { status: 500 },
    )
  }
}
