import * as store from "./ordersStorePackages"
import type { HotelPackage, SavePackageInput } from "./ordersStorePackages"

export type { HotelPackage, SavePackageInput }

export async function getPackages(branchId?: string | null): Promise<HotelPackage[]> {
  return store.getPackages(branchId)
}

export async function savePackage(input: SavePackageInput, branchId?: string | null): Promise<HotelPackage> {
  return store.savePackage(input, branchId)
}

export async function deletePackage(id: string, branchId?: string | null) {
  return store.deletePackage(id, branchId)
}
