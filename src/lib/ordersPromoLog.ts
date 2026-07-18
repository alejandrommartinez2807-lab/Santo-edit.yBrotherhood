import * as store from "./ordersStorePromoLog"
import type { PromoLogEntry, LogPromoInput } from "./ordersStorePromoLog"

export type { PromoLogEntry, LogPromoInput }
export { promoKeyOf } from "./ordersStorePromoLog"

export async function logPromoSend(
  input: LogPromoInput,
  branchId?: string | null,
): Promise<{ inserted: boolean }> {
  return store.logPromoSend(input, branchId)
}

export async function getSentPromoKeys(
  branchId?: string | null,
  limit?: number,
): Promise<Set<string>> {
  return store.getSentPromoKeys(branchId, limit)
}

export async function getRecentPromoLog(
  branchId?: string | null,
  limit?: number,
): Promise<PromoLogEntry[]> {
  return store.getRecentPromoLog(branchId, limit)
}
