import type { SupplierPurchase } from "@/types/localOrders"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { cleanText } from "@/lib/localOrderHelpers"
import { num } from "./ordersStoreMappers"

import * as purchaseStore from "./ordersStoreSupplierPurchases"
import type {
  SaveSupplierPurchaseInput,
  UpdateSupplierPurchaseInput,
} from "./ordersStoreSupplierPurchases"

export type { SaveSupplierPurchaseInput, UpdateSupplierPurchaseInput }

export async function getSupplierPurchases(
  branchId?: string | null,
  supplierId?: string | null,
): Promise<SupplierPurchase[]> {
  return purchaseStore.getSupplierPurchases(branchId, supplierId)
}

export async function getSupplierPurchaseById(
  id: string,
  branchId?: string | null,
): Promise<SupplierPurchase | null> {
  return purchaseStore.getSupplierPurchaseById(id, branchId)
}

export async function saveSupplierPurchase(
  input: SaveSupplierPurchaseInput,
  branchId?: string | null,
): Promise<SupplierPurchase> {
  return purchaseStore.saveSupplierPurchase(input, branchId)
}

export async function updateSupplierPurchase(
  id: string,
  input: UpdateSupplierPurchaseInput,
  branchId?: string | null,
) {
  return purchaseStore.updateSupplierPurchase(id, input, branchId)
}

export async function deleteSupplierPurchase(id: string, branchId?: string | null) {
  return purchaseStore.deleteSupplierPurchase(id, branchId)
}

export type SupplierPurchasePayment = {
  id: string
  supplierPurchaseId: string
  purchaseId: string
  paymentDate: string
  amountUSD: number
  amountVES: number
  paymentMethod: string
  reference: string
  note: string
  createdAt: string
}

export type SaveSupplierPurchasePaymentInput = {
  supplierPurchaseId?: string
  purchaseId?: string
  paymentDate?: string
  amountUSD?: number
  amountVES?: number
  paymentMethod?: string
  reference?: string
  note?: string
}

type PaymentRow = Record<string, unknown>

function mapSupplierPurchasePayment(raw: PaymentRow): SupplierPurchasePayment {
  const purchaseId = String(raw.supplier_purchase_id || raw.purchase_id || "")
  return {
    id: String(raw.id || ""),
    supplierPurchaseId: purchaseId,
    purchaseId,
    paymentDate: String(raw.payment_date || raw.created_at || "").slice(0, 10),
    amountUSD: num(raw.amount_usd),
    amountVES: num(raw.amount_ves),
    paymentMethod: cleanText(raw.method || raw.payment_method),
    reference: cleanText(raw.reference || raw.payment_reference),
    note: cleanText(raw.note),
    createdAt: String(raw.created_at || ""),
  }
}

function buildSupplierPurchasePaymentArgs(args: unknown[]) {
  const first = args[0]
  const second = args[1]
  const third = args[2]

  if (typeof first === "string") {
    return {
      purchaseId: cleanText(first),
      input: (second && typeof second === "object" ? second : {}) as SaveSupplierPurchasePaymentInput,
      branchId: cleanText(third) || null,
    }
  }

  const input = (first && typeof first === "object" ? first : {}) as SaveSupplierPurchasePaymentInput
  return {
    purchaseId: cleanText(input.supplierPurchaseId || input.purchaseId),
    input,
    branchId: cleanText(second) || null,
  }
}

export async function getSupplierPurchasePayments(
  purchaseId: string,
  branchId?: string | null,
): Promise<SupplierPurchasePayment[]> {
  const cleanPurchaseId = cleanText(purchaseId)
  if (!cleanPurchaseId) return []

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("supplier_purchase_payments")
    .select("*")
    .eq("purchase_id", cleanPurchaseId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapSupplierPurchasePayment(raw as PaymentRow))
}

// Abonos a proveedores dentro de un rango de fechas (para el cierre de caja:
// "salidas a proveedores del día"). Filtra por sucursal; no depende de un
// purchase_id concreto. dateFrom/dateTo son YYYY-MM-DD inclusivos.
export async function getSupplierPurchasePaymentsInRange(
  branchId: string | null | undefined,
  range: { dateFrom?: string; dateTo?: string } = {},
): Promise<SupplierPurchasePayment[]> {
  const dateFrom = cleanText(range.dateFrom)
  const dateTo = cleanText(range.dateTo)

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("supplier_purchase_payments")
    .select("*")
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)
  if (dateFrom) query = query.gte("payment_date", dateFrom)
  if (dateTo) query = query.lte("payment_date", dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapSupplierPurchasePayment(raw as PaymentRow))
}

// Tolerancia de centavos para comparar montos (evita rechazos por redondeo).
const PAYMENT_OVERPAY_TOLERANCE = 0.01

export async function saveSupplierPurchasePayment(
  ...args: [string, SaveSupplierPurchasePaymentInput, string?] | [SaveSupplierPurchasePaymentInput, string?]
): Promise<{ payment: SupplierPurchasePayment; purchase: SupplierPurchase }> {
  const { purchaseId, input, branchId } = buildSupplierPurchasePaymentArgs(args)
  if (!purchaseId) throw new Error("Compra de proveedor inválida")

  const amountUSD = num(input.amountUSD)
  const amountVES = num(input.amountVES)
  if (amountUSD <= 0 && amountVES <= 0) {
    throw new Error("Indica un monto pagado mayor a cero")
  }

  // Validación de cuentas por pagar: el abono no puede superar lo pendiente.
  // Se valida por moneda (la compra define cuánto se debe en USD y en VES) y se
  // exige pagar en la moneda de la compra, así no se sobrepaga vía conversión.
  const purchase = await purchaseStore.getSupplierPurchaseById(purchaseId, branchId)
  if (!purchase) throw new Error("Compra de proveedor no encontrada")

  if (amountUSD > 0 && purchase.totalUSD <= 0) {
    throw new Error("Esta compra no tiene monto en dólares; registra el pago en bolívares.")
  }
  if (amountVES > 0 && purchase.totalVES <= 0) {
    throw new Error("Esta compra no tiene monto en bolívares; registra el pago en dólares.")
  }
  if (amountUSD > purchase.pendingUSD + PAYMENT_OVERPAY_TOLERANCE) {
    throw new Error(
      `El pago en dólares supera lo pendiente (quedan $${purchase.pendingUSD.toFixed(2)}).`,
    )
  }
  if (amountVES > purchase.pendingVES + PAYMENT_OVERPAY_TOLERANCE) {
    throw new Error(
      `El pago en bolívares supera lo pendiente (quedan Bs ${purchase.pendingVES.toFixed(2)}).`,
    )
  }

  const supabase = getSupabaseAdmin()
  // La PK `id` no tiene default en la tabla: se genera aquí. Las columnas reales
  // son purchase_id y method (no supplier_purchase_id / payment_method).
  const payload = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    branch_id: branchId || null,
    purchase_id: purchaseId,
    supplier_id: purchase.supplierId,
    supplier_name: purchase.supplierName,
    payment_date: input.paymentDate || new Date().toISOString().slice(0, 10),
    amount_usd: amountUSD,
    amount_ves: amountVES,
    method: cleanText(input.paymentMethod),
    reference: cleanText(input.reference),
    note: cleanText(input.note),
  }

  const { data, error } = await supabase
    .from("supplier_purchase_payments")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const payment = mapSupplierPurchasePayment(data as PaymentRow)
  // Devolvemos la compra recalculada (pagado/pendiente/estado) tras el abono.
  const updatedPurchase = (await purchaseStore.getSupplierPurchaseById(purchaseId, branchId)) ?? purchase

  return { payment, purchase: updatedPurchase }
}
