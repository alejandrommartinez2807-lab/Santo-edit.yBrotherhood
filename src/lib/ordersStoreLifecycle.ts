import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { LocalOrder, OrderStatus } from "@/types/localOrders";

type LoadOrderWithItems = (
  orderId: string,
  branchId?: string | null,
) => Promise<LocalOrder>;

export async function updateOrderStatusInStore(
  orderId: string,
  status: OrderStatus,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("orders").update({ status }).eq("id", orderId);
  if (branchId) query = query.eq("branch_id", branchId);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return loadOrderWithItems(orderId, branchId);
}

export async function updateOrderNotesInStore(
  orderId: string,
  input: { customerNote?: string },
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin();
  const customerNote = String(input.customerNote || "")
    .trim()
    .slice(0, 1000);
  let query = supabase
    .from("orders")
    .update({ customer_note: customerNote })
    .eq("id", orderId);
  if (branchId) query = query.eq("branch_id", branchId);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return loadOrderWithItems(orderId, branchId);
}

export async function updateOrderDeliveryReportInStore(
  orderId: string,
  branchId: string | null | undefined,
  loadOrderWithItems: LoadOrderWithItems,
): Promise<LocalOrder> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("orders")
    .update({
      delivery_report_status: "Entrega reportada",
      delivery_reported_at: new Date().toISOString(),
      delivery_reported_by: "Delivery",
    })
    .eq("id", orderId);
  if (branchId) query = query.eq("branch_id", branchId);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return loadOrderWithItems(orderId, branchId);
}

export async function deleteOrderInStore(
  orderId: string,
  branchId?: string | null,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  // order_items cae por ON DELETE CASCADE
  let query = supabase.from("orders").delete().eq("id", orderId);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Pedido no encontrado en esta sucursal");
  return { ok: true };
}

export async function clearOrdersInStore(
  branchId?: string | null,
): Promise<{ ok: boolean; deleted: number; message: string }> {
  const supabase = getSupabaseAdmin();
  let countQ = supabase
    .from("orders")
    .select("id", { count: "exact", head: true });
  if (branchId) countQ = countQ.eq("branch_id", branchId);
  const { count } = await countQ;
  // Borra SOLO los pedidos de esta sucursal (order_items cae por cascade).
  let delQ = supabase.from("orders").delete();
  delQ = branchId ? delQ.eq("branch_id", branchId) : delQ.neq("id", "");
  const { error } = await delQ;
  if (error) throw new Error(error.message);
  return {
    ok: true,
    deleted: count ?? 0,
    message: "Pedidos reiniciados correctamente.",
  };
}
