import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import type { SupplierPurchase } from "@/types/localOrders"
import {
  calculateSupplierPayableTotals,
  isSupplierPurchaseOverdue,
} from "@/lib/supplierPayables"

import { num, type Row } from "./ordersStoreMappers"

type SupabaseClient = ReturnType<typeof getSupabaseAdmin>

// Aplica el cómputo de cuentas por pagar (pagado/pendiente/estado/vencido) a
// una compra, a partir de la suma de sus abonos. Fuente canónica:
// calculateSupplierPayableTotals (supplierPayables.ts).
function enrichPurchaseWithPayments(
  purchase: SupplierPurchase,
  paid: { usd: number; ves: number },
): SupplierPurchase {
  const totals = calculateSupplierPayableTotals({
    totalUSD: purchase.totalUSD,
    totalVES: purchase.totalVES,
    paidUSD: paid.usd,
    paidVES: paid.ves,
  })

  return {
    ...purchase,
    paidUSD: totals.paidUSD,
    paidVES: totals.paidVES,
    pendingUSD: totals.pendingUSD,
    pendingVES: totals.pendingVES,
    paymentStatus: totals.status,
    isOverdue: isSupplierPurchaseOverdue({
      dueDate: purchase.dueDate,
      paymentStatus: totals.status,
    }),
  }
}

// Suma los abonos (USD/VES) agrupados por compra, en una sola query.
async function getPaymentTotalsByPurchase(
  supabase: SupabaseClient,
  purchaseIds: string[],
  branchId?: string | null,
): Promise<Map<string, { usd: number; ves: number }>> {
  const totals = new Map<string, { usd: number; ves: number }>()
  const ids = purchaseIds.filter(Boolean)
  if (ids.length === 0) return totals

  let query = supabase
    .from("supplier_purchase_payments")
    .select("purchase_id, amount_usd, amount_ves")
    .in("purchase_id", ids)
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  for (const raw of (data ?? []) as Row[]) {
    const id = String(raw.purchase_id || "")
    if (!id) continue
    const previous = totals.get(id) || { usd: 0, ves: 0 }
    previous.usd += num(raw.amount_usd)
    previous.ves += num(raw.amount_ves)
    totals.set(id, previous)
  }

  return totals
}

// ============================================================
// COMPRAS A PROVEEDORES SOBRE SUPABASE (Proveedores Fase 2a)
//
// Toda query se filtra/asigna por branch_id para no mezclar compras entre
// sucursales (lo vigila branchIsolation.fitness.test.ts).
// ============================================================

export type SaveSupplierPurchaseInput = {
  supplierId: string | null
  supplierName: string
  purchaseDate: string
  dueDate?: string
  documentNumber?: string
  totalUSD?: number
  totalVES?: number
  note?: string
  // Relación opcional con inventario (Fase 2b). Si se envía un insumo con
  // cantidad > 0, la compra suma stock y genera un movimiento "Compra".
  inventoryItemId?: string | null
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

// Edición de una compra ya registrada (Fase 2b). No cambia el proveedor:
// solo los datos de la compra. Campos omitidos se conservan.
export type UpdateSupplierPurchaseInput = {
  purchaseDate?: string
  dueDate?: string
  documentNumber?: string
  totalUSD?: number
  totalVES?: number
  note?: string
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function mapPurchase(raw: Row): SupplierPurchase {
  const totalUSD = num(raw.total_usd)
  const totalVES = num(raw.total_ves)
  // Sin abonos todavía: el estado base es "Pendiente" y todo queda pendiente.
  // getSupplierPurchases / enrichPurchaseWithPayments lo recalculan con el
  // historial real. due_date es opcional (columna añadida en migración aparte).
  const base = calculateSupplierPayableTotals({ totalUSD, totalVES, paidUSD: 0, paidVES: 0 })
  const dueDate = String(raw.due_date || "").slice(0, 10)

  return {
    id: String(raw.id || ""),
    supplierId: raw.supplier_id ? String(raw.supplier_id) : null,
    supplierName: cleanText(raw.supplier_name),
    purchaseDate: String(raw.purchase_date || "").slice(0, 10),
    documentNumber: cleanText(raw.document_number),
    totalUSD,
    totalVES,
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
    inventoryItemId: raw.inventory_item_id ? String(raw.inventory_item_id) : null,
    inventoryItemName: cleanText(raw.inventory_item_name),
    inventoryQuantity: num(raw.inventory_quantity),
    inventoryUnit: cleanText(raw.inventory_unit),
    inventoryMovementId: cleanText(raw.inventory_movement_id),
    dueDate,
    paidUSD: base.paidUSD,
    paidVES: base.paidVES,
    pendingUSD: base.pendingUSD,
    pendingVES: base.pendingVES,
    paymentStatus: base.status,
    isOverdue: isSupplierPurchaseOverdue({ dueDate, paymentStatus: base.status }),
  }
}

// Suma `quantity` al stock de un insumo y registra el movimiento "Compra".
// Aditivo: nunca resta ni revierte. Devuelve el id del movimiento creado.
// branch-exempt en lecturas: se acota por id de insumo (único) y por branch_id.
async function applyPurchaseStock(
  itemId: string,
  quantity: number,
  branchId: string | null | undefined,
  info: { itemName: string; unit: string; supplierName: string; purchaseDate: string },
): Promise<string> {
  const supabase = getSupabaseAdmin()

  // Stock actual del insumo (acotado a la sucursal).
  let currentQuery = supabase
    .from("inventory_items")
    .select("quantity, unit")
    .eq("id", itemId)
  if (branchId) currentQuery = currentQuery.eq("branch_id", branchId)
  const { data: current } = await currentQuery.maybeSingle()

  const previousQuantity = num((current as Row | null)?.quantity)
  const unit = info.unit || cleanText((current as Row | null)?.unit) || "unidades"
  const finalQuantity = Math.round((previousQuantity + quantity + Number.EPSILON) * 1000) / 1000

  // Actualiza el stock (fila concreta, acotada a la sucursal).
  let updateQuery = supabase
    .from("inventory_items")
    .update({ quantity: finalQuantity, updated_at: new Date().toISOString() })
    .eq("id", itemId)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { error: updateError } = await updateQuery
  if (updateError) throw new Error(updateError.message)

  // Movimiento de auditoría. branch-exempt: la fila incluye branch_id.
  const movementId = `mov-${Date.now()}-${randomSuffix()}`
  const { error: movementError } = await supabase.from("inventory_movements").insert({
    id: movementId,
    branch_id: branchId ?? null,
    date_label: new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }),
    item_id: itemId,
    item_name: info.itemName,
    movement_type: "Compra",
    previous_quantity: previousQuantity,
    quantity_moved: quantity,
    final_quantity: finalQuantity,
    unit,
    reason: `Entrada por compra a proveedor (${info.supplierName})`,
    related_expense: false,
    expense_id: "",
    note: `Compra del ${info.purchaseDate}`,
  })
  if (movementError) throw new Error(movementError.message)

  return movementId
}

export async function getSupplierPurchases(
  branchId?: string | null,
  supplierId?: string | null,
): Promise<SupplierPurchase[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("supplier_purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (branchId) query = query.eq("branch_id", branchId)
  if (supplierId) query = query.eq("supplier_id", supplierId)
  const { data, error } = await query

  if (error) throw new Error(error.message)

  const purchases = (data ?? []).map((raw) => mapPurchase(raw as Row))
  const paymentTotals = await getPaymentTotalsByPurchase(
    supabase,
    purchases.map((purchase) => purchase.id),
    branchId,
  )

  return purchases.map((purchase) =>
    enrichPurchaseWithPayments(purchase, paymentTotals.get(purchase.id) || { usd: 0, ves: 0 }),
  )
}

// Compra individual (acotada a la sucursal) ya enriquecida con sus abonos.
export async function getSupplierPurchaseById(
  id: string,
  branchId?: string | null,
): Promise<SupplierPurchase | null> {
  const cleanId = cleanText(id)
  if (!cleanId) return null

  const supabase = getSupabaseAdmin()
  let query = supabase.from("supplier_purchases").select("*").eq("id", cleanId)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const purchase = mapPurchase(data as Row)
  const paymentTotals = await getPaymentTotalsByPurchase(supabase, [purchase.id], branchId)
  return enrichPurchaseWithPayments(purchase, paymentTotals.get(purchase.id) || { usd: 0, ves: 0 })
}

export async function saveSupplierPurchase(
  input: SaveSupplierPurchaseInput,
  branchId?: string | null,
): Promise<SupplierPurchase> {
  const supabase = getSupabaseAdmin()

  const inventoryItemId = cleanText(input.inventoryItemId)
  const inventoryQuantity = num(input.inventoryQuantity)
  const linksInventory = Boolean(inventoryItemId) && inventoryQuantity > 0

  // Si la compra alimenta el inventario, aplicamos el stock ANTES y guardamos
  // el id del movimiento en la compra (trazabilidad). La validación de que el
  // insumo existe en la sucursal la hace la API antes de llegar aquí.
  let inventoryMovementId = ""
  if (linksInventory) {
    inventoryMovementId = await applyPurchaseStock(inventoryItemId, inventoryQuantity, branchId, {
      itemName: cleanText(input.inventoryItemName),
      unit: cleanText(input.inventoryUnit),
      supplierName: cleanText(input.supplierName),
      purchaseDate: input.purchaseDate,
    })
  }

  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data, error } = await supabase
    .from("supplier_purchases")
    .insert({
      branch_id: branchId ?? null,
      supplier_id: input.supplierId || null,
      supplier_name: cleanText(input.supplierName),
      purchase_date: input.purchaseDate,
      due_date: cleanText(input.dueDate) || null,
      document_number: cleanText(input.documentNumber),
      total_usd: num(input.totalUSD),
      total_ves: num(input.totalVES),
      note: cleanText(input.note),
      inventory_item_id: linksInventory ? inventoryItemId : null,
      inventory_item_name: linksInventory ? cleanText(input.inventoryItemName) : "",
      inventory_quantity: linksInventory ? inventoryQuantity : 0,
      inventory_unit: linksInventory ? cleanText(input.inventoryUnit) : "",
      inventory_movement_id: inventoryMovementId,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapPurchase(data as Row)
}

export async function updateSupplierPurchase(
  id: string,
  input: UpdateSupplierPurchaseInput,
  branchId?: string | null,
): Promise<SupplierPurchase | null> {
  const supabase = getSupabaseAdmin()

  const patch: Record<string, unknown> = {}
  if (input.purchaseDate !== undefined) patch.purchase_date = input.purchaseDate
  if (input.dueDate !== undefined) patch.due_date = cleanText(input.dueDate) || null
  if (input.documentNumber !== undefined) patch.document_number = cleanText(input.documentNumber)
  if (input.totalUSD !== undefined) patch.total_usd = num(input.totalUSD)
  if (input.totalVES !== undefined) patch.total_ves = num(input.totalVES)
  if (input.note !== undefined) patch.note = cleanText(input.note)

  // Actualiza una fila concreta de esta sucursal (no toca otras sucursales).
  let query = supabase.from("supplier_purchases").update(patch).eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.select("*").maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const purchase = mapPurchase(data as Row)
  const paymentTotals = await getPaymentTotalsByPurchase(supabase, [purchase.id], branchId)
  return enrichPurchaseWithPayments(purchase, paymentTotals.get(purchase.id) || { usd: 0, ves: 0 })
}

export async function deleteSupplierPurchase(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  // Borra una fila concreta, acotada además a la sucursal.
  let deleteQuery = supabase.from("supplier_purchases").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}
