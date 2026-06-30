import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import type { SupplierPurchase, SupplierPurchasePayment } from "@/types/localOrders"
import {
  calculateSupplierPayableTotals,
  normalizeSupplierPaymentStatus,
} from "@/lib/supplierPayables"

import { num, type Row } from "./ordersStoreMappers"

// ============================================================
// COMPRAS A PROVEEDORES SOBRE SUPABASE (Proveedores Fase 2a/2b/2d)
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
  // Pago inicial al registrar la compra (cuentas por pagar, Fase 2d).
  initialPaidUSD?: number
  initialPaidVES?: number
  paymentMethod?: string
  paymentReference?: string
  paymentNote?: string
  // Relación opcional con inventario (Fase 2b). Si se envía un insumo con
  // cantidad > 0, la compra suma stock y genera un movimiento "Compra".
  inventoryItemId?: string | null
  inventoryItemName?: string
  inventoryQuantity?: number
  inventoryUnit?: string
}

// Edición de una compra ya registrada. No cambia el proveedor ni los pagos:
// solo los datos de la compra. Campos omitidos se conservan.
export type UpdateSupplierPurchaseInput = {
  purchaseDate?: string
  dueDate?: string
  documentNumber?: string
  totalUSD?: number
  totalVES?: number
  note?: string
}

export type GetSupplierPurchasesOptions = {
  paymentStatus?: string | null
}

export type SaveSupplierPurchasePaymentInput = {
  paymentDate?: string
  amountUSD?: number
  amountVES?: number
  method?: string
  reference?: string
  note?: string
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function mapPurchase(raw: Row): SupplierPurchase {
  const totals = calculateSupplierPayableTotals({
    totalUSD: raw.total_usd,
    totalVES: raw.total_ves,
    paidUSD: raw.paid_usd,
    paidVES: raw.paid_ves,
  })

  return {
    id: String(raw.id || ""),
    supplierId: raw.supplier_id ? String(raw.supplier_id) : null,
    supplierName: cleanText(raw.supplier_name),
    purchaseDate: String(raw.purchase_date || "").slice(0, 10),
    dueDate: raw.due_date ? String(raw.due_date).slice(0, 10) : "",
    documentNumber: cleanText(raw.document_number),
    totalUSD: totals.totalUSD,
    totalVES: totals.totalVES,
    paidUSD: totals.paidUSD,
    paidVES: totals.paidVES,
    pendingUSD: totals.pendingUSD,
    pendingVES: totals.pendingVES,
    paymentStatus: normalizeSupplierPaymentStatus(raw.payment_status ?? totals.status),
    paymentMethod: cleanText(raw.payment_method),
    paymentReference: cleanText(raw.payment_reference),
    paymentNote: cleanText(raw.payment_note),
    lastPaymentAt: String(raw.last_payment_at || ""),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
    inventoryItemId: raw.inventory_item_id ? String(raw.inventory_item_id) : null,
    inventoryItemName: cleanText(raw.inventory_item_name),
    inventoryQuantity: num(raw.inventory_quantity),
    inventoryUnit: cleanText(raw.inventory_unit),
    inventoryMovementId: cleanText(raw.inventory_movement_id),
  }
}

function mapPurchasePayment(raw: Row): SupplierPurchasePayment {
  return {
    id: String(raw.id || ""),
    purchaseId: String(raw.purchase_id || ""),
    supplierId: raw.supplier_id ? String(raw.supplier_id) : null,
    supplierName: cleanText(raw.supplier_name),
    paymentDate: String(raw.payment_date || raw.created_at || "").slice(0, 10),
    amountUSD: num(raw.amount_usd),
    amountVES: num(raw.amount_ves),
    method: cleanText(raw.method),
    reference: cleanText(raw.reference),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
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
  options?: GetSupplierPurchasesOptions,
): Promise<SupplierPurchase[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("supplier_purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (branchId) query = query.eq("branch_id", branchId)
  if (supplierId) query = query.eq("supplier_id", supplierId)
  const statusFilter = cleanText(options?.paymentStatus)
  if (statusFilter && ["Pendiente", "Parcial", "Pagado"].includes(statusFilter)) {
    query = query.eq("payment_status", statusFilter)
  }
  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapPurchase(raw as Row))
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

  // Pago inicial al registrar la compra → estado de pago calculado.
  const totals = calculateSupplierPayableTotals({
    totalUSD: input.totalUSD,
    totalVES: input.totalVES,
    paidUSD: input.initialPaidUSD,
    paidVES: input.initialPaidVES,
  })
  const hasInitialPayment = totals.paidUSD > 0 || totals.paidVES > 0
  const dueDate = cleanText(input.dueDate)

  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data, error } = await supabase
    .from("supplier_purchases")
    .insert({
      branch_id: branchId ?? null,
      supplier_id: input.supplierId || null,
      supplier_name: cleanText(input.supplierName),
      purchase_date: input.purchaseDate,
      due_date: dueDate || null,
      document_number: cleanText(input.documentNumber),
      total_usd: totals.totalUSD,
      total_ves: totals.totalVES,
      paid_usd: totals.paidUSD,
      paid_ves: totals.paidVES,
      payment_status: totals.status,
      payment_method: cleanText(input.paymentMethod),
      payment_reference: cleanText(input.paymentReference),
      payment_note: cleanText(input.paymentNote),
      last_payment_at: hasInitialPayment ? new Date().toISOString() : null,
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

  // Si cambian los totales, recalculamos el estado de pago con lo ya pagado.
  if (input.totalUSD !== undefined || input.totalVES !== undefined) {
    const current = await fetchPurchaseRow(id, branchId)
    if (!current) return null
    const totals = calculateSupplierPayableTotals({
      totalUSD: input.totalUSD !== undefined ? input.totalUSD : current.total_usd,
      totalVES: input.totalVES !== undefined ? input.totalVES : current.total_ves,
      paidUSD: current.paid_usd,
      paidVES: current.paid_ves,
    })
    patch.payment_status = totals.status
  }

  // Actualiza una fila concreta de esta sucursal (no toca otras sucursales).
  let query = supabase.from("supplier_purchases").update(patch).eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.select("*").maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapPurchase(data as Row) : null
}

export async function deleteSupplierPurchase(
  id: string,
  branchId?: string | null,
): Promise<{ ok: true }> {
  const supabase = getSupabaseAdmin()
  // Los abonos se borran en cascada lógica: primero los pagos de esta compra.
  let paymentsDelete = supabase.from("supplier_purchase_payments").delete().eq("purchase_id", id)
  if (branchId) paymentsDelete = paymentsDelete.eq("branch_id", branchId)
  await paymentsDelete

  // Borra una fila concreta, acotada además a la sucursal.
  let deleteQuery = supabase.from("supplier_purchases").delete().eq("id", id)
  if (branchId) deleteQuery = deleteQuery.eq("branch_id", branchId)
  const { error } = await deleteQuery
  if (error) throw new Error(error.message)
  return { ok: true }
}

async function fetchPurchaseRow(id: string, branchId?: string | null): Promise<Row | null> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from("supplier_purchases").select("*").eq("id", id)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Row | null) ?? null
}

export async function getSupplierPurchasePayments(
  purchaseId: string,
  branchId?: string | null,
): Promise<SupplierPurchasePayment[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("supplier_purchase_payments")
    .select("*")
    .eq("purchase_id", purchaseId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapPurchasePayment(raw as Row))
}

// Registra un abono a una compra: valida saldo, inserta el pago y recalcula el
// estado de pago de la compra. Devuelve el pago y la compra ya actualizada.
export async function saveSupplierPurchasePayment(
  purchaseId: string,
  input: SaveSupplierPurchasePaymentInput,
  branchId?: string | null,
): Promise<{ payment: SupplierPurchasePayment; purchase: SupplierPurchase }> {
  const supabase = getSupabaseAdmin()

  const purchaseRow = await fetchPurchaseRow(purchaseId, branchId)
  if (!purchaseRow) {
    throw new Error("Compra no encontrada")
  }

  const current = calculateSupplierPayableTotals({
    totalUSD: purchaseRow.total_usd,
    totalVES: purchaseRow.total_ves,
    paidUSD: purchaseRow.paid_usd,
    paidVES: purchaseRow.paid_ves,
  })

  if (current.status === "Pagado") {
    throw new Error("Esta compra ya está pagada")
  }

  const amountUSD = num(input.amountUSD)
  const amountVES = num(input.amountVES)
  if (!(amountUSD > 0 || amountVES > 0)) {
    throw new Error("Indica un monto pagado mayor a cero")
  }

  const newPaidUSD = Math.round((current.paidUSD + amountUSD + Number.EPSILON) * 100) / 100
  const newPaidVES = Math.round((current.paidVES + amountVES + Number.EPSILON) * 100) / 100

  // No permitir abonar de más (tolerancia de 1 céntimo por redondeo).
  if (current.totalUSD > 0 && newPaidUSD > current.totalUSD + 0.01) {
    throw new Error("El abono supera el saldo pendiente de la compra")
  }
  if (current.totalUSD <= 0 && current.totalVES > 0 && newPaidVES > current.totalVES + 0.01) {
    throw new Error("El abono supera el saldo pendiente de la compra")
  }

  const updatedTotals = calculateSupplierPayableTotals({
    totalUSD: current.totalUSD,
    totalVES: current.totalVES,
    paidUSD: newPaidUSD,
    paidVES: newPaidVES,
  })

  const paymentDate = cleanText(input.paymentDate) || new Date().toISOString().slice(0, 10)
  const nowISO = new Date().toISOString()

  // Inserta el abono. id es text PK (sin default): lo generamos aquí.
  // branch-exempt: la fila incluye branch_id (asignado aquí).
  const { data: paymentRow, error: paymentError } = await supabase
    .from("supplier_purchase_payments")
    .insert({
      id: `pay-${Date.now()}-${randomSuffix()}`,
      branch_id: branchId ?? null,
      purchase_id: purchaseId,
      supplier_id: purchaseRow.supplier_id ?? null,
      supplier_name: cleanText(purchaseRow.supplier_name),
      payment_date: paymentDate,
      amount_usd: amountUSD,
      amount_ves: amountVES,
      method: cleanText(input.method),
      reference: cleanText(input.reference),
      note: cleanText(input.note),
    })
    .select("*")
    .single()
  if (paymentError) throw new Error(paymentError.message)

  // Actualiza los acumulados y el estado de pago de la compra.
  let updateQuery = supabase
    .from("supplier_purchases")
    .update({
      paid_usd: updatedTotals.paidUSD,
      paid_ves: updatedTotals.paidVES,
      payment_status: updatedTotals.status,
      last_payment_at: nowISO,
    })
    .eq("id", purchaseId)
  if (branchId) updateQuery = updateQuery.eq("branch_id", branchId)
  const { data: updatedPurchase, error: updateError } = await updateQuery.select("*").single()
  if (updateError) throw new Error(updateError.message)

  return {
    payment: mapPurchasePayment(paymentRow as Row),
    purchase: mapPurchase(updatedPurchase as Row),
  }
}
