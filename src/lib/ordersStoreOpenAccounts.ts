import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
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

  if (error || !orderRow) {
    throw new Error(error?.message || "Pedido no encontrado")
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

async function loadAccountOrderSummaries(
  accountId: string,
  branchId?: string | null,
): Promise<OpenAccountOrderSummary[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .select(
      "id, seq, branch_seq, branch_code, customer_name, table_number, order_type, status, payment_status, total_usd, total_ves, exchange_rate, payment_received_equiv_usd, payment_pending_usd, created_at, items_text"
    )
    .eq("open_account_id", accountId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data } = await query.order("created_at", { ascending: true })

  const orderRows = (data ?? []) as Row[]
  const orderIds = orderRows
    .map((raw: Row) => cleanText(raw.id))
    .filter(Boolean)
  const itemsByOrderId = new Map<string, ReturnType<typeof itemRowToOrderItem>[]>()

  if (orderIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("sort_order", { ascending: true })

    for (const rawItem of (itemRows ?? []) as Row[]) {
      const itemRow = rawItem
      const itemOrderId = cleanText(itemRow.order_id)
      if (!itemOrderId) continue

      const currentItems = itemsByOrderId.get(itemOrderId) ?? []
      currentItems.push(itemRowToOrderItem(itemRow))
      itemsByOrderId.set(itemOrderId, currentItems)
    }
  }

  return orderRows.map((raw: Row) => {
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
  })
}

export async function recomputeOpenAccountTotals(
  accountId: string,
  branchId?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  // Los pedidos CANCELADOS no cuentan en el total de la cuenta (antes inflaban
  // total_estimated/pending y bloqueaban el auto-cierre) — auditoría R3.
  const orders = (await loadAccountOrderSummaries(accountId, branchId)).filter(
    (o) => o.status !== "Cancelado",
  )
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

export async function getOpenAccounts(
  options: { status?: OpenAccountStatus | "all" } = {},
  branchId?: string | null,
): Promise<OpenAccount[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("open_accounts").select("*").order("created_at", { ascending: false })

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status)
  }
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const accounts: OpenAccount[] = []
  for (const raw of data ?? []) {
    const row = raw as Row
    const orders = await loadAccountOrderSummaries(cleanText(row.id), branchId)
    accounts.push(openAccountRowToOpenAccount(row, orders))
  }
  return accounts
}

export async function createOpenAccount(
  input: CreateOpenAccountInput,
  branchId?: string | null,
): Promise<OpenAccount> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("open_accounts")
    .insert({
      branch_id: branchId ?? null,
      table_number: cleanText(input.tableNumber),
      customer_name: cleanText(input.customerName),
      customer_phone: cleanText(input.customerPhone) || null,
      note: cleanText(input.note) || null,
      opened_by: cleanText(input.openedBy) || null,
      status: "Abierta",
    })
    .select("*")
    .single()

  if (error) {
    // El índice único parcial impide dos cuentas "Abierta" en la misma mesa
    if (error.code === "23505") {
      throw new Error("Esta mesa ya tiene una cuenta abierta activa")
    }
    throw new Error(error.message)
  }

  return openAccountRowToOpenAccount(data as Row, [])
}

export async function attachOrderToOpenAccount(
  accountId: string,
  orderId: string,
  branchId?: string | null,
): Promise<{ openAccount: OpenAccount; order: LocalOrder | undefined }> {
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
  }
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
