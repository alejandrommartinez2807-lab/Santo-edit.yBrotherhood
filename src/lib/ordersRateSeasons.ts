import * as store from "./ordersStoreRateSeasons"
import type { RateSeason, SaveRateSeasonInput } from "./ordersStoreRateSeasons"

export type { RateSeason, SaveRateSeasonInput }

export async function getRateSeasons(branchId?: string | null): Promise<RateSeason[]> {
  return store.getRateSeasons(branchId)
}

export async function saveRateSeason(
  input: SaveRateSeasonInput,
  branchId?: string | null,
): Promise<RateSeason> {
  return store.saveRateSeason(input, branchId)
}

export async function deleteRateSeason(id: string, branchId?: string | null) {
  return store.deleteRateSeason(id, branchId)
}
