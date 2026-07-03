import { NextRequest, NextResponse } from "next/server"
import { getSupplierPurchasePaymentsInRange } from "@/lib/orders"
import { resolveScopedBranchId } from "@/lib/branch"

import { checkSuppliersAccess } from "../../suppliers/guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanDate(value: string | null) {
  const text = String(value || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""
}

// Abonos a proveedores en un rango de fechas (para el cierre de caja y el
// resumen del dueño). Acepta ?dateValue=YYYY-MM-DD (un día) o
// ?dateFrom=&dateTo=. Por sede, o consolidado con ?scope=all (dueño/soporte).
export async function GET(request: NextRequest) {
  try {
    const access = await checkSuppliersAccess(request, ["owner", "manager", "support"])
    if (!access.ok) return access.response

    const { searchParams } = request.nextUrl
    const dateValue = cleanDate(searchParams.get("dateValue"))
    const dateFrom = dateValue || cleanDate(searchParams.get("dateFrom"))
    const dateTo = dateValue || cleanDate(searchParams.get("dateTo"))

    const payments = await getSupplierPurchasePaymentsInRange(
      await resolveScopedBranchId(request, access.role),
      { dateFrom, dateTo },
    )

    return NextResponse.json({ ok: true, payments })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los abonos a proveedores",
      },
      { status: 500 },
    )
  }
}
