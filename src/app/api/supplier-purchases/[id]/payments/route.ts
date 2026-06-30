import { NextRequest, NextResponse } from "next/server"
import {
  getSupplierPurchasePayments,
  saveSupplierPurchasePayment,
} from "@/lib/orders"
import { resolveBranchId } from "@/lib/branch"
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"
import { enforceApiReadGuards } from "@/lib/apiReadGuards"

import { checkSuppliersAccess } from "../../../suppliers/guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanText(value: unknown) {
  return String(value || "").trim()
}

function normalizeAmount(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function normalizeDate(value: unknown) {
  const text = cleanText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10)
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiReadGuards(request, {
    id: "api-supplier-purchase-payments-get",
    limit: 120,
    windowMs: 60_000,
    rateLimitMessage: "Demasiadas consultas de pagos a proveedores. Espera unos segundos.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner", "support"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const payments = await getSupplierPurchasePayments(id, await resolveBranchId(request))

    return NextResponse.json({ ok: true, payments })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron cargar los pagos",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-supplier-purchase-payments-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 512_000,
    rateLimitMessage: "Demasiados pagos registrados. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse

  try {
    const access = await checkSuppliersAccess(request, ["owner"])
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const amountUSD = normalizeAmount(body.amountUSD)
    const amountVES = normalizeAmount(body.amountVES)

    if (!(amountUSD > 0 || amountVES > 0)) {
      return NextResponse.json({ error: "Indica un monto pagado mayor a cero" }, { status: 400 })
    }

    const result = await saveSupplierPurchasePayment(
      id,
      {
        paymentDate: normalizeDate(body.paymentDate),
        amountUSD,
        amountVES,
        paymentMethod: cleanText(body.method),
        reference: cleanText(body.reference),
        note: cleanText(body.note),
      },
      (await resolveBranchId(request)) ?? undefined,
    )

    return NextResponse.json({ ok: true, payment: result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el pago"
    const status = /no encontrada|mayor a cero|supera|ya está pagada/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
