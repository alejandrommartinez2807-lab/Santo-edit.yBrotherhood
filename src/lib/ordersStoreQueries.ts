import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { OrderNotFoundError } from "@/lib/orderConflicts"
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

  // PGRST116 = .single() sin filas: el pedido no existe (o es de OTRA sede).
  // Eso es un 404 para las rutas, no un fallo del servidor (QA 2026-07-30).
  if (error && error.code !== "PGRST116") {
    throw new Error(error.message)
  }
  if (!orderRow) {
    throw new OrderNotFoundError("Pedido no encontrado en esta sucursal")
  }

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  const items = (itemRows ?? []).map(itemRowToOrderItem)
  return orderRowToLocalOrder(orderRow as Row, items)
}

// Busca un pedido por su clave de idempotencia (client_order_id). Devuelve el
// pedido si ya existe (reintento de un envío offline ya procesado) o null.
export async function findOrderByClientOrderId(
  clientOrderId: string,
  branchId?: string | null,
): Promise<LocalOrder | null> {
  if (!clientOrderId) return null
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .select("id")
    .eq("client_order_id", clientOrderId)
    .limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()

  if (error || !data) return null
  return loadOrderWithItems((data as Row).id as string, branchId)
}

// PostgREST devuelve como mucho 1000 filas por petición. Sin paginar, una sede
// con muchos pedidos recibía SOLO las primeras 1000 líneas de `order_items`:
// del pedido 60 en adelante todo llegaba sin productos, en silencio, y así se
// mostraba en el panel, en cocina y en la fotografía del cierre.
// (Auditoría 2026-08-02, hallazgo crítico.)
const SUPABASE_PAGE_SIZE = 1000

// `in(...)` viaja en la URL: con miles de ids la petición revienta por longitud.
const ORDER_IDS_PER_QUERY = 200

// Tope de seguridad del panel. Con el reinicio ya acotado a la jornada, pasar
// de aquí significa que hay días sin cerrar acumulados.
const MAX_ORDERS = 5000

async function fetchAllRows(
  buildQuery: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null
    error: { message: string } | null
  }>,
  limit = Number.POSITIVE_INFINITY,
): Promise<Row[]> {
  const rows: Row[] = []
  let from = 0

  for (;;) {
    const { data, error } = await buildQuery(from, from + SUPABASE_PAGE_SIZE - 1)

    // El error NO se traga (antes se descartaba): un fallo leyendo las líneas
    // dejaba todos los pedidos vacíos sin avisar a nadie.
    if (error) throw new Error(error.message)

    const page = (data ?? []) as Row[]
    rows.push(...page)

    if (page.length < SUPABASE_PAGE_SIZE || rows.length >= limit) break
    from += SUPABASE_PAGE_SIZE
  }

  return Number.isFinite(limit) ? rows.slice(0, limit) : rows
}

export async function getOrdersFromStore(
  branchId?: string | null,
  options?: { createdFrom?: string | null },
): Promise<LocalOrder[]> {
  const supabase = getSupabaseAdmin()
  const createdFrom = options?.createdFrom || null

  const orderRows = await fetchAllRows((from, to) => {
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      // Desempate estable: sin él, dos pedidos con el mismo created_at pueden
      // repetirse o perderse entre páginas.
      .order("id", { ascending: false })
      .range(from, to)
    if (branchId) query = query.eq("branch_id", branchId)
    // Ventana de los paneles operativos: pedidos de la jornada en curso MÁS
    // cualquier pedido aún vivo de jornadas anteriores (una cuenta abierta que
    // cruzó la madrugada, un delivery sin entregar). Lo único que se queda
    // fuera es lo ya terminado (Entregado/Cancelado) de días viejos — que es
    // justo el peso muerto que crecía sin tope en cada sondeo.
    if (createdFrom) {
      query = query.or(
        `created_at.gte.${createdFrom},status.not.in.(Entregado,Cancelado)`,
      )
    }
    return query
  }, MAX_ORDERS)

  if (!orderRows.length) return []

  const ids = orderRows.map((row) => row.id as string)
  const itemRows: Row[] = []

  for (let start = 0; start < ids.length; start += ORDER_IDS_PER_QUERY) {
    const chunk = ids.slice(start, start + ORDER_IDS_PER_QUERY)

    itemRows.push(
      ...(await fetchAllRows((from, to) =>
        supabase
          .from("order_items")
          .select("*")
          .in("order_id", chunk)
          .order("order_id", { ascending: true })
          .order("sort_order", { ascending: true })
          .range(from, to),
      )),
    )
  }

  const itemsByOrder = new Map<string, OrderItem[]>()
  for (const row of itemRows) {
    const key = row.order_id as string
    if (!itemsByOrder.has(key)) itemsByOrder.set(key, [])
    itemsByOrder.get(key)!.push(itemRowToOrderItem(row))
  }

  return orderRows.map((row) =>
    orderRowToLocalOrder(row, itemsByOrder.get(row.id as string) ?? []),
  )
}
