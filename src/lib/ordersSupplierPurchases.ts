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
    paymentMethod: cleanText(raw.payment_method),
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
    .eq("supplier_purchase_id", cleanPurchaseId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => mapSupplierPurchasePayment(raw as PaymentRow))
}

export async function saveSupplierPurchasePayment(
  ...args: [string, SaveSupplierPurchasePaymentInput, string?] | [SaveSupplierPurchasePaymentInput, string?]
): Promise<SupplierPurchasePayment> {
  const { purchaseId, input, branchId } = buildSupplierPurchasePaymentArgs(args)
  if (!purchaseId) throw new Error("Compra de proveedor inválida")

  const supabase = getSupabaseAdmin()
  const payload = {
    branch_id: branchId || null,
    supplier_purchase_id: purchaseId,
    payment_date: input.paymentDate || new Date().toISOString().slice(0, 10),
    amount_usd: num(input.amountUSD),
    amount_ves: num(input.amountVES),
    payment_method: cleanText(input.paymentMethod),
    reference: cleanText(input.reference),
    note: cleanText(input.note),
  }

  const { data, error } = await supabase
    .from("supplier_purchase_payments")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSupplierPurchasePayment(data as PaymentRow)
}
