import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import { captureError } from "@/lib/monitoring"
import type { CancelOrigin, CancelRefund } from "@/lib/orderCancellationInfo"

// Escribe el detalle estructurado de una anulación (columnas 0036) sobre un
// pedido YA cancelado. Los tres orígenes (automático, personal, cliente)
// pasan por aquí para que el dato quede igual de completo en los tres.
//
// Sin la migración 0036 aplicada se omite en silencio: el motivo sigue
// viajando en customer_note y en Auditoría, como antes. Nunca lanza — un
// fallo aquí no puede tumbar una anulación que ya ocurrió.

export type CancellationDetails = {
  origin: CancelOrigin
  // Motivo tal cual se escribió; vacío = cliente que no dejó motivo (se
  // guarda NULL y la UI muestra "no dejó motivo").
  reason: string
  cancelledById?: string
  cancelledByName: string
  cancelledByRole: string
  inventoryUsed: boolean | null
  // null = el pedido no tenía dinero cobrado al anular.
  refund: CancelRefund | null
  refundUSD: number
}

export async function applyCancellationDetails(
  orderId: string,
  branchId: string | null | undefined,
  details: CancellationDetails,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from("orders")
      .update({
        cancel_origin: details.origin,
        cancel_reason: details.reason.trim() || null,
        cancelled_by_id: details.cancelledById?.trim() || null,
        cancelled_by_name: details.cancelledByName.trim() || null,
        cancelled_by_role: details.cancelledByRole.trim() || null,
        cancelled_at: new Date().toISOString(),
        cancel_inventory_used: details.inventoryUsed,
        cancel_refund: details.refund,
        cancel_refund_usd: details.refundUSD > 0 ? details.refundUSD : null,
      })
      .eq("id", orderId)
      // Solo estampa pedidos que SIGUEN cancelados: si una compensación
      // anti-carrera lo revivió en el medio, no se ensucia.
      .eq("status", "Cancelado")
    if (branchId) query = query.eq("branch_id", branchId)

    const { error } = await query
    if (error && !isMissingColumnError(error)) throw new Error(error.message)
  } catch (error) {
    captureError(error, {
      route: "lib/orderCancellationStore",
      action: "applyCancellationDetails",
    })
  }
}

// Una compensación anti-carrera revivió el pedido (p. ej. el comprobante del
// cliente aterrizó mientras se anulaba): el detalle de anulación se limpia
// para que un pedido VIVO no cargue datos de una anulación que se deshizo.
export async function clearCancellationDetails(
  orderId: string,
  branchId: string | null | undefined,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from("orders")
      .update({
        cancel_origin: null,
        cancel_reason: null,
        cancelled_by_id: null,
        cancelled_by_name: null,
        cancelled_by_role: null,
        cancelled_at: null,
        cancel_inventory_used: null,
        cancel_refund: null,
        cancel_refund_usd: null,
      })
      .eq("id", orderId)
      .neq("status", "Cancelado")
    if (branchId) query = query.eq("branch_id", branchId)

    const { error } = await query
    if (error && !isMissingColumnError(error)) throw new Error(error.message)
  } catch (error) {
    captureError(error, {
      route: "lib/orderCancellationStore",
      action: "clearCancellationDetails",
    })
  }
}
