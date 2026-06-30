import type {
  CreateOpenAccountInput,
  OpenAccountStatus,
  UpdateOpenAccountInput,
} from "@/types/localOrders"

import * as openAccountStore from "./ordersStoreOpenAccounts"

export async function getOpenAccounts(
  options: { status?: OpenAccountStatus | "all" } = {},
  branchId?: string | null,
) {
  return openAccountStore.getOpenAccounts(options, branchId)
}

export async function createOpenAccount(
  input: CreateOpenAccountInput,
  branchId?: string | null,
) {
  return openAccountStore.createOpenAccount(input, branchId)
}

export async function attachOrderToOpenAccount(
  accountId: string,
  orderId: string,
  branchId?: string | null,
) {
  return openAccountStore.attachOrderToOpenAccount(accountId, orderId, branchId)
}

export async function closeOpenAccount(
  accountId: string,
  input: UpdateOpenAccountInput = {},
  branchId?: string | null,
) {
  return openAccountStore.closeOpenAccount(accountId, input, branchId)
}
