import { cleanText } from "@/lib/localOrderHelpers"
import {
  calculatePaymentStatus,
  normalizeDeliveryPaymentIn,
  normalizePaymentMethodUSD,
  normalizePaymentMethodVES,
  roundMoney,
} from "@/lib/localOrderMoney"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import type { LocalOrder } from "@/types/localOrders"
import type { UpdateOrderPaymentInput } from "./ordersCoreTypes"
import { buildOrderFiscalSnapshot } from "./ordersStoreFiscal"
import { isMissingColumnError, num } from "./ordersStoreMappers"
import { recomputeOpenAccountTotals } from "./ordersStoreOpenAccounts"

type LoadOrderWithItems = (
  orderId: string,
  branchId?: string | null,
) => Promise<LocalOrder>

export async function updateOrderPaymentInStore(
  orderId: string,
  payment: UpdateOrderPaymentInput,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()

  const current = await loadOrderWithItems(orderId, branchId)
  const exchangeRate = num(current.exchangeRate)
  const totalOrderUSD = roundMoney(current.totalUSD ?? current.totalPrice)

  const amountReceivedUSD = roundMoney(payment.amountReceivedUSD)
  const amountReceivedVES = roundMoney(payment.amountReceivedVES)
  const receivedFromVES =
    amountReceivedVES > 0 && exchangeRate > 0 ? amountReceivedVES / exchangeRate : 0
  const receivedEquivalentUSD = roundMoney(amountReceivedUSD + receivedFromVES)
  const status = calculatePaymentStatus(receivedEquivalentUSD, totalOrderUSD)
  const pendingUSD =
    status === "Pagado" ? 0 : roundMoney(Math.max(totalOrderUSD - receivedEquivalentUSD, 0))
  const fiscalSnapshot = await buildOrderFiscalSnapshot(current.items, amountReceivedUSD)

  const updateRow: Record<string, unknown> = {
    payment_status: status,
    amount_received_usd: amountReceivedUSD,
    amount_received_ves: amountReceivedVES,
    payment_method_usd: normalizePaymentMethodUSD(payment.paymentMethodUSD),
    payment_method_ves: normalizePaymentMethodVES(payment.paymentMethodVES),
    delivery_payment_in: normalizeDeliveryPaymentIn(payment.deliveryPaymentIn),
    payment_note: cleanText(payment.paymentNote),
    payment_total_order_usd: totalOrderUSD,
    payment_received_equiv_usd: receivedEquivalentUSD,
    payment_pending_usd: pendingUSD,
    payment_updated_at: new Date().toISOString(),
    fiscal: fiscalSnapshot,
  }

  // Atribución de ventas (0022): quién registró este cobro. Solo se tocan las
  // columnas cuando hay staff identificado.
  const chargedByName = cleanText(payment.chargedBy?.name)
  const attributionKeys = ["charged_by_id", "charged_by_name", "charged_by_role"]
  if (chargedByName) {
    updateRow.charged_by_id = cleanText(payment.chargedBy?.id) || null
    updateRow.charged_by_name = chargedByName
    updateRow.charged_by_role = cleanText(payment.chargedBy?.role) || null
  }

  const runUpdate = async () => {
    let query = supabase.from("orders").update(updateRow).eq("id", orderId)
    if (branchId) query = query.eq("branch_id", branchId)
    return query
  }

  let { error } = await runUpdate()

  // Migración 0022 sin aplicar: reintenta sin atribución (el cobro no se pierde).
  if (error && chargedByName && isMissingColumnError(error)) {
    attributionKeys.forEach((key) => delete updateRow[key])
    ;({ error } = await runUpdate())
  }

  if (error) throw new Error(error.message)

  // Si el pedido pertenece a una cuenta abierta, recalcular sus totales.
  if (current.openAccountId) {
    await recomputeOpenAccountTotals(current.openAccountId, branchId)
  }

  return loadOrderWithItems(orderId, branchId)
}
