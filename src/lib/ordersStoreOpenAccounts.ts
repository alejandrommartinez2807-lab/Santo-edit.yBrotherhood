import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { OrderNotFoundError } from "@/lib/orderConflicts"
import { normalizePaymentStatus, roundMoney } from "@/lib/localOrderMoney"
import type {
  CreateOpenAccountInput,
  LocalOrder,
  OpenAccount,
  OpenAccountOrderSummary,
  OpenAccountStatus,
  UpdateOpenAccountInput,
} from "@/types/localOrders"

import {
  itemRowToOrderItem,
  iso,
  num,
  orderRowToLocalOrder,
  type Row,
} from "./ordersStoreMappers"
import {
  addBillRequestMarker,
  getBillRequestedAt,
  stripBillRequestMarker,
} from "@/lib/openAccountBillRequest"

async function loadOrderWithItems(
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

  // PGRST116 = .single() sin filas: no existe (o es de otra sede) → 404.
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

  const items = (itemRows ?? []).map((row) => itemRowToOrderItem(row as Row))
  return orderRowToLocalOrder(orderRow as Row, items)
}

// ============================================================
// CUENTAS ABIERTAS
// ============================================================

function openAccountRowToOpenAccount(row: Row, orders: OpenAccountOrderSummary[] = []): OpenAccount {
  return {
    id: cleanText(row.id),
    createdAt: iso(row.created_at),
    tableNumber: cleanText(row.table_number),
    customerName: cleanText(row.customer_name),
    customerPhone: cleanText(row.customer_phone) || undefined,
    status: (cleanText(row.status) || "Abierta") as OpenAccountStatus,
    orderIds: orders.map((o) => o.id),
    orders,
    totalEstimatedUSD: num(row.total_estimated_usd),
    totalCollectedUSD: num(row.total_collected_usd),
    pendingUSD: num(row.pending_usd),
    note: cleanText(row.note) || undefined,
    openedBy: cleanText(row.opened_by) || undefined,
    closedBy: cleanText(row.closed_by) || undefined,
    closedAt: cleanText(row.closed_at) || undefined,
    updatedAt: cleanText(row.updated_at) || undefined,
  }
}

// Pedidos de VARIAS cuentas en dos queries (una de pedidos + una de items).
// Antes getOpenAccounts hacía 2 queries POR cuenta en un bucle secuencial, y
// caja + mesonero lo sondean cada 2.5s: con 10 mesas abiertas eran ~20
// consultas por tick por pantalla.
// `throwOnError`: quien va a ESCRIBIR totales a partir de esta lectura tiene
// que enterarse si la lectura falló. Una consulta caída devolvía [] en silencio
// y el recálculo persistía "esta cuenta no debe nada" (auditoría 2026-08-02).
// Las pantallas siguen leyendo en modo tolerante: un hipo de la base no debe
// tumbar la vista de mesas, que se refresca sola cada 2,5 s.
async function loadOrderSummariesByAccount(
  accountIds: string[],
  branchId?: string | null,
  options?: { throwOnError?: boolean },
): Promise<Map<string, OpenAccountOrderSummary[]>> {
  const byAccount = new Map<string, OpenAccountOrderSummary[]>()
  const cleanIds = accountIds.map((id) => cleanText(id)).filter(Boolean)
  for (const id of cleanIds) byAccount.set(id, [])
  if (cleanIds.length === 0) return byAccount

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .select(
      "id, open_account_id, seq, branch_seq, branch_code, customer_name, table_number, order_type, status, payment_status, total_usd, total_ves, exchange_rate, payment_received_equiv_usd, payment_pending_usd, created_at, items_text"
    )
    .in("open_account_id", cleanIds)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.order("created_at", { ascending: true })

  if (error && options?.throwOnError) throw new Error(error.message)

  const orderRows = (data ?? []) as Row[]
  const orderIds = orderRows
    .map((raw: Row) => cleanText(raw.id))
    .filter(Boolean)
  const itemsByOrderId = new Map<string, ReturnType<typeof itemRowToOrderItem>[]>()

  if (orderIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("sort_order", { ascending: true })

    if (itemsError && options?.throwOnError) throw new Error(itemsError.message)

    for (const rawItem of (itemRows ?? []) as Row[]) {
      const itemRow = rawItem
      const itemOrderId = cleanText(itemRow.order_id)
      if (!itemOrderId) continue

      const currentItems = itemsByOrderId.get(itemOrderId) ?? []
      currentItems.push(itemRowToOrderItem(itemRow))
      itemsByOrderId.set(itemOrderId, currentItems)
    }
  }

  for (const raw of orderRows) {
    const accountId = cleanText(raw.open_account_id)
    const bucket = byAccount.get(accountId)
    if (bucket) bucket.push(mapOrderRowToSummary(raw, itemsByOrderId))
  }

  return byAccount
}

async function loadAccountOrderSummaries(
  accountId: string,
  branchId?: string | null,
  options?: { throwOnError?: boolean },
): Promise<OpenAccountOrderSummary[]> {
  const byAccount = await loadOrderSummariesByAccount([accountId], branchId, options)
  return byAccount.get(cleanText(accountId)) ?? []
}

function mapOrderRowToSummary(
  raw: Row,
  itemsByOrderId: Map<string, ReturnType<typeof itemRowToOrderItem>[]>,
): OpenAccountOrderSummary {
    const row = raw
    const id = cleanText(row.id)
    const seq = num(row.seq)
    const branchSeq = num(row.branch_seq)
    const branchCode = cleanText(row.branch_code)
    const totalUSD = num(row.total_usd)
    const received = num(row.payment_received_equiv_usd)
    const items = itemsByOrderId.get(id) ?? []

    return {
      id,
      displayNumber:
        branchSeq > 0
          ? `#${String(branchSeq).padStart(2, "0")}${branchCode ? `-${branchCode}` : ""}`
          : seq > 0
            ? `#${String(seq).padStart(2, "0")}`
            : undefined,
      customerName: cleanText(row.customer_name),
      tableNumber: cleanText(row.table_number),
      orderType: (cleanText(row.order_type) || "Comer aquí") as OpenAccountOrderSummary["orderType"],
      status: (cleanText(row.status) || "Nuevo") as OpenAccountOrderSummary["status"],
      paymentStatus: normalizePaymentStatus(row.payment_status),
      totalUSD,
      totalVES: num(row.total_ves),
      exchangeRate: num(row.exchange_rate),
      receivedEquivalentUSD: received,
      pendingUSD: num(row.payment_pending_usd),
      createdAt: iso(row.created_at),
      itemsText: cleanText(row.items_text),
      items,
    }
}

export async function recomputeOpenAccountTotals(
  accountId: string,
  branchId?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  // Los pedidos CANCELADOS no cuentan en el total de la cuenta (antes inflaban
  // total_estimated/pending y bloqueaban el auto-cierre) — auditoría R3.
  //
  // throwOnError (auditoría 2026-08-02): si la lectura de pedidos falla, aquí
  // se ABORTA. Antes devolvía [] en silencio y se escribía pendiente = 0 en la
  // base; acto seguido el endpoint releía la cuenta, la veía saldada y la
  // cerraba sola. Esa comida se iba sin cobrar y no se recuperaba refrescando.
  // Mejor dejar el saldo anterior —aunque esté viejo— que grabar un cero falso.
  const orders = (
    await loadAccountOrderSummaries(accountId, branchId, { throwOnError: true })
  ).filter((o) => o.status !== "Cancelado")
  const totalEstimated = roundMoney(orders.reduce((s, o) => s + o.totalUSD, 0))
  const totalCollected = roundMoney(orders.reduce((s, o) => s + o.receivedEquivalentUSD, 0))
  const pending = roundMoney(Math.max(totalEstimated - totalCollected, 0))

  let query = supabase
    .from("open_accounts")
    .update({
      total_estimated_usd: totalEstimated,
      total_collected_usd: totalCollected,
      pending_usd: pending,
    })
    .eq("id", accountId)
  if (branchId) query = query.eq("branch_id", branchId)
  await query
}

export type OpenAccountsFreshness = {
  accountsCount: number
  accountsMaxUpdatedAt: string | null
  attachedOrdersCount: number
  attachedOrdersMaxUpdatedAt: string | null
}

// La huella barata del sondeo de cuentas (2026-08-04): agregados de ~54 bytes
// en vez de leer todas las filas. Van DOS pares porque el payload de
// getOpenAccounts incluye los pedidos de cada cuenta (y sus líneas): un
// cambio de estado o una línea marcada entregada no toca open_accounts, pero
// SÍ mueve orders.updated_at (triggers 0001 y 0038, vigilados por
// qa:migraciones). El de cuentas repite EXACTO el filtro del cuerpo; el de
// pedidos usa el superconjunto "anclado a alguna cuenta" — más ancho solo
// cuesta una lectura de más, más angosto congelaría el panel sin error.
export async function getOpenAccountsFreshnessFromStore(
  options: { status?: OpenAccountStatus | "all" } = {},
  branchId?: string | null,
): Promise<OpenAccountsFreshness> {
  const supabase = getSupabaseAdmin()

  let accountsQuery = supabase
    .from("open_accounts")
    .select("updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(1)
  if (options.status && options.status !== "all") {
    accountsQuery = accountsQuery.eq("status", options.status)
  }
  if (branchId) accountsQuery = accountsQuery.eq("branch_id", branchId)

  let ordersQuery = supabase
    .from("orders")
    .select("updated_at", { count: "exact" })
    .not("open_account_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
  if (branchId) ordersQuery = ordersQuery.eq("branch_id", branchId)

  const [accounts, orders] = await Promise.all([accountsQuery, ordersQuery])

  if (accounts.error) throw new Error(accounts.error.message)
  if (orders.error) throw new Error(orders.error.message)

  const maxOf = (data: unknown[] | null) => {
    const value = (data?.[0] as Row | undefined)?.updated_at
    return typeof value === "string" && value ? value : null
  }

  return {
    accountsCount: accounts.count ?? 0,
    accountsMaxUpdatedAt: maxOf(accounts.data),
    attachedOrdersCount: orders.count ?? 0,
    attachedOrdersMaxUpdatedAt: maxOf(orders.data),
  }
}

export async function getOpenAccounts(
  options: { status?: OpenAccountStatus | "all"; id?: string } = {},
  branchId?: string | null,
): Promise<OpenAccount[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("open_accounts").select("*").order("created_at", { ascending: false })

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status)
  }
  // Refresco puntual de UNA cuenta (tras cobrar/entregar): antes se traían
  // TODAS las cuentas históricas de la sede solo para encontrar una.
  if (cleanText(options.id)) query = query.eq("id", cleanText(options.id))
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Row[]
  const ordersByAccount = await loadOrderSummariesByAccount(
    rows.map((row) => cleanText(row.id)),
    branchId,
  )

  return rows.map((row) =>
    openAccountRowToOpenAccount(row, ordersByAccount.get(cleanText(row.id)) ?? []),
  )
}

export async function createOpenAccount(
  input: CreateOpenAccountInput,
  branchId?: string | null,
): Promise<OpenAccount> {
  const supabase = getSupabaseAdmin()

  const insertAccount = (tableId: string | null) =>
    supabase
      // branch-exempt: INSERT — la sede viaja DENTRO de la fila
      // (buildOpenAccountInsertRow pone branch_id), no como filtro.
      .from("open_accounts")
      .insert(buildOpenAccountInsertRow(input, branchId, tableId))
      .select("*")
      .single()

  let { data, error } = await insertAccount(cleanText(input.tableId) || null)

  // table_id referencia a `tables`: si la config de mesas divergió de esa
  // tabla (mesa nueva sin fila), la FK falla — la cuenta vale igual sin el
  // vínculo, así que se reintenta sin él en vez de tumbar la apertura.
  if (error && error.code === "23503") {
    ;({ data, error } = await insertAccount(null))
  }

  if (error) {
    // El índice único parcial impide dos cuentas "Abierta" en la misma mesa
    if (error.code === "23505") {
      throw new Error("Esta mesa ya tiene una cuenta abierta activa")
    }
    throw new Error(error.message)
  }

  return openAccountRowToOpenAccount(data as Row, [])
}

function buildOpenAccountInsertRow(
  input: CreateOpenAccountInput,
  branchId: string | null | undefined,
  tableId: string | null,
) {
  return {
      branch_id: branchId ?? null,
      table_number: cleanText(input.tableNumber),
      // La columna existía desde 0001 pero NUNCA se escribía: toda la
      // resolución cuenta↔mesa iba por texto y renombrar la mesa la
      // desconectaba. Guardarla no cambia la resolución actual, pero deja el
      // dato firme para dejar de depender del nombre.
      table_id: tableId,
      customer_name: cleanText(input.customerName),
      customer_phone: cleanText(input.customerPhone) || null,
      // A3/B-2: una cuenta NUNCA nace con la cuenta ya pedida — el marcador
      // solo lo estampa request-bill con su propia hora de servidor.
      note: stripBillRequestMarker(cleanText(input.note)) || null,
      opened_by: cleanText(input.openedBy) || null,
      status: "Abierta",
  }
}

export async function attachOrderToOpenAccount(
  accountId: string,
  orderId: string,
  branchId?: string | null,
): Promise<{
  openAccount: OpenAccount
  order: LocalOrder | undefined
  // "Mover a otra mesa": si el pedido venía de OTRA cuenta, aquí viaja de
  // cuál (para la auditoría) — null cuando fue una asociación normal.
  movedFromAccountId: string | null
  movedFromTable: string | null
}> {
  const supabase = getSupabaseAdmin()

  let accountQuery = supabase
    .from("open_accounts")
    .select("*")
    .eq("id", accountId)
  if (branchId) accountQuery = accountQuery.eq("branch_id", branchId)
  const { data: accountRow, error: accountError } = await accountQuery.single()
  if (accountError || !accountRow) {
    throw new Error("No se encontró la cuenta abierta")
  }

  const account = accountRow as Row

  // Guard R4 (auditoría 2026-07-24): NO se pueden sumar pedidos a una cuenta ya
  // Cerrada/Cancelada (antes el server lo permitía; solo la UI lo evitaba).
  if (cleanText(account.status) !== "Abierta") {
    throw new Error(
      "Esta cuenta ya está cerrada: no se le pueden sumar más pedidos.",
    )
  }

  // Mesa equivocada: si el pedido YA está en otra cuenta, esto es un MOVER.
  // Solo se permite mientras la cuenta de origen siga Abierta — si ya se
  // cobró o cerró, ese dinero está registrado y el camino es la cancelación
  // con el código del dueño, no un movimiento silencioso.
  let previousOrderQuery = supabase
    .from("orders")
    .select("id, open_account_id")
    .eq("id", orderId)
  if (branchId) previousOrderQuery = previousOrderQuery.eq("branch_id", branchId)
  const { data: previousOrderRow, error: previousOrderError } =
    await previousOrderQuery.maybeSingle()
  if (previousOrderError) throw new Error(previousOrderError.message)
  if (!previousOrderRow) throw new Error("El pedido no pertenece a esta sucursal")

  const previousAccountId = cleanText((previousOrderRow as Row).open_account_id)
  const isMove = Boolean(previousAccountId) && previousAccountId !== accountId
  let movedFromTable: string | null = null

  if (isMove) {
    let previousAccountQuery = supabase
      .from("open_accounts")
      .select("id, status, table_number")
      .eq("id", previousAccountId)
    if (branchId) previousAccountQuery = previousAccountQuery.eq("branch_id", branchId)
    const { data: previousAccountRow, error: previousAccountError } =
      await previousAccountQuery.maybeSingle()
    if (previousAccountError) throw new Error(previousAccountError.message)
    if (!previousAccountRow) {
      throw new Error("No se encontró la cuenta de origen del pedido")
    }
    if (cleanText((previousAccountRow as Row).status) !== "Abierta") {
      throw new Error(
        "La cuenta de origen ya está cerrada o cobrada: ese pedido solo se ajusta cancelándolo con el código del dueño.",
      )
    }
    movedFromTable = cleanText((previousAccountRow as Row).table_number) || null
  }

  let orderQuery = supabase
    .from("orders")
    .update({
      open_account_id: accountId,
      open_account_table: cleanText(account.table_number),
      open_account_status: cleanText(account.status),
    })
    .eq("id", orderId)
  if (branchId) orderQuery = orderQuery.eq("branch_id", branchId)
  const { data: updatedOrderRows, error: orderError } = await orderQuery.select("id")
  if (orderError) throw new Error(orderError.message)
  if (!updatedOrderRows?.length) throw new Error("El pedido no pertenece a esta sucursal")

  await recomputeOpenAccountTotals(accountId, branchId)

  // Al mover, la cuenta de ORIGEN también debe quedar cuadrada al instante
  // (si no, la mesa equivocada seguiría mostrando plata que ya no es suya).
  if (isMove) {
    await recomputeOpenAccountTotals(previousAccountId, branchId)
  }

  const orders = await loadAccountOrderSummaries(accountId, branchId)
  let refreshedQuery = supabase
    .from("open_accounts")
    .select("*")
    .eq("id", accountId)
  if (branchId) refreshedQuery = refreshedQuery.eq("branch_id", branchId)
  const { data: refreshed } = await refreshedQuery.single()

  return {
    openAccount: openAccountRowToOpenAccount((refreshed ?? accountRow) as Row, orders),
    order: await loadOrderWithItems(orderId, branchId).catch(() => undefined),
    movedFromAccountId: isMove ? previousAccountId : null,
    movedFromTable: isMove ? movedFromTable : null,
  }
}

// "Pedir la cuenta": pone o quita el marcador en la nota de la cuenta.
// Devuelve null si la cuenta no existe o ya no está Abierta; si ya estaba
// pedida, alreadyRequested=true y se conserva la hora original.
export async function setOpenAccountBillRequested(
  accountId: string,
  requested: boolean,
  branchId?: string | null,
): Promise<{ alreadyRequested: boolean; requestedAt: string } | null> {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from("open_accounts")
    .select("id, status, note")
    .eq("id", accountId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || cleanText((data as Row).status) !== "Abierta") return null

  const currentNote = cleanText((data as Row).note)
  const currentStamp = getBillRequestedAt(currentNote)

  if (requested && currentStamp) {
    return { alreadyRequested: true, requestedAt: currentStamp }
  }

  // Quitar una petición que no existe: nada que escribir.
  if (!requested && currentNote === stripBillRequestMarker(currentNote)) {
    return { alreadyRequested: false, requestedAt: "" }
  }

  const now = new Date().toISOString()
  const nextNote = requested
    ? addBillRequestMarker(currentNote, now)
    : stripBillRequestMarker(currentNote)

  let updateQuery = supabase
    .from("open_accounts")
    .update({ note: nextNote || null })
    .eq("id", accountId)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { error: updateError } = await updateQuery
  if (updateError) throw new Error(updateError.message)

  return { alreadyRequested: false, requestedAt: requested ? now : "" }
}

// Estado actual de una cuenta sin cargar sus pedidos (guard barato para las
// acciones del PATCH: cerrar/entregar/cobrar sobre una cuenta que ya no está
// Abierta). Devuelve null si la cuenta no existe en esa sucursal.
export async function getOpenAccountStatus(
  accountId: string,
  branchId?: string | null,
): Promise<OpenAccountStatus | null> {
  const supabase = getSupabaseAdmin()

  let query = supabase.from("open_accounts").select("id, status").eq("id", accountId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  return normalizeOpenAccountStatus((data as Row).status) || "Abierta"
}

export async function closeOpenAccount(
  accountId: string,
  input: UpdateOpenAccountInput = {},
  branchId?: string | null,
): Promise<OpenAccount> {
  const supabase = getSupabaseAdmin()

  const status: OpenAccountStatus = normalizeOpenAccountStatus(input.status) || "Cerrada"
  const patch: Row = {
    status,
    closed_by: cleanText(input.closedBy) || null,
    closed_at: new Date().toISOString(),
  }
  if (input.customerName !== undefined) patch.customer_name = cleanText(input.customerName)
  if (input.customerPhone !== undefined) patch.customer_phone = cleanText(input.customerPhone) || null
  if (input.note !== undefined) patch.note = cleanText(input.note) || null

  // Cerrar la cuenta atiende la petición de cuenta pendiente: el marcador
  // no debe sobrevivir en el historial.
  if (patch.note === undefined) {
    let noteQuery = supabase
      .from("open_accounts")
      .select("note")
      .eq("id", accountId)
    if (branchId) noteQuery = noteQuery.eq("branch_id", branchId)
    const { data: noteRow } = await noteQuery.maybeSingle()
    const currentNote = cleanText((noteRow as Row | null)?.note)
    if (getBillRequestedAt(currentNote) || currentNote !== stripBillRequestMarker(currentNote)) {
      patch.note = stripBillRequestMarker(currentNote) || null
    }
  }

  let accountUpdateQuery = supabase
    .from("open_accounts")
    .update(patch)
    .eq("id", accountId)
  if (branchId) accountUpdateQuery = accountUpdateQuery.eq("branch_id", branchId)
  const { data, error } = await accountUpdateQuery.select("*").single()
  if (error) throw new Error(error.message)

  // Propagar el estado a los pedidos asociados de la misma sucursal
  let ordersUpdateQuery = supabase
    .from("orders")
    .update({ open_account_status: status })
    .eq("open_account_id", accountId)
  if (branchId) ordersUpdateQuery = ordersUpdateQuery.eq("branch_id", branchId)
  await ordersUpdateQuery

  const orders = await loadAccountOrderSummaries(accountId, branchId)
  return openAccountRowToOpenAccount(data as Row, orders)
}

function normalizeOpenAccountStatus(value: unknown): OpenAccountStatus | null {
  if (value === "Abierta" || value === "Cerrada" || value === "Cancelada") return value
  return null
}
