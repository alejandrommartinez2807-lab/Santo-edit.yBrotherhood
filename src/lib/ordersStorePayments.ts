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
import { num } from "./ordersStoreMappers"
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

  let query = supabase
    .from("orders")
    .update({
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
    })
    .eq("id", orderId)

  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query

  if (error) throw new Error(error.message)

  // Si el pedido pertenece a una cuenta abierta, recalcular sus totales.
  if (current.openAccountId) {
    await recomputeOpenAccountTotals(current.openAccountId, branchId)
  }

  return loadOrderWithItems(orderId, branchId)
}
