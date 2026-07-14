import * as store from "./ordersStoreInvoices"
import type { CreateInvoiceInput, Invoice } from "./ordersStoreInvoices"

export type { CreateInvoiceInput, Invoice }

export async function getInvoices(branchId?: string | null): Promise<Invoice[]> {
  return store.getInvoices(branchId)
}

export async function createInvoice(input: CreateInvoiceInput, branchId?: string | null): Promise<Invoice> {
  return store.createInvoice(input, branchId)
}
