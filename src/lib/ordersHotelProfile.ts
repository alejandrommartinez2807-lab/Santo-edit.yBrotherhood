import * as store from "./ordersStoreHotelProfile"
import type { HotelProfile, SaveHotelProfileInput } from "./ordersStoreHotelProfile"

export type { HotelProfile, SaveHotelProfileInput }

export async function getHotelProfile(branchId?: string | null): Promise<HotelProfile> {
  return store.getHotelProfile(branchId)
}

export async function saveHotelProfile(input: SaveHotelProfileInput, branchId?: string | null): Promise<HotelProfile> {
  return store.saveHotelProfile(input, branchId)
}
