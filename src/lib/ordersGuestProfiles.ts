import * as store from "./ordersStoreGuestProfiles"
import type { GuestProfile, SaveGuestProfileInput } from "./ordersStoreGuestProfiles"

export type { GuestProfile, SaveGuestProfileInput }

export async function getGuestProfiles(branchId?: string | null): Promise<GuestProfile[]> {
  return store.getGuestProfiles(branchId)
}

export async function saveGuestProfile(input: SaveGuestProfileInput, branchId?: string | null): Promise<GuestProfile> {
  return store.saveGuestProfile(input, branchId)
}

export async function deleteGuestProfile(id: string, branchId?: string | null) {
  return store.deleteGuestProfile(id, branchId)
}
