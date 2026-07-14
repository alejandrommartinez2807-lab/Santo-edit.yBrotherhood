import * as store from "./ordersStoreBusinessDays"
import type { BusinessDay, CloseBusinessDayInput } from "./ordersStoreBusinessDays"

export type { BusinessDay, CloseBusinessDayInput }

export async function getBusinessDays(branchId?: string | null): Promise<BusinessDay[]> {
  return store.getBusinessDays(branchId)
}

export async function closeBusinessDay(input: CloseBusinessDayInput, branchId?: string | null): Promise<BusinessDay> {
  return store.closeBusinessDay(input, branchId)
}
