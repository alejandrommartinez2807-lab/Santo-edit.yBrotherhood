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

// Otro cobro entró entre la lectura y la escritura. Se distingue del "pedido
// anulado" porque quien lo provocó (confirmar un comprobante) puede recalcular
// con los montos frescos y reintentar.
export class OrderPaymentConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OrderPaymentConflictError"
  }
}

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

  // Nunca cobrar sobre un pedido ANULADO (la anulación automática o del
  // cliente pudo ganar la carrera con una tarjeta de caja desactualizada):
  // el WHERE lo excluye y 0 filas se reporta como error claro.
  // Candado optimista (solo si quien llama calculó los montos a partir de una
  // lectura previa): el UPDATE exige que el pedido siga teniendo esos montos.
  // Si otro cobro entró entremedio, 0 filas y nadie pisa a nadie.
  const expectedPrevious = payment.expectedPrevious

  const runUpdate = async () => {
    let query = supabase
      .from("orders")
      .update(updateRow)
      .eq("id", orderId)
      .neq("status", "Cancelado")
    if (branchId) query = query.eq("branch_id", branchId)
    if (expectedPrevious) {
      // Las columnas admiten NULL (su default es 0, pero un `.eq(col, 0)` NO
      // empareja un NULL): sin este `or`, el candado fallaría SIEMPRE en el
      // primer cobro de un pedido con la columna vacía y no se podría
      // confirmar ningún comprobante.
      const lockOn = (column: string, value: number) => {
        const amount = roundMoney(value)
        query =
          amount === 0
            ? query.or(`${column}.eq.0,${column}.is.null`)
            : query.eq(column, amount)
      }
      lockOn("amount_received_usd", expectedPrevious.amountReceivedUSD)
      lockOn("amount_received_ves", expectedPrevious.amountReceivedVES)
    }
    // El .select() va al final para no cambiar el tipo del encadenado.
    return query.select("id")
  }

  let { data: updatedRows, error } = await runUpdate()

  // Migración 0022 sin aplicar: reintenta sin atribución (el cobro no se pierde).
  if (error && chargedByName && isMissingColumnError(error)) {
    attributionKeys.forEach((key) => delete updateRow[key])
    ;({ data: updatedRows, error } = await runUpdate())
  }

  if (error) throw new Error(error.message)
  if (!updatedRows?.length) {
    // Con el candado puesto, 0 filas tiene DOS causas posibles: el pedido se
    // anuló, o el cobro cambió entremedio. Se distinguen releyendo, para no
    // decirle a caja "está anulado" cuando lo que pasó es una carrera.
    if (expectedPrevious) {
      const { data: freshRow } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle()
      const freshStatus = String((freshRow as Record<string, unknown>)?.status || "")

      if (freshRow && freshStatus !== "Cancelado") {
        throw new OrderPaymentConflictError(
          "Otro cobro de este pedido se registró primero. Vuelve a intentarlo con los montos actualizados.",
        )
      }
    }

    throw new Error(
      "Este pedido está ANULADO: no se puede registrar un cobro. Refresca la lista de caja.",
    )
  }

  // Si el pedido pertenece a una cuenta abierta, recalcular sus totales.
  if (current.openAccountId) {
    await recomputeOpenAccountTotals(current.openAccountId, branchId)
  }

  return loadOrderWithItems(orderId, branchId)
}
