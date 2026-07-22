import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig, getPaymentProofs } from "@/lib/orders"
import { sendOrderCancelledStaffPush } from "@/lib/orderPushNotifications"
import { writeAuditLog } from "@/lib/audit"
import { enforceRateLimit } from "@/lib/rateLimit"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// El CLIENTE cancela su propio pedido desde el seguimiento (pedido del dueño
// 2026-07-21): solo mientras sigue en "Nuevo", sin cobro de caja y sin
// comprobante activo (si ya reportó plata, que hable con el local). La razón
// es opcional y el dueño la ve en la nota del pedido y en Auditoría.

function noStoreResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return NextResponse.json(data, { ...init, headers })
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-public-order-cancel-post",
    limit: 10,
    windowMs: 60_000,
    message: "Demasiados intentos. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const orderId = String(body.orderId || "")
      .trim()
      .toLowerCase()
    const reason = String(body.reason || "")
      .trim()
      .slice(0, 300)

    if (!orderId || !orderId.startsWith("ord-")) {
      return noStoreResponse(
        { ok: false, error: "Indica el pedido que quieres cancelar" },
        { status: 400 },
      )
    }

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...).
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id,branch_id,status,customer_note,customer_name,amount_received_usd,amount_received_ves,seq,branch_seq,branch_code",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!order) {
      return noStoreResponse({ ok: false, error: "Pedido no encontrado" }, { status: 404 })
    }

    if (String(order.status || "") !== "Nuevo") {
      return noStoreResponse(
        {
          ok: false,
          error:
            "Este pedido ya está en preparación o cerrado: para cancelarlo escríbenos por WhatsApp.",
        },
        { status: 409 },
      )
    }

    const alreadyCharged =
      Number(order.amount_received_usd || 0) > 0 ||
      Number(order.amount_received_ves || 0) > 0
    const proofs = await getPaymentProofs(
      { orderId },
      String(order.branch_id || "") || null,
    )
    const hasActiveProof = proofs.some(
      (proof) => String(proof.status || "") !== "Rechazado",
    )

    if (alreadyCharged || hasActiveProof) {
      return noStoreResponse(
        {
          ok: false,
          error:
            "Ya hay un pago asociado a este pedido: escríbenos por WhatsApp y lo resolvemos contigo.",
        },
        { status: 409 },
      )
    }

    const reasonNote = `ANULADO: Cancelado por el cliente${reason ? ` — Motivo: ${reason}` : ""}`
    const nextNote = String(order.customer_note || "").trim()
      ? `${String(order.customer_note).trim()} | ${reasonNote}`
      : reasonNote

    // Lock optimista: solo cancela si SIGUE en "Nuevo".
    const { data: updatedRows, error: updateError } = await supabase
      .from("orders")
      .update({ status: "Cancelado", customer_note: nextNote })
      .eq("id", orderId)
      .eq("status", "Nuevo")
      .select("id")

    if (updateError) throw new Error(updateError.message)
    if (!updatedRows?.length) {
      return noStoreResponse(
        {
          ok: false,
          error: "El pedido cambió de estado justo ahora: revisa el seguimiento.",
        },
        { status: 409 },
      )
    }

    await writeAuditLog({
      action: "order.status.updated",
      branchId: String(order.branch_id || "") || null,
      entityType: "order",
      entityId: orderId,
      actor: { label: "Cliente (seguimiento público)", role: "public", source: "order-cancel" },
      request,
      metadata: {
        status: "Cancelado",
        cancelReason: reason || "Cancelado por el cliente (sin motivo)",
      },
    }).catch(() => undefined)

    const config = await getBusinessConfig()
    if (config.cancellationAlertsEnabled !== false) {
      const branchSeq = Number(order.branch_seq || 0)
      const branchCode = String(order.branch_code || "").trim()
      const seq = Number(order.seq || 0)
      const displayNumber =
        branchSeq > 0
          ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
          : seq > 0
            ? `#${String(seq).padStart(2, "0")}`
            : orderId

      await sendOrderCancelledStaffPush({
        displayNumber,
        customerName: String(order.customer_name || ""),
        itemsSummary: reason ? `Motivo del cliente: ${reason}` : "El cliente no dejó motivo",
        cancelledBy: "El cliente (desde su seguimiento)",
        branchId: String(order.branch_id || "") || null,
      }).catch(() => undefined)
    }

    return noStoreResponse({ ok: true, cancelled: true })
  } catch (error) {
    captureError(error, { route: "/api/public/order-cancel", action: "POST" })

    return noStoreResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo cancelar el pedido",
      },
      { status: 500 },
    )
  }
}
