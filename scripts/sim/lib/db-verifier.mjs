// Verificador de estado REAL en la base de prueba (service role, solo lectura
// en las verificaciones). Nada se marca PASS sin pasar por aquí.
import { supabase } from "./simulation-guard.mjs"

export async function orderRow(orderId) {
  const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle()
  return data
}

export async function ordersByPrefix(prefix) {
  const { data } = await supabase.from("orders").select("*").ilike("customer_name", `${prefix}%`)
  return data || []
}

export async function stockOf(itemId) {
  const { data } = await supabase
    .from("inventory_items")
    .select("quantity")
    .eq("id", itemId)
    .maybeSingle()
  return data ? Number(data.quantity) : NaN
}

export async function auditRows(filter) {
  let query = supabase
    .from("audit_logs")
    .select("id, action, actor_role, actor_label, actor_source, branch_id, entity_id, metadata, created_at")
  if (filter.action) query = query.eq("action", filter.action)
  if (filter.entityId) query = query.eq("entity_id", filter.entityId)
  const { data } = await query.order("created_at", { ascending: false }).limit(filter.limit || 50)
  return data || []
}

export async function tableCount(table) {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true })
  return count ?? 0
}

// PostgREST corta en 1000 filas por defecto. Sin paginar, una tabla grande
// devuelve un trozo y cualquier chequeo de integridad da un FALSO POSITIVO
// ("pedidos sin detalles" que sí los tienen). Lección del Día 7.
export async function fetchAll(table, columns) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

// Chequeos de integridad global (sección 24 del maestro). Devuelve lista de
// problemas; lista vacía = íntegro.
export async function integritySweep() {
  const problems = []

  const orders = await fetchAll(
    "orders",
    "id, status, total_usd, amount_received_usd, amount_received_ves, branch_id, customer_name",
  )
  const items = await fetchAll("order_items", "id, order_id")
  const orderIds = new Set(orders.map((o) => o.id))
  const withItems = new Set(items.map((i) => i.order_id))

  for (const item of items) {
    if (!orderIds.has(item.order_id)) problems.push(`order_item huérfano: ${item.id}`)
  }
  for (const order of orders) {
    if (!withItems.has(order.id)) problems.push(`pedido sin detalles: ${order.id} (${order.customer_name})`)
    if (!order.branch_id) problems.push(`pedido sin sede: ${order.id}`)
  }

  const proofs = await fetchAll("payment_proofs", "id, order_id")
  for (const proof of proofs) {
    if (proof.order_id && !orderIds.has(proof.order_id))
      problems.push(`comprobante huérfano: ${proof.id}`)
  }

  const movements = await fetchAll("inventory_movements", "id, item_id, branch_id")
  const invItems = await fetchAll("inventory_items", "id")
  const invIds = new Set(invItems.map((i) => i.id))
  for (const move of movements) {
    if (!invIds.has(move.item_id)) problems.push(`movimiento sin insumo: ${move.id}`)
  }

  const audit = await fetchAll("audit_logs", "id, actor_label, actor_role")
  for (const row of audit) {
    if (!row.actor_label && !row.actor_role) problems.push(`auditoría sin actor: ${row.id}`)
  }

  return problems
}
