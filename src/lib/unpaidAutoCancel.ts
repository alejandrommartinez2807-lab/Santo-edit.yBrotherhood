import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { getBusinessConfig, getPaymentProofs } from "@/lib/orders"
import { sendOrderCancelledStaffPush } from "@/lib/orderPushNotifications"
import { writeAuditLog } from "@/lib/audit"
import { captureError } from "@/lib/monitoring"

// Anulación automática de pedidos SIN pago reportado (pedido del dueño
// 2026-07-21, configurable en publicUnpaidAutoCancelMinutes; 0 = apagada).
//
// Se evalúa "en caliente" cuando el propio cliente consulta su pedido
// (/api/public/order-status y /api/public/order-payment, que la página de
// seguimiento sondea cada pocos segundos): así el pedido se anula justo
// cuando vence el plazo y el cliente ve el aviso con el motivo al instante.
// Solo aplica a Para llevar / Delivery que siguen en "Nuevo" sin cobro de
// caja y sin NINGÚN comprobante reportado (un reporte pendiente lo protege).

type AutoCancelResult = {
  cancelled: boolean
}

function minutesSince(value: unknown): number {
  const createdAt = new Date(String(value || ""))
  if (Number.isNaN(createdAt.getTime())) return 0
  return (Date.now() - createdAt.getTime()) / 60_000
}

export async function maybeAutoCancelUnpaidOrder(
  orderId: string,
): Promise<AutoCancelResult> {
  try {
    const config = await getBusinessConfig()
    const limitMinutes = Number(config.publicUnpaidAutoCancelMinutes || 0)

    if (!Number.isFinite(limitMinutes) || limitMinutes <= 0) {
      return { cancelled: false }
    }

    const supabase = getSupabaseAdmin()
    // branch-exempt: lookup puntual por id único e imprevisible (ord-...).
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id,branch_id,status,order_type,created_at,customer_note,customer_name,amount_received_usd,amount_received_ves,seq,branch_seq,branch_code,is_training",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (error || !order) return { cancelled: false }

    const orderType = String(order.order_type || "")
    const isPrepayType = orderType === "Para llevar" || orderType === "Delivery"
    const alreadyCharged =
      Number(order.amount_received_usd || 0) > 0 ||
      Number(order.amount_received_ves || 0) > 0

    if (
      String(order.status || "") !== "Nuevo" ||
      !isPrepayType ||
      alreadyCharged ||
      order.is_training === true ||
      minutesSince(order.created_at) < limitMinutes
    ) {
      return { cancelled: false }
    }

    // Cualquier comprobante activo (enviado/en revisión/confirmado) protege
    // el pedido: el cliente sí reportó, falta que caja lo revise.
    const proofs = await getPaymentProofs(
      { orderId },
      String(order.branch_id || "") || null,
    )
    const hasActiveProof = proofs.some(
      (proof) => String(proof.status || "") !== "Rechazado",
    )
    if (hasActiveProof) return { cancelled: false }

    const reasonNote = `ANULADO: Sin pago reportado en ${limitMinutes} min (anulación automática). Si aún lo quieres, vuelve a pedir o pásate por caja.`
    const nextNote = String(order.customer_note || "").trim()
      ? `${String(order.customer_note).trim()} | ${reasonNote}`
      : reasonNote

    // Lock optimista: solo anula si SIGUE en "Nuevo" (si caja lo movió en el
    // medio, no se toca).
    const { data: updatedRows, error: updateError } = await supabase
      .from("orders")
      .update({ status: "Cancelado", customer_note: nextNote })
      .eq("id", orderId)
      .eq("status", "Nuevo")
      .select("id")

    if (updateError || !updatedRows?.length) return { cancelled: false }

    await writeAuditLog({
      action: "order.status.updated",
      branchId: String(order.branch_id || "") || null,
      entityType: "order",
      entityId: orderId,
      actor: { label: "Sistema", role: "system", source: "auto-cancel" },
      metadata: {
        status: "Cancelado",
        cancelReason: `Sin pago reportado en ${limitMinutes} min (automático)`,
      },
    }).catch(() => undefined)

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
        itemsSummary: `Anulación automática: sin pago reportado en ${limitMinutes} min`,
        cancelledBy: "Sistema (sin pago reportado)",
        branchId: String(order.branch_id || "") || null,
      }).catch(() => undefined)
    }

    return { cancelled: true }
  } catch (error) {
    captureError(error, { route: "lib/unpaidAutoCancel", action: "maybeAutoCancelUnpaidOrder" })
    return { cancelled: false }
  }
}
