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
// (Auditoría 2026-08-02, hallazgo crítico. Compartido con los stores de
// cuentas abiertas y comprobantes desde el 2026-08-04 — hallazgo H-2: eran
// las últimas listas operativas sin paginar.)
const SUPABASE_PAGE_SIZE = 1000

// `in(...)` viaja en la URL: con miles de ids la petición revienta por longitud.
export const ORDER_IDS_PER_QUERY = 200

// Tope de seguridad del panel. Con el reinicio ya acotado a la jornada, pasar
// de aquí significa que hay días sin cerrar acumulados.
const MAX_ORDERS = 5000

export async function fetchAllRows(
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

// Ventana de los paneles operativos: pedidos de la jornada en curso MÁS
// cualquier pedido aún vivo de jornadas anteriores (una cuenta abierta que
// cruzó la madrugada, un delivery sin entregar). Lo único que se queda fuera
// es lo ya terminado (Entregado/Cancelado) de días viejos — que es justo el
// peso muerto que crecía sin tope en cada sondeo.
//
// ÚNICA fuente del predicado: la usan el cuerpo (getOrdersFromStore) y la
// huella (getOrdersFreshnessFromStore). Si divergieran, la huella respondería
// "nada cambió" sobre un conjunto distinto del que ve el panel — congelándolo
// sin ningún error (condición 2 del audit de la huella, 2026-08-04).
export function liveOrdersWindowOrFilter(createdFrom: string) {
  return `created_at.gte.${createdFrom},status.not.in.(Entregado,Cancelado)`
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
    if (createdFrom) {
      query = query.or(liveOrdersWindowOrFilter(createdFrom))
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

export type OrdersFreshness = {
  count: number
  maxUpdatedAt: string | null
}

// La huella barata del sondeo (consumo de Supabase 2026-08-04): en vez de
// bajar todas las filas para saber si algo cambió (626 KB medidos por sondeo),
// se piden dos agregados (~54 bytes): cuántos pedidos hay y el updated_at más
// reciente. Cualquier escritura los mueve: la fila del pedido por
// trg_orders_updated (0001) y sus líneas por trg_order_items_touch_order
// (0038) — qa:migraciones comprueba AMBOS por comportamiento en cada corrida.
//
// El conjunto agregado tiene que ser EXACTAMENTE el que el panel ve: misma
// sede, misma ventana (el helper compartido de arriba) y el mismo lado de
// is_training que aplica el filtro en memoria de la ruta (mapper:
// isTraining = is_training === true). Un conjunto más ancho solo gasta de
// más; uno más angosto congela el panel sin error.
export async function getOrdersFreshnessFromStore(
  branchId?: string | null,
  options?: { createdFrom?: string | null; trainingActive?: boolean },
): Promise<OrdersFreshness> {
  const supabase = getSupabaseAdmin()
  const createdFrom = options?.createdFrom || null

  let query = supabase
    .from("orders")
    .select("updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(1)
  if (branchId) query = query.eq("branch_id", branchId)
  if (createdFrom) query = query.or(liveOrdersWindowOrFilter(createdFrom))
  // `not is true` (y no `eq false`) porque en filas viejas is_training es null.
  query = options?.trainingActive
    ? query.is("is_training", true)
    : query.not("is_training", "is", true)

  const { data, count, error } = await query

  if (error) throw new Error(error.message)

  const newest = (data?.[0] as Row | undefined)?.updated_at

  return {
    count: count ?? 0,
    maxUpdatedAt: typeof newest === "string" && newest ? newest : null,
  }
}
