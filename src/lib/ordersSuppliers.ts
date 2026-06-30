import type { Supplier } from "@/types/localOrders"

import * as supplierStore from "./ordersStoreSuppliers"
import type { SaveSupplierInput } from "./ordersStoreSuppliers"

export type { SaveSupplierInput }

export async function getSuppliers(branchId?: string | null): Promise<Supplier[]> {
  return supplierStore.getSuppliers(branchId)
}

export async function saveSupplier(
  input: SaveSupplierInput,
  branchId?: string | null,
): Promise<Supplier> {
  return supplierStore.saveSupplier(input, branchId)
}

export async function deleteSupplier(id: string, branchId?: string | null) {
  return supplierStore.deleteSupplier(id, branchId)
}
