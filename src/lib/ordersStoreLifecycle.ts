import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import { OrderActionConflictError } from "@/lib/orderConflicts"
import type { LocalOrder, OrderStatus } from "@/types/localOrders"

type LoadOrderWithItems = (
  orderId: string,
  branchId?: string | null,
) => Promise<LocalOrder>

export async function updateOrderStatusInStore(
  orderId: string,
  status: OrderStatus,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()

  // Anti doble-acción con varios usuarios a la vez: se lee el estado actual
  // y el UPDATE exige que siga siendo ese (lock optimista). Si otro usuario
  // ya hizo el mismo cambio (o uno distinto en el medio), se responde con un
  // conflicto claro en vez de aplicar la acción dos veces.
  let currentQuery = supabase.from("orders").select("status").eq("id", orderId)
  if (branchId) currentQuery = currentQuery.eq("branch_id", branchId)
  const { data: currentRows, error: currentError } = await currentQuery.limit(1)
  if (currentError) throw new Error(currentError.message)
  if (!currentRows?.length) throw new Error("Pedido no encontrado en esta sucursal")

  const currentStatus = String(currentRows[0]?.status || "")

  if (currentStatus === status) {
    throw new OrderActionConflictError(
      `Este pedido ya está como "${status}": otro usuario lo marcó primero. La lista se actualizará sola.`,
    )
  }

  let query = supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("status", currentStatus)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data: updatedRows, error } = await query.select("id")
  if (error) throw new Error(error.message)
  if (!updatedRows?.length) {
    throw new OrderActionConflictError(
      "El pedido cambió de estado mientras lo actualizabas (otro usuario lo tocó primero). Revisa la lista y vuelve a intentar.",
    )
  }

  if (status === "Preparando") {
    // Marca el arranque real de cocina la PRIMERA vez que el pedido pasa a
    // Preparando: el cronómetro de cocina cuenta desde aquí. Si la migración
    // 0026 no está aplicada, se omite en silencio (queda el fallback por
    // createdAt en la pantalla de cocina).
    let stampQuery = supabase
      .from("orders")
      .update({ kitchen_started_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("kitchen_started_at", null)
    if (branchId) stampQuery = stampQuery.eq("branch_id", branchId)
    const { error: stampError } = await stampQuery
    if (stampError && !isMissingColumnError(stampError)) {
      throw new Error(stampError.message)
    }
  }

  if (status === "Entregado") {
    // Pedido ENTREGADO completo ⇒ sus ítems también quedan entregados: antes
    // un pedido "Entregado" podía mostrar "0/3 entregados" en la vista por
    // producto del mesonero (auditoría 2026-07-23, P2). Solo se estampan los
    // que faltaban; sin migración 0026 se omite en silencio.
    const { error: itemsError } = await supabase
      .from("order_items")
      .update({ delivered_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .is("delivered_at", null)
    if (itemsError && !isMissingColumnError(itemsError)) {
      throw new Error(itemsError.message)
    }
  }

  return loadOrderWithItems(orderId, branchId)
}

export async function updateOrderDeliveryReportInStore(
  orderId: string,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .update({
      delivery_report_status: "Entrega reportada",
      delivery_reported_at: new Date().toISOString(),
      delivery_reported_by: "Delivery",
    })
    .eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { error } = await query
  if (error) throw new Error(error.message)
  return loadOrderWithItems(orderId, branchId)
}

export async function deleteOrderInStore(
  orderId: string,
  branchId?: string | null,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin()
  // order_items cae por ON DELETE CASCADE
  let query = supabase.from("orders").delete().eq("id", orderId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.select("id")
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error("Pedido no encontrado en esta sucursal")
  return { ok: true }
}

export async function clearOrdersInStore(
  branchId?: string | null,
): Promise<{ ok: boolean; deleted: number; message: string }> {
  const supabase = getSupabaseAdmin()
  let countQ = supabase.from("orders").select("id", { count: "exact", head: true })
  if (branchId) countQ = countQ.eq("branch_id", branchId)
  const { count } = await countQ
  // Borra SOLO los pedidos de esta sucursal (order_items cae por cascade).
  let delQ = supabase.from("orders").delete()
  delQ = branchId ? delQ.eq("branch_id", branchId) : delQ.neq("id", "")
  const { error } = await delQ
  if (error) throw new Error(error.message)
  return {
    ok: true,
    deleted: count ?? 0,
    message: "Pedidos reiniciados correctamente.",
  }
}
