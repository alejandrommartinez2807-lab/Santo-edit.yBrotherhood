import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { canTransitionOrderStatus } from "@/lib/orderStatusPermissions"
import { isMissingColumnError } from "@/lib/ordersStoreMappers"
import { OrderActionConflictError } from "@/lib/orderConflicts"
import { recomputeOpenAccountTotals } from "@/lib/ordersStoreOpenAccounts"
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

  // Máquina de estados (H1): Cancelado es terminal — un pedido anulado ya
  // devolvió inventario y no puede revivir para cobrarse; Entregado solo se
  // reabre a Listo o se anula.
  if (!canTransitionOrderStatus(currentStatus, status)) {
    throw new Error(
      currentStatus === "Cancelado"
        ? "Este pedido está ANULADO y no puede cambiar de estado."
        : `Un pedido "${currentStatus}" no puede pasar directo a "${status}".`,
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

  if (currentStatus === "Entregado" && status !== "Entregado" && status !== "Cancelado") {
    // REABRIR un pedido (Entregado → Listo/otro, botón "No entregado"): se
    // des-marca la entrega de todos los ítems para que no quede "3/3
    // entregados" en un pedido que ya NO está entregado (auditoría 2026-07-24,
    // P2b). También delivered_by (quedaba "entregado por Juan" sin fecha). Un
    // Entregado → Cancelado NO borra el rastro de quién entregó (auditoría
    // H5). Sin migración 0026 se omite en silencio.
    const { error: reopenError } = await supabase
      .from("order_items")
      .update({ delivered_at: null, delivered_by: null })
      .eq("order_id", orderId)
    if (reopenError && !isMissingColumnError(reopenError)) {
      throw new Error(reopenError.message)
    }
  }

  const order = await loadOrderWithItems(orderId, branchId)

  // Cancelar un pedido de una cuenta abierta dejaba los totales cacheados
  // (total/pendiente) inflados hasta la siguiente acción sobre la cuenta —
  // el recálculo excluye cancelados (R3), pero nadie lo disparaba aquí. Un
  // fallo del recálculo no tumba la anulación: el próximo attach/cobro lo
  // corrige igual.
  if (status === "Cancelado" && order.openAccountId) {
    await recomputeOpenAccountTotals(order.openAccountId, branchId).catch(
      () => {},
    )
  }

  return order
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
    // H19 (2026-07-24): solo un pedido LISTO puede reportar entrega — antes
    // esto solo lo validaba la UI y cualquier estado (incluso Cancelado)
    // contaminaba el filtro "Delivery por confirmar" de caja.
    .eq("status", "Listo")
  if (branchId) query = query.eq("branch_id", branchId)
  const { data: updatedRows, error } = await query.select("id")
  if (error) throw new Error(error.message)
  if (!updatedRows?.length) {
    throw new Error(
      "Solo se puede reportar la entrega de un pedido LISTO. Refresca la lista e intenta de nuevo.",
    )
  }
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
  // Fail-closed (auditoría 2026-07-24, B): sin sede resuelta el `neq("id","")`
  // borraba los pedidos de TODAS las sucursales.
  if (!branchId) {
    throw new Error("No se pudo resolver la sucursal: no se reinician los pedidos")
  }
  const supabase = getSupabaseAdmin()
  // Red de seguridad R2 (auditoría 2026-07-24): NO borrar los pedidos atados a
  // una cuenta AÚN "Abierta" — perderían su pendiente y la cuenta quedaría
  // huérfana. Se conservan hasta que la cuenta se cierre. Los de cuentas ya
  // Cerradas/Canceladas y los sueltos sí se limpian.
  const keepOpenAccounts = "open_account_status.is.null,open_account_status.neq.Abierta"
  let countQ = supabase.from("orders").select("id", { count: "exact", head: true })
  if (branchId) countQ = countQ.eq("branch_id", branchId)
  countQ = countQ.or(keepOpenAccounts)
  const { count } = await countQ
  // Borra SOLO los pedidos de esta sucursal (order_items cae por cascade).
  let delQ = supabase.from("orders").delete()
  delQ = branchId ? delQ.eq("branch_id", branchId) : delQ.neq("id", "")
  delQ = delQ.or(keepOpenAccounts)
  const { error } = await delQ
  if (error) throw new Error(error.message)
  return {
    ok: true,
    deleted: count ?? 0,
    message: "Pedidos reiniciados correctamente.",
  }
}
