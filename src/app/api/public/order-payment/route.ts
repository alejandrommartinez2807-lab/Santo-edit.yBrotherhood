import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getPaymentProofs } from "@/lib/orders"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Estado de pago público de UN pedido: lo usa la página de seguimiento
// (/pedido/[orderId]) para que el cliente reporte su pago después (si salió
// sin subir la captura) y vea si caja ya se lo confirmó, sin duplicarlo.
// Mismo modelo de confianza que /api/public/order-status: el id del pedido
// (ord-...) es imprevisible y solo muestra datos de ese pedido.

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

  return NextResponse.json(data, { ...init, headers })
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-order-payment-get",
    limit: 60,
    windowMs: 60_000,
    message: "Demasiadas consultas de pago. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const orderId = String(request.nextUrl.searchParams.get("pedido") || "")
      .trim()
      .toLowerCase()

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Indica el pedido que quieres consultar" },
        { status: 400 },
      )
    }

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...);
    // devuelve la sede del pedido para que el reporte de pago llegue a ella.
    const { data, error } = await supabase
      .from("orders")
      .select("id,branch_id,seq,branch_seq,branch_code,status,total_usd,exchange_rate,amount_received_usd,amount_received_ves")
      .eq("id", orderId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    if (!data) {
      return noStoreResponse({ ok: false, error: "Pedido no encontrado" }, { status: 404 })
    }

    const order = data as Record<string, unknown>
    const branchId = String(order.branch_id || "")
    const seq = Number(order.seq || 0)
    // Número por sede (branch_seq + inicial de la sede). Fallback al seq global
    // si aún no se aplicó la migración 0025.
    const branchSeq = Number(order.branch_seq || 0)
    const branchCode = String(order.branch_code || "").trim()
    const displayNumber =
      branchSeq > 0
        ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
        : seq > 0
          ? `#${String(seq).padStart(2, "0")}`
          : ""
    const paymentRegistered =
      Number(order.amount_received_usd || 0) > 0 || Number(order.amount_received_ves || 0) > 0

    const proofs = await getPaymentProofs({ orderId }, branchId || null)

    return noStoreResponse({
      ok: true,
      orderId,
      branchId,
      displayNumber,
      orderStatus: String(order.status || ""),
      totalUSD: Number(order.total_usd || 0),
      exchangeRate: Number(order.exchange_rate || 0),
      paymentRegistered,
      // Subconjunto seguro: sin teléfono ni imagen (la captura puede traer
      // datos bancarios del cliente; solo caja la ve en su panel).
      proofs: proofs.map((proof) => ({
        createdAt: proof.createdAt,
        status: proof.status,
        reportedMethod: proof.reportedMethod,
        amountReportedUSD: proof.amountReportedUSD,
        amountReportedVES: proof.amountReportedVES,
        paymentReference: proof.paymentReference,
        internalNote: proof.status === "Necesita corrección" ? proof.internalNote : "",
      })),
    })
  } catch (error) {
    captureError(error, { route: "/api/public/order-payment", action: "GET" })

    return noStoreResponse(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo consultar el pago del pedido",
      },
      { status: 500 },
    )
  }
}
