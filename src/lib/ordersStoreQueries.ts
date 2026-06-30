import { getSupabaseAdmin } from "@/lib/supabaseServer"
import type { LocalOrder, OrderItem } from "@/types/localOrders"
import {
  itemRowToOrderItem,
  orderRowToLocalOrder,
  type Row,
} from "./ordersStoreMappers"

export async function loadOrderWithItems(
  orderId: string,
  branchId?: string | null,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  let orderQuery = supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
  if (branchId) orderQuery = orderQuery.eq("branch_id", branchId)
  const { data: orderRow, error } = await orderQuery.single()

  if (error || !orderRow) {
    throw new Error(error?.message || "Pedido no encontrado")
  }

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  const items = (itemRows ?? []).map(itemRowToOrderItem)
  return orderRowToLocalOrder(orderRow as Row, items)
}

export async function getOrdersFromStore(
  branchId?: string | null,
): Promise<LocalOrder[]> {
  const supabase = getSupabaseAdmin()
  let ordersQuery = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
  if (branchId) ordersQuery = ordersQuery.eq("branch_id", branchId)
  const { data: orderRows, error } = await ordersQuery

  if (error) throw new Error(error.message)
  if (!orderRows?.length) return []

  const ids = orderRows.map((r) => (r as Row).id as string)
  const { data: itemRows } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", ids)
    .order("sort_order", { ascending: true })

  const itemsByOrder = new Map<string, OrderItem[]>()
  for (const raw of itemRows ?? []) {
    const row = raw as Row
    const key = row.order_id as string
    if (!itemsByOrder.has(key)) itemsByOrder.set(key, [])
    itemsByOrder.get(key)!.push(itemRowToOrderItem(row))
  }

  return orderRows.map((row) =>
    orderRowToLocalOrder(
      row as Row,
      itemsByOrder.get((row as Row).id as string) ?? [],
    ),
  )
}
