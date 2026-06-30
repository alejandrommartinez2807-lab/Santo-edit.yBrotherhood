import { cleanText, getOrderStaffConfirmationSummary } from "@/lib/localOrderHelpers"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
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
