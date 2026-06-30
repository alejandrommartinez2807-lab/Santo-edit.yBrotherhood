import type { SupplierPurchase, SupplierPurchasePayment } from "@/types/localOrders"

import * as purchaseStore from "./ordersStoreSupplierPurchases"
import type {
  GetSupplierPurchasesOptions,
  SaveSupplierPurchaseInput,
  SaveSupplierPurchasePaymentInput,
  UpdateSupplierPurchaseInput,
} from "./ordersStoreSupplierPurchases"

export type {
  GetSupplierPurchasesOptions,
  SaveSupplierPurchaseInput,
  SaveSupplierPurchasePaymentInput,
  SupplierPurchasePayment,
  UpdateSupplierPurchaseInput,
}

export async function getSupplierPurchases(
  branchId?: string | null,
  supplierId?: string | null,
  options?: GetSupplierPurchasesOptions,
): Promise<SupplierPurchase[]> {
  return purchaseStore.getSupplierPurchases(branchId, supplierId, options)
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

export async function getSupplierPurchasePayments(
  purchaseId: string,
  branchId?: string | null,
): Promise<SupplierPurchasePayment[]> {
  return purchaseStore.getSupplierPurchasePayments(purchaseId, branchId)
}

export async function saveSupplierPurchasePayment(
  purchaseId: string,
  input: SaveSupplierPurchasePaymentInput,
  branchId?: string | null,
): Promise<{ payment: SupplierPurchasePayment; purchase: SupplierPurchase }> {
  return purchaseStore.saveSupplierPurchasePayment(purchaseId, input, branchId)
}
