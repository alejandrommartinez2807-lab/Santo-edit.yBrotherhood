import { cleanText, getOrderStaffConfirmationSummary } from "@/lib/localOrderHelpers"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import type { LocalOrder, OrderItem } from "@/types/localOrders"

type LoadOrderWithItems = (
  orderId: string,
  branchId?: string | null,
) => Promise<LocalOrder>

export function recomputeStaffFromItems(items: OrderItem[]) {
  const staff = getOrderStaffConfirmationSummary({ items })
  return {
    staff_confirmation_status: staff.status,
    staff_confirmation_required_count: staff.requiredCount,
    staff_confirmation_confirmed_count: staff.confirmedCount,
    staff_confirmation_pending_count: staff.pendingCount,
    staff_confirmation_updated_at: new Date().toISOString(),
  }
}

export async function confirmOrderStaffItemsInStore(
  orderId: string,
  input: { confirmedBy?: string; confirmedRole?: string },
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  await loadOrderWithItems(orderId, branchId)
  const now = new Date().toISOString()

  const { error: itemsError } = await supabase
    .from("order_items")
    .update({
      staff_confirmation_status: "confirmed",
      staff_confirmed_at: now,
      staff_confirmed_by: cleanText(input.confirmedBy) || null,
      staff_confirmed_role: cleanText(input.confirmedRole) || null,
    })
    .eq("order_id", orderId)
    .eq("requires_waiter_confirmation", true)
  if (itemsError) throw new Error(itemsError.message)

  const order = await loadOrderWithItems(orderId, branchId)
  let query = supabase
    .from("orders")
    .update({
      ...recomputeStaffFromItems(order.items),
      staff_confirmation_updated_by: cleanText(input.confirmedBy) || null,
    })
    .eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)

  return loadOrderWithItems(orderId, branchId)
}

// Marca (o desmarca) UNA línea del pedido como entregada al cliente
// (columnas 0026). Identifica la línea por line_id (cartLineId); si el pedido
// es viejo y no guardó line_id, cae al par producto+nombre.
export async function setOrderItemDeliveredInStore(
  orderId: string,
  input: {
    lineId?: string
    productId?: number
    itemName?: string
    delivered: boolean
    deliveredBy?: string
  },
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  // Valida que el pedido exista en esta sucursal antes de tocar sus líneas.
  await loadOrderWithItems(orderId, branchId)

  const patch = input.delivered
    ? {
        delivered_at: new Date().toISOString(),
        delivered_by: cleanText(input.deliveredBy) || null,
      }
    : { delivered_at: null, delivered_by: null }

  const lineId = cleanText(input.lineId)
  let updated = 0

  if (lineId) {
    const { data, error } = await supabase
      .from("order_items")
      .update(patch)
      .eq("order_id", orderId)
      .eq("line_id", lineId)
      .select("id")
    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          "Falta aplicar la migración 0026 en Supabase para marcar productos entregados.",
        )
      }
      throw new Error(error.message)
    }
    updated = data?.length ?? 0
  }

  if (!updated) {
    const itemName = cleanText(input.itemName)
    const productId = Number(input.productId || 0)
    if (!itemName && !productId) {
      throw new Error("No se pudo identificar el producto del pedido")
    }
    let fallbackQuery = supabase
      .from("order_items")
      .update(patch)
      .eq("order_id", orderId)
    if (productId) fallbackQuery = fallbackQuery.eq("product_id", productId)
    if (itemName) fallbackQuery = fallbackQuery.eq("name", itemName)
    const { data, error } = await fallbackQuery.select("id")
    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          "Falta aplicar la migración 0026 en Supabase para marcar productos entregados.",
        )
      }
      throw new Error(error.message)
    }
    updated = data?.length ?? 0
  }

  if (!updated) {
    throw new Error("No se encontró ese producto dentro del pedido")
  }

  return loadOrderWithItems(orderId, branchId)
}

export async function resetOrderStaffItemsInStore(
  orderId: string,
  input: { resetBy?: string; resetRole?: string },
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  await loadOrderWithItems(orderId, branchId)

  const { error: itemsError } = await supabase
    .from("order_items")
    .update({
      staff_confirmation_status: "pending",
      staff_confirmed_at: null,
      staff_confirmed_by: null,
      staff_confirmed_role: null,
    })
    .eq("order_id", orderId)
    .eq("requires_waiter_confirmation", true)
  if (itemsError) throw new Error(itemsError.message)

  const order = await loadOrderWithItems(orderId, branchId)
  let query = supabase
    .from("orders")
    .update({
      ...recomputeStaffFromItems(order.items),
      staff_confirmation_updated_by: cleanText(input.resetBy) || null,
    })
    .eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)

  return loadOrderWithItems(orderId, branchId)
}
