import * as store from "./ordersStoreRateRestrictions"
import type { RateRestriction, SaveRateRestrictionInput } from "./ordersStoreRateRestrictions"

export type { RateRestriction, SaveRateRestrictionInput }

export async function getRateRestrictions(branchId?: string | null): Promise<RateRestriction[]> {
  return store.getRateRestrictions(branchId)
}

export async function saveRateRestriction(
  input: SaveRateRestrictionInput,
  branchId?: string | null,
): Promise<RateRestriction> {
  return store.saveRateRestriction(input, branchId)
}

export async function deleteRateRestriction(id: string, branchId?: string | null) {
  return store.deleteRateRestriction(id, branchId)
}
